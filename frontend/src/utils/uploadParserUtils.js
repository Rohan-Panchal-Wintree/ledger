import * as XLSX from "xlsx";

import {
  buildAnalysis,
  deriveAcquirerFromFilename,
  excelDateToString,
  normalizeCell,
  normalizeEntityName,
  normalizeHeader,
  parseAmountValue,
  paymentSheetOrder,
  paymentSheetSections,
} from "./uploadUtils";

export function readWorkbook(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const data = event.target.result;
        const workbook = XLSX.read(data, { type: "array" });
        resolve(workbook);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsArrayBuffer(file);
  });
}

export function getWorksheetRows(workbook, sheetName) {
  const worksheet = workbook.Sheets[sheetName];

  return XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    raw: true,
    defval: "",
  });
}

export function findHeaderRow(
  rows,
  headerAliasesMap,
  requiredKeys,
  { minimumMatches = requiredKeys.length } = {},
) {
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i] || [];
    const normalizedRow = row.map((cell) => normalizeHeader(cell));
    const resolvedMap = {};

    Object.entries(headerAliasesMap).forEach(([key, aliases]) => {
      const foundIndex = normalizedRow.findIndex((header) =>
        aliases.includes(header),
      );

      if (foundIndex !== -1) {
        resolvedMap[key] = foundIndex;
      }
    });

    const matchedKeys = Object.keys(resolvedMap).length;
    const foundAll = requiredKeys.every(
      (requiredKey) => resolvedMap[requiredKey] !== undefined,
    );

    if (foundAll && matchedKeys >= minimumMatches) {
      return {
        headerRowIndex: i,
        headerMap: resolvedMap,
      };
    }
  }

  return {
    headerRowIndex: -1,
    headerMap: {},
  };
}

export async function readWireSheetByHeaders(file) {
  const workbook = await readWorkbook(file);
  const sheetName = workbook.SheetNames[0];
  const rows = getWorksheetRows(workbook, sheetName);

  const headerAliases = {
    merchantName: ["MERCHANT NAME"],
    mid: ["MID"],
    startDate: ["START DATE"],
    endDate: ["END DATE"],
    processingCurrency: ["PROCESSING CURRENCY"],
    amount: ["AMOUNT"],
  };

  const requiredKeys = [
    "merchantName",
    "mid",
    "startDate",
    "endDate",
    "processingCurrency",
    "amount",
  ];

  const { headerRowIndex, headerMap } = findHeaderRow(
    rows,
    headerAliases,
    requiredKeys,
  );

  if (headerRowIndex === -1) {
    throw new Error(
      "Required wire-sheet headers not found in the uploaded file.",
    );
  }

  const extractedRows = [];
  const currencies = new Set();
  const merchants = new Set();

  for (let i = headerRowIndex + 1; i < rows.length; i += 1) {
    const row = rows[i] || [];

    const merchantName = normalizeCell(row[headerMap.merchantName]);
    const mid = normalizeCell(row[headerMap.mid]);
    const startDate = excelDateToString(row[headerMap.startDate]);
    const endDate = excelDateToString(row[headerMap.endDate]);
    const processingCurrency = normalizeCell(row[headerMap.processingCurrency]);
    const amount = normalizeCell(row[headerMap.amount]);

    const isCompletelyEmpty = [
      merchantName,
      mid,
      startDate,
      endDate,
      processingCurrency,
      amount,
    ].every((item) => item === "");

    if (isCompletelyEmpty) continue;

    extractedRows.push({
      merchantName,
      mid,
      startDate,
      endDate,
      processingCurrency,
      amount,
    });

    if (merchantName) {
      merchants.add(normalizeEntityName(merchantName));
    }

    if (processingCurrency) {
      currencies.add(String(processingCurrency).trim().toUpperCase());
    }
  }

  const acquirer = deriveAcquirerFromFilename(file.name);

  return {
    sheetName,
    acquirer,
    currencies: Array.from(currencies),
    merchants: Array.from(merchants),
    acquirers: [acquirer],
    rates: [],
    rows: extractedRows,
  };
}

export function getPaymentSheetType(sheetName, parsedSection) {
  const normalizedSheetName = normalizeHeader(sheetName);

  if (
    paymentSheetSections.crypto.aliases.some((alias) =>
      normalizedSheetName.includes(alias),
    )
  ) {
    return "crypto";
  }

  if (
    paymentSheetSections.wire.aliases.some((alias) =>
      normalizedSheetName.includes(alias),
    )
  ) {
    return "wire";
  }

  if (
    parsedSection?.currencies?.some((currency) =>
      ["USDT", "CRYPTO"].includes(String(currency).trim().toUpperCase()),
    )
  ) {
    return "crypto";
  }

  if (
    parsedSection?.currencies?.some((currency) =>
      ["EUR", "EURO"].includes(String(currency).trim().toUpperCase()),
    )
  ) {
    return "wire";
  }

  return null;
}

export function shouldIncludePaymentRow(row, availableKeys) {
  if (!row.merchantName || !row.mid) return false;

  const populatedCount = availableKeys.filter((key) => row[key] !== "").length;
  return populatedCount >= Math.max(2, availableKeys.length - 1);
}

