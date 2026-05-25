export default function DashboardMiscellaneousRow({ item, formatPlainNumber }) {
  return (
    <tr className="group border-transparent table-row-hover">
      <td className="whitespace-nowrap px-8 py-4 text-sm font-medium text-on-surface">
        {item.entryTypeLabel || item.entryType || "-"}
      </td>

      <td className="whitespace-nowrap px-8 py-4 text-sm font-semibold text-on-surface">
        {item.merchantDisplayName || item.merchantName || "-"}
      </td>

      <td className="whitespace-nowrap px-8 py-4 text-sm font-medium text-on-surface-variant">
        {item.bankLabel || "-"}
      </td>

      <td className="whitespace-nowrap px-8 py-4 text-sm font-medium text-on-surface-variant">
        {item.linkedMid || item.mid || "-"}
      </td>

      <td className="whitespace-nowrap px-8 py-4 text-sm font-bold text-on-surface">
        {item.processingCurrency || "-"}
      </td>

      <td className="whitespace-nowrap px-8 py-4 text-right text-sm font-extrabold tabular-nums text-on-surface">
        {formatPlainNumber(item.amountPaid || 0)}
      </td>

      <td className="whitespace-nowrap px-8 py-4 text-right text-sm font-extrabold tabular-nums text-on-surface">
        {formatPlainNumber(item.settlementAmount || 0)}
      </td>

      <td className="min-w-60 px-8 py-4 text-sm font-medium text-on-surface-variant">
        {item.notes || "-"}
      </td>
    </tr>
  );
}
