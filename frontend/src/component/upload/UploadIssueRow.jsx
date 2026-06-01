import { AlertTriangle, Pencil } from "lucide-react";

import Badge from "../UI/Badge";
import Button from "../UI/Button";

import {
  canEditIssueRow,
  getAmount,
  getBank,
  getCurrency,
  getIssueReason,
  getMerchantName,
  getMid,
  getPaymentDate,
  getSettlement,
  getSourcePeriod,
  getStatus,
} from "./uploadIssueConstants";

import { formatDate } from "../../utils/appUtils";
import { formatAmountCell } from "../../utils/uploadUtils";

function getStatusVariant(status) {
  if (status === "invalid") return "destructive";
  if (status === "unmatched") return "outline";

  return "secondary";
}

export default function UploadIssueRow({ row, onEdit }) {
  const status = getStatus(row);
  const sourcePeriod = getSourcePeriod(row);
  const settlement = getSettlement(row);

  return (
    <tr
      className={`table-row-hover ${
        status === "invalid" ? "bg-primary/5 hover:bg-primary/10" : ""
      }`}
    >
      <td className="whitespace-nowrap px-8 py-4">
        <Badge variant={getStatusVariant(status)}>{status}</Badge>
      </td>

      <td className="px-8 py-4">
        <div className="flex items-center gap-3 w-52">
          <div className="flex h-9 w-9 items-center justify-center">
            <AlertTriangle className="h-4 w-4 text-primary" />
          </div>

          <p className="text-sm font-bold capitalize text-on-surface">
            {getIssueReason(row)}
          </p>
        </div>
      </td>

      <td className="whitespace-nowrap px-8 py-4 text-sm font-medium text-on-surface">
        {getBank(row)}
      </td>

      <td className="whitespace-nowrap px-8 py-4 text-sm font-medium text-on-surface">
        {getMerchantName(row)}
      </td>

      <td className="whitespace-nowrap px-8 py-4 text-sm text-on-surface-variant">
        {getMid(row)}
      </td>

      <td className="whitespace-nowrap px-8 py-4 text-sm text-on-surface-variant">
        {formatDate(sourcePeriod.startDate)} →{" "}
        {formatDate(sourcePeriod.endDate)}
      </td>

      <td className="whitespace-nowrap px-8 py-4 text-sm text-on-surface-variant">
        {formatDate(getPaymentDate(row))}
      </td>

      <td className="whitespace-nowrap px-8 py-4 text-sm font-semibold text-on-surface">
        {getCurrency(row)}
      </td>

      <td className="whitespace-nowrap px-8 py-4 text-right text-sm font-bold text-on-surface">
        {formatAmountCell(getAmount(row))}
      </td>

      <td className="whitespace-nowrap px-8 py-4 text-right text-sm font-bold text-on-surface">
        {settlement.currency} {formatAmountCell(settlement.amount)}
      </td>

      <td className="whitespace-nowrap px-8 py-4 text-right">
        {canEditIssueRow(row) ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            leftIcon={<Pencil className="h-4 w-4" />}
            onClick={() => onEdit(row)}
          >
            Edit
          </Button>
        ) : (
          <span className="text-xs font-semibold text-on-surface-variant">
            No action
          </span>
        )}
      </td>
    </tr>
  );
}
