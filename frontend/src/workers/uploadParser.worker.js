import * as XLSX from "xlsx";

function normalizeHeader(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function normalizeCell(value) {
  if (value === undefined || value === null) return "";
  if (typeof value === "number") return value;
  return String(value).trim();
}

function normalizeEntityName(value, { stripDp = false } = {}) {
  let normalized = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");

  if (stripDp) {
    normalized = normalized
      .replace(/\s*\(DP\)\s*/g, "")
      .replace(/\s+DP$/g, "")
      .trim();
  }

  return normalized;
}

function excelDateToString(value) {
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);

    if (parsed) {
      const yyyy = parsed.y;
      const mm = String(parsed.m).padStart(2, "0");
      const dd = String(parsed.d).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    }
  }

  return normalizeCell(value);
}

function parseAmountValue(value) {
  const numericValue = Number(
    String(value)
      .replace(/,/g, "")
      .replace(/[^\d.-]/g, ""),
  );

  return Number.isNaN(numericValue) ? 0 : numericValue;
}

function deriveAcquirerFromFilename(fileName) {
  const baseName = fileName.replace(/\.[^/.]+$/, "");
  const lower = baseName.toLowerCase();
  const split = lower.split(/automation|automated/)[0].trim();

  if (!split) return baseName;

  return split
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();
}

function getWorksheetRows(workbook, sheetName) {
  const worksheet = workbook.Sheets[sheetName];

  return XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    raw: true,
    defval: "",
  });
}

function findHeaderRow(
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

function buildAnalysis(parsedData, type) {
  if (type === "wire") {
    const totalAmount = parsedData.rows.reduce((sum, row) => {
      return sum + parseAmountValue(row.amount);
    }, 0);

    return {
      acquirers: parsedData.acquirers || [],
      currencies: parsedData.currencies || [],
      merchantsList: parsedData.merchants || [],
      rates: [],
      transactions: parsedData.rows.length,
      merchants: parsedData.merchants?.length || 0,
      estimatedRevenue: totalAmount,
    };
  }

  const totalAmount = parsedData.rows.reduce((sum, row) => {
    return sum + parseAmountValue(row.finalAmount);
  }, 0);

  return {
    acquirers: parsedData.acquirers || [],
    currencies: parsedData.currencies || [],
    merchantsList: parsedData.merchants || [],
    rates: parsedData.rates || [],
    transactions: parsedData.rows.length,
    merchants: parsedData.merchants?.length || 0,
    estimatedRevenue: totalAmount,
  };
}

function readWireSheetByHeaders({ arrayBuffer, fileName }) {
  const workbook = XLSX.read(arrayBuffer, { type: "array" });
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

  const acquirer = deriveAcquirerFromFilename(fileName);

  const parsedData = {
    sheetName,
    acquirer,
    currencies: Array.from(currencies),
    merchants: Array.from(merchants),
    acquirers: [acquirer],
    rates: [],
    rows: extractedRows,
  };

  return {
    ...parsedData,
    analysis: buildAnalysis(parsedData, "wire"),
  };
}

const paymentSheetSections = {
  crypto: {
    label: "Crypto",
    aliases: ["CRYPTO", "USDT"],
  },
  wire: {
    label: "Wire",
    aliases: ["WIRE", "EURO", "EUR"],
  },
};

const paymentSheetOrder = ["crypto", "wire"];

function getPaymentSheetType(sheetName, parsedSection) {
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

function shouldIncludePaymentRow(row, availableKeys) {
  if (!row.merchantName || !row.mid) return false;

  const populatedCount = availableKeys.filter((key) => row[key] !== "").length;

  return populatedCount >= Math.max(2, availableKeys.length - 1);
}

function extractPaymentSheetData(sheetName, rows, fallbackAcquirer) {
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

  if (headerRowIndex === -1) return null;

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

function readPaymentSheetByHeaders({ arrayBuffer, fileName }) {
  const fallbackAcquirer = deriveAcquirerFromFilename(fileName);
  const workbook = XLSX.read(arrayBuffer, { type: "array" });

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

self.onmessage = (event) => {
  const { id, tab, fileName, arrayBuffer } = event.data;

  try {
    const parsedData =
      tab === "wire"
        ? readWireSheetByHeaders({ arrayBuffer, fileName })
        : readPaymentSheetByHeaders({ arrayBuffer, fileName });

    self.postMessage({
      id,
      success: true,
      data: parsedData,
    });
  } catch (error) {
    self.postMessage({
      id,
      success: false,
      error: error?.message || "Unable to read the uploaded Excel file.",
    });
  }
};
