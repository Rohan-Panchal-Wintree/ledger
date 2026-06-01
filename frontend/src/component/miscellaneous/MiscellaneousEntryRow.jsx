import { MoreVertical, Pencil, Trash2 } from "lucide-react";

function formatEntryType(value) {
  return String(value || "payment")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function MiscellaneousEntryRow({
  entry,
  index,
  totalEntries,
  formatNumber,
  formatDate,
  onEdit,
  onDelete,
  isDeleting,
}) {
  const isAgentEntry = entry.entryType === "agent";

  return (
    <article
      className={`
        flex flex-col justify-between gap-4 bg-surface-container-lowest px-6 py-4
        transition-colors table-row-hover lg:flex-row lg:items-center
        ${index !== totalEntries - 1 ? "border-b border-outline-variant/10" : ""}
      `}
    >
      <div className="flex min-w-70 items-center gap-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-container text-[10px] font-black text-primary/70">
          {entry.entryType?.substring(0, 3).toUpperCase() || "PAY"}
        </div>

        <div className="min-w-0">
          <h3 className="truncate text-sm font-bold text-on-surface">
            {isAgentEntry
              ? entry.merchantName || "Unknown Agent"
              : entry.merchantDisplayName ||
                entry.merchantName ||
                "Unknown Merchant"}
          </h3>

          <p className="truncate text-[11px] font-medium text-on-surface-variant/70">
            {formatEntryType(entry.entryType)}
            {!isAgentEntry ? (
              <>
                {" "}
                • {entry.bankLabel || "-"} •{" "}
                <span className="font-mono">
                  {entry.linkedMid || entry.mid || "-"}
                </span>
              </>
            ) : null}
          </p>
        </div>
      </div>

      <div className="hidden min-w-30 xl:block">
        <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/50">
          Period
        </p>

        <p className="text-xs font-semibold text-on-surface/80">
          {formatDate(entry.startDate)} → {formatDate(entry.endDate)}
        </p>
      </div>

      <div className="flex items-center gap-10 lg:gap-16">
        <div className="min-w-22.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/50">
            Processing
          </p>

          <p className="text-sm font-bold text-on-surface">
            {formatNumber(entry.amountPaid)}{" "}
            <span className="text-[10px] text-primary/60">
              {entry.processingCurrency}
            </span>
          </p>
        </div>

        <div className="min-w-22.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/50">
            Settlement
          </p>

          <p className="text-sm font-bold text-on-surface">
            {formatNumber(entry.settlementAmount)}{" "}
            <span className="text-[10px] text-secondary/70">
              {entry.settlementCurrency}
            </span>
          </p>
        </div>
      </div>

      <div className="flex items-center justify-end pl-4">
        <div className="dropdown dropdown-left dropdown-end relative z-30">
          <button
            type="button"
            tabIndex={0}
            disabled={isDeleting}
            className="btn btn-ghost btn-circle btn-sm text-on-surface-variant hover:bg-surface-container disabled:cursor-not-allowed disabled:opacity-50"
          >
            <MoreVertical size={18} />
          </button>

          <ul
            tabIndex={0}
            className="dropdown-content menu z-20 w-44 rounded-lg border border-outline-variant/10 bg-surface-container-lowest p-2"
          >
            <li>
              <button
                type="button"
                onClick={() => onEdit(entry)}
                disabled={isDeleting}
                className="flex items-center gap-2 rounded-lg text-sm font-semibold text-on-surface"
              >
                <Pencil size={15} />
                Edit
              </button>
            </li>

            <li>
              <button
                type="button"
                onClick={() => onDelete(entry)}
                disabled={isDeleting}
                className="flex items-center gap-2 rounded-lg text-sm font-semibold text-error"
              >
                <Trash2 size={15} />
                Delete
              </button>
            </li>
          </ul>
        </div>
      </div>
    </article>
  );
}
