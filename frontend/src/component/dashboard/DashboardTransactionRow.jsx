import { Landmark } from "lucide-react";

import Badge from "../UI/Badge";

import { formatDate } from "../../utils/appUtils";
import {
  formatDashboardAmount,
  getDashboardStatusVariant,
  getMerchantShortName,
} from "../../utils/dashboardUtils";

const centeredColumns = [
  "processingCurrency",
  "settlementCurrency",
  "rate",
  "status",
];

const amountColumns = [
  "receivedAmount",
  "paidAmount",
  "settlementPaidAmount",
  "balance",
];

function getCellClassName(columnKey) {
  if (columnKey === "merchantName") return "px-8 py-4";

  if (centeredColumns.includes(columnKey)) {
    return "whitespace-nowrap px-8 py-4 text-center text-xs font-bold text-on-surface";
  }

  if (amountColumns.includes(columnKey)) {
    return "whitespace-nowrap px-8 py-4 text-right text-sm font-extrabold tabular-nums text-on-surface";
  }

  return "whitespace-nowrap px-8 py-4 text-sm font-medium text-on-surface-variant";
}

function renderCellContent(item, columnKey) {
  switch (columnKey) {
    case "acquirer":
      return (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/6 transition-transform duration-200 group-hover:scale-105">
            <Landmark className="text-primary" size={16} />
          </div>

          <div className="min-w-0">
            <span className="block truncate text-sm font-bold text-on-surface">
              {item.acquirer || "-"}
            </span>
          </div>
        </div>
      );

    case "merchantName":
      return (
        <div
          className="flex items-center justify-between gap-2 text-sm font-bold text-on-surface capitalize"
          title={item.merchantName}
        >
          <div className="min-w-0">
            <span className="block max-w-37.5 truncate font-semibold text-on-surface">
              {item.merchantName || "-"}
            </span>

            <span className="mt-1 block text-[11px] font-medium uppercase tracking-wide text-on-surface-variant/75">
              MID {item.mid || "-"}
            </span>
          </div>

          <Badge
            variant={getMerchantShortName(item.merchantTag)}
            className="ml-2 shrink-0"
          >
            {getMerchantShortName(item.merchantTag)}
          </Badge>
        </div>
      );

    case "startDate":
    case "endDate":
      return formatDate(item[columnKey]);

    case "processingCurrency":
      return (
        <span className="rounded-full bg-primary/8 px-3 py-1.5 font-bold tracking-wide text-primary">
          {item.processingCurrency || "-"}
        </span>
      );

    case "settlementCurrency":
      return (
        <span className="rounded-full bg-surface-container px-3 py-1.5 font-bold tracking-wide text-on-surface">
          {item.settlementDisplayCurrency || item.settlementCurrency || "-"}
        </span>
      );

    case "rate":
      return (
        <span className="rounded-full bg-primary/8 px-3 py-1.5 font-bold uppercase tracking-widest text-primary">
          {Number(item.lastPaymentRate || 0).toFixed(2)}
        </span>
      );

    case "receivedAmount":
      return formatDashboardAmount(
        item.receivedAmount || 0,
        item.receivedCurrency || item.processingCurrency || "EUR",
      );

    case "paidAmount":
      return formatDashboardAmount(
        item.paidAmount || 0,
        item.processingCurrency || item.receivedCurrency || "EUR",
      );

    case "settlementPaidAmount":
      return formatDashboardAmount(
        item.settlementPaidAmount || 0,
        item.settlementDisplayCurrency || item.settlementCurrency || "EUR",
      );

    case "balance":
      return formatDashboardAmount(
        item.balance || 0,
        item.processingCurrency || item.receivedCurrency || "EUR",
      );

    case "status":
      return (
        <Badge variant={getDashboardStatusVariant(item.status)} textSize="10px">
          {String(item.status || "pending").replace(/_/g, " ")}
        </Badge>
      );

    default:
      return item[columnKey] || "-";
  }
}

export default function DashboardTransactionRow({
  item,
  index,
  startIndex,
  visibleColumns,
}) {
  return (
    <tr className="group border-transparent table-row-hover transition-all duration-200">
      {visibleColumns.map((column) => (
        <td
          key={`${column.key}-${startIndex + index}`}
          className={getCellClassName(column.key)}
        >
          {renderCellContent(item, column.key)}
        </td>
      ))}
    </tr>
  );
}
