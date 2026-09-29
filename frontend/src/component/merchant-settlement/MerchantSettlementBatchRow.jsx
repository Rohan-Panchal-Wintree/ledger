import { ChevronRight, FileSpreadsheet } from "lucide-react";

import { formatDate, formatInteger } from "../../utils/appUtils";

const formatText = (value) => {
  const normalized = String(value ?? "").trim();

  return normalized || "-";
};

const getBatchDisplayName = (batch) => {
  if (batch?.reportDate) {
    return `Settlement Batch - ${formatDate(batch.reportDate)}`;
  }

  if (batch?.fromDate || batch?.toDate) {
    return `Settlement Batch - ${formatDate(batch?.fromDate || batch?.toDate)}`;
  }

  if (batch?.createdAt) {
    return `Settlement Batch - ${formatDate(batch.createdAt)}`;
  }

  return formatText(batch?.batchName);
};

const getPeriodLabel = (batch) => {
  const fromDate = batch?.fromDate;
  const toDate = batch?.toDate;

  if (fromDate && toDate) {
    return `${formatDate(fromDate)} - ${formatDate(toDate)}`;
  }

  if (batch?.reportDate) {
    return formatDate(batch.reportDate);
  }

  return "-";
};

const getFileLabel = (fileName, fallback) => {
  if (!fileName) return fallback;

  const normalized = String(fileName);

  if (normalized.toLowerCase().includes("datestamp")) {
    return "Datestamp File";
  }

  if (normalized.toLowerCase().includes("timestamp")) {
    return "Timestamp File";
  }

  return fallback;
};

export default function MerchantSettlementBatchRow({ batch, onSelect }) {
  const isCompleted = batch?.status === "completed";

  return (
    <tr
      role="button"
      tabIndex={0}
      onClick={() => onSelect?.(batch)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect?.(batch);
        }
      }}
      className="cursor-pointer transition-colors hover:bg-surface-container-low/60"
    >
      <td className="px-6 py-5 align-middle">
        <div className="min-w-48">
          <p className="text-sm font-bold text-on-surface">
            {getBatchDisplayName(batch)}
          </p>

          <p className="mt-1 text-xs font-medium text-on-surface-variant">
            Created {formatDate(batch?.createdAt)}
          </p>
        </div>
      </td>

      <td className="px-6 py-5 align-middle">
        <p className="whitespace-nowrap text-sm font-semibold text-on-surface">
          {getPeriodLabel(batch)}
        </p>
      </td>

      <td className="px-6 py-5 align-middle">
        <div className="min-w-44 space-y-2">
          {batch?.datestampFileName ? (
            <div className="flex items-center gap-2">
              <FileSpreadsheet
                size={14}
                className="shrink-0 text-on-surface-variant"
              />

              <span className="text-xs font-semibold text-on-surface">
                {getFileLabel(batch.datestampFileName, "Datestamp File")}
              </span>
            </div>
          ) : null}

          {batch?.timestampFileName ? (
            <div className="flex items-center gap-2">
              <FileSpreadsheet
                size={14}
                className="shrink-0 text-on-surface-variant"
              />

              <span className="text-xs font-semibold text-on-surface">
                {getFileLabel(batch.timestampFileName, "Timestamp File")}
              </span>
            </div>
          ) : null}
        </div>
      </td>

      <td className="px-6 py-5 align-middle">
        <div className="min-w-28 space-y-1">
          <div className="flex justify-between gap-4 text-xs">
            <span className="text-on-surface-variant">Total</span>

            <span className="font-bold text-on-surface">
              {formatInteger(batch?.totalRows)}
            </span>
          </div>

          <div className="flex justify-between gap-4 text-xs">
            <span className="text-on-surface-variant">Valid</span>

            <span className="font-semibold text-on-surface">
              {formatInteger(batch?.validRows)}
            </span>
          </div>
        </div>
      </td>

      <td className="px-6 py-5 align-middle">
        <div className="min-w-32 space-y-1">
          <div className="flex justify-between gap-4 text-xs">
            <span className="text-on-surface-variant">Matched</span>

            <span className="font-semibold text-success">
              {formatInteger(batch?.matchedRows)}
            </span>
          </div>

          <div className="flex justify-between gap-4 text-xs">
            <span className="text-on-surface-variant">Unmatched</span>

            <span className="font-semibold text-warning">
              {formatInteger(batch?.unmatchedFeeRows)}
            </span>
          </div>

          <div className="flex justify-between gap-4 text-xs">
            <span className="text-on-surface-variant">Skipped</span>

            <span className="font-semibold text-on-surface">
              {formatInteger(batch?.skippedRows)}
            </span>
          </div>
        </div>
      </td>

      <td className="px-6 py-5 text-center align-middle">
        <span
          className={`inline-flex rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${
            isCompleted
              ? "bg-success/10 text-success"
              : "bg-warning/10 text-warning"
          }`}
        >
          {formatText(batch?.status)}
        </span>
      </td>

      <td className="px-6 py-5 text-right align-middle">
        <ChevronRight size={18} className="text-on-surface-variant" />
      </td>
    </tr>
  );
}
