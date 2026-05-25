import * as XLSX from "xlsx";

// File upload limits
export const WIRE_FILE_LIMIT = 20;
export const PAYMENT_FILE_LIMIT = 5;

// Sample preview rows
export const wireSheetRows = [
  {
    merchantName: "Demo Merchant",
    mid: "MID001",
    startDate: "2026-03-06",
    endDate: "2026-03-09",
    processingCurrency: "USD",
    amount: "12500",
  },
];

export const paymentSheetRows = [
  {
    bank: "Demo Bank",
    merchantName: "Demo Merchant",
    mid: "MID001",
    startDate: "2026-03-06",
    endDate: "2026-03-09",
    processingCurrency: "USD",
    amount: "1000",
    rate: "83.15",
    settlementCurrency: "INR",
    finalAmount: "83150",
  },
];

// Payment sheet tab configuration
export const paymentSheetSections = {
  crypto: {
    label: "Crypto",
    aliases: ["CRYPTO", "USDT"],
  },
  wire: {
    label: "Wire",
    aliases: ["WIRE", "EURO", "EUR"],
  },
};

export const paymentSheetOrder = ["crypto", "wire"];

// Default preview state
export const defaultAnalysis = {
  acquirers: [],
  currencies: [],
  merchantsList: [],
  rates: [],
  transactions: 0,
  merchants: 0,
  estimatedRevenue: 0,
};

export const initialTabState = {
  files: [],
  activeFileIndex: 0,
  isDragging: false,
};

export function isValidWiresheetFileName(fileName = "") {
  const normalizedName = fileName.toLowerCase();

  return (
    normalizedName.includes("automation") &&
    normalizedName.includes("wiresheet")
  );
}

export function isValidPaymentSheetFileName(fileName = "") {
  const normalizedName = fileName.toLowerCase().replace(/\.[^/.]+$/, "");

  return /^\d{1,2}\.\d{1,2}\s+payments$/.test(normalizedName);
}

export function validateUploadFileBeforeParsing(file, tab) {
  if (!file?.name) {
    return "Invalid file selected.";
  }

  if (tab === "wire" && !isValidWiresheetFileName(file.name)) {
    return "Invalid wiresheet file format.";
  }

  if (tab === "payment" && !isValidPaymentSheetFileName(file.name)) {
    return "Invalid payment sheet file format.";
  }

  return "";
}

export function getRowId(row) {
  return row?.id || row?._id;
}

export function getFileLimit(tab) {
  return tab === "wire" ? WIRE_FILE_LIMIT : PAYMENT_FILE_LIMIT;
}

export function getFileIdentity(file) {
  return `${file.name}__${file.size}__${file.lastModified}`;
}

export function deriveAcquirerFromFilename(fileName) {
  const baseName = fileName.replace(/\.[^/.]+$/, "");
  const lower = baseName.toLowerCase();
  const split = lower.split(/automation|automated/)[0].trim();

  if (!split) return baseName;

  return split
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();
}

export function normalizeHeader(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

export function normalizeCell(value) {
  if (value === undefined || value === null) return "";
  if (typeof value === "number") return value;
  return String(value).trim();
}

export function normalizeEntityName(value, { stripDp = false } = {}) {
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

export function excelDateToString(value) {
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

export function parseAmountValue(value) {
  const numericValue = Number(
    String(value)
      .replace(/,/g, "")
      .replace(/[^\d.-]/g, ""),
  );

  if (Number.isNaN(numericValue)) return 0;
  return numericValue;
}

export function formatAmountCell(value) {
  if (value === undefined || value === null || String(value).trim() === "") {
    return "-";
  }

  const numericValue = Number(
    String(value)
      .replace(/,/g, "")
      .replace(/[^\d.-]/g, ""),
  );

  if (Number.isNaN(numericValue)) {
    return normalizeCell(value) || "-";
  }

  return numericValue.toFixed(2);
}

export function formatPreviewDate(value) {
  if (!value) return "-";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);

  return parsed.toISOString().slice(0, 10);
}

export function buildAnalysis(parsedData, type) {
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

export function getPaymentSheetKey(fileItem) {
  if (!fileItem?.paymentSheets) return null;

  return (
    fileItem.activePaymentSheet ||
    paymentSheetOrder.find((key) => fileItem.paymentSheets[key]) ||
    null
  );
}

export function getActivePaymentSheet(fileItem) {
  const sheetKey = getPaymentSheetKey(fileItem);

  return {
    sheetKey,
    sheetData: sheetKey ? fileItem?.paymentSheets?.[sheetKey] || null : null,
  };
}
