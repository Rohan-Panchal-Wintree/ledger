import { Check, X } from "lucide-react";

import ActionMenu from "../UI/ActionMenu";

const formatText = (value) => {
  const normalized = String(value ?? "").trim();

  return normalized || "-";
};

const formatRate = (value, suffix = "") => {
  const number = Number(value);

  if (!Number.isFinite(number)) return "-";

  return `${number}${suffix}`;
};

const getUserId = (user) => {
  if (!user) return "";

  if (typeof user === "string") {
    return user;
  }

  return user._id || user.id || "";
};

export default function MerchantSettlementApprovalRow({
  request,
  currentUser,
  onApprove,
  onReject,
  isActionPending = false,
}) {
  const isAdmin = currentUser?.role === "admin";

  const makerId = getUserId(request?.makerId);
  const currentUserId = getUserId(currentUser);

  const isOwnRequest =
    Boolean(makerId) &&
    Boolean(currentUserId) &&
    String(makerId) === String(currentUserId);

  const canApprove =
    isAdmin && request?.status === "PENDING_APPROVAL" && !isOwnRequest;

  const actions = canApprove
    ? [
        {
          key: "approve",
          label: "Approve",
          icon: Check,
          onClick: () => onApprove?.(request),
          disabled: isActionPending,
          className: "text-success",
        },
        {
          key: "reject",
          label: "Reject",
          icon: X,
          onClick: () => onReject?.(request),
          disabled: isActionPending,
          destructive: true,
        },
      ]
    : [];

  const oldRates = request?.oldRates || {};
  const newRates = request?.newRates || {};

  return (
    <tr className="border-b border-outline-variant/10 transition-colors last:border-b-0 hover:bg-surface-container-low/50">
      <td className="px-6 py-4 align-top">
        <div className="min-w-40">
          <p className="text-sm font-bold text-on-surface">
            {formatText(request?.merchantName)}
          </p>

          <p className="mt-1 text-xs font-medium text-on-surface-variant">
            MID: {formatText(request?.memberId)}
          </p>
        </div>
      </td>

      <td className="px-6 py-4 align-top">
        <span className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-primary">
          {formatText(request?.action)}
        </span>
      </td>

      <td className="px-6 py-4 align-top">
        <div className="min-w-48 space-y-1 text-xs">
          {(request?.changedFields || []).length ? (
            request.changedFields.map((field) => (
              <div key={field} className="flex gap-2">
                <span className="font-semibold text-on-surface-variant">
                  {field}:
                </span>

                <span className="text-on-surface">
                  {formatRate(oldRates[field])}
                  {" → "}
                  {formatRate(newRates[field])}
                </span>
              </div>
            ))
          ) : (
            <span className="text-on-surface-variant">
              New rate configuration
            </span>
          )}
        </div>
      </td>

      <td className="px-6 py-4 align-top">
        <div className="min-w-40">
          <p className="text-sm font-semibold text-on-surface">
            {formatText(
              request?.makerName ||
                request?.makerId?.name ||
                request?.requestedByName,
            )}
          </p>

          <p className="mt-1 text-xs text-on-surface-variant">
            {formatText(
              request?.makerEmail ||
                request?.makerId?.email ||
                request?.requestedByEmail,
            )}
          </p>
        </div>
      </td>

      <td className="px-6 py-4 align-top">
        <div className="min-w-56 space-y-2">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
              Change Reason
            </p>

            <p className="mt-1 text-sm text-on-surface">
              {formatText(request?.changeReason)}
            </p>
          </div>

          {request?.status === "REJECTED" ? (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-error">
                Rejection Reason
              </p>

              <p className="mt-1 text-sm font-medium text-error">
                {formatText(request?.checkerComment)}
              </p>
            </div>
          ) : null}
        </div>
      </td>

      <td className="px-6 py-4 text-center align-top">
        <span
          className={`inline-flex rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${
            request?.status === "REJECTED"
              ? "bg-error/10 text-error"
              : "bg-warning/10 text-warning"
          }`}
        >
          {request?.status === "REJECTED" ? "Rejected" : "Pending"}
        </span>
      </td>

      <td className="whitespace-nowrap px-6 py-4 text-right align-top">
        {isAdmin ? (
          isOwnRequest ? (
            <span className="text-xs font-medium text-on-surface-variant">
              Own Request
            </span>
          ) : (
            <ActionMenu
              actions={actions}
              disabled={!canApprove || isActionPending}
            />
          )
        ) : (
          <span className="text-xs text-on-surface-variant">-</span>
        )}
      </td>
    </tr>
  );
}
