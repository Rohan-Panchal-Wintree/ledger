import React, { useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  FileUp,
  RefreshCcw,
  X,
} from "lucide-react";
import { unstable_usePrompt, useBeforeUnload } from "react-router-dom";
import toast from "react-hot-toast";

import UploadFile from "../component/UploadFile";
import EditInvalidPaymentRowModal from "../component/EditInvalidPaymentRowModal";
import {
  useInvalidPaymentRows,
  useReconcileInvalidPaymentRow,
  useReconcileUnmatchedPaymentRows,
  useUnmatchedPaymentsSummary,
  useUpdateInvalidPaymentRow,
  useUploadFiles,
} from "../queries/uploadQueries";

// File upload limits
const WIRE_FILE_LIMIT = 20;
const PAYMENT_FILE_LIMIT = 5;

// Sample rows shown before upload
const wireSheetRows = [
  {
    merchantName: "Demo Merchant",
    mid: "MID001",
    startDate: "2026-03-06",
    endDate: "2026-03-09",
    processingCurrency: "USD",
    amount: "12500",
  },
];

const paymentSheetRows = [
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

// Default UI state
const defaultAnalysis = {
  acquirers: [],
  currencies: [],
  merchantsList: [],
  rates: [],
  transactions: 0,
  merchants: 0,
  estimatedRevenue: 0,
};

const initialTabState = {
  files: [],
  activeFileIndex: 0,
  isDragging: false,
};

// General helpers
function getRowId(row) {
  return row?.id || row?._id;
}

function getFileLimit(tab) {
  return tab === "wire" ? WIRE_FILE_LIMIT : PAYMENT_FILE_LIMIT;
}

function getErrorMessage(error, fallbackMessage) {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    fallbackMessage
  );
}

function getFileIdentity(file) {
  return `${file.name}__${file.size}__${file.lastModified}`;
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

  if (Number.isNaN(numericValue)) return 0;
  return numericValue;
}

function formatAmountCell(value) {
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

function formatPreviewDate(value) {
  if (!value) return "-";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);

  return parsed.toISOString().slice(0, 10);
}

