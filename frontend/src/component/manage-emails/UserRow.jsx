import { Mail, MoreVertical, Pencil, Trash2 } from "lucide-react";

import Badge from "../UI/Badge";

export const roleLabels = {
  admin: "Admin",
  merchant: "Merchant",
  finance: "Finance",
  settlement: "Settlement",
};

export function getRoleVariant(role) {
  if (role === "admin") return "DP";
  if (role === "merchant") return "secondary";
  if (role === "finance") return "outline";
  if (role === "settlement") return "TW";

  return "default";
}

export default function UserRow({
  user,
  onEdit,
  onDelete,
  isDeleting = false,
}) {
  return (
    <tr className="table-row-hover">
      <td className="whitespace-nowrap px-8 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/8">
            <Mail className="text-primary" size={16} />
          </div>

          <div>
            <span className="block text-sm font-bold text-on-surface capitalize">
              {user.name || "-"}
            </span>

            <span className="mt-1 block text-xs font-medium text-on-surface-variant">
              {user.email || "-"}
            </span>
          </div>
        </div>
      </td>

      <td className="whitespace-nowrap px-8 py-4 text-center">
        <Badge variant={getRoleVariant(user.role)} textSize="10px">
          {roleLabels[user.role] || user.role || "-"}
        </Badge>
      </td>

      <td className="whitespace-nowrap px-8 py-4 text-sm font-bold text-on-surface-variant">
        {user.role === "merchant" ? user.merchantMid || "-" : "-"}
      </td>

      <td className="whitespace-nowrap px-8 py-4 text-right">
        <div className="dropdown dropdown-end">
          <button
            type="button"
            tabIndex={0}
            disabled={isDeleting}
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
                disabled={isDeleting}
                onClick={() => onEdit(user)}
                className="flex items-center gap-2 rounded-lg text-sm font-semibold text-on-surface"
              >
                <Pencil size={15} />
                Edit
              </button>
            </li>

            <li>
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => onDelete(user)}
                className="flex items-center gap-2 rounded-lg text-sm font-semibold text-error disabled:cursor-not-allowed disabled:opacity-60"
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
