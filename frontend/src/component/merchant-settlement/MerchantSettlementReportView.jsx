import { useState } from "react";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  CheckCircle2,
  FileText,
  Mail,
  ReceiptText,
  Send,
  TriangleAlert,
} from "lucide-react";

import PageHeader from "../UI/PageHeader";
import StatCard from "../UI/StatCard";

import { useSelector } from "react-redux";

import {
  formatDate,
  formatInteger,
  getErrorMessage,
} from "../../utils/appUtils";

import Button from "../UI/Button";
import DataTable, { readStoredRowsPerPage } from "../UI/DataTable";
import EmptyState from "../UI/EmptyState";
import Spinner from "../UI/Spinner";

import MerchantSettlementBatchRow from "./MerchantSettlementBatchRow";
import MerchantSettlementReportCard from "./MerchantSettlementReportCard";

import { selectCurrentUser } from "../../store/slices/Auth.slice";

import {
  downloadMerchantSettlementReportExcel,
  downloadMerchantSettlementReportPdf,
  useMerchantSettlementBatches,
  useMerchantSettlementReports,
  useSendAllSettlementEmailsForBatch,
  useSendMerchantSettlementReportEmail,
} from "../../queries/merchantSettlementQueries";

const batchColumns = [
  { key: "batch", label: "Batch" },
  { key: "period", label: "Report Period" },
  { key: "files", label: "Source Files" },
  { key: "transactions", label: "Transactions" },
  { key: "matching", label: "Fee Matching" },
  { key: "status", label: "Status", align: "center" },
  { key: "open", label: "", align: "right" },
];

const getDownloadFileName = (response, fallbackFileName) => {
  const disposition = response?.headers?.["content-disposition"] || "";

  const utfMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i);

  if (utfMatch?.[1]) {
    return decodeURIComponent(utfMatch[1]);
  }

  const standardMatch = disposition.match(/filename="?([^"]+)"?/i);

  return standardMatch?.[1] || fallbackFileName;
};

const downloadBlobResponse = (response, fallbackFileName) => {
  const blob =
    response?.data instanceof Blob ? response.data : new Blob([response?.data]);

  const url = window.URL.createObjectURL(blob);

  const link = document.createElement("a");

  link.href = url;
  link.download = getDownloadFileName(response, fallbackFileName);

  document.body.appendChild(link);
  link.click();
  link.remove();

  window.URL.revokeObjectURL(url);
};

