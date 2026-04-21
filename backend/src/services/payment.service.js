import xlsx from "xlsx";
import mongoose from "mongoose";
import { Acquirer } from "../modules/acquirers/acquirer.model.js";
import { MerchantAccount } from "../modules/merchantAccounts/merchant-account.model.js";
import { Payment } from "../modules/payments/payment.model.js";
import { SettlementTransaction } from "../modules/settlements/settlement-transaction.model.js";
import { SettlementBatch } from "../modules/batches/batch.model.js";
import { derivePaymentMethod, deriveSettlementStatus, roundMoney } from "../utils/currencyUtils.js";
import { endOfDay, parseSheetDate, startOfDay } from "../utils/dateUtils.js";
import { ApiError } from "../utils/ApiError.js";

const parseSheetNumber = (value) => {
  if (value === null || value === undefined) return 0;

  const normalized = String(value)
    .replace(/,/g, "")
    .replace(/[^0-9.-]/g, "")
    .trim();

  if (!normalized || normalized === "-" || normalized === "." || normalized === "-.") {
    return 0;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeSheetRows = (sheet) =>
  xlsx.utils
    .sheet_to_json(sheet, { defval: "", raw: false })
    .map((row) =>
      Object.fromEntries(
        Object.entries(row).map(([key, value]) => [String(key).replace(/\s+/g, " ").trim(), value])
      )
    );

const parseWorkbookSheets = (buffer) => {
  const workbook = xlsx.read(buffer, { type: "buffer", cellDates: true });

  return workbook.SheetNames.map((sheetName) => ({
    sheetName,
    rows: normalizeSheetRows(workbook.Sheets[sheetName])
  }));
};

const normalizeLabel = (value) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();

const inferPaymentDate = ({ explicitPaymentDate, originalFilename, sheetName }) => {
  if (explicitPaymentDate) {
    return parseSheetDate(explicitPaymentDate);
  }

  const source = `${sheetName} ${originalFilename || ""}`;
  const currentYear = new Date().getUTCFullYear();
  const compactDateMatch = source.match(/(?:^|\s)(\d{2})(\d{2})(?:\s|$)/);
  if (compactDateMatch) {
    const [, day, month] = compactDateMatch;
    return parseSheetDate(`${day}/${month}/${currentYear}`);
  }

  const dottedDateMatch = source.match(/(\d{2})\.(\d{2})/);
  if (dottedDateMatch) {
    const [, day, month] = dottedDateMatch;
    return parseSheetDate(`${day}/${month}/${currentYear}`);
  }

  const today = new Date();
  return parseSheetDate(
    `${String(today.getUTCDate()).padStart(2, "0")}/${String(today.getUTCMonth() + 1).padStart(2, "0")}/${today.getUTCFullYear()}`
  );
};

const normalizePaymentRow = (row, sheetName, paymentDate) => {
  const normalizedSheetName = sheetName.toLowerCase();
  const isCryptoSheet = normalizedSheetName.includes("crypto");
  const isWireSheet = normalizedSheetName.includes("wire");

  const mid = String(row["MID"] || row["MID NO"] || row.mid || "").trim();
  const settlementCurrency = String(
    row["Settlement Currency"] || row["SETTLEMENT CURRENCY"] || row["Settlement Currency "] || ""
  )
    .trim()
    .toUpperCase();

  const processingAmount = parseSheetNumber(
    row.Amount || row["Amount"] || row["AMOUNT"] || row[" AMOUNT"] || row["PAID AMOUNT"] || 0
  );

  const settlementAmount = parseSheetNumber(
    (isCryptoSheet ? row.USDT : 0) ||
      (isWireSheet ? row["AMOUNT IN EURO"] || row["AMOUNT IN EUR"] || row["AMOUNT IN EURO "] : 0) ||
      row.USDT ||
      row["AMOUNT IN EURO"] ||
      row["AMOUNT IN EUR"] ||
      row["AMOUNT IN EURO "] ||
      0
  );

  return {
    bank: String(row.Bank || row.BANK || "").trim(),
    merchantName: String(row["MERCHANT NAME"] || "").trim(),
    mid,
    startDate: parseSheetDate(row["START DATE"] || row["First Date"] || row["FIRST DATE"]),
    endDate: parseSheetDate(row["END DATE"] || row["End Date"]),
    processingCurrency: String(row.Currency || row["PROCESSING CURRENCY"] || "").trim().toUpperCase(),
    processingAmount,
    rate: parseSheetNumber(row.RATE || row["RATE"] || row[" RATE"] || 0),
    settlementCurrency,
    amountPaid: processingAmount,
    settlementAmount,
    paymentDate,
    paymentMethod:
      settlementCurrency ? derivePaymentMethod(settlementCurrency) : isCryptoSheet ? "CRYPTO" : isWireSheet ? "WIRE" : "UNKNOWN",
    reference: String(row["Hash Payment / Wire Reference"] || row["HASH PAYMENT / WIRE REFERENCE"] || "").trim(),
    sheetName
  };
};

const deriveBatchStatus = ({ totalPaid, totalBalance }) => {
  if (totalPaid <= 0) return "pending";
  if (totalBalance > 0) return "partially_paid";
  return "settled";
};

const normalizeDateTime = (date) => {
  if (!date) return "";
  return new Date(date).toISOString();
};

const buildPaymentIdentityKey = ({
  settlementTransactionId,
  paymentBank,
  paidToMerchantDate,
  sourceStartDate,
  sourceEndDate,
  sourceProcessingCurrency,
  paymentCurrency
}) =>
  [
    settlementTransactionId,
    normalizeLabel(paymentBank),
    normalizeDateTime(paidToMerchantDate),
    normalizeDateTime(sourceStartDate),
    normalizeDateTime(sourceEndDate),
    String(sourceProcessingCurrency || "").trim().toUpperCase(),
    String(paymentCurrency || "").trim().toUpperCase()
  ].join("|");

const scoreTransactionMatch = (transaction, row) => {
  let score = 0;

  if (row.processingCurrency && transaction.processingCurrency === row.processingCurrency) {
    score += 100;
  }

  if (row.settlementCurrency && transaction.settlementCurrency === row.settlementCurrency) {
    score += 10;
  }

  const startDiff = row.startDate ? Math.abs(transaction.startDate.getTime() - row.startDate.getTime()) : 0;
  const endDiff = row.endDate ? Math.abs(transaction.endDate.getTime() - row.endDate.getTime()) : 0;

  score -= Math.floor(startDiff / (1000 * 60 * 60));
  score -= Math.floor(endDiff / (1000 * 60 * 60));

  return score;
};

const buildBankAcquirerMap = async (rows) => {
  const normalizedBanks = [...new Set(rows.map((row) => normalizeLabel(row.bank)).filter(Boolean))];

  if (!normalizedBanks.length) {
    return new Map();
  }

  const acquirers = await Acquirer.find({}, { _id: 1, name: 1 }).lean();
  const bankAcquirerMap = new Map();

  for (const normalizedBank of normalizedBanks) {
    bankAcquirerMap.set(
      normalizedBank,
      acquirers
        .filter((acquirer) => normalizeLabel(acquirer.name) === normalizedBank)
        .map((acquirer) => acquirer._id.toString())
    );
  }

  return bankAcquirerMap;
};

const buildMerchantAccountLookup = async ({ rows, bankAcquirerMap }) => {
  const mids = [...new Set(rows.map((row) => row.mid).filter(Boolean))];
  const acquirerIds = [...new Set([...bankAcquirerMap.values()].flat())];

  if (!mids.length || !acquirerIds.length) {
    return {
      accountIdsByRowKey: new Map(),
      allAccountIds: []
    };
  }

  const merchantAccounts = await MerchantAccount.find(
    {
      mid: { $in: mids },
      acquirerId: { $in: acquirerIds }
    },
    { _id: 1, mid: 1, acquirerId: 1 }
  ).lean();

  const accountsByMidAcquirer = new Map(
    merchantAccounts.map((account) => [
      `${account.mid}:${account.acquirerId.toString()}`,
      account._id.toString()
    ])
  );

  const accountIdsByRowKey = new Map();

  for (const row of rows) {
    const acquirerIdsForBank = bankAcquirerMap.get(normalizeLabel(row.bank)) || [];
    accountIdsByRowKey.set(
      `${normalizeLabel(row.bank)}:${row.mid}`,
      acquirerIdsForBank
        .map((acquirerId) => accountsByMidAcquirer.get(`${row.mid}:${acquirerId}`))
        .filter(Boolean)
    );
  }

  return {
    accountIdsByRowKey,
    allAccountIds: [...new Set(merchantAccounts.map((account) => account._id.toString()))]
  };
};

const buildTransactionIndex = async ({ rows, batchId, allAccountIds }) => {
  if (!allAccountIds.length) {
    return new Map();
  }

  const mids = [...new Set(rows.map((row) => row.mid).filter(Boolean))];
  const parsedStartDates = rows.map((row) => row.startDate).filter(Boolean);
  const parsedEndDates = rows.map((row) => row.endDate).filter(Boolean);

  const transactionQuery = {
    merchantAccountId: { $in: allAccountIds },
    mid: { $in: mids }
  };

  if (batchId) {
    transactionQuery.batchId = batchId;
  }

  if (parsedStartDates.length && parsedEndDates.length) {
    const minStartDate = new Date(Math.min(...parsedStartDates.map((date) => date.getTime())));
    const maxEndDate = new Date(Math.max(...parsedEndDates.map((date) => date.getTime())));
    transactionQuery.startDate = { $lte: endOfDay(maxEndDate) };
    transactionQuery.endDate = { $gte: startOfDay(minStartDate) };
  }

  const transactions = await SettlementTransaction.find(transactionQuery).lean();
  const transactionsByMid = new Map();

  for (const transaction of transactions) {
    const key = transaction.mid;
    if (!transactionsByMid.has(key)) {
      transactionsByMid.set(key, []);
    }

    transactionsByMid.get(key).push({
      ...transaction,
      _id: transaction._id.toString(),
      merchantAccountId: transaction.merchantAccountId.toString(),
      batchId: transaction.batchId.toString()
    });
  }

  return transactionsByMid;
};

const findMatchingSettlementTransaction = ({ row, candidateTransactions, candidateAccountIds }) => {
  if (!candidateTransactions?.length || !candidateAccountIds?.length) {
    return null;
  }

  const exactMatches = candidateTransactions.filter((transaction) => {
    if (!candidateAccountIds.includes(transaction.merchantAccountId)) {
      return false;
    }

    if (row.startDate && transaction.startDate.getTime() !== row.startDate.getTime()) {
      return false;
    }

    if (row.endDate && transaction.endDate.getTime() !== row.endDate.getTime()) {
      return false;
    }

    if (row.processingCurrency && transaction.processingCurrency !== row.processingCurrency) {
      return false;
    }

    return true;
  });

  if (exactMatches.length) {
    exactMatches.sort((left, right) => scoreTransactionMatch(right, row) - scoreTransactionMatch(left, row));
    return exactMatches[0];
  }

  const overlapMatches = candidateTransactions.filter((transaction) => {
    if (!candidateAccountIds.includes(transaction.merchantAccountId)) {
      return false;
    }

    if (row.processingCurrency && transaction.processingCurrency !== row.processingCurrency) {
      return false;
    }

    if (row.startDate && transaction.endDate.getTime() < startOfDay(row.startDate).getTime()) {
      return false;
    }

    if (row.endDate && transaction.startDate.getTime() > endOfDay(row.endDate).getTime()) {
      return false;
    }

    return true;
  });

  if (!overlapMatches.length) {
    return null;
  }

  overlapMatches.sort((left, right) => scoreTransactionMatch(right, row) - scoreTransactionMatch(left, row));
  return overlapMatches[0];
};

export const processPaymentUpload = async ({
  fileBuffer,
  batchId,
  userId,
  paymentDate,
  originalFilename
}) => {
  const workbookSheets = parseWorkbookSheets(fileBuffer);
  const rows = workbookSheets.flatMap(({ sheetName, rows: sheetRows }) => {
    const inferredPaymentDate = inferPaymentDate({
      explicitPaymentDate: paymentDate,
      originalFilename,
      sheetName
    });

    return sheetRows
      .map((row) => normalizePaymentRow(row, sheetName, inferredPaymentDate))
      .filter(
        (row) =>
          row.mid &&
          row.settlementCurrency &&
          row.amountPaid !== 0 &&
          row.startDate &&
          row.endDate
      );
  });

  if (!rows.length) {
    throw new ApiError(400, "No valid payment rows found");
  }

  const bankAcquirerMap = await buildBankAcquirerMap(rows);
  const { accountIdsByRowKey, allAccountIds } = await buildMerchantAccountLookup({
    rows,
    bankAcquirerMap
  });
  const transactionsByMid = await buildTransactionIndex({
    rows,
    batchId,
    allAccountIds
  });

  const skippedRows = [];
  const matchedRows = [];

  for (const row of rows) {
    const candidateAccountIds =
      accountIdsByRowKey.get(`${normalizeLabel(row.bank)}:${row.mid}`) || [];
    const transaction = findMatchingSettlementTransaction({
      row,
      candidateTransactions: transactionsByMid.get(row.mid) || [],
      candidateAccountIds
    });

    if (!transaction) {
      skippedRows.push({
        reason: "settlement_transaction_not_found",
        sheetName: row.sheetName,
        bank: row.bank,
        merchantName: row.merchantName,
        mid: row.mid,
        processingCurrency: row.processingCurrency,
        settlementCurrency: row.settlementCurrency,
        startDate: row.startDate,
        endDate: row.endDate,
        amountPaid: roundMoney(row.amountPaid),
        settlementAmount: roundMoney(row.settlementAmount)
      });
      continue;
    }

    matchedRows.push({ row, transaction });
  }

  const touchedTransactionIds = [...new Set(matchedRows.map(({ transaction }) => transaction._id))];
  const existingPayments = touchedTransactionIds.length
    ? await Payment.find(
        {
          settlementTransactionId: {
            $in: touchedTransactionIds.map((id) => new mongoose.Types.ObjectId(id))
          }
        }
      ).lean()
    : [];

  const existingPaymentMap = new Map();
  for (const payment of existingPayments) {
    existingPaymentMap.set(
      buildPaymentIdentityKey({
        settlementTransactionId: payment.settlementTransactionId.toString(),
        paymentBank: payment.paymentBank,
        paidToMerchantDate: payment.paidToMerchantDate,
        sourceStartDate: payment.sourceStartDate,
        sourceEndDate: payment.sourceEndDate,
        sourceProcessingCurrency: payment.sourceProcessingCurrency,
        paymentCurrency: payment.paymentCurrency
      }),
      {
        ...payment,
        _id: payment._id.toString(),
        settlementTransactionId: payment.settlementTransactionId.toString()
      }
    );
  }

  const paymentDocs = [];
  const paymentUpdates = [];
  const transactionStateMap = new Map();

  for (const { row, transaction } of matchedRows) {
    const paymentDateValue = row.paymentDate || new Date();
    const normalizedAmountPaid = roundMoney(row.amountPaid);
    const normalizedSettlementAmount = roundMoney(row.settlementAmount);
    const paymentDoc = {
      settlementTransactionId: transaction._id,
      merchantAccountId: transaction.merchantAccountId,
      amountPaid: normalizedAmountPaid,
      settlementAmount: normalizedSettlementAmount,
      paymentCurrency: row.settlementCurrency,
      paymentMethod: row.paymentMethod,
      paymentDate: paymentDateValue,
      paidToMerchantDate: paymentDateValue,
      paymentRate: roundMoney(row.rate),
      paymentBank: row.bank,
      sourceMid: row.mid,
      sourceStartDate: row.startDate,
      sourceEndDate: row.endDate,
      sourceProcessingCurrency: row.processingCurrency,
      hashPayment: row.paymentMethod === "CRYPTO" ? row.reference : "",
      referenceNo: row.paymentMethod === "WIRE" ? row.reference : "",
      createdBy: userId
    };

    const paymentIdentityKey = buildPaymentIdentityKey({
      settlementTransactionId: transaction._id,
      paymentBank: row.bank,
      paidToMerchantDate: paymentDateValue,
      sourceStartDate: row.startDate,
      sourceEndDate: row.endDate,
      sourceProcessingCurrency: row.processingCurrency,
      paymentCurrency: row.settlementCurrency
    });
    const existingPayment = existingPaymentMap.get(paymentIdentityKey);
    const previousAmount = existingPayment ? roundMoney(existingPayment.amountPaid) : 0;
    const paymentDelta = roundMoney(normalizedAmountPaid - previousAmount);

    const transactionId = transaction._id;
    const transactionState = transactionStateMap.get(transactionId) || {
      _id: transactionId,
      batchId: transaction.batchId,
      merchantAccountId: transaction.merchantAccountId,
      payable: transaction.payable,
      paid: roundMoney(transaction.paid),
      balance: roundMoney(transaction.balance)
    };

    transactionState.paid = roundMoney(transactionState.paid + paymentDelta);
    transactionState.balance = roundMoney(transactionState.payable - transactionState.paid);
    transactionState.status = deriveSettlementStatus({
      payable: transactionState.payable,
      paid: transactionState.paid
    });

    transactionStateMap.set(transactionId, transactionState);

    if (existingPayment) {
      paymentUpdates.push({
        updateOne: {
          filter: { _id: existingPayment._id },
          update: { $set: paymentDoc }
        }
      });
    } else {
      paymentDocs.push(paymentDoc);
    }
  }

  if (paymentDocs.length) {
    await Payment.insertMany(paymentDocs);
  }

  if (paymentUpdates.length) {
    await Payment.bulkWrite(paymentUpdates);
  }

  const transactionUpdates = [...transactionStateMap.values()];
  if (transactionUpdates.length) {
    await SettlementTransaction.bulkWrite(
      transactionUpdates.map((transaction) => ({
        updateOne: {
          filter: { _id: transaction._id },
          update: {
            $set: {
              paid: transaction.paid,
              balance: transaction.balance,
              status: transaction.status
            }
          }
        }
      }))
    );
  }

  const touchedBatchIds = [...new Set(transactionUpdates.map((transaction) => transaction.batchId))];

  if (touchedBatchIds.length) {
    const batchTotals = await SettlementTransaction.aggregate([
      {
        $match: {
          batchId: { $in: touchedBatchIds.map((batch) => new mongoose.Types.ObjectId(batch)) }
        }
      },
      {
        $group: {
          _id: "$batchId",
          totalPayable: { $sum: "$payable" },
          totalPaid: { $sum: "$paid" },
          totalBalance: { $sum: "$balance" }
        }
      }
    ]);

    if (batchTotals.length) {
      await SettlementBatch.bulkWrite(
        batchTotals.map((batch) => {
          const totalPayable = roundMoney(batch.totalPayable);
          const totalPaid = roundMoney(batch.totalPaid);
          const totalBalance = roundMoney(batch.totalBalance);

          return {
            updateOne: {
              filter: { _id: batch._id },
              update: {
                $set: {
                  totalPayable,
                  totalPaid,
                  totalBalance,
                  status: deriveBatchStatus({ totalPaid, totalBalance })
                }
              }
            }
          };
        })
      );
    }
  }

  return {
    createdPayments: paymentDocs.length + paymentUpdates.length,
    updatedBatches: touchedBatchIds.length,
    skippedCount: skippedRows.length,
    skippedRows
  };
};

