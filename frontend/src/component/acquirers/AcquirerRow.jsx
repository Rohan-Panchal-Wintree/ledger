import { Landmark, MoreVertical, Pencil, Trash2 } from "lucide-react";

import { formatDate } from "../../utils/appUtils";

export default function AcquirerRow({
  acquirer,
  canManageAcquirers,
  isDeletePending,
  onEdit,
  onDelete,
}) {
  return (
    <tr className="group transition-all duration-200 hover:bg-surface-container-low/45">
      <td className="whitespace-nowrap px-8 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/8">
            <Landmark className="text-primary" size={16} />
          </div>

          <div className="min-w-0">
            <span className="block truncate text-sm font-bold text-on-surface">
              {acquirer.name || "-"}
            </span>
          </div>
        </div>
      </td>

      <td className="whitespace-nowrap px-8 py-4 text-sm font-medium text-on-surface-variant">
        {formatDate(acquirer.createdAt)}
      </td>

      <td className="whitespace-nowrap px-8 py-4 text-sm font-medium text-on-surface-variant">
        {formatDate(acquirer.updatedAt)}
      </td>

      <td className="whitespace-nowrap px-8 py-4 text-right">
        <div className="dropdown dropdown-left dropdown-end relative z-30">
          <button
            type="button"
            tabIndex={0}
            disabled={!canManageAcquirers}
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
                onClick={() => onEdit?.(acquirer)}
                disabled={!canManageAcquirers}
                className="flex items-center gap-2 rounded-lg text-sm font-semibold text-on-surface"
              >
                <Pencil size={15} />
                Edit
              </button>
            </li>

            <li>
              <button
                type="button"
                onClick={() => onDelete?.(acquirer)}
                disabled={!canManageAcquirers || isDeletePending}
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
