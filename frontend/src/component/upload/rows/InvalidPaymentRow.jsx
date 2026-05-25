export default function InvalidPaymentRow({ row, onEdit }) {
  const displayRow = {
    ...row,
    ...(row.fixedData || {}),
  };

  const isUpdated = row.status === "fixed";

  return (
    <tr className="group table-row-hover">
      <td className="whitespace-nowrap px-8 py-4 text-sm font-medium text-on-surface-variant">
        {displayRow.sourceOriginalFilename || "-"}
      </td>

      <td className="whitespace-nowrap px-8 py-4 text-sm font-medium text-on-surface-variant">
        {displayRow.sourceSheetName || "-"}
      </td>

      <td className="whitespace-nowrap px-8 py-4 text-sm font-medium text-on-surface-variant">
        {displayRow.excelRowNumber || "-"}
      </td>

      <td className="whitespace-nowrap px-8 py-4 text-sm font-bold text-on-surface">
        {displayRow.merchantName ||
          row.normalizedRow?.["MERCHANT NAME"] ||
          row.rawRow?.["MERCHANT NAME"] ||
          "-"}
      </td>

      <td className="whitespace-nowrap px-8 py-4 text-sm font-medium text-on-surface-variant">
        {displayRow.mid || row.normalizedRow?.MID || row.rawRow?.MID || "-"}
      </td>

      <td className="min-w-65 px-8 py-4 text-sm font-medium text-on-surface-variant">
        {displayRow.failureReason || "Invalid or missing data"}
      </td>

      <td className="whitespace-nowrap px-8 py-4">
        <span
          className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${
            isUpdated
              ? "bg-green-500/10 text-green-600"
              : "bg-surface-container text-on-surface-variant"
          }`}
        >
          {isUpdated ? "Updated" : "Pending"}
        </span>
      </td>

      <td className="whitespace-nowrap px-8 py-4">
        <button
          type="button"
          onClick={() => onEdit(row)}
          className="rounded-full bg-surface-container px-4 py-2 text-xs font-bold text-on-surface transition hover:bg-primary/5"
        >
          Edit
        </button>
      </td>
    </tr>
  );
}
