import {
  AlertTriangle,
  FileSpreadsheet,
  FileUp,
  Filter,
  X,
} from "lucide-react";
import { useSelector } from "react-redux";

import UploadFile from "../component/upload/UploadFile";
import EditInvalidPaymentRowForm from "../component/upload/EditInvalidPaymentRowForm";
import UploadPreviewSection from "../component/upload/UploadPreviewSection";
import ReviewIssuesFilterForm from "../component/upload/ReviewIssuesFilterForm";

import Spinner from "../component/UI/Spinner";
import Tabs from "../component/UI/Tabs";
import Button from "../component/UI/Button";
import Modal from "../component/UI/Modal";

import UploadIssuesSection from "../component/upload/UploadIssuesSection";

import { useUploadPageController } from "../hooks/useUploadPageController";
import { selectCurrentUser } from "../store/slices/Auth.slice";

const wirePreviewColumns = [
  { key: "merchantName", label: "Merchant Name" },
  { key: "mid", label: "MID" },
  { key: "startDate", label: "Start Date" },
  { key: "endDate", label: "End Date" },
  { key: "processingCurrency", label: "Processing Currency" },
  { key: "amount", label: "Amount", align: "right" },
];

const paymentPreviewColumns = [
  { key: "bank", label: "Bank" },
  { key: "merchantName", label: "Merchant Name" },
  { key: "mid", label: "MID" },
  { key: "startDate", label: "Start Date" },
  { key: "endDate", label: "End Date" },
  { key: "processingCurrency", label: "Currency" },
  { key: "amount", label: "Amount", align: "right" },
  { key: "rate", label: "Rate", align: "right" },
  { key: "settlementCurrency", label: "Settlement Currency" },
  { key: "finalAmount", label: "Final Amount", align: "right" },
];

