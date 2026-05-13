import xlsx from "xlsx";
import mongoose from "mongoose";

import { Acquirer } from "../models/acquirer.model.js";
import { Wiresheet } from "../models/wiresheet.model.js";
import { MerchantAccount } from "../models/merchant-account.model.js";
import { WiresheetTransaction } from "../models/wiresheet-transaction.model.js";
import { Payment } from "../models/payment.model.js";
import { UnmatchedPayment } from "../models/unmatchedPayment.model.js";
import { InvalidPaymentRow } from "../models/invalid-payment-row.model.js";

import {
  derivePaymentMethod,
  deriveSettlementStatus,
  roundMoney,
} from "../utils/currencyUtils.js";

import {
  parseSheetDate,
  startOfDay,
  endOfDay,
  parseFlexibleSheetDate,
} from "../utils/dateUtils.js";
import {
  canonicalizeBankName,
  isSameBankName,
} from "../utils/bankNameUtils.js";

// converts excel amount to numbers
const parseSheetNumber = (value) => {
  if (value === null || value === undefined) return 0;

  const normalized = String(value)
    .replace(/,/g, "")
    .replace(/[^0-9.-]/g, "")
    .trim();

  if (
    !normalized ||
    normalized === "-" ||
    normalized === "." ||
    normalized === "-."
  ) {
    return 0;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

// Missing field checker from payment rows if date not present then
const getMissingFields = (row) => {
  const missing = [];

  if (!row.bank) missing.push("BANK");
  if (!row.merchantName) missing.push("MERCHANT NAME");
  if (!row.mid) missing.push("MID / MID NO");
  if (!row.startDate) missing.push("START DATE / FIRST DATE");
  if (!row.endDate) missing.push("END DATE");
  if (!row.processingCurrency) missing.push("PROCESSING CURRENCY / CURRENCY");
  if (row.amountPaid === 0) missing.push("AMOUNT");

  return missing;
};

// //This cleans text.

// Example:

// " merchant   name " → "MERCHANT NAME"
const normalizeText = (value) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();

// Example:

// " merchant   name " → "MERCHANT NAME"
const normalizeMerchantName = (value) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();

// This currently requires exact merchant match after cleaning.

// Example:

// Cyberpay2 == cyberpay2 ✅
// Cyberpay2 != Cyberpay 2 ❌

const isMerchantMatch = (left, right) => {
  const a = normalizeMerchantName(left);
  const b = normalizeMerchantName(right);

  return a === b;
};

// This normalizes Excel column names.

// Example:

// " merchant name " → "MERCHANT NAME"
// " Start Date " → "START DATE"
const normalizeHeader = (key) =>
  String(key || "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();

//This turns dates into stable strings for duplicate keys.
const normalizeDateTime = (date) => {
  if (!date) return "";
  return new Date(date).toISOString();
};

// This checks exact date/time equality.

// Important: this is strict. Your wiresheet date like:

// 2026-04-03T03:30:00

// must exactly equal payment date. That may cause unmatched rows.
const isSameMoment = (left, right) => {
  if (!left || !right) return false;

  return new Date(left).getTime() === new Date(right).getTime();
};

// This tries to read date from filename.
// Example:
// 02.04 Payments.xlsx → 02.04
const extractPaymentDateFromFileName = (fileName = "") => {
  const nameWithoutExt = fileName.replace(/\.[^/.]+$/, "");

  const match = nameWithoutExt.match(
    /(\d{1,2})[.\-_/](\d{1,2})(?:[.\-_/](\d{2,4}))?/,
  );

  if (!match) return null;

  const [, day, month, year] = match;

  const fullYear = year
    ? year.length === 2
      ? 2000 + Number(year)
      : Number(year)
    : new Date().getUTCFullYear();

  const parsedDate = new Date(
    Date.UTC(fullYear, Number(month) - 1, Number(day)),
  );

  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
};

// This makes label like:

// 02.04
// 14.04

// Used for reporting/display.
const formatPaymentSheetDateLabel = (date) => {
  if (!date) return "";

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) return "";

  return `${String(parsedDate.getUTCDate()).padStart(2, "0")}.${String(
    parsedDate.getUTCMonth() + 1,
  ).padStart(2, "0")}`;
};

// Example:

// getValue(row, ["MID", "MID NO"])

// Means:

// Use MID if exists, otherwise MID NO

const getValue = (row, keys) => {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== "") {
      return row[key];
    }
  }

  return "";
};

// Excel parsing
const parseWorkbookSheets = (buffer) => {
  const workbook = xlsx.read(buffer, {
    type: "buffer",
    cellDates: true,
  });

  return workbook.SheetNames.map((sheetName) => {
    const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], {
      defval: "",
      raw: false,
    });

    return {
      sheetName,
      rows: rows.map((row, index) => {
        const normalizedRow = {};

        for (const [key, value] of Object.entries(row)) {
          normalizedRow[normalizeHeader(key)] = value;
        }

        normalizedRow.__excelRowNumber = index + 2;

        return normalizedRow;
      }),
    };
  });
};