export default function MerchantSettlementReportView({
  searchQuery = "",
  onResetSearch,
}) {
  const currentUser = useSelector(selectCurrentUser);

  const normalizedRole = String(currentUser?.role || "")
    .trim()
    .toLowerCase();

  const canSendEmails = ["admin", "finance", "settlement"].includes(
    normalizedRole,
  );

  const [selectedBatch, setSelectedBatch] = useState(null);

  const [batchPage, setBatchPage] = useState(1);

  const [batchPageSize, setBatchPageSize] = useState(readStoredRowsPerPage);

  const [reportPage, setReportPage] = useState(1);

  const [reportPageSize, setReportPageSize] = useState(readStoredRowsPerPage);

  const [sendingReportId, setSendingReportId] = useState(null);

  const {
    data: batchesResponse,
    isLoading: isBatchesLoading,
    isFetching: isBatchesFetching,
  } = useMerchantSettlementBatches(
    {
      search:
        !selectedBatch && searchQuery.trim() ? searchQuery.trim() : undefined,

      page: batchPage,
      limit: batchPageSize,
    },
    {
      enabled: !selectedBatch,
    },
  );

  const selectedBatchId = selectedBatch?._id || selectedBatch?.id || "";

  const {
    data: reportsResponse,
    isLoading: isReportsLoading,
    isFetching: isReportsFetching,
  } = useMerchantSettlementReports(
    {
      settlementBatchId: selectedBatchId || undefined,

      search:
        selectedBatch && searchQuery.trim() ? searchQuery.trim() : undefined,

      page: reportPage,
      limit: reportPageSize,
    },
    {
      enabled: Boolean(selectedBatchId),
    },
  );

  const sendEmailMutation = useSendMerchantSettlementReportEmail();

  const sendAllEmailsMutation = useSendAllSettlementEmailsForBatch();

  const batches = batchesResponse?.items ?? [];

  const batchMeta = batchesResponse?.meta ?? {
    total: 0,
    page: batchPage,
    limit: batchPageSize,
    totalPages: 0,
  };

  const reports = reportsResponse?.items ?? [];

  const reportMeta = reportsResponse?.meta ?? {
    total: 0,
    page: reportPage,
    limit: reportPageSize,
    totalPages: 0,
  };

  const handleSelectBatch = (batch) => {
    setSelectedBatch(batch);
    setReportPage(1);
    onResetSearch?.();
  };

  const handleBack = () => {
    setSelectedBatch(null);
    setReportPage(1);
    onResetSearch?.();
  };

  const handleDownloadPdf = async (report) => {
    const id = report?._id || report?.id;

    if (!id) return;

    try {
      const response = await downloadMerchantSettlementReportPdf(id);

      downloadBlobResponse(
        response,
        `${report?.memberId || "merchant"}-settlement.pdf`,
      );
    } catch (error) {
      toast.error(getErrorMessage(error, "Unable to download settlement PDF."));
    }
  };

  const handleDownloadExcel = async (report) => {
    const id = report?._id || report?.id;

    if (!id) return;

    try {
      const response = await downloadMerchantSettlementReportExcel(id);

      downloadBlobResponse(
        response,
        `${report?.memberId || "merchant"}-settlement.xlsx`,
      );
    } catch (error) {
      toast.error(
        getErrorMessage(error, "Unable to download settlement Excel file."),
      );
    }
  };

  const handleSendEmail = async (report) => {
    if (!canSendEmails) return;

    const id = report?._id || report?.id;

    if (!id) return;

    try {
      setSendingReportId(id);

      const result = await sendEmailMutation.mutateAsync(id);

      toast.success(
        result?.message || "Settlement report email sent successfully.",
      );
    } catch (error) {
      toast.error(
        getErrorMessage(error, "Unable to send settlement report email."),
      );
    } finally {
      setSendingReportId(null);
    }
  };

  const handleSendAllEmails = async () => {
    if (!selectedBatchId || !canSendEmails) return;

    try {
      const result = await sendAllEmailsMutation.mutateAsync(selectedBatchId);

      const queuedCount = result?.data?.queuedCount ?? 0;

      const failedCount = result?.data?.failedCount ?? 0;

      toast.success(
        `${result?.message || "Settlement emails queued successfully."} Queued: ${queuedCount}, Failed: ${failedCount}.`,
      );
    } catch (error) {
      toast.error(getErrorMessage(error, "Unable to queue settlement emails."));
    }
  };

  /*
  |--------------------------------------------------------------------------
  | Page 1 — Settlement batches
  |--------------------------------------------------------------------------
  */

  if (!selectedBatch) {
    return (
      <DataTable
        title="Settlement Report Batches"
        description="Select a settlement batch to view its merchant reports."
        columns={batchColumns}
        page={batchPage}
        pageSize={batchPageSize}
        totalItems={batchMeta.total}
        onPageChange={setBatchPage}
        onRowsPerPageChange={(size) => {
          setBatchPageSize(size);
          setBatchPage(1);
        }}
        isLoading={isBatchesLoading}
        isFetching={isBatchesFetching}
        itemLabel="batches"
        isEmpty={batches.length === 0}
        emptyTitle={
          searchQuery.trim()
            ? "No matching settlement batches found."
            : "No settlement batches found."
        }
        emptyDescription={
          searchQuery.trim()
            ? "Try adjusting your search."
            : "Settlement report batches will appear after transaction files are processed."
        }
        emptyIcon={ReceiptText}
      >
        {batches.map((batch) => (
          <MerchantSettlementBatchRow
            key={batch._id || batch.id}
            batch={batch}
            onSelect={handleSelectBatch}
          />
        ))}
      </DataTable>
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Page 2 — Merchant reports
  |--------------------------------------------------------------------------
  */

  return (
    <section className="space-y-6">
      <div className="rounded-2xl bg-surface-lowest px-5 py-5">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={handleBack}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-container text-on-surface transition hover:bg-surface-container-high"
            aria-label="Back to settlement batches"
          >
            <ArrowLeft size={20} />
          </button>

          <div className="min-w-0 flex-1">
            <PageHeader
              title={
                selectedBatch?.reportDate
                  ? `Settlement Report - ${formatDate(
                      selectedBatch.reportDate,
                    )}`
                  : selectedBatch?.fromDate
                    ? `Settlement Report - ${formatDate(
                        selectedBatch.fromDate,
                      )}`
                    : "Settlement Report"
              }
              description={
                selectedBatch?.fromDate && selectedBatch?.toDate
                  ? `Report period: ${formatDate(
                      selectedBatch.fromDate,
                    )} - ${formatDate(selectedBatch.toDate)}`
                  : "Merchant settlement reports for the selected batch."
              }
              actions={
                canSendEmails ? (
                  <Button
                    type="button"
                    leftIcon={<Send size={16} />}
                    loading={sendAllEmailsMutation.isPending}
                    disabled={
                      sendAllEmailsMutation.isPending || reports.length === 0
                    }
                    onClick={handleSendAllEmails}
                  >
                    Send All Emails
                  </Button>
                ) : null
              }
              className="flex-1 p-0"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Total Rows"
          value={formatInteger(selectedBatch?.totalRows)}
          icon={FileText}
          valueClassName="text-2xl"
        />

        <StatCard
          label="Valid Rows"
          value={formatInteger(selectedBatch?.validRows)}
          icon={CheckCircle2}
          valueClassName="text-2xl"
        />

        <StatCard
          label="Matched"
          value={formatInteger(selectedBatch?.matchedRows)}
          icon={CheckCircle2}
          valueClassName="text-2xl"
        />

        <StatCard
          label="Unmatched"
          value={formatInteger(selectedBatch?.unmatchedFeeRows)}
          icon={TriangleAlert}
          valueClassName="text-2xl"
        />
        <StatCard
          label="Reports"
          value={formatInteger(reportMeta.total)}
          icon={ReceiptText}
          valueClassName="text-2xl"
        />
      </div>

      {isReportsLoading || isReportsFetching ? (
        <div className="flex min-h-52 items-center justify-center rounded-lg border border-outline-variant/10 bg-surface-container-lowest">
          <Spinner type="md" />
        </div>
      ) : reports.length === 0 ? (
        <EmptyState
          title={
            searchQuery.trim()
              ? "No matching merchant reports found."
              : "No merchant reports found."
          }
          description={
            searchQuery.trim()
              ? "Try adjusting your search."
              : "No generated merchant reports are available for this settlement batch."
          }
          compact
        />
      ) : (
        <div className="space-y-4">
          {reports.map((report) => {
            const reportId = report._id || report.id;

            return (
              <MerchantSettlementReportCard
                key={reportId}
                report={report}
                onDownloadPdf={handleDownloadPdf}
                onDownloadExcel={handleDownloadExcel}
                onSendEmail={handleSendEmail}
                canSendEmail={canSendEmails}
                isEmailPending={
                  sendEmailMutation.isPending && sendingReportId === reportId
                }
              />
            );
          })}

          {reportMeta.totalPages > 1 ? (
            <div className="flex flex-col gap-3 rounded-lg bg-surface-container-low/30 px-6 py-4 text-xs font-bold uppercase tracking-widest text-on-surface-variant sm:flex-row sm:items-center sm:justify-between">
              <span>
                Page {reportMeta.page} of {reportMeta.totalPages}
              </span>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={reportPage <= 1}
                  onClick={() => setReportPage((page) => Math.max(1, page - 1))}
                >
                  Previous
                </Button>

                <Button
                  type="button"
                  size="sm"
                  disabled={reportPage >= reportMeta.totalPages}
                  onClick={() =>
                    setReportPage((page) =>
                      Math.min(reportMeta.totalPages, page + 1),
                    )
                  }
                >
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
