import Badge from "../UI/Badge";

import { formatDate, formatNumber } from "../../utils/appUtils";

export default function WiresheetRow({ row, getStatusVariant }) {
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
        {formatDate(row.startDate)} → {formatDate(row.endDate)}
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
        <Badge variant={getStatusVariant(row.status)} textSize="11px">
          {row.status || "-"}
        </Badge>
      </td>

      <td className="whitespace-nowrap px-8 py-4 text-sm text-on-surface-variant">
        {formatDate(row.uploadedAt)}
      </td>

      <td className="whitespace-nowrap px-8 py-4 text-sm text-on-surface-variant">
        {row.uploadedBy?.name || row.uploadedBy?.email || "-"}
      </td>
    </tr>
  );
}
