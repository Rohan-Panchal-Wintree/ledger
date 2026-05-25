import { AlertTriangle, FileSpreadsheet, FileUp, X } from "lucide-react";

import UploadFile from "../component/UploadFile";
import EditInvalidPaymentRowModal from "../component/EditInvalidPaymentRowModal";

import DataTable from "../component/UI/DataTable";
import Spinner from "../component/UI/Spinner";
import Tabs from "../component/UI/Tabs";

import UploadIssuesSection from "../component/upload/UploadIssuesSection";
import PaymentSheetRow from "../component/upload/rows/PaymentSheetRow";
import WireSheetRow from "../component/upload/rows/WireSheetRow";

import { useUploadPageController } from "../hooks/useUploadPageController";

import {
  formatAmountCell,
  paymentSheetOrder,
  paymentSheetRows,
  paymentSheetSections,
  wireSheetRows,
} from "../utils/uploadUtils";

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
  } = useUploadPageController();

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
            {isWireSheet ? "Wiresheets selected" : "Payment sheets selected"}
          </span>
        </div>
      )}
    </div>
  );

  const renderFileTabs = () => {
    if (!currentTab.files.length) return null;

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

  const renderPaymentSheetTabs = () => {
    if (!isPaymentSheet || !activeFile?.paymentSheets) return null;

    return (
      <Tabs
        activeTab={activePaymentSheetKey}
        onChange={handlePaymentSheetTabChange}
        className="mb-1"
        tabs={paymentSheetOrder.map((sheetKey) => ({
          label: paymentSheetSections[sheetKey].label,
          value: sheetKey,
          disabled: !activeFile.paymentSheets?.[sheetKey],
        }))}
      />
    );
  };

  const renderExtractedDataHeader = () => {
    const hasUploadedFiles = currentTab.files.length > 0;

    return (
      <div className="flex items-center justify-between">
        <div className="w-full">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-bold tracking-tight text-on-surface">
              {hasUploadedFiles
                ? "Extracted File Data (Valid Table Rows)"
                : isWireSheet
                  ? "Expected Wire-sheet Format"
                  : "Expected Payment Sheet Format"}
            </h2>

            {!hasUploadedFiles && (
              <div className="inline-flex flex-wrap items-center gap-2 rounded-lg px-4 py-3 text-xs font-medium text-on-surface-variant">
                <span className="font-bold text-on-surface">
                  Expected file name:
                </span>

                <span className="rounded-lg bg-surface-container-high px-2 py-1 font-mono text-primary">
                  {isWireSheet
                    ? "Bankname automation wiresheet DD.MM.YYYY to DD.MM.YYYY.xlsx"
                    : "01.02 Payments.xlsx"}
                </span>
              </div>
            )}
          </div>

          {hasUploadedFiles && (
            <p className="mt-1 text-sm text-on-surface-variant">
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
  };

  const renderWireTable = (rows, keyPrefix) => (
    <DataTable
      columns={wirePreviewColumns}
      totalItems={rows.length}
      isEmpty={rows.length === 0}
      emptyTitle="No wire-sheet rows found."
      emptyDescription="Upload a valid wiresheet file to preview extracted rows."
      showFooter={false}
    >
      {rows.map((row, index) => (
        <WireSheetRow
          key={`${keyPrefix}-${row.mid || index}-${index}`}
          row={row}
          index={index}
          keyPrefix={keyPrefix}
          formatAmountCell={formatAmountCell}
        />
      ))}
    </DataTable>
  );

  const renderPaymentTable = (rows, keyPrefix) => (
    <DataTable
      columns={paymentPreviewColumns}
      totalItems={rows.length}
      isEmpty={rows.length === 0}
      emptyTitle="No payment rows found."
      emptyDescription="Upload a valid payment sheet file to preview extracted rows."
      showFooter={false}
    >
      {rows.map((row, index) => (
        <PaymentSheetRow
          key={`${keyPrefix}-${row.mid || index}-${index}`}
          row={row}
          index={index}
          keyPrefix={keyPrefix}
          formatAmountCell={formatAmountCell}
        />
      ))}
    </DataTable>
  );

  const renderExtractedDataTable = () => {
    const hasUploadedFiles = currentTab.files.length > 0;

    if (hasUploadedFiles) {
      return isWireSheet
        ? renderWireTable(displayedRows, activeFile?.id || "wire")
        : renderPaymentTable(displayedRows, activeFile?.id || "payment");
    }

    return isWireSheet
      ? renderWireTable(wireSheetRows, "sample-wire")
      : renderPaymentTable(paymentSheetRows, "sample-payment");
  };

  const renderInvalidRowModal = () => (
    <EditInvalidPaymentRowModal
      open={isInvalidRowModalOpen}
      row={selectedInvalidRow}
      initialData={selectedInvalidRow?.fixedData || null}
      onClose={handleCloseInvalidRowModal}
      onSave={handleSaveInvalidRow}
    />
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
          />
        </div>

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

      {renderUploadTabs()}
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
        <section className="space-y-6">
          {renderPaymentSheetTabs()}
          {renderExtractedDataHeader()}
          {renderExtractedDataTable()}
        </section>
      )}

      {renderInvalidRowModal()}
    </div>
  );
}
