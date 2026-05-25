export default function PaymentSheetRow({
  row,
  index,
  keyPrefix,
  formatAmountCell,
}) {
  return (
    <tr
      key={`${keyPrefix}-${row.mid || index}-${index}`}
      className="group table-row-hover"
    >
      <td className="whitespace-nowrap px-6 py-5 font-medium text-on-surface">
        {row.bank || "-"}
      </td>

      <td className="whitespace-nowrap px-6 py-5 text-on-surface-variant">
        {row.merchantName || "-"}
      </td>

      <td className="whitespace-nowrap px-6 py-5 text-on-surface-variant">
        {row.mid || "-"}
      </td>

      <td className="whitespace-nowrap px-6 py-5 text-on-surface-variant">
        {row.startDate || "-"}
      </td>

      <td className="whitespace-nowrap px-6 py-5 text-on-surface-variant">
        {row.endDate || "-"}
      </td>

      <td className="whitespace-nowrap px-6 py-5 text-on-surface">
        {row.processingCurrency || "-"}
      </td>

      <td className="whitespace-nowrap px-6 py-5 font-bold text-on-surface">
        {row.amount || "-"}
      </td>

      <td className="whitespace-nowrap px-6 py-5 text-on-surface">
        {row.rate || "-"}
      </td>

      <td className="whitespace-nowrap px-6 py-5 text-on-surface">
        {row.settlementCurrency || "-"}
      </td>

      <td className="whitespace-nowrap px-6 py-5 font-bold text-on-surface">
        {formatAmountCell(row.finalAmount)}
      </td>
    </tr>
  );
}