export function extractPaymentSheetData(sheetName, rows, fallbackAcquirer) {
  const headerAliases = {
    bank: ["BANK"],
    merchantName: ["MERCHANT NAME"],
    mid: ["MID", "MID NO"],
    startDate: ["START DATE", "FIRST DATE"],
    endDate: ["END DATE"],
    processingCurrency: ["PROCESSING CURRENCY", "CURRENCY"],
    amount: ["AMOUNT"],
    rate: ["RATE"],
    settlementCurrency: ["SETTLEMENT CURRENCY"],
    finalAmount: ["AMOUNT IN EURO", "USDT", "FINAL AMOUNT"],
  };

  const { headerRowIndex, headerMap } = findHeaderRow(
    rows,
    headerAliases,
    ["merchantName", "mid"],
    { minimumMatches: 4 },
  );

  if (headerRowIndex === -1) {
    return null;
  }

  const availableKeys = Object.keys(headerMap);
  const extractedRows = [];
  const currencies = new Set();
  const merchants = new Set();
  const acquirers = new Set();
  const rates = new Set();

  for (let i = headerRowIndex + 1; i < rows.length; i += 1) {
    const row = rows[i] || [];

    const parsedRow = {
      bank:
        headerMap.bank !== undefined ? normalizeCell(row[headerMap.bank]) : "",
      merchantName:
        headerMap.merchantName !== undefined
          ? normalizeCell(row[headerMap.merchantName])
          : "",
      mid: headerMap.mid !== undefined ? normalizeCell(row[headerMap.mid]) : "",
      startDate:
        headerMap.startDate !== undefined
          ? excelDateToString(row[headerMap.startDate])
          : "",
      endDate:
        headerMap.endDate !== undefined
          ? excelDateToString(row[headerMap.endDate])
          : "",
      processingCurrency:
        headerMap.processingCurrency !== undefined
          ? normalizeCell(row[headerMap.processingCurrency])
          : "",
      amount:
        headerMap.amount !== undefined
          ? normalizeCell(row[headerMap.amount])
          : "",
      rate:
        headerMap.rate !== undefined ? normalizeCell(row[headerMap.rate]) : "",
      settlementCurrency:
        headerMap.settlementCurrency !== undefined
          ? normalizeCell(row[headerMap.settlementCurrency])
          : "",
      finalAmount:
        headerMap.finalAmount !== undefined
          ? normalizeCell(row[headerMap.finalAmount])
          : "",
    };

    const isCompletelyEmpty = availableKeys.every(
      (key) => parsedRow[key] === "",
    );

    if (
      isCompletelyEmpty ||
      !shouldIncludePaymentRow(parsedRow, availableKeys)
    ) {
      continue;
    }

    extractedRows.push(parsedRow);

    if (parsedRow.bank) {
      acquirers.add(normalizeEntityName(parsedRow.bank));
    }

    if (parsedRow.merchantName) {
      merchants.add(
        normalizeEntityName(parsedRow.merchantName, { stripDp: true }),
      );
    }

    if (parsedRow.settlementCurrency) {
      currencies.add(String(parsedRow.settlementCurrency).trim().toUpperCase());
    }

    if (parsedRow.rate) {
      rates.add(String(parsedRow.rate).trim());
    }
  }

  return {
    sheetName,
    acquirer: fallbackAcquirer,
    currencies: Array.from(currencies),
    merchants: Array.from(merchants),
    acquirers: acquirers.size > 0 ? Array.from(acquirers) : [fallbackAcquirer],
    rates: Array.from(rates),
    rows: extractedRows,
  };
}

export async function readPaymentSheetByHeaders(file) {
  const fallbackAcquirer = deriveAcquirerFromFilename(file.name);
  const workbook = await readWorkbook(file);

  const paymentSheets = {
    crypto: null,
    wire: null,
  };

  const fallbackSections = [];

  workbook.SheetNames.forEach((sheetName) => {
    const rows = getWorksheetRows(workbook, sheetName);
    const parsedSection = extractPaymentSheetData(
      sheetName,
      rows,
      fallbackAcquirer,
    );

    if (!parsedSection) return;

    const sectionType = getPaymentSheetType(sheetName, parsedSection);

    if (sectionType) {
      if (!paymentSheets[sectionType]) {
        paymentSheets[sectionType] = parsedSection;
      }

      return;
    }

    fallbackSections.push(parsedSection);
  });

  if (
    !paymentSheets.crypto &&
    !paymentSheets.wire &&
    fallbackSections.length > 0
  ) {
    const inferredType =
      getPaymentSheetType(fallbackSections[0].sheetName, fallbackSections[0]) ||
      "wire";

    paymentSheets[inferredType] = fallbackSections[0];
  }

  const activePaymentSheet = paymentSheetOrder.find(
    (key) => paymentSheets[key] !== null,
  );

  if (!activePaymentSheet) {
    throw new Error(
      "No valid payment sheets found. Add a Crypto/USDT sheet and/or a Wire/EURO sheet with Merchant Name and MID columns.",
    );
  }

  const normalizedPaymentSheets = paymentSheetOrder.reduce((acc, key) => {
    const section = paymentSheets[key];

    acc[key] = section
      ? {
          ...section,
          label: paymentSheetSections[key].label,
          analysis: buildAnalysis(section, "payment"),
        }
      : null;

    return acc;
  }, {});

  const activeSection = normalizedPaymentSheets[activePaymentSheet];

  return {
    sheetName: activeSection.sheetName,
    acquirer: fallbackAcquirer,
    currencies: activeSection.currencies,
    merchants: activeSection.merchants,
    acquirers: activeSection.acquirers,
    rates: activeSection.rates,
    rows: activeSection.rows,
    paymentSheets: normalizedPaymentSheets,
    activePaymentSheet,
    analysis: activeSection.analysis,
  };
}