export default function Upload() {
  const {
    activeTab,
    setActiveTab,

    currentTab,
    activeFile,

    reviewRows,
    reviewMeta,
    reviewPage,
    setReviewPage,
    handleReviewRowsPerPageChange,

    reviewFilterDraft,
    isReviewFilterModalOpen,
    activeReviewFilterCount,

    handleOpenReviewFilters,
    handleCloseReviewFilters,
    handleReviewFilterChange,
    handleApplyReviewFilters,
    handleResetReviewFilters,

    selectedInvalidRow,
    isInvalidRowModalOpen,

    wireInputRef,
    paymentInputRef,
    ratesInputRef,

    hasReviewIssues,
    isReviewTab,
    isWireSheet,
    isPaymentSheet,
    isRatesTab,

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
    handleEditInvalidRow,
    handleCloseInvalidRowModal,
    handleSaveInvalidRow,
    handleReconcilePayments,
  } = useUploadPageController();

  const currentUser = useSelector(selectCurrentUser);
  const normalizedRole = String(currentUser.role).trim().toLowerCase();

  const canUploadRates = ["admin", "support", "settlement"].includes(
    normalizedRole,
  );

  const renderUploadTabs = () => (
    <div className="flex items-center justify-between">
      <Tabs
        activeTab={activeTab}
        onChange={setActiveTab}
        tabs={[
          {
            label: "Wire-sheet",
            value: "wire",
            icon: FileSpreadsheet,
          },
          {
            label: "Payment Sheet",
            value: "payment",
            icon: FileUp,
          },
          ...(canUploadRates
            ? [
                {
                  label: "Rates",
                  value: "rates",
                  icon: FileSpreadsheet,
                },
              ]
            : []),
          ...(hasReviewIssues || isReviewTab
            ? [
                {
                  label: "Review Issues",
                  value: "review",
                  icon: AlertTriangle,
                },
              ]
            : []),
        ]}
      />

      {!isReviewTab && (
        <div className="inline-flex items-center gap-3 rounded-full bg-surface-container-low px-4 py-2 text-sm font-semibold text-on-surface">
          <span className="rounded-full bg-primary px-3 py-1 text-xs font-extrabold text-white">
            {currentFileCount}/{currentFileLimit}
          </span>

          <span className="text-on-surface-variant">
            {isRatesTab
              ? "Rates file selected"
              : isWireSheet
                ? "Wiresheets selected"
                : "Payment sheets selected"}
          </span>
        </div>
      )}
    </div>
  );

  const renderFileTabs = () => {
    if (isRatesTab || !currentTab.files.length) return null;

    return (
      <div className="mb-6 flex gap-2 overflow-x-auto scrollbar-hide">
        {currentTab.files.map((fileObj, index) => {
          const isActive = index === currentTab.activeFileIndex;

          return (
            <div
              key={fileObj.id}
              className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition ${
                isActive
                  ? "bg-primary text-white"
                  : "bg-surface-container text-on-surface-variant hover:bg-primary/5 hover:text-on-surface"
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
                aria-label={`Remove ${fileObj.name}`}
                onClick={() => handleRemoveFile(activeTab, index)}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          );
        })}
      </div>
    );
  };

  const renderInvalidRowModal = () => (
    <Modal
      open={isInvalidRowModalOpen}
      title="Edit Invalid Payment Row"
      description="Fix the row data before reconciliation."
      size="lg"
      onClose={handleCloseInvalidRowModal}
      footer={
        <>
          <Button
            type="button"
            variant="secondary"
            onClick={handleCloseInvalidRowModal}
          >
            Cancel
          </Button>

          <Button type="submit" form="invalid-payment-row-form">
            Save Changes
          </Button>
        </>
      }
    >
      <EditInvalidPaymentRowForm
        formId="invalid-payment-row-form"
        row={selectedInvalidRow}
        initialData={selectedInvalidRow?.fixedData || null}
        onSubmit={handleSaveInvalidRow}
      />
    </Modal>
  );

  if (isReviewTab) {
    return (
      <div className="w-full bg-background text-on-background">
        {renderUploadTabs()}

        <div className="mt-6">
          <UploadIssuesSection
            rows={reviewRows}
            meta={reviewMeta}
            page={reviewPage}
            onPageChange={setReviewPage}
            onPageSizeChange={handleReviewRowsPerPageChange}
            onEdit={handleEditInvalidRow}
            onReconcile={handleReconcilePayments}
            isReconciling={reconcileUnmatchedMutation.isPending}
            isFetching={reviewRowsQuery.isFetching}
            openReviewFilter={handleOpenReviewFilters}
            activeReviewFilterCount={activeReviewFilterCount}
          />
        </div>

        <Modal
          open={isReviewFilterModalOpen}
          title="Filter Review Issues"
          description="Filter unmatched and invalid payment rows."
          size="lg"
          onClose={handleCloseReviewFilters}
          footer={
            <>
              <Button
                type="button"
                variant="secondary"
                onClick={handleResetReviewFilters}
              >
                Clear
              </Button>

              <Button type="submit" form="review-issues-filter-form">
                Apply Filters
              </Button>
            </>
          }
        >
          <ReviewIssuesFilterForm
            formId="review-issues-filter-form"
            filters={reviewFilterDraft}
            onChange={handleReviewFilterChange}
            onApply={handleApplyReviewFilters}
          />
        </Modal>

        {renderInvalidRowModal()}
      </div>
    );
  }

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

      <input
        ref={ratesInputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={handleRatesInputChange}
      />

      {renderUploadTabs()}

      {isRatesTab ? (
        <UploadFile
          simpleUpload
          mode={ratesFile ? "filled" : "empty"}
          title={
            ratesFile ? "Upload Merchant Rates File" : "Upload Merchant Rates"
          }
          description="Select one CSV file. The file will be processed by the server after upload."
          selectedFile={ratesFile}
          isDragging={isRatesDragging}
          onBrowse={handleRatesBrowseClick}
          onDragOver={handleRatesDragOver}
          onDragLeave={handleRatesDragLeave}
          onDrop={handleRatesDrop}
          onRemove={handleRemoveRatesFile}
          onCancel={handleRemoveRatesFile}
          onProcess={handleUploadRates}
          isProcessing={uploadMerchantRatesMutation.isPending}
        />
      ) : (
        <>
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
            onRemove={() =>
              handleRemoveFile(activeTab, currentTab.activeFileIndex)
            }
            onCancel={() => handleCancel(activeTab)}
            onProcess={handleProcess}
            isProcessing={isCurrentTabBusy}
            analysis={analysis}
            showRates={isPaymentSheet}
          />

          {isCurrentTabExtracting ? (
            <div className="my-6 flex items-center justify-center rounded-lg border border-outline-variant/10 bg-surface-container-lowest px-8 py-10">
              <div className="flex flex-col items-center gap-3 text-center">
                <Spinner type="md" />

                <p className="text-sm font-bold text-on-surface">
                  Extracting file data...
                </p>

                <p className="text-xs text-on-surface-variant">
                  Please wait while we read and prepare the spreadsheet preview.
                </p>
              </div>
            </div>
          ) : (
            <UploadPreviewSection
              isWireSheet={isWireSheet}
              isPaymentSheet={isPaymentSheet}
              hasUploadedFiles={currentTab.files.length > 0}
              activeFile={activeFile}
              activePaymentSheetKey={activePaymentSheetKey}
              activePaymentSheetData={activePaymentSheetData}
              displayedRows={displayedRows}
              onPaymentSheetTabChange={handlePaymentSheetTabChange}
            />
          )}
        </>
      )}

      {renderInvalidRowModal()}
    </div>
  );
}
