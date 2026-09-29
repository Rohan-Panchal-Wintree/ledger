import { FileSpreadsheet, FileText, Mail } from "lucide-react";

import ActionMenu from "../UI/ActionMenu";

import { formatDate, formatInteger, formatNumber } from "../../utils/appUtils";

const getEmailStatusClassName = (status) => {
  switch (String(status || "").toLowerCase()) {
    case "sent":
      return "bg-success/10 text-success";

    case "failed":
      return "bg-error/10 text-error";

    case "queued":
    case "sending":
      return "bg-warning/10 text-warning";

    default:
      return "bg-surface-container text-on-surface-variant";
  }
};

const getSettlementRows = (report) =>
  Object.values(report?.currencySummary || {})
    .filter((row) => row?.currency)
    .map((row) => ({
      currency: row.currency,
      value: formatNumber(row.netSettlement),
    }));

export default function MerchantSettlementReportCard({
  report,
  onDownloadPdf,
  onDownloadExcel,
  onSendEmail,
  canSendEmail = false,
  isEmailPending = false,
}) {
  const recipients =
    report?.emailRecipients
      ?.map((recipient) => recipient?.email)
      .filter(Boolean)
      .join(", ") ||
    report?.emailTo ||
    "-";

  const settlementRows = getSettlementRows(report);

  const actions = [
    {
      key: "download-pdf",
      label: "Download PDF",
      icon: FileText,
      onClick: () => onDownloadPdf?.(report),
    },
    {
      key: "download-excel",
      label: "Download Excel",
      icon: FileSpreadsheet,
      onClick: () => onDownloadExcel?.(report),
    },
    ...(canSendEmail
      ? [
          {
            key: "send-email",
            label: "Send Email",
            icon: Mail,
            onClick: () => onSendEmail?.(report),
            disabled: isEmailPending,
          },
        ]
      : []),
  ];

  return (
    <article className="rounded-lg border border-outline-variant/10 bg-surface-container-lowest px-6 py-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="truncate text-base font-bold text-on-surface">
              {report?.merchantName || "Unknown Merchant"}
            </h3>

            <span
              className={`inline-flex rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${getEmailStatusClassName(
                report?.emailStatus,
              )}`}
            >
              {report?.emailStatus || "draft"}
            </span>
          </div>

          <p className="mt-1 text-xs font-medium text-on-surface-variant">
            MID: {report?.memberId || "-"}
          </p>
        </div>

        <ActionMenu actions={actions} disabled={isEmailPending} />
      </div>

      <div className="mt-5 grid grid-cols-1 border-t border-outline-variant/10 pt-4 md:grid-cols-4">
        <div className="border-b border-outline-variant/10 py-3 md:border-b-0 md:border-r md:pr-6">
          <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
            Report Period
          </p>

          <p className="mt-2 whitespace-nowrap text-sm font-semibold text-on-surface">
            {formatDate(report?.fromDate)} - {formatDate(report?.toDate)}
          </p>
        </div>

        <div className="border-b border-outline-variant/10 py-3 md:border-b-0 md:border-r md:px-6">
          <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
            Transactions
          </p>

          <p className="mt-2 text-sm font-bold text-on-surface">
            {formatInteger(report?.summary?.totalTransactions)}
          </p>
        </div>

        <div className="border-b border-outline-variant/10 py-3 md:border-b-0 md:border-r md:px-6">
          <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
            Net Settlement
          </p>

          <div className="mt-2 space-y-1">
            {settlementRows.length ? (
              settlementRows.map((row) => (
                <div
                  key={row.currency}
                  className="flex max-w-52 items-center justify-between gap-5 text-sm"
                >
                  <span className="font-semibold text-on-surface-variant">
                    {row.currency}
                  </span>

                  <span className="font-bold text-on-surface">{row.value}</span>
                </div>
              ))
            ) : (
              <span className="text-sm font-semibold text-on-surface">
                {formatNumber(report?.summary?.netSettlement)}
              </span>
            )}
          </div>
        </div>

        <div className="py-3 md:pl-6">
          <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
            Generated
          </p>

          <p className="mt-2 text-sm font-semibold text-on-surface">
            {formatDate(report?.createdAt)}
          </p>
        </div>
      </div>

      <div className="mt-4 border-t border-outline-variant/10 pt-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
          Email Recipients
        </p>

        <p className="mt-1 wrap-break-word text-sm font-medium text-on-surface">
          {recipients}
        </p>

        {report?.emailStatus === "failed" && report?.emailError ? (
          <p className="mt-2 text-xs font-medium text-error">
            {report.emailError}
          </p>
        ) : null}
      </div>
    </article>
  );
}