//This converts raw Excel row into your internal standard row.
const normalizePaymentRow = ({
  row,
  sheetName,
  paymentDate,
  paymentSheetDateLabel,
  originalFilename,
}) => {
  const lowerSheetName = sheetName.toLowerCase();

  const isCryptoSheet = lowerSheetName.includes("crypto");
  const isWireSheet = lowerSheetName.includes("wire");

  const bank = normalizeText(getValue(row, ["BANK"]));

  const merchantName = normalizeText(getValue(row, ["MERCHANT NAME"]));

  const mid = String(getValue(row, ["MID", "MID NO"])).trim();

  const startDate = parseFlexibleSheetDate(
    getValue(row, ["START DATE", "FIRST DATE"]),
  );

  const endDate = parseFlexibleSheetDate(getValue(row, ["END DATE"]));
  const processingCurrency = normalizeText(
    getValue(row, ["PROCESSING CURRENCY", "CURRENCY"]),
  );

  const amountPaid = parseSheetNumber(getValue(row, ["AMOUNT", "PAID AMOUNT"]));

  const paymentRate = parseSheetNumber(getValue(row, ["RATE"]));

  const settlementCurrency = normalizeText(
    getValue(row, ["SETTLEMENT CURRENCY"]),
  );

  const wireSettlementAmount = parseSheetNumber(
    getValue(row, ["AMOUNT IN EURO", "AMOUNT IN EUR"]),
  );

  const cryptoSettlementAmount = parseSheetNumber(getValue(row, ["USDT"]));

  const settlementAmount = isCryptoSheet
    ? cryptoSettlementAmount
    : isWireSheet
      ? wireSettlementAmount
      : wireSettlementAmount || cryptoSettlementAmount;

  const reference = String(
    getValue(row, [
      "HASH PAYMENT / WIRE REFERENCE",
      "HASH PAYMENT",
      "WIRE REFERENCE",
      "REFERENCE",
      "REFERENCE NO",
    ]),
  ).trim();

  const paymentMethod = settlementCurrency
    ? derivePaymentMethod(settlementCurrency)
    : isCryptoSheet
      ? "CRYPTO"
      : isWireSheet
        ? "WIRE"
        : "UNKNOWN";

  return {
    excelRowNumber: row.__excelRowNumber,
    bank,
    merchantName,
    mid,
    startDate,
    endDate,
    processingCurrency,
    amountPaid,
    paymentRate,
    settlementCurrency,
    settlementAmount,
    paymentMethod,
    paymentDate,
    paidToMerchantDate: paymentDate,
    paymentSheetDateLabel,
    hashPayment: paymentMethod === "CRYPTO" ? reference : "",
    referenceNo: paymentMethod === "WIRE" ? reference : "",
    reference,
    sheetName,
    originalFilename,
  };
};

const isBlankOrTotalRow = (rawRow) => {
  const values = Object.values(rawRow || {}).map((value) =>
    String(value || "").trim(),
  );

  const nonEmptyValues = values.filter(Boolean);

  if (!nonEmptyValues.length) return true;

  const joined = nonEmptyValues.join(" ").toUpperCase();

  if (
    joined.includes("TOTAL") ||
    joined.includes("SUM") ||
    joined.includes("GRAND TOTAL")
  ) {
    return true;
  }

  const hasBank = Boolean(getValue(rawRow, ["BANK"]));
  const hasMerchant = Boolean(getValue(rawRow, ["MERCHANT NAME"]));
  const hasMid = Boolean(getValue(rawRow, ["MID", "MID NO"]));
  const hasStartDate = Boolean(getValue(rawRow, ["START DATE", "FIRST DATE"]));
  const hasEndDate = Boolean(getValue(rawRow, ["END DATE"]));

  if (!hasBank && !hasMerchant && !hasMid && !hasStartDate && !hasEndDate) {
    return true;
  }

  return false;
};

//Normalize all rows from one file
const normalizePaymentUploadRows = ({
  fileBuffer,
  paymentDate,
  originalFilename,
}) => {
  const sheets = parseWorkbookSheets(fileBuffer);

  const allValidRows = [];
  const allInvalidRows = [];

  for (const { sheetName, rows } of sheets) {
    const finalPaymentDate =
      paymentDate ||
      extractPaymentDateFromFileName(originalFilename) ||
      new Date();

    const paymentSheetDateLabel = formatPaymentSheetDateLabel(finalPaymentDate);

    for (const rawRow of rows) {
      if (isBlankOrTotalRow(rawRow)) {
        continue;
      }

      const row = normalizePaymentRow({
        row: rawRow,
        sheetName,
        paymentDate: parseSheetDate(finalPaymentDate),
        paymentSheetDateLabel,
        originalFilename,
      });

      const missingFields = getMissingFields(row);

      if (missingFields.length) {
        allInvalidRows.push({
          sheetName: row.sheetName,
          excelRowNumber: row.excelRowNumber,
          rawRow,
          normalizedRow: row,
          missingFields,
          message: `${row.sheetName} row ${row.excelRowNumber} is missing: ${missingFields.join(", ")}`,
          paymentSheetDate: parseSheetDate(finalPaymentDate),
          paymentSheetDateLabel,
        });
        continue;
      }

      allValidRows.push(row);
    }
  }

  return {
    validRows: allValidRows,
    invalidRows: allInvalidRows,
  };
};

