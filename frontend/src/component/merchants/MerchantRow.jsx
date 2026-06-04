import { Building2, MoreVertical, Pencil, Trash2 } from "lucide-react";

import Badge from "../UI/Badge";

import { formatDate } from "../../utils/appUtils";

function getStatusVariant(status) {
  return status?.toLowerCase() === "active" ? "DP" : "secondary";
}

export default function MerchantRow({
  merchant,
  canManageMerchants,
  isDeletePending,
  onEdit,
  onDelete,
}) {
  return (
    <tr className="group transition-all duration-200 hover:bg-surface-container-low/45">
      <td className="whitespace-nowrap px-8 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/8">
            <Building2 className="text-primary" size={16} />
          </div>

          <div className="min-w-0">
            <span className="block truncate text-sm font-bold text-on-surface">
              {merchant.merchantName || "-"}
            </span>

            <span className="mt-1 block text-[11px] font-medium uppercase tracking-wide text-on-surface-variant/75">
              {merchant.merchantTag || "No tag added"}
            </span>
          </div>
        </div>
      </td>

      <td className="whitespace-nowrap px-8 py-4 text-sm font-medium text-on-surface-variant">
        {merchant.mid || "-"}
      </td>

      <td className="whitespace-nowrap px-8 py-4 text-center">
        <Badge variant={getStatusVariant(merchant.status)}>
          {merchant.status || "unknown"}
        </Badge>
      </td>

      <td className="whitespace-nowrap px-8 py-4 text-sm font-medium text-on-surface-variant">
        {formatDate(merchant.createdAt)}
      </td>

      <td className="whitespace-nowrap px-8 py-4 text-sm font-medium text-on-surface-variant">
        {formatDate(merchant.updatedAt)}
      </td>

      <td className="whitespace-nowrap px-8 py-4 text-right">
        <div className="dropdown dropdown-left dropdown-end relative z-30">
          <button
            type="button"
            tabIndex={0}
            disabled={!canManageMerchants}
            className="btn btn-ghost btn-circle btn-sm text-on-surface-variant hover:bg-surface-container disabled:cursor-not-allowed disabled:opacity-50"
          >
            <MoreVertical size={18} />
          </button>

          <ul
            tabIndex={0}
            className="dropdown-content menu z-20 w-44 rounded-lg border border-outline-variant/10 bg-surface-container-lowest p-2"
          >
            <li>
              <button
                type="button"
                onClick={() => onEdit?.(merchant)}
                disabled={!canManageMerchants}
                className="flex items-center gap-2 rounded-lg text-sm font-semibold text-on-surface"
              >
                <Pencil size={15} />
                Edit
              </button>
            </li>

            <li>
              <button
                type="button"
                onClick={() => onDelete?.(merchant)}
                disabled={!canManageMerchants || isDeletePending}
                className="flex items-center gap-2 rounded-lg text-sm font-semibold text-error"
              >
                <Trash2 size={15} />
                Delete
              </button>
            </li>
          </ul>
        </div>
      </td>
    </tr>
  );
}
