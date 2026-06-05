import { Download } from "lucide-react";

import Badge from "../UI/Badge";
import Button from "../UI/Button";

import { formatDate, formatNumber } from "../../utils/appUtils";

function getPeriodLabel(row) {
  if (row.matchedStartDate && row.matchedEndDate) {
    return `${formatDate(row.matchedStartDate)} → ${formatDate(
      row.matchedEndDate,
    )}`;
  }

  return `${formatDate(row.startDate)} → ${formatDate(row.endDate)}`;
}

export default function WiresheetRow({
  row,
  getStatusVariant,
  canDownload = false,
  onDownload,
}) {
  return (
    <tr className="table-row-hover">
      <td className="whitespace-nowrap px-8 py-4">
        <div>
          <p className="text-sm font-bold text-on-surface">
            {row.wiresheetName || "-"}
          </p>
        </div>
      </td>

      <td className="whitespace-nowrap px-8 py-4 text-sm text-on-surface-variant">
        {row.acquirerName || "Unknown Acquirer"}
      </td>

      <td className="whitespace-nowrap px-8 py-4 text-sm text-on-surface-variant">
        {getPeriodLabel(row)}
      </td>

      <td className="whitespace-nowrap px-8 py-4 text-right text-sm font-bold text-on-surface">
        {formatNumber(row.totalPayable)}
      </td>

      <td className="whitespace-nowrap px-8 py-4 text-right text-sm font-bold text-on-surface">
        {formatNumber(row.totalPaid)}
      </td>

      <td className="whitespace-nowrap px-8 py-4 text-right text-sm font-bold text-primary">
        {formatNumber(row.totalBalance)}
      </td>

      <td className="whitespace-nowrap px-8 py-4 text-sm">
        <Badge variant={getStatusVariant?.(row.status)} textSize="11px">
          {row.status || "-"}
        </Badge>
      </td>

      <td className="whitespace-nowrap px-8 py-4 text-sm text-on-surface-variant">
        {formatDate(row.uploadedAt)}
      </td>

      <td className="whitespace-nowrap px-8 py-4 text-sm text-on-surface-variant">
        {row.uploadedBy?.name || row.uploadedBy?.email || "-"}
      </td>

      {canDownload ? (
        <td className="whitespace-nowrap px-8 py-4 text-right">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            leftIcon={<Download className="h-4 w-4" />}
            onClick={onDownload}
          />
        </td>
      ) : null}
    </tr>
  );
}