//This creates a unique key for unmatched rows, so the same unmatched row is not inserted again.
const buildUnmatchedPaymentIdentityKey = ({
  paymentBank,
  merchantName,
  paidToMerchantDate,
  sourceMid,
  sourceStartDate,
  sourceEndDate,
  sourceProcessingCurrency,
  paymentCurrency,
  amountPaid,
  settlementAmount,
}) =>
  [
    canonicalizeBankName(paymentBank),
    normalizeMerchantName(merchantName),
    String(sourceMid || "").trim(),
    normalizeDateTime(paidToMerchantDate),
    normalizeDateTime(sourceStartDate),
    normalizeDateTime(sourceEndDate),
    String(sourceProcessingCurrency || "")
      .trim()
      .toUpperCase(),
    String(paymentCurrency || "")
      .trim()
      .toUpperCase(),
    roundMoney(amountPaid),
    roundMoney(settlementAmount),
  ].join("|");

const getRowIdentityKey = (row) =>
  row.rowIdentityKey ||
  buildUnmatchedPaymentIdentityKey({
    paymentBank: row.bank,
    merchantName: row.merchantName,
    paidToMerchantDate: row.paymentDate,
    sourceMid: row.mid,
    sourceStartDate: row.startDate,
    sourceEndDate: row.endDate,
    sourceProcessingCurrency: row.processingCurrency,
    paymentCurrency: row.settlementCurrency,
    amountPaid: row.amountPaid,
    settlementAmount: row.settlementAmount,
  });

const buildBankAcquirerMap = async (rows) => {
  const banks = [
    ...new Set(
      rows.map((row) => canonicalizeBankName(row.bank)).filter(Boolean),
    ),
  ];

  const acquirers = await Acquirer.find({}, { _id: 1, name: 1 }).lean();

  const bankAcquirerMap = new Map();

  for (const bank of banks) {
    const matchedAcquirerIds = acquirers
      .filter((acquirer) => isSameBankName(acquirer.name, bank))
      .map((acquirer) => acquirer._id.toString());

    bankAcquirerMap.set(bank, matchedAcquirerIds);
  }

  return bankAcquirerMap;
};

// This finds MerchantAccount records using:

// MID + acquirerId

// Because WiresheetTransaction stores:

// merchantMappingId

// So code needs to know which mapping IDs can match each payment row.
const buildMerchantAccountLookup = async ({ rows, bankAcquirerMap }) => {
  const mids = [...new Set(rows.map((row) => row.mid).filter(Boolean))];

  const acquirerIds = [...new Set([...bankAcquirerMap.values()].flat())];

  if (!mids.length || !acquirerIds.length) {
    return {
      accountIdsByRowKey: new Map(),
      allAccountIds: [],
    };
  }

  const merchantAccounts = await MerchantAccount.find(
    {
      mid: { $in: mids },
      acquirerId: { $in: acquirerIds },
    },
    {
      _id: 1,
      mid: 1,
      acquirerId: 1,
    },
  ).lean();

  const accountsByMidAcquirer = new Map(
    merchantAccounts.map((account) => [
      `${account.mid}:${account.acquirerId.toString()}`,
      account._id.toString(),
    ]),
  );

  const accountIdsByRowKey = new Map();

  for (const row of rows) {
    const bankKey = canonicalizeBankName(row.bank);
    const acquirerIdsForBank = bankAcquirerMap.get(bankKey) || [];

    accountIdsByRowKey.set(
      `${bankKey}:${row.mid}`,
      acquirerIdsForBank
        .map((acquirerId) =>
          accountsByMidAcquirer.get(`${row.mid}:${acquirerId}`),
        )
        .filter(Boolean),
    );
  }

  return {
    accountIdsByRowKey,
    allAccountIds: [
      ...new Set(merchantAccounts.map((account) => account._id.toString())),
    ],
  };
};

const buildTransactionIndex = async ({ rows, allAccountIds }) => {
  if (!allAccountIds.length) return new Map();

  const mids = [...new Set(rows.map((row) => row.mid).filter(Boolean))];

  const parsedStartDates = rows.map((row) => row.startDate).filter(Boolean);
  const parsedEndDates = rows.map((row) => row.endDate).filter(Boolean);

  const query = {
    merchantMappingId: {
      $in: allAccountIds.map((id) => new mongoose.Types.ObjectId(id)),
    },
    mid: { $in: mids },
  };

  if (parsedStartDates.length && parsedEndDates.length) {
    const minStartDate = new Date(
      Math.min(...parsedStartDates.map((date) => date.getTime())),
    );

    const maxEndDate = new Date(
      Math.max(...parsedEndDates.map((date) => date.getTime())),
    );

    query.startDate = { $lte: endOfDay(maxEndDate) };
    query.endDate = { $gte: startOfDay(minStartDate) };
  }

  const transactions = await WiresheetTransaction.find(query).lean();

  const transactionsByMid = new Map();

  for (const transaction of transactions) {
    const key = transaction.mid;

    if (!transactionsByMid.has(key)) {
      transactionsByMid.set(key, []);
    }

    transactionsByMid.get(key).push({
      ...transaction,
      _id: transaction._id.toString(),
      merchantMappingId: transaction.merchantMappingId.toString(),
      wiresheetId: transaction.wiresheetId.toString(),
    });
  }

  return transactionsByMid;
};

