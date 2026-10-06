import { useCallback, useMemo, useRef, useState } from "react";
import { unstable_usePrompt, useBeforeUnload } from "react-router-dom";
import toast from "react-hot-toast";

import { readStoredTab } from "../component/UI/Tabs";

import {
  useReconcileUnmatchedPaymentRows,
  useUnmatchedPaymentRows,
  useUpdateUnmatchedPaymentRow,
  useUploadFiles,
  useUploadMerchantRates,
  useUploadSettlementBatchTransactions,
  useUploadCountryMaster,
} from "../queries/uploadQueries";

import {
  formatDateShortMonth,
  getErrorMessage,
  formatDate,
} from "../utils/appUtils";
import { parseUploadFileInWorker } from "../utils/uploadWorkerClient";

import {
  PAYMENT_FILE_LIMIT,
  WIRE_FILE_LIMIT,
  buildAnalysis,
  defaultAnalysis,
  getActivePaymentSheet,
  getFileIdentity,
  getFileLimit,
  getRowId,
  initialTabState,
  validateUploadFileBeforeParsing,
} from "../utils/uploadUtils";

import {
  buildUnmatchedPaymentUpdatePayload,
  createInitialUploadState,
  createTabLoadingState,
  getInitialReviewPageSize,
} from "../utils/uploadReviewUtils";

const EMPTY_REVIEW_FILTERS = {
  status: "",
  paymentDate: "",
  fromDate: "",
  toDate: "",
  merchantName: "",
  bank: "",
  currency: "",
};

const UPLOAD_TABS = [
  { label: "Wire-sheet", value: "wire" },
  { label: "Payment Sheet", value: "payment" },
  { label: "Transaction List", value: "settlement-transactions" },
  { label: "Rates", value: "rates" },
  { label: "Countries", value: "countries" },
  { label: "Review Issues", value: "review" },
];