// Excel helpers
function readWorkbook(file) {
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

// Wiresheet parsing
async function readWireSheetByHeaders(file) {
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

// Payment sheet parsing
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

async function readPaymentSheetByHeaders(file) {
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

// Preview analysis
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

function getPaymentSheetKey(fileItem) {
  if (!fileItem?.paymentSheets) return null;

  return (
    fileItem.activePaymentSheet ||
    paymentSheetOrder.find((key) => fileItem.paymentSheets[key]) ||
    null
  );
}

function getActivePaymentSheet(fileItem) {
  const sheetKey = getPaymentSheetKey(fileItem);

  return {
    sheetKey,
    sheetData: sheetKey ? fileItem?.paymentSheets?.[sheetKey] || null : null,
  };
}

export default function Upload() {
  // Local UI state
  const [activeTab, setActiveTab] = useState("wire");
  const [queueTab, setQueueTab] = useState("unmatched");
  const [selectedInvalidRow, setSelectedInvalidRow] = useState(null);
  const [isInvalidRowModalOpen, setIsInvalidRowModalOpen] = useState(false);
  const [isReconciliationExpanded, setIsReconciliationExpanded] =
    useState(false);
  const [tabState, setTabState] = useState({
    wire: { ...initialTabState },
    payment: { ...initialTabState },
  });

  // File input refs
  const wireInputRef = useRef(null);
  const paymentInputRef = useRef(null);

  // Server state
  const unmatchedSummaryQuery = useUnmatchedPaymentsSummary();
  const invalidRowsQuery = useInvalidPaymentRows({
    page: 1,
    limit: 20,
  });
  const uploadFilesMutation = useUploadFiles();
  const reconcileUnmatchedMutation = useReconcileUnmatchedPaymentRows();
  const updateInvalidRowMutation = useUpdateInvalidPaymentRow();
  const reconcileInvalidRowMutation = useReconcileInvalidPaymentRow();

  // Upload tab state
  const isWireSheet = activeTab === "wire";
  const currentTab = tabState[activeTab];
  const activeFile = currentTab.files[currentTab.activeFileIndex] || null;
  const currentFileLimit = getFileLimit(activeTab);
  const currentFileCount = currentTab.files.length;

  // Payment sheet state
  const { sheetKey: activePaymentSheetKey, sheetData: activePaymentSheetData } =
    !isWireSheet
      ? getActivePaymentSheet(activeFile)
      : { sheetKey: null, sheetData: null };

  const displayedRows = isWireSheet
    ? activeFile?.rows || []
    : activePaymentSheetData?.rows || [];

  const analysis = isWireSheet
    ? activeFile?.analysis || defaultAnalysis
    : activePaymentSheetData?.analysis || defaultAnalysis;

  // Queue state
  const unmatchedSummary = unmatchedSummaryQuery.data || {
    pendingCount: 0,
    manualReviewCount: 0,
    recentRows: [],
  };

  const invalidRows = invalidRowsQuery.data?.items || [];
  const activeQueueRows =
    queueTab === "unmatched" ? unmatchedSummary?.recentRows || [] : invalidRows;

  const activeQueueCount =
    queueTab === "unmatched"
      ? unmatchedSummary?.pendingCount || 0
      : invalidRows.length;

  const activeQueueTitle =
    queueTab === "unmatched"
      ? `${activeQueueCount} unmatched row(s) need reconciliation`
      : `${activeQueueCount} invalid row(s) need correction`;

  const unmatchedSummaryLoading =
    unmatchedSummaryQuery.isLoading || unmatchedSummaryQuery.isFetching;

  const invalidRowsLoading =
    invalidRowsQuery.isLoading || invalidRowsQuery.isFetching;

  const activeQueueLoading =
    queueTab === "unmatched" ? unmatchedSummaryLoading : invalidRowsLoading;

  const isUploading = uploadFilesMutation.isPending;
  const isReconciling =
    reconcileUnmatchedMutation.isPending ||
    updateInvalidRowMutation.isPending ||
    reconcileInvalidRowMutation.isPending;

  const canReconcileActiveQueue =
    queueTab === "unmatched"
      ? Boolean(unmatchedSummary?.pendingCount)
      : invalidRows.length > 0;

  const hasUnsavedFiles =
    tabState.wire.files.length > 0 || tabState.payment.files.length > 0;

  const shouldShowQueue =
    unmatchedSummaryLoading ||
    invalidRowsLoading ||
    unmatchedSummary?.pendingCount > 0 ||
    invalidRows.length > 0;

  // Leave protection
  unstable_usePrompt({
    when: hasUnsavedFiles,
    message:
      "Your uploaded data is not saved yet. If you leave this page, it will be lost.",
  });

  useBeforeUnload((event) => {
    if (!hasUnsavedFiles) return;

    event.preventDefault();
    event.returnValue = "";
  });

  // State helpers
  const updateTabState = (tab, updates) => {
    setTabState((prev) => ({
      ...prev,
      [tab]: {
        ...prev[tab],
        ...updates,
      },
    }));
  };

  const updatePaymentFile = (fileIndex, updates) => {
    setTabState((prev) => ({
      ...prev,
      payment: {
        ...prev.payment,
        files: prev.payment.files.map((fileItem, index) =>
          index === fileIndex ? { ...fileItem, ...updates } : fileItem,
        ),
      },
    }));
  };

  const resetUploadState = () => {
    setTabState({
      wire: { ...initialTabState },
      payment: { ...initialTabState },
    });
  };

  // File handlers
  const handleBrowseClick = (tab) => {
    if (tabState[tab].files.length >= getFileLimit(tab)) {
      toast.error(
        tab === "wire"
          ? `Maximum ${WIRE_FILE_LIMIT} wiresheet files allowed at a time.`
          : `Maximum ${PAYMENT_FILE_LIMIT} payment sheet files allowed at a time.`,
      );
      return;
    }

    if (tab === "wire") {
      wireInputRef.current?.click();
    } else {
      paymentInputRef.current?.click();
    }
  };

  const handleFileSelect = async (files, tab) => {
    const selectedFiles = Array.from(files || []).filter(Boolean);
    if (selectedFiles.length === 0) return;

    const fileLimit = getFileLimit(tab);
    const existingCount = tabState[tab].files.length;
    const remainingSlots = fileLimit - existingCount;

    if (remainingSlots <= 0) {
      toast.error(
        tab === "wire"
          ? `You can upload maximum ${WIRE_FILE_LIMIT} wiresheet files at a time.`
          : `You can upload maximum ${PAYMENT_FILE_LIMIT} payment sheet files at a time.`,
      );
      return;
    }

    const limitedSelectedFiles = selectedFiles.slice(0, remainingSlots);

    if (selectedFiles.length > remainingSlots) {
      toast.error(
        `Only ${remainingSlots} more file(s) allowed. Extra files were skipped.`,
      );
    }

    const existingFileIds = new Set(
      tabState[tab].files.map((fileItem) => fileItem.fileId),
    );
    const seenFileIds = new Set(existingFileIds);
    const newFiles = [];
    const skippedDuplicates = [];
    const failedFiles = [];

    for (const file of limitedSelectedFiles) {
      const fileId = getFileIdentity(file);

      if (seenFileIds.has(fileId)) {
        skippedDuplicates.push(file.name);
        continue;
      }

      seenFileIds.add(fileId);

      try {
        const parsedData =
          tab === "wire"
            ? await readWireSheetByHeaders(file)
            : await readPaymentSheetByHeaders(file);

        const analysisData = buildAnalysis(parsedData, tab);

        newFiles.push({
          id: `${Date.now()}-${Math.random()}`,
          fileId,
          file,
          name: file.name,
          size: file.size,
          sheetName: parsedData.sheetName,
          acquirer: parsedData.acquirer,
          currencies: parsedData.currencies,
          merchants: parsedData.merchants,
          acquirers: parsedData.acquirers,
          rates: parsedData.rates,
          rows: parsedData.rows,
          paymentSheets: parsedData.paymentSheets || null,
          activePaymentSheet: parsedData.activePaymentSheet || null,
          analysis: analysisData,
          uploadedAt: new Date().toISOString(),
        });
      } catch (error) {
        failedFiles.push({
          name: file.name,
          message: error?.message || "Unable to read the uploaded Excel file.",
        });
      }
    }

    if (newFiles.length > 0) {
      setTabState((prev) => {
        const nextFiles = [...prev[tab].files, ...newFiles];

        return {
          ...prev,
          [tab]: {
            ...prev[tab],
            files: nextFiles,
            activeFileIndex: nextFiles.length - 1,
          },
        };
      });
    }

    if (skippedDuplicates.length > 0) {
      toast.error(`Skipped duplicate files: ${skippedDuplicates.join(", ")}`);
    }

    if (failedFiles.length > 0) {
      toast.error(
        failedFiles.map((item) => `${item.name}: ${item.message}`).join("\n"),
      );
    }
  };

  const handleInputChange = (event, tab) => {
    handleFileSelect(event.target.files, tab);

    if (tab === "wire" && wireInputRef.current) {
      wireInputRef.current.value = "";
    }

    if (tab === "payment" && paymentInputRef.current) {
      paymentInputRef.current.value = "";
    }
  };

  const handleDragOver = (event, tab) => {
    event.preventDefault();
    updateTabState(tab, { isDragging: true });
  };

  const handleDragLeave = (event, tab) => {
    event.preventDefault();
    updateTabState(tab, { isDragging: false });
  };

  const handleDrop = (event, tab) => {
    event.preventDefault();
    updateTabState(tab, { isDragging: false });

    if (tabState[tab].files.length >= getFileLimit(tab)) {
      toast.error(
        tab === "wire"
          ? `Maximum ${WIRE_FILE_LIMIT} wiresheet files allowed at a time.`
          : `Maximum ${PAYMENT_FILE_LIMIT} payment sheet files allowed at a time.`,
      );
      return;
    }

    handleFileSelect(event.dataTransfer.files, tab);
  };

  const handleRemoveFile = (tab, index) => {
    setTabState((prev) => {
      const updatedFiles = prev[tab].files.filter((_, i) => i !== index);
      let nextIndex = prev[tab].activeFileIndex;

      if (updatedFiles.length === 0) {
        nextIndex = 0;
      } else if (index < prev[tab].activeFileIndex) {
        nextIndex = prev[tab].activeFileIndex - 1;
      } else if (index === prev[tab].activeFileIndex) {
        nextIndex = Math.max(0, prev[tab].activeFileIndex - 1);
      } else if (nextIndex >= updatedFiles.length) {
        nextIndex = updatedFiles.length - 1;
      }

      return {
        ...prev,
        [tab]: {
          ...prev[tab],
          files: updatedFiles,
          activeFileIndex: nextIndex,
        },
      };
    });
  };

  const handleCancel = (tab) => {
    setTabState((prev) => ({
      ...prev,
      [tab]: {
        ...prev[tab],
        files: [],
        activeFileIndex: 0,
        isDragging: false,
      },
    }));
  };

  const handleFileTabChange = (tab, index) => {
    updateTabState(tab, { activeFileIndex: index });
  };

  const handlePaymentSheetTabChange = (sheetKey) => {
    if (isWireSheet || !activeFile) return;
    if (!activeFile.paymentSheets?.[sheetKey]) return;

    updatePaymentFile(currentTab.activeFileIndex, {
      activePaymentSheet: sheetKey,
    });
  };

  // API handlers
  const handleProcess = async () => {
    const wireFiles = tabState.wire.files.map((fileItem) => fileItem.file);
    const paymentFiles = tabState.payment.files.map(
      (fileItem) => fileItem.file,
    );

    if (wireFiles.length === 0 && paymentFiles.length === 0) {
      toast.error("Please upload at least one wire-sheet or payment file.");
      return;
    }

    try {
      await uploadFilesMutation.mutateAsync({
        wireFiles,
        paymentFiles,
      });

      resetUploadState();
      toast.success("Files uploaded successfully.");
    } catch (error) {
      toast.error(getErrorMessage(error, "Unable to upload selected files."));
    }
  };

  const handleReconcileQueue = async () => {
    try {
      if (queueTab === "unmatched") {
        const result = await reconcileUnmatchedMutation.mutateAsync();

        toast.success(
          `Reconciliation complete. Reconciled: ${
            result?.reconciledCount || 0
          }, Still pending: ${result?.remainingCount || 0}`,
        );

        return;
      }

      const fixedRows = invalidRows.filter((row) => row.status === "fixed");

      if (!fixedRows.length) {
        toast.error(
          "Please update at least one invalid row before reconciliation.",
        );
        return;
      }

      for (const row of fixedRows) {
        const rowId = getRowId(row);

        if (rowId) {
          await reconcileInvalidRowMutation.mutateAsync(rowId);
        }
      }

      setSelectedInvalidRow(null);
      setIsInvalidRowModalOpen(false);

      toast.success("Fixed invalid rows sent for reconciliation.");
    } catch (error) {
      toast.error(
        getErrorMessage(error, "Unable to reconcile selected queue rows."),
      );
    }
  };

  const handleEditInvalidRow = (row) => {
    setSelectedInvalidRow(row);
    setIsInvalidRowModalOpen(true);
  };

  const handleCloseInvalidRowModal = () => {
    setSelectedInvalidRow(null);
    setIsInvalidRowModalOpen(false);
  };

  const handleSaveInvalidRow = async (updatedData) => {
    const rowId = getRowId(selectedInvalidRow);

    if (!rowId) {
      toast.error("Invalid row id missing.");
      return;
    }

    const payload = {
      BANK: updatedData.paymentBank,
      "MERCHANT NAME": updatedData.merchantName,
      MID: updatedData.mid,
      "START DATE": updatedData.sourceStartDate,
      "FIRST DATE": updatedData.sourceStartDate,
      "END DATE": updatedData.sourceEndDate,
      "PROCESSING CURRENCY": updatedData.sourceProcessingCurrency,
      CURRENCY: updatedData.sourceProcessingCurrency,
      AMOUNT: updatedData.amountPaid,
      RATE: updatedData.rate,
      "SETTLEMENT CURRENCY": updatedData.paymentCurrency,
    };

    try {
      await updateInvalidRowMutation.mutateAsync({
        id: rowId,
        payload,
      });

      setSelectedInvalidRow(null);
      setIsInvalidRowModalOpen(false);

      toast.success("Invalid row updated successfully.");
    } catch (error) {
      toast.error(
        getErrorMessage(error, "Unable to update invalid payment row."),
      );
    }
  };

  // Render helpers
  const renderUploadTabs = () => (
    <div className="flex items-center justify-between">
      <div className="mb-6 flex w-fit items-center gap-1 rounded-xl bg-surface-container-low p-1">
        <button
          type="button"
          onClick={() => setActiveTab("wire")}
          className={`flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm transition ${
            isWireSheet
              ? "bg-surface-container-lowest font-bold text-primary"
              : "font-semibold text-on-surface-variant hover:text-on-surface"
          }`}
        >
          <FileSpreadsheet className="h-5 w-5" />
          Wire-sheet
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("payment")}
          className={`flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm transition ${
            !isWireSheet
              ? "bg-surface-container-lowest font-bold text-primary"
              : "font-semibold text-on-surface-variant hover:text-on-surface"
          }`}
        >
          <FileUp className="h-5 w-5" />
          Payment Sheet
        </button>
      </div>

      <div className="inline-flex items-center gap-3 rounded-full bg-surface-container-low px-4 py-2 text-sm font-semibold text-on-surface">
        <span className="rounded-full bg-primary px-3 py-1 text-xs font-extrabold text-white">
          {currentFileCount}/{currentFileLimit}
        </span>

        <span className="text-on-surface-variant">
          {isWireSheet ? "Wiresheets selected" : "Payment sheets selected"}
        </span>
      </div>
    </div>
  );

  const renderQueueTabs = () => (
    <div className="mb-4 flex w-fit items-center gap-1 rounded-xl bg-surface-container-low p-1">
      <button
        type="button"
        onClick={() => setQueueTab("unmatched")}
        className={`flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm transition ${
          queueTab === "unmatched"
            ? "bg-surface-container-lowest font-bold text-primary"
            : "font-semibold text-on-surface-variant hover:text-on-surface"
        }`}
      >
        Unmatched
      </button>

      <button
        type="button"
        onClick={() => setQueueTab("invalid")}
        className={`flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm transition ${
          queueTab === "invalid"
            ? "bg-surface-container-lowest font-bold text-primary"
            : "font-semibold text-on-surface-variant hover:text-on-surface"
        }`}
      >
        Invalid
      </button>
    </div>
  );

  console.log("invalidRowsQuery:", invalidRowsQuery.data);
  console.log("invalidRows:", invalidRows);

  const renderUnmatchedRowsTable = () => (
    <table className="w-full border-collapse text-left">
      <thead className="bg-surface-container-low/50">
        <tr>
          {[
            "Merchant",
            "Bank",
            "MID",
            "Start Date",
            "End Date",
            "Source Currency",
            "Payment Currency",
            "Amount Paid",
            "Retry",
            "Source File",
            "Reason",
          ].map((heading) => (
            <th
              key={heading}
              className="whitespace-nowrap px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant"
            >
              {heading}
            </th>
          ))}
        </tr>
      </thead>

      <tbody className="divide-y divide-outline-variant/5">
        {activeQueueRows.length > 0 ? (
          activeQueueRows.map((row) => (
            <tr
              key={getRowId(row)}
              className="group transition-all duration-200 hover:bg-surface-container-low/45"
            >
              <td className="whitespace-nowrap px-8 py-4 text-sm font-bold text-on-surface">
                {row.merchantName || "-"}
              </td>
              <td className="whitespace-nowrap px-8 py-4 text-sm font-medium text-on-surface-variant">
                {row.paymentBank || "Unknown Bank"}
              </td>
              <td className="whitespace-nowrap px-8 py-4 text-sm font-medium text-on-surface-variant">
                {row.sourceMid || "-"}
              </td>
              <td className="whitespace-nowrap px-8 py-4 text-sm font-medium text-on-surface-variant">
                {formatPreviewDate(row.sourceStartDate)}
              </td>
              <td className="whitespace-nowrap px-8 py-4 text-sm font-medium text-on-surface-variant">
                {formatPreviewDate(row.sourceEndDate)}
              </td>
              <td className="whitespace-nowrap px-8 py-4">
                <span className="rounded-full bg-primary/10 px-3 py-1 text-[11px] font-bold text-primary">
                  {row.sourceProcessingCurrency || "-"}
                </span>
              </td>
              <td className="whitespace-nowrap px-8 py-4">
                <span className="rounded-full bg-surface-container px-3 py-1 text-[11px] font-bold text-on-surface">
                  {row.paymentCurrency || "-"}
                </span>
              </td>
              <td className="whitespace-nowrap px-8 py-4 text-sm font-extrabold text-error">
                {row.amountPaid || "-"}
              </td>
              <td className="whitespace-nowrap px-8 py-4 text-sm font-medium text-on-surface">
                {row.retryCount || 0}
              </td>
              <td className="max-w-55 truncate px-8 py-4 text-sm font-medium text-on-surface-variant">
                {row.originalFilename || "-"}
              </td>
              <td className="min-w-65 px-8 py-4 text-sm font-medium text-on-surface-variant">
                {row.failureReason || "Settlement transaction not found"}
              </td>
            </tr>
          ))
        ) : (
          <tr>
            <td
              colSpan={11}
              className="px-8 py-12 text-center text-sm font-medium text-on-surface-variant"
            >
              No unmatched rows found.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );

  const renderInvalidRowsTable = () => (
    <table className="w-full border-collapse text-left">
      <thead className="bg-surface-container-low/50">
        <tr>
          {[
            "File",
            "Sheet",
            "Row",
            "Merchant",
            "MID",
            "Issue",
            "Updated",
            "Actions",
          ].map((heading) => (
            <th
              key={heading}
              className="whitespace-nowrap px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant"
            >
              {heading}
            </th>
          ))}
        </tr>
      </thead>

      <tbody className="divide-y divide-outline-variant/5">
        {invalidRows.length > 0 ? (
          invalidRows.map((row) => {
            const rowId = getRowId(row);
            const displayRow = {
              ...row,
              ...(row.fixedData || {}),
            };

            const isUpdated = row.status === "fixed";

            return (
              <tr
                key={rowId}
                className="group transition-all duration-200 hover:bg-surface-container-low/45"
              >
                <td className="whitespace-nowrap px-8 py-4 text-sm font-medium text-on-surface-variant">
                  {displayRow.sourceOriginalFilename || "-"}
                </td>

                <td className="whitespace-nowrap px-8 py-4 text-sm font-medium text-on-surface-variant">
                  {displayRow.sourceSheetName || "-"}
                </td>

                <td className="whitespace-nowrap px-8 py-4 text-sm font-medium text-on-surface-variant">
                  {displayRow.excelRowNumber || "-"}
                </td>

                <td className="whitespace-nowrap px-8 py-4 text-sm font-bold text-on-surface">
                  {displayRow.merchantName ||
                    row.normalizedRow?.["MERCHANT NAME"] ||
                    row.rawRow?.["MERCHANT NAME"] ||
                    "-"}
                </td>

                <td className="whitespace-nowrap px-8 py-4 text-sm font-medium text-on-surface-variant">
                  {displayRow.mid ||
                    row.normalizedRow?.MID ||
                    row.rawRow?.MID ||
                    "-"}
                </td>

                <td className="min-w-65 px-8 py-4 text-sm font-medium text-on-surface-variant">
                  {displayRow.failureReason || "Invalid or missing data"}
                </td>

                <td className="whitespace-nowrap px-8 py-4">
                  <span
                    className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${
                      isUpdated
                        ? "bg-green-500/10 text-green-600"
                        : "bg-surface-container text-on-surface-variant"
                    }`}
                  >
                    {isUpdated ? "Updated" : "Pending"}
                  </span>
                </td>

                <td className="whitespace-nowrap px-8 py-4">
                  <button
                    type="button"
                    onClick={() => handleEditInvalidRow(row)}
                    className="rounded-full bg-surface-container px-4 py-2 text-xs font-bold text-on-surface transition hover:bg-surface-container-high"
                  >
                    Edit
                  </button>
                </td>
              </tr>
            );
          })
        ) : (
          <tr>
            <td
              colSpan={8}
              className="px-8 py-12 text-center text-sm font-medium text-on-surface-variant"
            >
              No invalid rows found.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );

  const renderReconciliationQueue = () => {
    if (!shouldShowQueue) return null;

    return (
      <div className="mb-6">
        {renderQueueTabs()}

        <section className="overflow-hidden rounded-[2rem] border border-outline-variant/15 bg-surface-container-lowest">
          <div className="px-6 py-6 md:px-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="inline-flex items-center gap-2 rounded-full bg-primary/8 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-primary">
                  {queueTab === "unmatched"
                    ? "Unmatched Queue"
                    : "Invalid Rows Queue"}
                </div>

                <h2 className="mt-4 text-xl font-bold tracking-tight text-on-surface">
                  {activeQueueLoading
                    ? "Checking payment rows..."
                    : activeQueueTitle}
                </h2>

                <p className="mt-2 max-w-3xl text-sm leading-6 text-on-surface-variant">
                  {queueTab === "unmatched"
                    ? "These payment rows were uploaded before their matching wiresheet records existed. Upload the missing wiresheet, then reconcile the pending rows from here."
                    : "These rows have missing or invalid data. Edit the row values first, then reconcile the corrected rows."}
                </p>
              </div>

              <div className="flex w-full flex-col gap-3 sm:w-auto sm:min-w-65">
                <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-low px-4 py-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
                    {queueTab === "unmatched" ? "Pending Rows" : "Invalid Rows"}
                  </p>
                  <p className="mt-1 text-3xl font-extrabold tracking-tight text-on-surface">
                    {activeQueueLoading ? "..." : activeQueueCount}
                  </p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => setIsReconciliationExpanded((prev) => !prev)}
                    disabled={activeQueueLoading}
                    className="btn flex-1 rounded-full border border-outline-variant/15 bg-surface-container-low text-on-surface hover:bg-surface-container disabled:bg-surface-container disabled:text-on-surface-variant"
                  >
                    {isReconciliationExpanded ? (
                      <span className="flex items-center gap-x-1.5">
                        <ChevronUp /> Hide
                      </span>
                    ) : (
                      <span className="flex items-center gap-x-1.5">
                        <ChevronDown /> Expand
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleReconcileQueue}
                    disabled={
                      isUploading ||
                      isReconciling ||
                      activeQueueLoading ||
                      !canReconcileActiveQueue
                    }
                    className="btn flex-1 rounded-full border-none bg-primary text-primary-content hover:bg-primary disabled:bg-surface-container disabled:text-on-surface-variant"
                  >
                    <RefreshCcw className="h-4 w-4" />
                    Reconcile
                  </button>
                </div>
              </div>
            </div>
          </div>

          {isReconciliationExpanded && (
            <div className="border-t border-outline-variant/10 px-6 py-6 md:px-8">
              <div className="overflow-hidden rounded-lg border border-outline-variant/10 bg-surface-container-lowest">
                <div className="overflow-x-auto scrollbar-hide">
                  {queueTab === "unmatched"
                    ? renderUnmatchedRowsTable()
                    : renderInvalidRowsTable()}
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    );
  };

  const renderFileTabs = () => {
    if (currentTab.files.length === 0) return null;

    return (
      <div className="mb-6 flex gap-2 overflow-x-auto scrollbar-hide">
        {currentTab.files.map((fileObj, index) => (
          <div
            key={fileObj.id}
            className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition ${
              index === currentTab.activeFileIndex
                ? "bg-primary text-white"
                : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
            }`}
          >
            <button
              type="button"
              onClick={() => handleFileTabChange(activeTab, index)}
            >
              {fileObj.name}
            </button>

            <button
              type="button"
              onClick={() => handleRemoveFile(activeTab, index)}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
    );
  };

  const renderPaymentSheetTabs = () => {
    if (isWireSheet || !activeFile?.paymentSheets) return null;

    return (
      <div className="mb-1 flex w-fit items-center gap-1 rounded-xl bg-surface-container-low p-1">
        {paymentSheetOrder.map((sheetKey) => {
          const isAvailable = Boolean(activeFile.paymentSheets?.[sheetKey]);
          const isActive = activePaymentSheetKey === sheetKey;

          return (
            <button
              key={sheetKey}
              type="button"
              onClick={() => handlePaymentSheetTabChange(sheetKey)}
              disabled={!isAvailable}
              className={`flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm transition ${
                isActive
                  ? "bg-surface-container-lowest font-bold text-primary"
                  : isAvailable
                    ? "font-semibold text-on-surface-variant hover:text-on-surface"
                    : "cursor-not-allowed font-semibold text-on-surface-variant/40"
              }`}
            >
              {paymentSheetSections[sheetKey].label}
            </button>
          );
        })}
      </div>
    );
  };

  const renderExtractedDataHeader = () => (
    <div className="flex items-center justify-between">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-on-surface">
          {currentTab.files.length > 0
            ? "Extracted File Data"
            : isWireSheet
              ? "Expected Wire-sheet Format"
              : "Expected Payment Sheet Format"}
        </h2>

        {currentTab.files.length > 0 && (
          <p className="text-sm text-on-surface-variant">
            {isWireSheet
              ? "Showing only: MERCHANT NAME, MID, START DATE, END DATE, PROCESSING CURRENCY, AMOUNT"
              : `Showing ${
                  activePaymentSheetData?.label || "payment"
                } rows with Merchant Name + MID and at most one missing mapped value.`}
          </p>
        )}
      </div>
    </div>
  );

  const renderWireTable = (rows, keyPrefix) => (
    <table className="min-w-max w-full border-collapse text-left">
      <thead>
        <tr className="bg-surface-container-low">
          {[
            "Merchant Name",
            "MID",
            "Start Date",
            "End Date",
            "Processing Currency",
            "Amount",
          ].map((heading) => (
            <th
              key={heading}
              className="whitespace-nowrap px-6 py-4 text-xs font-bold uppercase tracking-widest text-on-surface-variant"
            >
              {heading}
            </th>
          ))}
        </tr>
      </thead>

      <tbody className="divide-y divide-outline-variant/10">
        {rows.map((row, index) => (
          <tr
            key={`${keyPrefix}-${row.mid || index}-${index}`}
            className="group transition-colors hover:bg-surface-container-low"
          >
            <td className="whitespace-nowrap px-6 py-5 font-medium text-on-surface">
              {row.merchantName || "-"}
            </td>
            <td className="whitespace-nowrap px-6 py-5 text-on-surface-variant">
              {row.mid || "-"}
            </td>
            <td className="whitespace-nowrap px-6 py-5 text-on-surface-variant">
              {row.startDate || "-"}
            </td>
            <td className="whitespace-nowrap px-6 py-5 text-on-surface-variant">
              {row.endDate || "-"}
            </td>
            <td className="whitespace-nowrap px-6 py-5 text-on-surface">
              {row.processingCurrency || "-"}
            </td>
            <td className="whitespace-nowrap px-6 py-5 font-bold text-on-surface">
              {formatAmountCell(row.amount)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  const renderPaymentTable = (rows, keyPrefix) => (
    <table className="min-w-max w-full border-collapse text-left">
      <thead>
        <tr className="bg-surface-container-low">
          {[
            "Bank",
            "Merchant Name",
            "MID",
            "Start Date",
            "End Date",
            "Currency",
            "Amount",
            "Rate",
            "Settlement Currency",
            "Final Amount",
          ].map((heading) => (
            <th
              key={heading}
              className="whitespace-nowrap px-6 py-4 text-xs font-bold uppercase tracking-widest text-on-surface-variant"
            >
              {heading}
            </th>
          ))}
        </tr>
      </thead>

      <tbody className="divide-y divide-outline-variant/10">
        {rows.map((row, index) => (
          <tr
            key={`${keyPrefix}-${row.mid || index}-${index}`}
            className="group transition-colors hover:bg-surface-container-low"
          >
            <td className="whitespace-nowrap px-6 py-5 font-medium text-on-surface">
              {row.bank || "-"}
            </td>
            <td className="whitespace-nowrap px-6 py-5 text-on-surface-variant">
              {row.merchantName || "-"}
            </td>
            <td className="whitespace-nowrap px-6 py-5 text-on-surface-variant">
              {row.mid || "-"}
            </td>
            <td className="whitespace-nowrap px-6 py-5 text-on-surface-variant">
              {row.startDate || "-"}
            </td>
            <td className="whitespace-nowrap px-6 py-5 text-on-surface-variant">
              {row.endDate || "-"}
            </td>
            <td className="whitespace-nowrap px-6 py-5 text-on-surface">
              {row.processingCurrency || "-"}
            </td>
            <td className="whitespace-nowrap px-6 py-5 font-bold text-on-surface">
              {row.amount || "-"}
            </td>
            <td className="whitespace-nowrap px-6 py-5 text-on-surface">
              {row.rate || "-"}
            </td>
            <td className="whitespace-nowrap px-6 py-5 text-on-surface">
              {row.settlementCurrency || "-"}
            </td>
            <td className="whitespace-nowrap px-6 py-5 font-bold text-on-surface">
              {formatAmountCell(row.finalAmount)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  const renderExtractedDataTable = () => {
    const hasUploadedFiles = currentTab.files.length > 0;

    return (
      <div className="overflow-hidden rounded-lg border border-outline-variant/10 bg-surface-container-lowest">
        <div className="overflow-x-auto scrollbar-hide">
          {hasUploadedFiles
            ? isWireSheet
              ? renderWireTable(displayedRows, activeFile?.id || "wire")
              : renderPaymentTable(displayedRows, activeFile?.id || "payment")
            : isWireSheet
              ? renderWireTable(wireSheetRows, "sample-wire")
              : renderPaymentTable(paymentSheetRows, "sample-payment")}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full bg-background text-on-background">
      <input
        ref={wireInputRef}
        type="file"
        accept=".xlsx,.csv"
        multiple
        className="hidden"
        onChange={(event) => handleInputChange(event, "wire")}
      />

      <input
        ref={paymentInputRef}
        type="file"
        accept=".xlsx,.csv"
        multiple
        className="hidden"
        onChange={(event) => handleInputChange(event, "payment")}
      />

      {renderUploadTabs()}
      {renderReconciliationQueue()}
      {renderFileTabs()}

      <UploadFile
        mode={currentTab.files.length > 0 ? "filled" : "empty"}
        title={
          currentTab.files.length > 0
            ? isWireSheet
              ? "Upload Wiresheet Excel"
              : "Upload Payment Excel"
            : isWireSheet
              ? "Upload Wiresheet Settlement File"
              : "Upload Payment Sheet File"
        }
        description={
          isWireSheet
            ? "Process your multi-acquirer transaction reports through our engine."
            : "Process your payment sheet reports through our engine."
        }
        selectedFile={activeFile?.file || null}
        isDragging={currentTab.isDragging}
        onBrowse={() => handleBrowseClick(activeTab)}
        onDragOver={(event) => handleDragOver(event, activeTab)}
        onDragLeave={(event) => handleDragLeave(event, activeTab)}
        onDrop={(event) => handleDrop(event, activeTab)}
        onRemove={() => handleRemoveFile(activeTab, currentTab.activeFileIndex)}
        onCancel={() => handleCancel(activeTab)}
        onProcess={handleProcess}
        isProcessing={isUploading}
        analysis={analysis}
        showRates={!isWireSheet}
      />

      <section className="space-y-6">
        {renderPaymentSheetTabs()}
        {renderExtractedDataHeader()}
        {renderExtractedDataTable()}
      </section>

      <EditInvalidPaymentRowModal
        open={isInvalidRowModalOpen}
        row={selectedInvalidRow}
        initialData={selectedInvalidRow?.fixedData || null}
        onClose={handleCloseInvalidRowModal}
        onSave={handleSaveInvalidRow}
      />
    </div>
  );
}