const scoreTransactionMatch = (transaction, row) => {
  let score = 0;

  if (transaction.processingCurrency === row.processingCurrency) {
    score += 100;
  }

  if (isMerchantMatch(transaction.merchantName, row.merchantName)) {
    score += 75;
  } else {
    return -1000;
  }

  const amountDiff = Math.abs(
    roundMoney(transaction.processingAmount) - roundMoney(row.amountPaid),
  );

  if (amountDiff === 0) {
    score += 50;
  } else {
    score -= Math.min(50, Math.floor(amountDiff));
  }

  const startDiff = Math.abs(
    new Date(transaction.startDate).getTime() - row.startDate.getTime(),
  );

  const endDiff = Math.abs(
    new Date(transaction.endDate).getTime() - row.endDate.getTime(),
  );

  score -= Math.floor(startDiff / (1000 * 60 * 60));
  score -= Math.floor(endDiff / (1000 * 60 * 60));

  return score;
};

const findMatchingWiresheetTransaction = ({
  row,
  candidateTransactions,
  candidateAccountIds,
}) => {
  if (!candidateTransactions?.length || !candidateAccountIds?.length) {
    return null;
  }

  const matches = candidateTransactions.filter((transaction) => {
    if (!candidateAccountIds.includes(transaction.merchantMappingId)) {
      return false;
    }

    if (transaction.mid !== row.mid) {
      return false;
    }

    if (
      normalizeMerchantName(transaction.merchantName) !==
      normalizeMerchantName(row.merchantName)
    ) {
      return false;
    }

    if (transaction.processingCurrency !== row.processingCurrency) {
      return false;
    }

    if (!isSameMoment(transaction.startDate, row.startDate)) {
      return false;
    }

    if (!isSameMoment(transaction.endDate, row.endDate)) {
      return false;
    }

    return true;
  });

  if (!matches.length) return null;

  matches.sort(
    (left, right) =>
      scoreTransactionMatch(right, row) - scoreTransactionMatch(left, row),
  );

  return matches[0];
};

const matchRowsToTransactions = async ({ rows }) => {
  const bankAcquirerMap = await buildBankAcquirerMap(rows);

  const { accountIdsByRowKey, allAccountIds } =
    await buildMerchantAccountLookup({
      rows,
      bankAcquirerMap,
    });

  const transactionsByMid = await buildTransactionIndex({
    rows,
    allAccountIds,
  });

  const matchedRows = [];
  const skippedRows = [];

  for (const row of rows) {
    const rowBankKey = canonicalizeBankName(row.bank);

    const candidateAccountIds =
      accountIdsByRowKey.get(`${rowBankKey}:${row.mid}`) || [];

    const transaction = findMatchingWiresheetTransaction({
      row,
      candidateTransactions: transactionsByMid.get(row.mid) || [],
      candidateAccountIds,
    });

    if (!transaction) {
      skippedRows.push({
        row,
        reason: "wiresheet_transaction_not_found",
      });
      continue;
    }

    matchedRows.push({
      row,
      transaction,
    });
  }

  return {
    matchedRows,
    skippedRows,
  };
};

//recalculateTransactionAndWiresheetTotals

const recalculateTransactionAndWiresheetTotals = async (transactionIds) => {
  const cleanTransactionIds = [
    ...new Set(transactionIds.map((id) => id.toString())),
  ].map((id) => new mongoose.Types.ObjectId(id));

  if (!cleanTransactionIds.length) return 0;

  const paymentTotals = await Payment.aggregate([
    {
      $match: {
        wiresheetTransactionId: { $in: cleanTransactionIds },
      },
    },
    {
      $group: {
        _id: "$wiresheetTransactionId",
        totalPaid: { $sum: "$amountPaid" },
      },
    },
  ]);

  const totalMap = new Map(
    paymentTotals.map((item) => [
      item._id.toString(),
      roundMoney(item.totalPaid),
    ]),
  );

  const transactions = await WiresheetTransaction.find({
    _id: { $in: cleanTransactionIds },
  }).lean();

  const bulkUpdates = transactions.map((transaction) => {
    const paid = totalMap.get(transaction._id.toString()) || 0;
    const payable = roundMoney(transaction.payable || 0);
    const balance = roundMoney(payable - paid);

    return {
      updateOne: {
        filter: { _id: transaction._id },
        update: {
          $set: {
            paid,
            balance,
            status: deriveSettlementStatus({ payable, paid }),
          },
        },
      },
    };
  });

  if (bulkUpdates.length) {
    await WiresheetTransaction.bulkWrite(bulkUpdates);
  }

  const wiresheetIds = [
    ...new Set(transactions.map((item) => item.wiresheetId.toString())),
  ];

  const wiresheetTotals = await WiresheetTransaction.aggregate([
    {
      $match: {
        wiresheetId: {
          $in: wiresheetIds.map((id) => new mongoose.Types.ObjectId(id)),
        },
      },
    },
    {
      $group: {
        _id: "$wiresheetId",
        totalPayable: { $sum: "$payable" },
        totalPaid: { $sum: "$paid" },
        totalBalance: { $sum: "$balance" },
      },
    },
  ]);

  if (wiresheetTotals.length) {
    await Wiresheet.bulkWrite(
      wiresheetTotals.map((item) => {
        const totalPayable = roundMoney(item.totalPayable);
        const totalPaid = roundMoney(item.totalPaid);
        const totalBalance = roundMoney(item.totalBalance);

        return {
          updateOne: {
            filter: { _id: item._id },
            update: {
              $set: {
                totalPayable,
                totalPaid,
                totalBalance,
                status:
                  totalPaid <= 0
                    ? "pending"
                    : totalBalance > 0
                      ? "partially_paid"
                      : "settled",
              },
            },
          },
        };
      }),
    );
  }

  return wiresheetIds.length;
};

