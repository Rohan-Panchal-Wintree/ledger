import React from "react";
import * as XLSX from "xlsx";
import { FileUp, FileSpreadsheet, Download, X, ArrowRightLeft } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { unstable_usePrompt, useBeforeUnload } from "react-router-dom";
import UploadFile from "../component/UploadFile";
import {
  fetchUnmatchedPaymentSummary,
  reconcileUnmatchedPaymentRows,
  selectPaymentsFullState,
  uploadFiles,
} from "../store/slices/Payments.slice";

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

function getFileIdentity(file) {
  return `${file.name}__${file.size}__${file.lastModified}`;
}

function isDuplicateFile(existingFiles, file) {
  const candidateId = getFileIdentity(file);
  return existingFiles.some((item) => item.fileId === candidateId);
}

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
  const dispatch = useDispatch();
  const [activeTab, setActiveTab] = React.useState("wire");
  const [tabState, setTabState] = React.useState({
    wire: { ...initialTabState },
    payment: { ...initialTabState },
  });
  const {
    loading: isUploading,
    unmatchedSummary,
    unmatchedSummaryLoading,
  } = useSelector(selectPaymentsFullState);

  const wireInputRef = React.useRef(null);
  const paymentInputRef = React.useRef(null);

  const isWireSheet = activeTab === "wire";
  const currentTab = tabState[activeTab];
  const activeFile = currentTab.files[currentTab.activeFileIndex] || null;
  const hasUnsavedFiles =
    tabState.wire.files.length > 0 || tabState.payment.files.length > 0;
  const { sheetKey: activePaymentSheetKey, sheetData: activePaymentSheetData } =
    !isWireSheet
      ? getActivePaymentSheet(activeFile)
      : { sheetKey: null, sheetData: null };
  const displayedRows = isWireSheet
    ? activeFile?.rows || []
    : activePaymentSheetData?.rows || [];

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

  React.useEffect(() => {
    dispatch(fetchUnmatchedPaymentSummary());
  }, [dispatch]);

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

  const handleBrowseClick = (tab) => {
    if (tab === "wire") {
      wireInputRef.current?.click();
    } else {
      paymentInputRef.current?.click();
    }
  };

  const handleFileSelect = async (files, tab) => {
    const selectedFiles = Array.from(files || []).filter(Boolean);
    if (selectedFiles.length === 0) return;

    const existingFileIds = new Set(
      tabState[tab].files.map((fileItem) => fileItem.fileId),
    );
    const seenFileIds = new Set(existingFileIds);
    const newFiles = [];
    const skippedDuplicates = [];
    const failedFiles = [];

    for (const file of selectedFiles) {
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

        const analysis = buildAnalysis(parsedData, tab);

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
          analysis,
          uploadedAt: new Date().toISOString(),
        });
      } catch (error) {
        console.error("Excel read failed:", error);
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

    if (skippedDuplicates.length > 0 || failedFiles.length > 0) {
      const notices = [];

      if (skippedDuplicates.length > 0) {
        notices.push(
          `Skipped duplicate files: ${skippedDuplicates.join(", ")}`,
        );
      }

      if (failedFiles.length > 0) {
        notices.push(
          failedFiles
            .map((item) => `${item.name}: ${item.message}`)
            .join("\n"),
        );
      }

      alert(notices.join("\n\n"));
    }
  };

  const handleInputChange = (e, tab) => {
    const files = e.target.files;
    handleFileSelect(files, tab);

    if (tab === "wire" && wireInputRef.current) {
      wireInputRef.current.value = "";
    }

    if (tab === "payment" && paymentInputRef.current) {
      paymentInputRef.current.value = "";
    }
  };

  const handleDragOver = (e, tab) => {
    e.preventDefault();
    updateTabState(tab, { isDragging: true });
  };

  const handleDragLeave = (e, tab) => {
    e.preventDefault();
    updateTabState(tab, { isDragging: false });
  };

  const handleDrop = (e, tab) => {
    e.preventDefault();
    updateTabState(tab, { isDragging: false });

    handleFileSelect(e.dataTransfer.files, tab);
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

  const handleProcess = async () => {
    const wireFiles = tabState.wire.files.map((fileItem) => fileItem.file);
    const paymentFiles = tabState.payment.files.map(
      (fileItem) => fileItem.file,
    );

    if (wireFiles.length === 0 && paymentFiles.length === 0) {
      alert("Please upload at least one wire-sheet or payment file.");
      return;
    }

    try {
      const result = await dispatch(
        uploadFiles({
          wireFiles,
          paymentFiles,
        }),
      ).unwrap();

      resetUploadState();
      const pendingCount = result?.unmatchedSummary?.pendingCount || 0;
      const uploadMessage =
        pendingCount > 0
          ? `Files uploaded successfully. ${pendingCount} unmatched payment row(s) are waiting for reconciliation.`
          : "Files uploaded successfully.";
      alert(uploadMessage);
    } catch (error) {
      alert(error || "Unable to upload the selected files.");
    }
  };

  const handleReconcileUnmatched = async () => {
    try {
      const result = await dispatch(reconcileUnmatchedPaymentRows()).unwrap();
      alert(
        `Reconciliation complete.\nProcessed: ${result.processedCount}\nReconciled: ${result.reconciledCount}\nStill pending: ${result.remainingCount}`,
      );
    } catch (error) {
      alert(error || "Unable to reconcile pending unmatched payments.");
    }
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

  const analysis = isWireSheet
    ? activeFile?.analysis || defaultAnalysis
    : activePaymentSheetData?.analysis || defaultAnalysis;

  return (
    <div className="w-full bg-background text-on-background">
      <input
        ref={wireInputRef}
        type="file"
        accept=".xlsx,.csv"
        multiple
        className="hidden"
        onChange={(e) => handleInputChange(e, "wire")}
      />

      <input
        ref={paymentInputRef}
        type="file"
        accept=".xlsx,.csv"
        multiple
        className="hidden"
        onChange={(e) => handleInputChange(e, "payment")}
      />

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

      {(unmatchedSummaryLoading || unmatchedSummary?.pendingCount > 0) && (
        <section className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-amber-700">
                Pending Reconciliation Queue
              </p>
              <h2 className="mt-2 text-xl font-bold text-amber-950">
                {unmatchedSummaryLoading
                  ? "Checking unmatched payment rows..."
                  : `${unmatchedSummary?.pendingCount || 0} payment row(s) waiting for missing wiresheet match`}
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-amber-900/80">
                When a payment row was uploaded before its matching wiresheet existed, we now keep it here. Upload the missing wiresheet, then click reconcile to auto-match the saved row without uploading the payment sheet again.
              </p>
            </div>

            <button
              type="button"
              onClick={handleReconcileUnmatched}
              disabled={isUploading || unmatchedSummaryLoading || !unmatchedSummary?.pendingCount}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-amber-500 px-5 py-3 text-sm font-bold uppercase tracking-widest text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              <ArrowRightLeft className="h-4 w-4" />
              Reconcile Unmatched
            </button>
          </div>

          {!unmatchedSummaryLoading && unmatchedSummary?.recentRows?.length > 0 && (
            <div className="mt-5 grid gap-3 xl:grid-cols-2">
              {unmatchedSummary.recentRows.map((row) => (
                <div
                  key={row.id}
                  className="rounded-2xl border border-amber-200/70 bg-white/70 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-slate-900">
                        {row.merchantName || "-"}
                      </p>
                      <p className="mt-1 text-xs uppercase tracking-widest text-slate-500">
                        {row.paymentBank || "Unknown Bank"} • MID {row.sourceMid || "-"}
                      </p>
                    </div>
                    <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700 ring-1 ring-red-200">
                      {row.amountPaid}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
                    <span className="rounded-full bg-slate-100 px-3 py-1">
                      {formatPreviewDate(row.sourceStartDate)} to {formatPreviewDate(row.sourceEndDate)}
                    </span>
                    <span className="rounded-full bg-slate-100 px-3 py-1">
                      {row.sourceProcessingCurrency || "-"} to {row.paymentCurrency || "-"}
                    </span>
                    <span className="rounded-full bg-slate-100 px-3 py-1">
                      Retry {row.retryCount || 0}
                    </span>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-slate-600">
                    {row.failureReason || "Settlement transaction not found"} • Source file:{" "}
                    <span className="font-semibold text-slate-800">
                      {row.originalFilename || "-"}
                    </span>
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {currentTab.files.length > 0 && (
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
      )}

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
        onDragOver={(e) => handleDragOver(e, activeTab)}
        onDragLeave={(e) => handleDragLeave(e, activeTab)}
        onDrop={(e) => handleDrop(e, activeTab)}
        onRemove={() => handleRemoveFile(activeTab, currentTab.activeFileIndex)}
        onCancel={() => handleCancel(activeTab)}
        onProcess={handleProcess}
        isProcessing={isUploading}
        analysis={analysis}
        showRates={!isWireSheet}
      />

      <section className="space-y-6">
        {!isWireSheet && activeFile?.paymentSheets && (
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
        )}

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

          <button
            type="button"
            className={`flex items-center gap-2 ${
              currentTab.files.length > 0
                ? "text-sm font-bold text-primary hover:underline"
                : "rounded-default bg-surface-container px-4 py-2 text-sm font-bold text-on-surface-variant transition-colors hover:bg-surface-container-highest"
            }`}
          >
            <Download className="h-4 w-4" />
            {currentTab.files.length > 0
              ? "DOWNLOAD TEMPLATE"
              : "Sample Template"}
          </button>
        </div>

        <div className="overflow-hidden rounded-lg   border border-outline-variant/10 bg-surface-container-lowest">
          <div className="overflow-x-auto scrollbar-hide">
            {currentTab.files.length > 0 ? (
              isWireSheet ? (
                <table className="w-full min-w-max border-collapse text-left">
                  <thead>
                    <tr className="bg-surface-container-low">
                      <th className="whitespace-nowrap px-6 py-4 text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                        Merchant Name
                      </th>
                      <th className="whitespace-nowrap px-6 py-4 text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                        MID
                      </th>
                      <th className="whitespace-nowrap px-6 py-4 text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                        Start Date
                      </th>
                      <th className="whitespace-nowrap px-6 py-4 text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                        End Date
                      </th>
                      <th className="whitespace-nowrap px-6 py-4 text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                        Processing Currency
                      </th>
                      <th className="whitespace-nowrap px-6 py-4 text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                        Amount
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-surface-container">
                    {displayedRows.map((row, index) => (
                      <tr
                        key={`${activeFile.id}-${index}`}
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
                        <td className="whitespace-nowrap px-6 py-5">
                          <span className="rounded-full bg-primary/10 px-3 py-1 text-[11px] font-bold text-primary">
                            {row.processingCurrency || "-"}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-6 py-5 font-bold text-on-surface">
                          {formatAmountCell(row.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <table className="w-full min-w-max border-collapse text-left">
                  <thead>
                    <tr className="bg-surface-container-low">
                      <th className="whitespace-nowrap px-6 py-4 text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                        Bank
                      </th>
                      <th className="whitespace-nowrap px-6 py-4 text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                        Merchant Name
                      </th>
                      <th className="whitespace-nowrap px-6 py-4 text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                        MID
                      </th>
                      <th className="whitespace-nowrap px-6 py-4 text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                        Start Date
                      </th>
                      <th className="whitespace-nowrap px-6 py-4 text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                        End Date
                      </th>
                      <th className="whitespace-nowrap px-6 py-4 text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                        Currency
                      </th>
                      <th className="whitespace-nowrap px-6 py-4 text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                        Amount
                      </th>
                      <th className="whitespace-nowrap px-6 py-4 text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                        Rate
                      </th>
                      <th className="whitespace-nowrap px-6 py-4 text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                        Settlement Currency
                      </th>
                      <th className="whitespace-nowrap px-6 py-4 text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                        Final Amount
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-surface-container">
                    {displayedRows.map((row, index) => (
                      <tr
                        key={`${activeFile.id}-${index}`}
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
                        <td className="whitespace-nowrap px-6 py-5">
                          <span className="rounded-full bg-primary/10 px-3 py-1 text-[11px] font-bold text-primary">
                            {row.processingCurrency || "-"}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-6 py-5 font-bold text-on-surface">
                          {row.amount || "-"}
                        </td>
                        <td className="whitespace-nowrap px-6 py-5 text-on-surface">
                          {row.rate || "-"}
                        </td>
                        <td className="whitespace-nowrap px-6 py-5">
                          <span className="rounded-full bg-surface-container px-3 py-1 text-[11px] font-bold text-on-surface">
                            {row.settlementCurrency || "-"}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-6 py-5 font-bold text-on-surface">
                          {formatAmountCell(row.finalAmount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            ) : isWireSheet ? (
              <table className="min-w-max w-full border-collapse text-left">
                <thead>
                  <tr className="bg-surface-container-low">
                    <th className="whitespace-nowrap px-6 py-4 text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                      Merchant Name
                    </th>
                    <th className="whitespace-nowrap px-6 py-4 text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                      MID
                    </th>
                    <th className="whitespace-nowrap px-6 py-4 text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                      Start Date
                    </th>
                    <th className="whitespace-nowrap px-6 py-4 text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                      End Date
                    </th>
                    <th className="whitespace-nowrap px-6 py-4 text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                      Processing Currency
                    </th>
                    <th className="whitespace-nowrap px-6 py-4 text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                      Amount
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-outline-variant/10">
                  {wireSheetRows.map((row, index) => (
                    <tr
                      key={`${row.mid}-${index}`}
                      className="group transition-colors hover:bg-surface-container-low"
                    >
                      <td className="whitespace-nowrap px-6 py-5 font-medium text-on-surface">
                        {row.merchantName}
                      </td>
                      <td className="whitespace-nowrap px-6 py-5 text-on-surface-variant">
                        {row.mid}
                      </td>
                      <td className="whitespace-nowrap px-6 py-5 text-on-surface-variant">
                        {row.startDate}
                      </td>
                      <td className="whitespace-nowrap px-6 py-5 text-on-surface-variant">
                        {row.endDate}
                      </td>
                      <td className="whitespace-nowrap px-6 py-5 text-on-surface">
                        {row.processingCurrency}
                      </td>
                      <td className="whitespace-nowrap px-6 py-5 font-bold text-on-surface">
                        {formatAmountCell(row.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="min-w-max w-full border-collapse text-left">
                <thead>
                  <tr className="bg-surface-container-low">
                    <th className="whitespace-nowrap px-6 py-4 text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                      Bank
                    </th>
                    <th className="whitespace-nowrap px-6 py-4 text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                      Merchant Name
                    </th>
                    <th className="whitespace-nowrap px-6 py-4 text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                      MID
                    </th>
                    <th className="whitespace-nowrap px-6 py-4 text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                      Start Date
                    </th>
                    <th className="whitespace-nowrap px-6 py-4 text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                      End Date
                    </th>
                    <th className="whitespace-nowrap px-6 py-4 text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                      Currency
                    </th>
                    <th className="whitespace-nowrap px-6 py-4 text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                      Amount
                    </th>
                    <th className="whitespace-nowrap px-6 py-4 text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                      Rate
                    </th>
                    <th className="whitespace-nowrap px-6 py-4 text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                      Settlement Currency
                    </th>
                    <th className="whitespace-nowrap px-6 py-4 text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                      Final Amount
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-outline-variant/10">
                  {paymentSheetRows.map((row, index) => (
                    <tr
                      key={`${row.mid}-${index}`}
                      className="group transition-colors hover:bg-surface-container-low"
                    >
                      <td className="whitespace-nowrap px-6 py-5 font-medium text-on-surface">
                        {row.bank}
                      </td>
                      <td className="whitespace-nowrap px-6 py-5 text-on-surface-variant">
                        {row.merchantName}
                      </td>
                      <td className="whitespace-nowrap px-6 py-5 text-on-surface-variant">
                        {row.mid}
                      </td>
                      <td className="whitespace-nowrap px-6 py-5 text-on-surface-variant">
                        {row.startDate}
                      </td>
                      <td className="whitespace-nowrap px-6 py-5 text-on-surface-variant">
                        {row.endDate}
                      </td>
                      <td className="whitespace-nowrap px-6 py-5 text-on-surface">
                        {row.processingCurrency}
                      </td>
                      <td className="whitespace-nowrap px-6 py-5 font-bold text-on-surface">
                        {row.amount}
                      </td>
                      <td className="whitespace-nowrap px-6 py-5 text-on-surface">
                        {row.rate}
                      </td>
                      <td className="whitespace-nowrap px-6 py-5 text-on-surface">
                        {row.settlementCurrency}
                      </td>
                      <td className="whitespace-nowrap px-6 py-5 font-bold text-on-surface">
                        {formatAmountCell(row.finalAmount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
