export default function DashboardTransactionRow({
  item,
  index,
  startIndex,
  visibleColumns,
  renderCellContent,
}) {
  return (
    <tr
      key={`${item.acquirer}-${item.merchant}-${startIndex + index}`}
      className="group border-transparent transition-all duration-200 table-row-hover"
    >
      {visibleColumns.map((column) => (
        <td
          key={`${column.key}-${startIndex + index}`}
          className={`px-8 py-4 ${
            column.key === "merchantName"
              ? ""
              : [
                    "processingCurrency",
                    "settlementCurrency",
                    "rate",
                    "status",
                  ].includes(column.key)
                ? "whitespace-nowrap text-center text-xs font-bold text-on-surface"
                : [
                      "receivedAmount",
                      "paidAmount",
                      "settlementPaidAmount",
                      "balance",
                    ].includes(column.key)
                  ? "whitespace-nowrap text-right text-sm font-extrabold tabular-nums text-on-surface"
                  : "whitespace-nowrap text-sm font-medium text-on-surface-variant"
          }`}
        >
          {renderCellContent(item, column.key)}
        </td>
      ))}
    </tr>
  );
}