// buildmatch
const buildSafePaymentKey = ({
  bank,
  merchantName,
  mid,
  startDate,
  endDate,
  processingCurrency,
  settlementCurrency,
  paymentDate,
  amountPaid,
  settlementAmount,
}) =>
  [
    canonicalizeBankName(bank),
    normalizeMerchantName(merchantName),
    String(mid || "").trim(),
    normalizeDateTime(startDate),
    normalizeDateTime(endDate),
    normalizeText(processingCurrency),
    normalizeText(settlementCurrency),
    normalizeDateTime(paymentDate),
    roundMoney(amountPaid),
    roundMoney(settlementAmount),
  ].join("|");

// Doing Match + Duplicate
const persistMatchedRows = async ({ matchedRows, userId }) => {
  const duplicateRows = [];

  if (!matchedRows.length) {
    return {
      createdPayments: 0,
      updatedWiresheets: 0,
      reconciledCount: 0,
      duplicateCount: 0,
      duplicateRows: [],
    };
  }

  const transactionIds = [
    ...new Set(
      matchedRows.map(({ transaction }) => transaction._id.toString()),
    ),
  ];

  const existingPayments = await Payment.find({
    wiresheetTransactionId: {
      $in: transactionIds.map((id) => new mongoose.Types.ObjectId(id)),
    },
  }).lean();

  const existingPaymentMap = new Map();

  for (const payment of existingPayments) {
    const key = buildSafePaymentKey({
      bank: payment.paymentBank,
      merchantName: payment.merchantName,
      mid: payment.sourceMid,
      startDate: payment.sourceStartDate,
      endDate: payment.sourceEndDate,
      processingCurrency: payment.sourceProcessingCurrency,
      settlementCurrency: payment.settlementCurrency,
      paymentDate: payment.paymentDate,
      amountPaid: payment.amountPaid,
      settlementAmount: payment.settlementAmount,
    });

    existingPaymentMap.set(key, payment);
  }

  const paymentDocs = [];
  const unmatchedUpdates = [];
  const processedKeys = new Set();
  const now = new Date();

  for (const { row, transaction } of matchedRows) {
    const paymentDateValue = row.paymentDate || new Date();

    const paymentIdentityKey = buildSafePaymentKey({
      bank: row.bank,
      merchantName: row.merchantName,
      mid: row.mid,
      startDate: row.startDate,
      endDate: row.endDate,
      processingCurrency: row.processingCurrency,
      settlementCurrency: row.settlementCurrency,
      paymentDate: paymentDateValue,
      amountPaid: row.amountPaid,
      settlementAmount: row.settlementAmount,
    });

    if (processedKeys.has(paymentIdentityKey)) {
      duplicateRows.push({
        reason: "duplicate_in_file",
        sheetName: row.sheetName,
        excelRowNumber: row.excelRowNumber,
        bank: row.bank,
        merchantName: row.merchantName,
        mid: row.mid,
        startDate: row.startDate,
        endDate: row.endDate,
        processingCurrency: row.processingCurrency,
        settlementCurrency: row.settlementCurrency,
        amountPaid: row.amountPaid,
        settlementAmount: row.settlementAmount,
      });
      continue;
    }

    processedKeys.add(paymentIdentityKey);

    const existingPayment = existingPaymentMap.get(paymentIdentityKey);

    if (existingPayment) {
      duplicateRows.push({
        reason: "duplicate_payment_db",
        sheetName: row.sheetName,
        excelRowNumber: row.excelRowNumber,
        bank: row.bank,
        merchantName: row.merchantName,
        mid: row.mid,
        startDate: row.startDate,
        endDate: row.endDate,
        processingCurrency: row.processingCurrency,
        settlementCurrency: row.settlementCurrency,
        amountPaid: row.amountPaid,
        settlementAmount: row.settlementAmount,
      });

      continue;
    }

    paymentDocs.push({
      wiresheetTransactionId: transaction._id,
      merchantMappingId: transaction.merchantMappingId,

      paymentBank: row.bank,
      merchantName: row.merchantName,
      sourceMid: row.mid,
      sourceStartDate: row.startDate,
      sourceEndDate: row.endDate,
      sourceProcessingCurrency: row.processingCurrency,

      amountPaid: roundMoney(row.amountPaid),
      paymentRate: roundMoney(row.paymentRate),
      settlementCurrency: normalizeText(row.settlementCurrency),
      settlementAmount: roundMoney(row.settlementAmount),

      paymentMethod: row.paymentMethod,
      paymentDate: paymentDateValue,
      paidToMerchantDate: paymentDateValue,

      hashPayment: row.hashPayment,
      referenceNo: row.referenceNo,

      sourceSheetName: row.sheetName,
      sourceOriginalFilename: row.originalFilename,

      createdBy: userId,
    });

    unmatchedUpdates.push({
      updateOne: {
        filter: row.unmatchedPaymentId
          ? { _id: row.unmatchedPaymentId }
          : { rowIdentityKey: getRowIdentityKey(row) },
        update: {
          $set: {
            status: "reconciled",
            failureReason: "",
            wiresheetTransactionId: transaction._id,
            merchantMappingId: transaction.merchantMappingId,
            reconciledAt: now,
            lastReconciledAt: now,
            reconciledBy: userId,
          },
          ...(row.unmatchedPaymentId ? { $inc: { retryCount: 1 } } : {}),
        },
      },
    });
  }

  if (paymentDocs.length) {
    await Payment.insertMany(paymentDocs, { ordered: false });
  }

  if (unmatchedUpdates.length) {
    await UnmatchedPayment.bulkWrite(unmatchedUpdates);
  }

  const updatedWiresheets =
    await recalculateTransactionAndWiresheetTotals(transactionIds);

  return {
    createdPayments: paymentDocs.length,
    updatedWiresheets,
    reconciledCount: paymentDocs.length,
    duplicateCount: duplicateRows.length,
    duplicateRows,
  };
};

