import { Download } from "lucide-react";

import Button from "../UI/Button";

import { formatDate, formatNumber } from "../../utils/appUtils";

export default function PaymentSheetRow({
  row,
  canDownload = false,
  onDownload,
}) {
  return (
    <tr className="table-row-hover">
      <td className="whitespace-nowrap px-8 py-4">
        <div>
          <p className="text-sm font-bold text-on-surface">
            {row.fileName || "-"}
          </p>
        </div>
      </td>

      <td className="whitespace-nowrap px-8 py-4 text-sm text-on-surface-variant">
        {formatDate(row.paymentDate)}
      </td>

      <td className="whitespace-nowrap px-8 py-4 text-right text-sm">
        <span className="inline-flex items-center justify-end gap-1.5 rounded-full bg-green-500/10 px-3 py-1.5 font-bold text-green-600">
          {row.successfulPayments ?? 0}
        </span>
      </td>

      <td className="whitespace-nowrap px-8 py-4 text-right text-sm">
        <span className="inline-flex items-center justify-end gap-1.5 rounded-full bg-red-400/10 px-3 py-1.5 font-bold text-red-600">
          {row.invalidCount ?? 0}
        </span>
      </td>

      <td className="whitespace-nowrap px-8 py-4 text-right text-sm">
        <span className="inline-flex items-center justify-end gap-1.5 rounded-full bg-yellow-400/10 px-3 py-1.5 font-bold text-yellow-600">
          {row.unmatchedCount ?? 0}
        </span>
      </td>

      <td className="whitespace-nowrap px-8 py-4 text-right text-sm font-bold text-on-surface">
        {formatNumber(row.totalRows)}
      </td>

      <td className="whitespace-nowrap px-8 py-4 text-right text-sm font-bold text-on-surface">
        {formatNumber(row.totalPaid)}
      </td>

      <td className="whitespace-nowrap px-8 py-4 text-right text-sm font-bold text-primary">
        {formatNumber(row.totalSettlement)}
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
