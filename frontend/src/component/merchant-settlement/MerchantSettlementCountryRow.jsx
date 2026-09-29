import { Pencil, Power } from "lucide-react";

import ActionMenu from "../UI/ActionMenu";

const formatText = (value) => {
  const normalized = String(value ?? "").trim();

  return normalized || "-";
};

export default function MerchantSettlementCountryRow({
  country,
  onEdit,
  onDeactivate,
  onActivate,
  canManage = false,
  isStatusPending = false,
}) {
  const isActive = country?.status === "active";

  const actions = [
    {
      key: "edit",
      label: "Edit",
      icon: Pencil,
      onClick: () => onEdit?.(country),
      disabled: !canManage || isStatusPending,
    },

    isActive
      ? {
          key: "deactivate",
          label: "Deactivate",
          icon: Power,
          onClick: () => onDeactivate?.(country),
          disabled: !canManage || isStatusPending,
          destructive: true,
        }
      : {
          key: "activate",
          label: "Reactivate",
          icon: Power,
          onClick: () => onActivate?.(country),
          disabled: !canManage || isStatusPending,
          className: "text-success",
        },
  ];

  return (
    <tr className="border-b border-outline-variant/10 transition-colors last:border-b-0 hover:bg-surface-container-low/50">
      <td className="px-6 py-4 align-top">
        <p className="text-sm font-bold text-on-surface">
          {formatText(country?.transactionCountryName)}
        </p>
      </td>

      <td className="px-6 py-4 align-top">
        <span className="text-sm font-semibold text-on-surface">
          {formatText(country?.feeCountryCode)}
        </span>
      </td>

      <td className="px-6 py-4 align-top">
        <span
          className={`inline-flex rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${
            country?.countryCategory === "NONEU"
              ? "bg-warning/10 text-warning"
              : "bg-surface-container text-on-surface-variant"
          }`}
        >
          {country?.countryCategory === "NONEU"
            ? "NON EU"
            : formatText(country?.countryCategory)}
        </span>
      </td>

      <td className="px-6 py-4 text-center align-top">
        <span
          className={`inline-flex rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${
            isActive
              ? "bg-success/10 text-success"
              : "bg-surface-container text-on-surface-variant"
          }`}
        >
          {formatText(country?.status)}
        </span>
      </td>

      <td className="whitespace-nowrap px-6 py-4 text-right align-top">
        {canManage ? (
          <ActionMenu
            actions={actions}
            disabled={!canManage || isStatusPending}
          />
        ) : (
          <span className="text-sm text-on-surface-variant">-</span>
        )}
      </td>
    </tr>
  );
}