export const useUploadPageController = () => {
  const [activeTab, setActiveTab] = useState(() =>
    readStoredTab("upload", "wire", UPLOAD_TABS),
  );
  const [tabState, setTabState] = useState(() =>
    createInitialUploadState(initialTabState),
  );

  const [extractingTab, setExtractingTab] = useState(createTabLoadingState);
  const [uploadingTab, setUploadingTab] = useState(createTabLoadingState);

  const [reviewPage, setReviewPage] = useState(1);
  const [reviewPageSize, setReviewPageSize] = useState(
    getInitialReviewPageSize,
  );

  // States for the filter for review section
  const [reviewSearchDraft, setReviewSearchDraft] = useState("");
  const [appliedReviewSearch, setAppliedReviewSearch] = useState("");
  const [reviewFilterDraft, setReviewFilterDraft] =
    useState(EMPTY_REVIEW_FILTERS);
  const [appliedReviewFilters, setAppliedReviewFilters] =
    useState(EMPTY_REVIEW_FILTERS);
  const [isReviewFilterModalOpen, setIsReviewFilterModalOpen] = useState(false);

  const [selectedInvalidRow, setSelectedInvalidRow] = useState(null);
  const [isInvalidRowModalOpen, setIsInvalidRowModalOpen] = useState(false);
  const [ratesFile, setRatesFile] = useState(null);
  const [isRatesDragging, setIsRatesDragging] = useState(false);

  const [countryFile, setCountryFile] = useState(null);
  const [isCountryDragging, setIsCountryDragging] = useState(false);

  const [settlementTransactionFiles, setSettlementTransactionFiles] = useState({
    datestampFile: null,
    timestampFile: null,
  });

  const [settlementDateMode, setSettlementDateMode] = useState("single");

  const [settlementDateValue, setSettlementDateValue] = useState("");

  const [
    isSettlementTransactionsDragging,
    setIsSettlementTransactionsDragging,
  ] = useState(false);

  const wireInputRef = useRef(null);
  const paymentInputRef = useRef(null);
  const ratesInputRef = useRef(null);
  const countryInputRef = useRef(null);
  const settlementTransactionsInputRef = useRef(null);

  const uploadFilesMutation = useUploadFiles();
  const uploadMerchantRatesMutation = useUploadMerchantRates();
  const uploadCountryMasterMutation = useUploadCountryMaster();
  const uploadSettlementTransactionsMutation =
    useUploadSettlementBatchTransactions();
  const updateUnmatchedRowMutation = useUpdateUnmatchedPaymentRow();
  const reconcileUnmatchedMutation = useReconcileUnmatchedPaymentRows();

  const reviewRowsQuery = useUnmatchedPaymentRows({
    search: appliedReviewSearch,
    status: appliedReviewFilters.status,
    paymentDate: appliedReviewFilters.paymentDate,
    fromDate: appliedReviewFilters.fromDate,
    toDate: appliedReviewFilters.toDate,
    merchantName: appliedReviewFilters.merchantName,
    bank: appliedReviewFilters.bank,
    currency: appliedReviewFilters.currency,
    page: reviewPage,
    limit: reviewPageSize,
  });

  const reviewRows = reviewRowsQuery.data?.items || [];

  const reviewFilterOptions = reviewRowsQuery.data?.filterOptions || {
    banks: [],
    merchants: [],
    currencies: [],
  };

  const reviewMeta = reviewRowsQuery.data?.meta || {
    total: reviewRows.length,
    page: reviewPage,
    limit: reviewPageSize,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  };

  const isReviewTab = activeTab === "review";
  const isWireSheet = activeTab === "wire";
  const isPaymentSheet = activeTab === "payment";
  const isRatesTab = activeTab === "rates";
  const isCountriesTab = activeTab === "countries";
  const isSettlementTransactionsTab = activeTab === "settlement-transactions";

  const settlementTransactionFileList = [
    settlementTransactionFiles.datestampFile,
    settlementTransactionFiles.timestampFile,
  ].filter(Boolean);

  const settlementTransactionFileCount = settlementTransactionFileList.length;

  const hasBothSettlementTransactionFiles = useMemo(() => {
    const getFileName = (item) => {
      const file = item?.file || item?.source?.file || item?.source || item;

      return String(file?.name || "").toLowerCase();
    };

    const hasDatestampFile = settlementTransactionFileList.some((item) =>
      getFileName(item).includes("datestamp"),
    );

    const hasTimestampFile = settlementTransactionFileList.some((item) =>
      getFileName(item).includes("timestamp"),
    );

    return hasDatestampFile && hasTimestampFile;
  }, [settlementTransactionFileList]);

  const hasValidSettlementPeriod = useMemo(() => {
    if (settlementDateMode === "range") {
      return Boolean(
        settlementDateValue?.startDate && settlementDateValue?.endDate,
      );
    }

    return Boolean(settlementDateValue);
  }, [settlementDateMode, settlementDateValue]);

  const currentTab = tabState[activeTab] || initialTabState;
  const activeFile = currentTab.files[currentTab.activeFileIndex] || null;

  const hasReviewIssues = (reviewMeta.total || reviewRows.length) > 0;

  const activeReviewFilterCount = useMemo(() => {
    let count = 0;

    if (appliedReviewFilters.status) {
      count += 1;
    }

    if (appliedReviewFilters.paymentDate) {
      count += 1;
    } else if (appliedReviewFilters.fromDate || appliedReviewFilters.toDate) {
      count += 1;
    }

    if (appliedReviewFilters.merchantName) {
      count += 1;
    }

    if (appliedReviewFilters.bank) {
      count += 1;
    }

    if (appliedReviewFilters.currency) {
      count += 1;
    }

    return count;
  }, [appliedReviewFilters]);

  const currentFileLimit = isReviewTab
    ? 0
    : isRatesTab
      ? 1
      : isCountriesTab
        ? 1
        : isSettlementTransactionsTab
          ? 2
          : getFileLimit(activeTab);

  const currentFileCount = isRatesTab
    ? Number(Boolean(ratesFile))
    : isCountriesTab
      ? Number(Boolean(countryFile))
      : isSettlementTransactionsTab
        ? settlementTransactionFileCount
        : currentTab.files.length;

  const hasUnsavedFiles =
    tabState.wire.files.length > 0 ||
    tabState.payment.files.length > 0 ||
    Boolean(ratesFile) ||
    Boolean(countryFile) ||
    settlementTransactionFileCount > 0;

  const isCurrentTabExtracting =
    isRatesTab || isCountriesTab || isSettlementTransactionsTab
      ? false
      : Boolean(extractingTab[activeTab]);

  const isCurrentTabUploading = isRatesTab
    ? uploadMerchantRatesMutation.isPending
    : isCountriesTab
      ? uploadCountryMasterMutation.isPending
      : isSettlementTransactionsTab
        ? uploadSettlementTransactionsMutation.isPending
        : Boolean(uploadingTab[activeTab]);

  const isCurrentTabBusy = isCurrentTabExtracting || isCurrentTabUploading;

  const { sheetKey: activePaymentSheetKey, sheetData: activePaymentSheetData } =
    isPaymentSheet
      ? getActivePaymentSheet(activeFile)
      : { sheetKey: null, sheetData: null };

  const displayedRows = isWireSheet
    ? activeFile?.rows || []
    : activePaymentSheetData?.rows || [];

  const analysis = isWireSheet
    ? activeFile?.analysis || defaultAnalysis
    : activePaymentSheetData?.analysis || defaultAnalysis;

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

  const updateTabState = useCallback((tab, updates) => {
    setTabState((prev) => ({
      ...prev,
      [tab]: {
        ...prev[tab],
        ...updates,
      },
    }));
  }, []);

  const updatePaymentFile = useCallback((fileIndex, updates) => {
    setTabState((prev) => ({
      ...prev,
      payment: {
        ...prev.payment,
        files: prev.payment.files.map((fileItem, index) =>
          index === fileIndex ? { ...fileItem, ...updates } : fileItem,
        ),
      },
    }));
  }, []);

  const resetTab = useCallback((tab) => {
    setTabState((prev) => ({
      ...prev,
      [tab]: { ...initialTabState },
    }));
  }, []);

  const setTabLoading = useCallback((setter, tab, value) => {
    setter((prev) => ({
      ...prev,
      [tab]: value,
    }));
  }, []);

  // ----------------------------------------------
  //  Rates
  // ----------------------------------------------

  const validateRatesFile = useCallback((file) => {
    if (!file) {
      return "Please select a rates file.";
    }

    const extension = file.name.split(".").pop()?.toLowerCase();

    if (!["xlsx", "csv"].includes(extension)) {
      return "Only .xlsx and .csv files are supported.";
    }

    const maximumSize = 50 * 1024 * 1024;

    if (file.size > maximumSize) {
      return "The rates file must not exceed 50MB.";
    }

    return null;
  }, []);

  const handleRatesFileSelect = useCallback(
    (file) => {
      const validationError = validateRatesFile(file);

      if (validationError) {
        toast.error(validationError);
        return;
      }

      setRatesFile(file);
    },
    [validateRatesFile],
  );

  const handleRatesBrowseClick = useCallback(() => {
    ratesInputRef.current?.click();
  }, []);

  const handleRatesInputChange = useCallback(
    (event) => {
      const file = event.target.files?.[0] || null;

      if (file) {
        handleRatesFileSelect(file);
      }

      if (ratesInputRef.current) {
        ratesInputRef.current.value = "";
      }
    },
    [handleRatesFileSelect],
  );

  const handleRatesDragOver = useCallback((event) => {
    event.preventDefault();
    setIsRatesDragging(true);
  }, []);

  const handleRatesDragLeave = useCallback((event) => {
    event.preventDefault();
    setIsRatesDragging(false);
  }, []);

  const handleRatesDrop = useCallback(
    (event) => {
      event.preventDefault();
      setIsRatesDragging(false);

      const files = Array.from(event.dataTransfer.files || []);

      if (!files.length) return;

      if (files.length > 1) {
        toast.error("Only one rates file can be uploaded at a time.");
      }

      handleRatesFileSelect(files[0]);
    },
    [handleRatesFileSelect],
  );

  const handleRemoveRatesFile = useCallback(() => {
    setRatesFile(null);

    if (ratesInputRef.current) {
      ratesInputRef.current.value = "";
    }
  }, []);

  const handleUploadRates = useCallback(async () => {
    if (!ratesFile) {
      toast.error("Please select a rates file.");
      return;
    }

    try {
      const response = await uploadMerchantRatesMutation.mutateAsync(ratesFile);

      setRatesFile(null);

      if (ratesInputRef.current) {
        ratesInputRef.current.value = "";
      }

      toast.success(response?.message || "Rates uploaded successfully.");

      toast(
        `Total rows: ${response?.totalRows || 0}
Inserted rows: ${response?.insertedRows || 0}
Skipped rows: ${response?.skippedRows || 0}`,
        {
          duration: 6000,
        },
      );
    } catch (error) {
      toast.error(getErrorMessage(error, "Unable to upload the rates file."));
    }
  }, [ratesFile, uploadMerchantRatesMutation]);

  // ----------------------------------------------
  // Countries
  // ----------------------------------------------

  const validateCountryFile = useCallback((file) => {
    if (!file) {
      return "Please select a country master file.";
    }

    const extension = file.name.split(".").pop()?.toLowerCase();

    if (!["xlsx", "csv"].includes(extension)) {
      return "Only .xlsx and .csv files are supported.";
    }

    const maximumSize = 50 * 1024 * 1024;

    if (file.size > maximumSize) {
      return "The country master file must not exceed 50MB.";
    }

    return null;
  }, []);

  const handleCountryFileSelect = useCallback(
    (file) => {
      const validationError = validateCountryFile(file);

      if (validationError) {
        toast.error(validationError);
        return;
      }

      setCountryFile(file);
    },
    [validateCountryFile],
  );

  const handleCountryBrowseClick = useCallback(() => {
    countryInputRef.current?.click();
  }, []);

  const handleCountryInputChange = useCallback(
    (event) => {
      const file = event.target.files?.[0] || null;

      if (file) {
        handleCountryFileSelect(file);
      }

      if (countryInputRef.current) {
        countryInputRef.current.value = "";
      }
    },
    [handleCountryFileSelect],
  );

  const handleCountryDragOver = useCallback((event) => {
    event.preventDefault();
    setIsCountryDragging(true);
  }, []);

  const handleCountryDragLeave = useCallback((event) => {
    event.preventDefault();
    setIsCountryDragging(false);
  }, []);

  const handleCountryDrop = useCallback(
    (event) => {
      event.preventDefault();
      setIsCountryDragging(false);

      const files = Array.from(event.dataTransfer.files || []);

      if (!files.length) return;

      if (files.length > 1) {
        toast.error("Only one country master file can be uploaded at a time.");
        return;
      }

      handleCountryFileSelect(files[0]);
    },
    [handleCountryFileSelect],
  );

  const handleRemoveCountryFile = useCallback(() => {
    setCountryFile(null);

    if (countryInputRef.current) {
      countryInputRef.current.value = "";
    }
  }, []);

  const handleUploadCountryMaster = useCallback(async () => {
    if (!countryFile) {
      toast.error("Please select a country master file.");
      return;
    }

    try {
      const response =
        await uploadCountryMasterMutation.mutateAsync(countryFile);

      setCountryFile(null);

      if (countryInputRef.current) {
        countryInputRef.current.value = "";
      }

      toast.success(
        response?.message || "Country master uploaded successfully.",
      );

      toast(
        `Excel rows: ${response?.excelRows || 0}
Processed: ${response?.countryRecordsProcessed || 0}
Unique countries: ${response?.uniqueCountriesStored || 0}
EU: ${response?.totalEuCountries || 0}
Non EU: ${response?.totalNonEuCountries || 0}`,
        {
          duration: 7000,
        },
      );
    } catch (error) {
      toast.error(
        getErrorMessage(error, "Unable to upload country master file."),
      );
    }
  }, [countryFile, uploadCountryMasterMutation]);

  // ----------------------------------------------
  // Transaction list
  // ----------------------------------------------

  const getSettlementTransactionFileType = useCallback((file) => {
    const fileName = String(file?.name || "").toLowerCase();

    if (fileName.includes("datestamp")) {
      return "datestampFile";
    }

    if (fileName.includes("timestamp")) {
      return "timestampFile";
    }

    return null;
  }, []);

  const validateSettlementTransactionFile = useCallback(
    (file) => {
      if (!file) {
        return "Please select a transaction file.";
      }

      const extension = file.name.split(".").pop()?.toLowerCase();

      if (!["xlsx", "csv"].includes(extension)) {
        return "Only .xlsx and .csv files are supported.";
      }

      const fileType = getSettlementTransactionFileType(file);

      if (!fileType) {
        return `${file.name} must contain either "datestamp" or "timestamp" in the filename.`;
      }

      const maximumSize = 100 * 1024 * 1024;

      if (file.size > maximumSize) {
        return `${file.name} must not exceed 100MB.`;
      }

      return null;
    },
    [getSettlementTransactionFileType],
  );

  const handleSettlementTransactionFilesSelect = useCallback(
    (files) => {
      const selectedFiles = Array.from(files || []).filter(Boolean);

      if (!selectedFiles.length) return;

      if (selectedFiles.length > 2) {
        toast.error(
          "You can upload a maximum of two settlement transaction files.",
        );
        return;
      }

      const validatedFiles = [];

      for (const file of selectedFiles) {
        const validationError = validateSettlementTransactionFile(file);

        if (validationError) {
          toast.error(validationError);
          return;
        }

        validatedFiles.push({
          file,
          type: getSettlementTransactionFileType(file),
        });
      }

      setSettlementTransactionFiles((currentFiles) => {
        const nextFiles = {
          ...currentFiles,
        };

        for (const { file, type } of validatedFiles) {
          nextFiles[type] = file;
        }

        return nextFiles;
      });
    },
    [getSettlementTransactionFileType, validateSettlementTransactionFile],
  );

  const handleBrowseClick = useCallback(
    (tab) => {
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
    },
    [tabState],
  );

  const handleSettlementTransactionsBrowseClick = useCallback(() => {
    settlementTransactionsInputRef.current?.click();
  }, []);

  const handleSettlementTransactionsInputChange = useCallback(
    (event) => {
      handleSettlementTransactionFilesSelect(event.target.files);

      if (settlementTransactionsInputRef.current) {
        settlementTransactionsInputRef.current.value = "";
      }
    },
    [handleSettlementTransactionFilesSelect],
  );

  const handleSettlementTransactionsDragOver = useCallback((event) => {
    event.preventDefault();
    setIsSettlementTransactionsDragging(true);
  }, []);

  const handleSettlementTransactionsDragLeave = useCallback((event) => {
    event.preventDefault();
    setIsSettlementTransactionsDragging(false);
  }, []);

  const handleSettlementTransactionsDrop = useCallback(
    (event) => {
      event.preventDefault();
      setIsSettlementTransactionsDragging(false);

      handleSettlementTransactionFilesSelect(event.dataTransfer.files);
    },
    [handleSettlementTransactionFilesSelect],
  );

  const handleRemoveSettlementTransactionFiles = useCallback(() => {
    setSettlementTransactionFiles({
      datestampFile: null,
      timestampFile: null,
    });

    setSettlementDateMode("single");
    setSettlementDateValue("");

    if (settlementTransactionsInputRef.current) {
      settlementTransactionsInputRef.current.value = "";
    }
  }, []);

  const handleRemoveSettlementTransactionFile = useCallback((file) => {
    if (!file) return;

    setSettlementTransactionFiles((currentFiles) => {
      if (currentFiles.datestampFile === file) {
        return {
          ...currentFiles,
          datestampFile: null,
        };
      }

      if (currentFiles.timestampFile === file) {
        return {
          ...currentFiles,
          timestampFile: null,
        };
      }

      return currentFiles;
    });
  }, []);

  // Transaction list dater picker handleres

  const handleSettlementDateModeChange = useCallback((nextMode) => {
    setSettlementDateMode(nextMode);

    setSettlementDateValue(
      nextMode === "range"
        ? {
            startDate: "",
            endDate: "",
          }
        : "",
    );
  }, []);

  const handleSettlementDateChange = useCallback((value) => {
    setSettlementDateValue(value);
  }, []);

  const handleClearSettlementDate = useCallback(() => {
    setSettlementDateValue(
      settlementDateMode === "range"
        ? {
            startDate: "",
            endDate: "",
          }
        : "",
    );
  }, [settlementDateMode]);

  const handleUploadSettlementTransactions = useCallback(async () => {
    const { datestampFile, timestampFile } = settlementTransactionFiles;

    if (!datestampFile || !timestampFile) {
      toast.error(
        "Both the datestamp and timestamp files are required before uploading.",
      );
      return;
    }

    if (!hasValidSettlementPeriod) {
      toast.error("Please select the settlement period before uploading.");
      return;
    }

    const isRange = settlementDateMode === "range";

    const reportDate = isRange
      ? `${formatDate(settlementDateValue.startDate)} - ${formatDate(
          settlementDateValue.endDate,
        )}`
      : formatDate(settlementDateValue);

    const batchName = `${reportDate} Settlement`;

    try {
      const response = await uploadSettlementTransactionsMutation.mutateAsync({
        datestampFile,
        timestampFile,
        reportDate,
        batchName,
      });

      setSettlementTransactionFiles({
        datestampFile: null,
        timestampFile: null,
      });

      setSettlementDateMode("single");
      setSettlementDateValue("");

      if (settlementTransactionsInputRef.current) {
        settlementTransactionsInputRef.current.value = "";
      }

      toast.success(
        response?.message || "Settlement transactions uploaded successfully.",
      );

      toast(
        `Total rows: ${response?.totalRows || 0}
Valid rows: ${response?.validRows || 0}
Matched rows: ${response?.matchedRows || 0}
Unmatched fee rows: ${response?.unmatchedFeeRows || 0}
Skipped rows: ${response?.skippedRows || 0}`,
        {
          duration: 7000,
        },
      );
    } catch (error) {
      toast.error(
        getErrorMessage(
          error,
          "Unable to upload settlement transaction files.",
        ),
      );
    }
  }, [
    settlementTransactionFiles,
    settlementDateMode,
    settlementDateValue,
    hasValidSettlementPeriod,
    uploadSettlementTransactionsMutation,
  ]);

  const handleFileSelect = useCallback(
    async (files, tab) => {
      const selectedFiles = Array.from(files || []).filter(Boolean);

      if (!selectedFiles.length) return;

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

      setTabLoading(setExtractingTab, tab, true);

      try {
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

          const validationError = validateUploadFileBeforeParsing(file, tab);

          if (validationError) {
            failedFiles.push({
              name: file.name,
              message: validationError,
            });
            continue;
          }

          seenFileIds.add(fileId);

          try {
            const parsedData = await parseUploadFileInWorker(file, tab);
            const analysisData =
              parsedData.analysis || buildAnalysis(parsedData, tab);

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
              message:
                error?.message || "Unable to read the uploaded Excel file.",
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
          toast.error(
            `Skipped duplicate files: ${skippedDuplicates.join(", ")}`,
          );
        }

        if (failedFiles.length > 0) {
          toast.error(failedFiles.map((item) => item.message).join("\n"));
        }
      } finally {
        setTabLoading(setExtractingTab, tab, false);
      }
    },
    [setTabLoading, tabState],
  );

  const handleInputChange = useCallback(
    (event, tab) => {
      handleFileSelect(event.target.files, tab);

      if (tab === "wire" && wireInputRef.current) {
        wireInputRef.current.value = "";
      }

      if (tab === "payment" && paymentInputRef.current) {
        paymentInputRef.current.value = "";
      }
    },
    [handleFileSelect],
  );

  const handleDragOver = useCallback(
    (event, tab) => {
      event.preventDefault();
      updateTabState(tab, { isDragging: true });
    },
    [updateTabState],
  );

  const handleDragLeave = useCallback(
    (event, tab) => {
      event.preventDefault();
      updateTabState(tab, { isDragging: false });
    },
    [updateTabState],
  );

  const handleDrop = useCallback(
    (event, tab) => {
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
    },
    [handleFileSelect, tabState, updateTabState],
  );

  const handleRemoveFile = useCallback((tab, index) => {
    setTabState((prev) => {
      const updatedFiles = prev[tab].files.filter(
        (_, itemIndex) => itemIndex !== index,
      );

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
  }, []);

  const handleFileTabChange = useCallback(
    (tab, index) => {
      updateTabState(tab, {
        activeFileIndex: index,
      });
    },
    [updateTabState],
  );

  const handlePaymentSheetTabChange = useCallback(
    (sheetKey) => {
      if (!isPaymentSheet || !activeFile) return;
      if (!activeFile.paymentSheets?.[sheetKey]) return;

      updatePaymentFile(currentTab.activeFileIndex, {
        activePaymentSheet: sheetKey,
      });
    },
    [activeFile, currentTab.activeFileIndex, isPaymentSheet, updatePaymentFile],
  );

  const handleProcess = useCallback(async () => {
    const currentFiles = tabState[activeTab].files.map(
      (fileItem) => fileItem.file,
    );

    if (!currentFiles.length) {
      toast.error(
        isWireSheet
          ? "Please upload at least one wiresheet file."
          : "Please upload at least one payment sheet file.",
      );
      return;
    }

    setTabLoading(setUploadingTab, activeTab, true);

    try {
      await uploadFilesMutation.mutateAsync({
        wireFiles: isWireSheet ? currentFiles : [],
        paymentFiles: isPaymentSheet ? currentFiles : [],
      });

      resetTab(activeTab);

      toast.success(
        isWireSheet
          ? "Wiresheet files uploaded successfully."
          : "Payment sheet files uploaded successfully.",
      );
    } catch (error) {
      toast.error(getErrorMessage(error, "Unable to upload selected files."));
    } finally {
      setTabLoading(setUploadingTab, activeTab, false);
    }
  }, [
    activeTab,
    isPaymentSheet,
    isWireSheet,
    resetTab,
    setTabLoading,
    tabState,
    uploadFilesMutation,
  ]);

  // Filter modal handlers for the review issue

  const handleOpenReviewFilters = useCallback(() => {
    setReviewFilterDraft({
      ...appliedReviewFilters,
    });

    setIsReviewFilterModalOpen(true);
  }, [appliedReviewFilters]);

  const handleCloseReviewFilters = useCallback(() => {
    setReviewFilterDraft({
      ...appliedReviewFilters,
    });

    setIsReviewFilterModalOpen(false);
  }, [appliedReviewFilters]);

  const handleReviewFilterChange = useCallback((name, value) => {
    setReviewFilterDraft((currentFilters) => ({
      ...currentFilters,
      [name]: value,
    }));
  }, []);

  const handleApplyReviewFilters = useCallback(() => {
    setAppliedReviewFilters({
      ...reviewFilterDraft,
    });

    setReviewPage(1);
    setIsReviewFilterModalOpen(false);
  }, [reviewFilterDraft]);

  const handleResetReviewFilters = useCallback(() => {
    setReviewFilterDraft({
      ...EMPTY_REVIEW_FILTERS,
    });

    setAppliedReviewFilters({
      ...EMPTY_REVIEW_FILTERS,
    });

    setReviewPage(1);
    setIsReviewFilterModalOpen(false);
  }, []);

  // Review issue search handler

  const handleApplyReviewSearch = useCallback((searchValue) => {
    const normalizedSearch = String(searchValue || "").trim();

    setReviewSearchDraft(searchValue || "");
    setAppliedReviewSearch(normalizedSearch);
    setReviewPage(1);
  }, []);

  const handleClearReviewSearch = useCallback(() => {
    setReviewSearchDraft("");
    setAppliedReviewSearch("");
    setReviewPage(1);
  }, []);

  const handleEditInvalidRow = useCallback((row) => {
    setSelectedInvalidRow(row);
    setIsInvalidRowModalOpen(true);
  }, []);

  const handleCloseInvalidRowModal = useCallback(() => {
    setSelectedInvalidRow(null);
    setIsInvalidRowModalOpen(false);
  }, []);

  const handleSaveInvalidRow = useCallback(
    async (updatedData) => {
      const rowId = selectedInvalidRow?._id || getRowId(selectedInvalidRow);

      if (!rowId) {
        toast.error("Invalid row id missing.");
        return;
      }

      const payload = buildUnmatchedPaymentUpdatePayload(updatedData);

      try {
        await updateUnmatchedRowMutation.mutateAsync({
          id: rowId,
          payload,
        });

        await reviewRowsQuery.refetch();

        handleCloseInvalidRowModal();

        toast.success("Invalid row updated successfully.");
      } catch (error) {
        toast.error(
          getErrorMessage(error, "Unable to update invalid payment row."),
        );
      }
    },
    [
      handleCloseInvalidRowModal,
      reviewRowsQuery,
      selectedInvalidRow,
      updateUnmatchedRowMutation,
    ],
  );

  const handleReconcilePayments = useCallback(async () => {
    try {
      const response = await reconcileUnmatchedMutation.mutateAsync({});

      toast.success(response?.message || "Payments reconciled successfully.");

      toast(
        `Processed: ${response?.processedCount || 0}
Reconciled: ${response?.reconciledCount || 0}
Remaining: ${response?.remainingCount || 0}
Skipped: ${response?.skippedCount || 0}`,
        {
          duration: 6000,
        },
      );

      await reviewRowsQuery.refetch();
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to reconcile payments."));
    }
  }, [reconcileUnmatchedMutation, reviewRowsQuery]);

  const handleReviewRowsPerPageChange = useCallback((nextSize) => {
    const normalizedSize = Number(nextSize);

    setReviewPageSize((currentSize) => {
      if (currentSize === normalizedSize) return currentSize;

      setReviewPage(1);
      return normalizedSize;
    });
  }, []);

  const handleCancel = useCallback(
    (tab) => {
      resetTab(tab);
    },
    [resetTab],
  );

  return useMemo(
    () => ({
      activeTab,
      setActiveTab,

      tabState,
      currentTab,
      activeFile,

      reviewRows,
      reviewMeta,
      reviewFilterOptions,
      reviewPage,
      reviewPageSize,
      setReviewPage,
      handleReviewRowsPerPageChange,

      reviewSearchDraft,
      setReviewSearchDraft,
      appliedReviewSearch,

      reviewFilterDraft,
      appliedReviewFilters,
      isReviewFilterModalOpen,
      activeReviewFilterCount,

      selectedInvalidRow,
      isInvalidRowModalOpen,

      wireInputRef,
      paymentInputRef,
      ratesInputRef,
      countryInputRef,
      settlementTransactionsInputRef,

      hasReviewIssues,
      isReviewTab,
      isWireSheet,
      isPaymentSheet,
      isRatesTab,
      isCountriesTab,
      isSettlementTransactionsTab,
      hasBothSettlementTransactionFiles,

      currentFileLimit,
      currentFileCount,

      isCurrentTabExtracting,
      isCurrentTabBusy,

      activePaymentSheetKey,
      activePaymentSheetData,
      displayedRows,
      analysis,

      ratesFile,
      isRatesDragging,
      uploadMerchantRatesMutation,
      countryFile,
      isCountryDragging,
      uploadCountryMasterMutation,
      settlementTransactionFiles,
      settlementTransactionFileList,
      settlementDateMode,
      settlementDateValue,
      isSettlementTransactionsDragging,
      hasValidSettlementPeriod,
      uploadSettlementTransactionsMutation,

      reconcileUnmatchedMutation,
      reviewRowsQuery,

      handleBrowseClick,
      handleInputChange,
      handleDragOver,
      handleDragLeave,
      handleDrop,
      handleRemoveFile,
      handleCancel,
      handleFileTabChange,
      handlePaymentSheetTabChange,
      handleProcess,
      handleRatesBrowseClick,
      handleRatesInputChange,
      handleRatesDragOver,
      handleRatesDragLeave,
      handleRatesDrop,
      handleRemoveRatesFile,
      handleUploadRates,
      handleCountryBrowseClick,
      handleCountryInputChange,
      handleCountryDragOver,
      handleCountryDragLeave,
      handleCountryDrop,
      handleRemoveCountryFile,
      handleUploadCountryMaster,
      handleSettlementTransactionsBrowseClick,
      handleSettlementTransactionsInputChange,
      handleSettlementTransactionsDragOver,
      handleSettlementTransactionsDragLeave,
      handleSettlementTransactionsDrop,
      handleRemoveSettlementTransactionFiles,
      handleRemoveSettlementTransactionFile,
      handleUploadSettlementTransactions,
      handleSettlementDateModeChange,
      handleSettlementDateChange,
      handleClearSettlementDate,
      handleApplyReviewSearch,
      handleClearReviewSearch,
      handleOpenReviewFilters,
      handleCloseReviewFilters,
      handleReviewFilterChange,
      handleApplyReviewFilters,
      handleResetReviewFilters,
      handleEditInvalidRow,
      handleCloseInvalidRowModal,
      handleSaveInvalidRow,
      handleReconcilePayments,
    }),
    [
      activeFile,
      activePaymentSheetData,
      activePaymentSheetKey,
      activeTab,
      analysis,
      currentFileCount,
      currentFileLimit,
      currentTab,
      displayedRows,
      settlementTransactionFileList,
      hasBothSettlementTransactionFiles,
      settlementDateMode,
      settlementDateValue,
      handleBrowseClick,
      handleCancel,
      handleCloseInvalidRowModal,
      handleDragLeave,
      handleDragOver,
      handleDrop,
      handleEditInvalidRow,
      handleFileTabChange,
      handleInputChange,
      handlePaymentSheetTabChange,
      handleProcess,
      handleReconcilePayments,
      handleRemoveFile,
      handleReviewRowsPerPageChange,
      handleSaveInvalidRow,
      handleSettlementTransactionsBrowseClick,
      handleSettlementTransactionsInputChange,
      handleSettlementTransactionsDragOver,
      handleSettlementTransactionsDragLeave,
      handleSettlementTransactionsDrop,
      handleRemoveSettlementTransactionFiles,
      handleRemoveSettlementTransactionFile,
      handleUploadSettlementTransactions,
      handleSettlementDateModeChange,
      handleSettlementDateChange,
      handleClearSettlementDate,
      hasReviewIssues,
      isCurrentTabBusy,
      isCurrentTabExtracting,
      isInvalidRowModalOpen,
      isPaymentSheet,
      isReviewTab,
      isWireSheet,
      isSettlementTransactionsDragging,
      isSettlementTransactionsTab,
      hasValidSettlementPeriod,
      uploadSettlementTransactionsMutation,
      reconcileUnmatchedMutation,
      reviewMeta,
      reviewFilterOptions,
      reviewPage,
      reviewPageSize,
      reviewRows,
      reviewRowsQuery,
      selectedInvalidRow,
      tabState,
      activeReviewFilterCount,
      appliedReviewFilters,
      appliedReviewSearch,
      handleApplyReviewFilters,
      handleApplyReviewSearch,
      handleClearReviewSearch,
      handleCloseReviewFilters,
      handleOpenReviewFilters,
      handleResetReviewFilters,
      handleReviewFilterChange,
      isReviewFilterModalOpen,
      reviewFilterDraft,
      reviewSearchDraft,
    ],
  );
};