const storeUnmatchedRows = async ({
  skippedRows,
  userId,
  originalFilename,
}) => {
  if (!skippedRows.length) {
    return {
      storedCount: 0,
      pendingCount: await UnmatchedPayment.countDocuments({
        status: "pending_reconciliation",
      }),
    };
  }

  const operations = skippedRows.map(({ row, reason }) => ({
    updateOne: {
      filter: { rowIdentityKey: getRowIdentityKey(row) },
      update: {
        $set: {
          status: "pending_reconciliation",
          failureReason: reason,

          paymentBank: row.bank,
          merchantName: row.merchantName,
          sourceMid: row.mid,
          sourceStartDate: row.startDate,
          sourceEndDate: row.endDate,
          sourceProcessingCurrency: row.processingCurrency,

          amountPaid: roundMoney(row.amountPaid),
          settlementAmount: roundMoney(row.settlementAmount),

          settlementCurrency: normalizeText(row.settlementCurrency),
          paymentMethod: row.paymentMethod,

          paymentDate: row.paymentDate,
          paidToMerchantDate: row.paidToMerchantDate,
          paymentRate: roundMoney(row.paymentRate),

          paymentSheetDateLabel: row.paymentSheetDateLabel,
          hashPayment: row.hashPayment,
          referenceNo: row.referenceNo,

          sheetName: row.sheetName,
          originalFilename,
          wiresheetTransactionId: null,
          merchantMappingId: null,
          reconciledAt: null,
          reconciledBy: null,
        },
        $setOnInsert: {
          createdBy: userId,
        },
      },
      upsert: true,
    },
  }));

  await UnmatchedPayment.bulkWrite(operations);

  return {
    storedCount: skippedRows.length,
    pendingCount: await UnmatchedPayment.countDocuments({
      status: "pending_reconciliation",
    }),
  };
};

const toSkippedRowPayload = ({ row, reason }) => ({
  reason,
  sheetName: row.sheetName,
  bank: row.bank,
  merchantName: row.merchantName,
  mid: row.mid,
  processingCurrency: row.processingCurrency,
  settlementCurrency: row.settlementCurrency,
  startDate: row.startDate,
  endDate: row.endDate,
  amountPaid: roundMoney(row.amountPaid),
  settlementAmount: roundMoney(row.settlementAmount),
});

const buildUnmatchedSummary = async () => {
  const [pendingCount, recentRows] = await Promise.all([
    UnmatchedPayment.countDocuments({ status: "pending_reconciliation" }),
    UnmatchedPayment.find({ status: "pending_reconciliation" })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean(),
  ]);

  return {
    pendingCount,
    recentRows,
  };
};

const buildInvalidPaymentRowKey = ({
  originalFilename,
  sheetName,
  excelRowNumber,
  rawRow,
}) =>
  [
    originalFilename,
    sheetName,
    excelRowNumber,
    JSON.stringify(rawRow || {}),
  ].join("|");

