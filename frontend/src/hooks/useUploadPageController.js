import { useCallback, useMemo, useRef, useState } from "react";
import { unstable_usePrompt, useBeforeUnload } from "react-router-dom";
import toast from "react-hot-toast";

import {
  useReconcileUnmatchedPaymentRows,
  useUnmatchedPaymentRows,
  useUpdateUnmatchedPaymentRow,
  useUploadFiles,
} from "../queries/uploadQueries";

import { getErrorMessage } from "../utils/appUtils";
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

export const useUploadPageController = () => {
  const [activeTab, setActiveTab] = useState("wire");
  const [tabState, setTabState] = useState(() =>
    createInitialUploadState(initialTabState),
  );

  const [extractingTab, setExtractingTab] = useState(createTabLoadingState);
  const [uploadingTab, setUploadingTab] = useState(createTabLoadingState);

  const [reviewPage, setReviewPage] = useState(1);
  const [reviewPageSize, setReviewPageSize] = useState(
    getInitialReviewPageSize,
  );

  const [selectedInvalidRow, setSelectedInvalidRow] = useState(null);
  const [isInvalidRowModalOpen, setIsInvalidRowModalOpen] = useState(false);

  const wireInputRef = useRef(null);
  const paymentInputRef = useRef(null);

  const uploadFilesMutation = useUploadFiles();
  const updateUnmatchedRowMutation = useUpdateUnmatchedPaymentRow();
  const reconcileUnmatchedMutation = useReconcileUnmatchedPaymentRows();

  const reviewRowsQuery = useUnmatchedPaymentRows({
    page: reviewPage,
    limit: reviewPageSize,
  });

  const reviewRows = reviewRowsQuery.data?.items || [];

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

  const currentTab = tabState[activeTab] || initialTabState;
  const activeFile = currentTab.files[currentTab.activeFileIndex] || null;

  const hasReviewIssues = (reviewMeta.total || reviewRows.length) > 0;

  const currentFileLimit = isReviewTab ? 0 : getFileLimit(activeTab);
  const currentFileCount = currentTab.files.length;

  const hasUnsavedFiles =
    tabState.wire.files.length > 0 || tabState.payment.files.length > 0;

  const isCurrentTabExtracting = Boolean(extractingTab[activeTab]);
  const isCurrentTabUploading = Boolean(uploadingTab[activeTab]);
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
      reviewPage,
      reviewPageSize,
      setReviewPage,
      handleReviewRowsPerPageChange,

      selectedInvalidRow,
      isInvalidRowModalOpen,

      wireInputRef,
      paymentInputRef,

      hasReviewIssues,
      isReviewTab,
      isWireSheet,
      isPaymentSheet,

      currentFileLimit,
      currentFileCount,

      isCurrentTabExtracting,
      isCurrentTabBusy,

      activePaymentSheetKey,
      activePaymentSheetData,
      displayedRows,
      analysis,

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
      hasReviewIssues,
      isCurrentTabBusy,
      isCurrentTabExtracting,
      isInvalidRowModalOpen,
      isPaymentSheet,
      isReviewTab,
      isWireSheet,
      reconcileUnmatchedMutation,
      reviewMeta,
      reviewPage,
      reviewPageSize,
      reviewRows,
      reviewRowsQuery,
      selectedInvalidRow,
      tabState,
    ],
  );
};
