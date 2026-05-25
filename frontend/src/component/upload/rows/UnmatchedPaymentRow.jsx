export default function UnmatchedPaymentRow({ row, formatPreviewDate }) {
  return (
    <tr className="group table-row-hover">
      <td className="whitespace-nowrap px-8 py-4 text-sm font-bold text-on-surface">
        {row.merchantName || "-"}
      </td>

      <td className="whitespace-nowrap px-8 py-4 text-sm font-medium text-on-surface-variant">
        {row.paymentBank || "Unknown Bank"}
      </td>

      <td className="whitespace-nowrap px-8 py-4 text-sm font-medium text-on-surface-variant">
        {row.sourceMid || "-"}
      </td>

      <td className="whitespace-nowrap px-8 py-4 text-sm font-medium text-on-surface-variant">
        {formatPreviewDate(row.sourceStartDate)}
      </td>

      <td className="whitespace-nowrap px-8 py-4 text-sm font-medium text-on-surface-variant">
        {formatPreviewDate(row.sourceEndDate)}
      </td>

      <td className="whitespace-nowrap px-8 py-4">
        <span className="rounded-full bg-primary/10 px-3 py-1 text-[11px] font-bold text-primary">
          {row.sourceProcessingCurrency || "-"}
        </span>
      </td>

      <td className="whitespace-nowrap px-8 py-4">
        <span className="rounded-full bg-surface-container px-3 py-1 text-[11px] font-bold text-on-surface">
          {row.paymentCurrency || "-"}
        </span>
      </td>

      <td className="whitespace-nowrap px-8 py-4 text-sm font-extrabold text-error">
        {row.amountPaid || "-"}
      </td>

      <td className="whitespace-nowrap px-8 py-4 text-sm font-medium text-on-surface">
        {row.retryCount || 0}
      </td>

      <td className="max-w-55 truncate px-8 py-4 text-sm font-medium text-on-surface-variant">
        {row.originalFilename || "-"}
      </td>

      <td className="min-w-65 px-8 py-4 text-sm font-medium text-on-surface-variant">
        {row.failureReason || "Settlement transaction not found"}
      </td>
    </tr>
  );
}