const storeInvalidRows = async ({ invalidRows, userId, originalFilename }) => {
  if (!invalidRows.length) return 0;

  const operations = invalidRows.map((row) => ({
    updateOne: {
      filter: {
        rowIdentityKey: buildInvalidPaymentRowKey({
          originalFilename,
          sheetName: row.sheetName,
          excelRowNumber: row.excelRowNumber,
          rawRow: row.rawRow,
        }),
      },
      update: {
        $set: {
          sourceOriginalFilename: originalFilename,
          sourceSheetName: row.sheetName,
          excelRowNumber: row.excelRowNumber,
          rawRow: row.rawRow,
          normalizedRow: row.normalizedRow,
          missingFields: row.missingFields,
          failureReason: row.message,
          paymentSheetDate: row.paymentSheetDate,
          paymentSheetDateLabel: row.paymentSheetDateLabel,
          status: "pending_fix",
        },
        $setOnInsert: {
          createdBy: userId,
        },
      },
      upsert: true,
    },
  }));

  await InvalidPaymentRow.bulkWrite(operations);

  return invalidRows.length;
};

export const uploadPayments = async (req, res) => {
  const files = [...(req.files?.file || []), ...(req.files?.files || [])];

  if (!files.length) {
    return res.status(400).json({
      success: false,
      message: "At least one payment file is required",
    });
  }

  const results = [];

  for (const file of files) {
    try {
      const { validRows, invalidRows } = normalizePaymentUploadRows({
        fileBuffer: file.buffer,
        paymentDate: req.body?.paymentDate,
        originalFilename: file.originalname,
      });

      const storedInvalidRowsCount = await storeInvalidRows({
        invalidRows,
        userId: req.user._id,
        originalFilename: file.originalname,
      });

      if (!validRows.length) {
        results.push({
          fileName: file.originalname,
          success: false,
          message: "No valid payment rows found",
          invalidRows,
        });
        continue;
      }

      const { matchedRows, skippedRows } = await matchRowsToTransactions({
        rows: validRows,
      });

      const matchedResult = await persistMatchedRows({
        matchedRows,
        userId: req.user._id,
      });

      const unmatchedResult = await storeUnmatchedRows({
        skippedRows,
        userId: req.user._id,
        originalFilename: file.originalname,
      });

      results.push({
        fileName: file.originalname,
        success: true,
        totalRows: validRows.length + invalidRows.length,
        validRowsCount: validRows.length,
        invalidRowsCount: invalidRows.length,
        storedInvalidRowsCount,
        invalidRows,
        matchedCount: matchedRows.length,
        unmatchedCount: skippedRows.length,
        createdPayments: matchedResult.createdPayments,
        duplicateCount: matchedResult.duplicateCount,
        duplicateRows: matchedResult.duplicateRows,
        updatedWiresheets: matchedResult.updatedWiresheets,
        storedUnmatchedCount: unmatchedResult.storedCount,
        pendingUnmatchedCount: unmatchedResult.pendingCount,
        skippedRows: skippedRows.map(toSkippedRowPayload),
      });
    } catch (error) {
      results.push({
        fileName: file.originalname,
        success: false,
        message: error.message || "Payment file processing failed",
      });
    }
  }

  const failedCount = results.filter((item) => !item.success).length;
  const processedCount = results.filter((item) => item.success).length;

  return res.status(failedCount > 0 ? 207 : 201).json({
    success: true,
    message:
      failedCount > 0
        ? "Payment files processed with some issues"
        : "Payment files processed successfully",
    data: {
      totalFiles: files.length,
      processedCount,
      failedCount,

      results,
    },
  });
};

export const listPayments = async (_req, res) => {
  const data = await Payment.find()
    .populate("wiresheetTransactionId")
    .populate("merchantMappingId")
    .sort({ createdAt: -1 })
    .lean();

  return res.json({
    success: true,
    data,
  });
};

export const listUnmatchedPayments = async (_req, res) => {
  const data = await UnmatchedPayment.find().sort({ createdAt: -1 }).lean();

  return res.json({
    success: true,
    data,
  });
};

export const getUnmatchedPaymentsSummary = async (_req, res) => {
  const summary = await buildUnmatchedSummary();

  return res.json({
    success: true,
    data: summary,
  });
};

