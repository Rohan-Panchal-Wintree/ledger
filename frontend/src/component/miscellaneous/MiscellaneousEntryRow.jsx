import { Pencil, Trash2 } from "lucide-react";

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
  return (
    <article
      className={`
        flex flex-col justify-between gap-4 bg-surface-container-lowest px-6 py-3
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
            {entry.merchantDisplayName ||
              entry.merchantName ||
              "Unknown Merchant"}
          </h3>

          <p className="truncate text-[11px] font-medium text-on-surface-variant/60">
            {entry.bankLabel || "-"} •{" "}
            <span className="font-mono">
              {entry.linkedMid || entry.mid || "-"}
            </span>
          </p>
        </div>
      </div>

      <div className="hidden min-w-30 xl:block">
        <p className="text-[10px] font-bold uppercase tracking-tighter text-on-surface-variant/40">
          Sheet Date
        </p>

        <p className="text-xs font-semibold text-on-surface/80">
          {entry.paymentSheetDateLabel || formatDate(entry.paymentSheetDate)}
        </p>
      </div>

      <div className="flex items-center gap-10 lg:gap-16">
        <div className="min-w-22.5">
          <p className="text-[10px] font-bold uppercase tracking-tighter text-on-surface-variant/40">
            Processing
          </p>

          <p className="text-sm font-bold text-on-surface">
            {formatNumber(entry.amountPaid)}{" "}
            <span className="text-[10px] text-primary/50">
              {entry.processingCurrency}
            </span>
          </p>
        </div>

        <div className="min-w-22.5">
          <p className="text-[10px] font-bold uppercase tracking-tighter text-on-surface-variant/40">
            Settlement
          </p>

          <p className="text-sm font-bold text-on-surface">
            {formatNumber(entry.settlementAmount)}{" "}
            <span className="text-[10px] text-secondary/60">
              {entry.settlementCurrency}
            </span>
          </p>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 pl-4">
        <button
          type="button"
          onClick={() => onEdit(entry)}
          className="flex h-8 items-center gap-2 rounded-md bg-surface-container px-3 text-xs font-bold text-on-surface-variant transition-colors hover:bg-primary/10 hover:text-primary"
        >
          <Pencil size={13} strokeWidth={2.5} />
          <span>Edit</span>
        </button>

        <button
          type="button"
          onClick={() => onDelete(entry)}
          disabled={isDeleting}
          className="flex h-8 w-8 items-center justify-center rounded-md text-red-400 transition-colors hover:bg-red-500/10 hover:text-red-600 disabled:opacity-40"
          title="Delete"
        >
          <Trash2 size={14} strokeWidth={2.5} />
        </button>
      </div>
    </article>
  );
}
