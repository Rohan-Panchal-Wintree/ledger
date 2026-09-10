import { Pencil, Power } from "lucide-react";

import ActionMenu from "../UI/ActionMenu";

const formatRate = (value, suffix = "") => {
  const number = Number(value);

  if (!Number.isFinite(number)) return "-";

  return `${number}${suffix}`;
};

const formatText = (value) => {
  const normalizedValue = String(value ?? "").trim();

  return normalizedValue || "-";
};

export default function MerchantSettlementRateRow({
  rate,
  onEdit,
  onDeactivate,
  onActivate,
  canManage = false,
  isStatusPending = false,
}) {
  const isActive = rate?.status === "active";

  const countryLabel =
    rate?.countryRuleRaw ||
    rate?.country ||
    rate?.countryCode ||
    rate?.countryScope ||
    "ALL";

  const actions = [
    {
      key: "edit",
      label: "Edit",
      icon: Pencil,
      onClick: () => onEdit?.(rate),
      disabled: !canManage || isStatusPending,
    },
    isActive
      ? {
          key: "deactivate",
          label: "Deactivate",
          icon: Power,
          onClick: () => onDeactivate?.(rate),
          disabled: !canManage || isStatusPending,
          destructive: true,
        }
      : {
          key: "activate",
          label: "Activate",
          icon: Power,
          onClick: () => onActivate?.(rate),
          disabled: !canManage || isStatusPending,
          className: "text-success",
        },
  ];

  return (
    <tr className="border-b border-outline-variant/10 transition-colors last:border-b-0 hover:bg-surface-container-low/50">
      <td className="px-4 py-4 align-top">
        <div className="min-w-40">
          <p className="text-sm font-bold text-on-surface">
            {formatText(rate?.merchantName)}
          </p>

          <p className="mt-1 text-xs font-medium text-on-surface-variant">
            MID: {formatText(rate?.memberId)}
          </p>

          {rate?.partnerName ? (
            <p className="mt-1 text-xs text-on-surface-variant">
              {rate.partnerName}
            </p>
          ) : null}
        </div>
      </td>

      <td className="px-4 py-4 align-top">
        <div className="min-w-32">
          <p className="text-sm font-semibold text-on-surface">
            {formatText(rate?.brand)}
          </p>

          <p className="mt-1 text-xs font-medium text-on-surface-variant">
            {formatText(rate?.currency)}
          </p>
        </div>
      </td>

      <td className="px-4 py-4 align-top">
        <div className="min-w-36">
          <p className="text-sm font-semibold text-on-surface">
            {countryLabel}
          </p>

          <p className="mt-1 text-xs text-on-surface-variant">
            Gateway: {formatText(rate?.gatewayName || "ALL")}
          </p>
        </div>
      </td>

      <td className="px-4 py-4 text-right align-top">
        <span className="text-sm font-bold text-on-surface">
          {formatRate(rate?.mdrPercent, "%")}
        </span>
      </td>

      <td className="px-4 py-4 align-top">
        <div className="min-w-36 space-y-1 text-xs">
          <div className="flex justify-between gap-4">
            <span className="text-on-surface-variant">Approval</span>
            <span className="font-semibold text-on-surface">
              {formatRate(rate?.approvalFee)}
            </span>
          </div>

          <div className="flex justify-between gap-4">
            <span className="text-on-surface-variant">Decline</span>
            <span className="font-semibold text-on-surface">
              {formatRate(rate?.declineFee)}
            </span>
          </div>

          <div className="flex justify-between gap-4">
            <span className="text-on-surface-variant">Reversal</span>
            <span className="font-semibold text-on-surface">
              {formatRate(rate?.reversalFee)}
            </span>
          </div>

          <div className="flex justify-between gap-4">
            <span className="text-on-surface-variant">Chargeback</span>
            <span className="font-semibold text-on-surface">
              {formatRate(rate?.chargebackFee)}
            </span>
          </div>
        </div>
      </td>

      <td className="px-4 py-4 align-top">
        <div className="min-w-36 space-y-1 text-xs">
          <div className="flex justify-between gap-4">
            <span className="text-on-surface-variant">RR</span>
            <span className="font-semibold text-on-surface">
              {formatRate(rate?.rollingReservePercent, "%")}
            </span>
          </div>

          <div className="flex justify-between gap-4">
            <span className="text-on-surface-variant">Settlement</span>
            <span className="font-semibold text-on-surface">
              {formatRate(rate?.settlementExpensePercent, "%")}
            </span>
          </div>
        </div>
      </td>

      <td className="px-4 py-4 text-center align-top">
        <span
          className={`inline-flex rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${
            isActive
              ? "bg-success/10 text-success"
              : "bg-surface-container text-on-surface-variant"
          }`}
        >
          {rate?.status || "unknown"}
        </span>
      </td>

      <td className="whitespace-nowrap px-8 py-4 text-right">
        <ActionMenu
          actions={actions}
          disabled={!canManage || isStatusPending}
        />
      </td>
    </tr>
  );
}