export const reconcilePendingPayments = async (req, res) => {
  const pendingRows = await UnmatchedPayment.find({
    status: "pending_reconciliation",
  })
    .sort({ createdAt: 1, _id: 1 })
    .lean();

  if (!pendingRows.length) {
    return res.json({
      success: true,
      message: "No pending unmatched payments found",
      data: {
        processedCount: 0,
        reconciledCount: 0,
        remainingCount: 0,
        updatedWiresheets: 0,
        summary: await buildUnmatchedSummary(),
      },
    });
  }

  const rows = pendingRows.map((row) => ({
    unmatchedPaymentId: row._id,
    rowIdentityKey: row.rowIdentityKey,
    bank: row.paymentBank,
    merchantName: row.merchantName,
    mid: row.sourceMid,
    startDate: row.sourceStartDate,
    endDate: row.sourceEndDate,
    processingCurrency: row.sourceProcessingCurrency,
    amountPaid: row.amountPaid,
    paymentRate: row.paymentRate,
    settlementCurrency: row.settlementCurrency,
    settlementAmount: row.settlementAmount,
    paymentMethod: row.paymentMethod,
    paymentDate: row.paymentDate || row.paidToMerchantDate,
    paidToMerchantDate: row.paidToMerchantDate || row.paymentDate,
    paymentSheetDateLabel: row.paymentSheetDateLabel,
    hashPayment: row.hashPayment,
    referenceNo: row.referenceNo,
    sheetName: row.sheetName,
    originalFilename: row.originalFilename,
  }));

  const { matchedRows, skippedRows } = await matchRowsToTransactions({
    rows,
  });

  const matchedResult = await persistMatchedRows({
    matchedRows,
    userId: req.user._id,
  });

  const now = new Date();

  const stillPendingUpdates = skippedRows
    .filter(({ row }) => row.unmatchedPaymentId)
    .map(({ row, reason }) => ({
      updateOne: {
        filter: { _id: row.unmatchedPaymentId },
        update: {
          $set: {
            status: "pending_reconciliation",
            failureReason: reason,
            lastReconciledAt: now,
          },
          $inc: { retryCount: 1 },
        },
      },
    }));

  if (stillPendingUpdates.length) {
    await UnmatchedPayment.bulkWrite(stillPendingUpdates);
  }

  const summary = await buildUnmatchedSummary();

  return res.json({
    success: true,
    message: "Pending payments reconciled successfully",
    data: {
      processedCount: pendingRows.length,
      reconciledCount: matchedResult.reconciledCount,
      remainingCount: summary.pendingCount,
      updatedWiresheets: matchedResult.updatedWiresheets,
      skippedCount: skippedRows.length,
      skippedRows: skippedRows.map(toSkippedRowPayload),
      summary,
    },
  });
};

export const reconcileInvalidPaymentRow = async (req, res) => {
  const invalidRow = await InvalidPaymentRow.findById(req.params.id);

  if (!invalidRow) {
    return res.status(404).json({
      success: false,
      message: "Invalid payment row not found",
    });
  }

  const mergedRawRow = {
    ...(invalidRow.rawRow || {}),
    ...(invalidRow.fixedData || {}),
    ...(req.body || {}),
  };

  const paymentDate =
    invalidRow.paymentSheetDate ||
    parseSheetDate(req.body.paymentSheetDate) ||
    new Date();

  const normalizedRow = normalizePaymentRow({
    row: {
      ...mergedRawRow,
      __excelRowNumber: invalidRow.excelRowNumber,
    },
    sheetName: invalidRow.sourceSheetName,
    paymentDate,
    paymentSheetDateLabel:
      invalidRow.paymentSheetDateLabel ||
      formatPaymentSheetDateLabel(paymentDate),
    originalFilename: invalidRow.sourceOriginalFilename,
  });

  const missingFields = getMissingFields(normalizedRow);

  if (missingFields.length) {
    invalidRow.rawRow = mergedRawRow;
    invalidRow.normalizedRow = normalizedRow;
    invalidRow.fixedData = {
      ...(invalidRow.fixedData || {}),
      ...(req.body || {}),
    };
    invalidRow.missingFields = missingFields;
    invalidRow.failureReason = `Still missing: ${missingFields.join(", ")}`;
    invalidRow.status = "pending_fix";
    invalidRow.fixedBy = req.user._id;

    await invalidRow.save();

    return res.status(400).json({
      success: false,
      message: invalidRow.failureReason,
      data: invalidRow,
    });
  }

  const { matchedRows, skippedRows } = await matchRowsToTransactions({
    rows: [normalizedRow],
  });

  if (matchedRows.length) {
    const result = await persistMatchedRows({
      matchedRows,
      userId: req.user._id,
    });

    invalidRow.status = "reconciled";
    invalidRow.normalizedRow = normalizedRow;
    invalidRow.fixedData = {
      ...(invalidRow.fixedData || {}),
      ...(req.body || {}),
    };
    invalidRow.missingFields = [];
    invalidRow.failureReason = "";
    invalidRow.reconciledAt = new Date();
    invalidRow.reconciledBy = req.user._id;

    await invalidRow.save();

    return res.json({
      success: true,
      message: "Invalid row reconciled and payment created",
      data: {
        status: "reconciled",
        result,
        row: invalidRow,
      },
    });
  }

  const unmatchedResult = await storeUnmatchedRows({
    skippedRows,
    userId: req.user._id,
    originalFilename: invalidRow.sourceOriginalFilename,
  });

  const unmatchedPayment = await UnmatchedPayment.findOne({
    rowIdentityKey: getRowIdentityKey(normalizedRow),
  }).lean();

  invalidRow.status = "moved_to_unmatched";
  invalidRow.normalizedRow = normalizedRow;
  invalidRow.fixedData = {
    ...(invalidRow.fixedData || {}),
    ...(req.body || {}),
  };
  invalidRow.missingFields = [];
  invalidRow.failureReason =
    skippedRows[0]?.reason || "wiresheet_transaction_not_found";
  invalidRow.unmatchedPaymentId = unmatchedPayment?._id || null;
  invalidRow.reconciledAt = new Date();
  invalidRow.reconciledBy = req.user._id;

  await invalidRow.save();

  return res.json({
    success: true,
    message: "Invalid row fixed but moved to unmatched payments",
    data: {
      status: "moved_to_unmatched",
      unmatchedResult,
      row: invalidRow,
    },
  });
};
