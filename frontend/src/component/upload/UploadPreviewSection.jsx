import DataTable from "../UI/DataTable";
import Tabs from "../UI/Tabs";

import PaymentSheetRow from "./rows/PaymentSheetRow";
import WireSheetRow from "./rows/WireSheetRow";

import {
  formatAmountCell,
  paymentSheetOrder,
  paymentSheetRows,
  paymentSheetSections,
  wireSheetRows,
} from "../../utils/uploadUtils";

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

function PreviewHeader({
  hasUploadedFiles,
  isWireSheet,
  activePaymentSheetData,
}) {
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

          {!hasUploadedFiles ? (
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
          ) : null}
        </div>

        {hasUploadedFiles ? (
          <p className="mt-1 text-sm text-on-surface-variant">
            {isWireSheet
              ? "Showing only: MERCHANT NAME, MID, START DATE, END DATE, PROCESSING CURRENCY, AMOUNT"
              : `Showing ${
                  activePaymentSheetData?.label || "payment"
                } rows with Merchant Name + MID and at most one missing mapped value.`}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function WirePreviewTable({ rows, keyPrefix }) {
  return (
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
}

function PaymentPreviewTable({ rows, keyPrefix }) {
  return (
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
}

export default function UploadPreviewSection({
  isWireSheet,
  isPaymentSheet,
  hasUploadedFiles,
  activeFile,
  activePaymentSheetKey,
  activePaymentSheetData,
  displayedRows,
  onPaymentSheetTabChange,
}) {
  const rows = hasUploadedFiles
    ? displayedRows
    : isWireSheet
      ? wireSheetRows
      : paymentSheetRows;

  const keyPrefix = hasUploadedFiles
    ? activeFile?.id || (isWireSheet ? "wire" : "payment")
    : isWireSheet
      ? "sample-wire"
      : "sample-payment";

  return (
    <section className="space-y-6">
      {isPaymentSheet && activeFile?.paymentSheets ? (
        <Tabs
          activeTab={activePaymentSheetKey}
          onChange={onPaymentSheetTabChange}
          className="mb-1"
          tabs={paymentSheetOrder.map((sheetKey) => ({
            label: paymentSheetSections[sheetKey].label,
            value: sheetKey,
            disabled: !activeFile.paymentSheets?.[sheetKey],
          }))}
        />
      ) : null}

      <PreviewHeader
        hasUploadedFiles={hasUploadedFiles}
        isWireSheet={isWireSheet}
        activePaymentSheetData={activePaymentSheetData}
      />

      {isWireSheet ? (
        <WirePreviewTable rows={rows} keyPrefix={keyPrefix} />
      ) : (
        <PaymentPreviewTable rows={rows} keyPrefix={keyPrefix} />
      )}
    </section>
  );
}
