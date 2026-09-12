const formatText = (value) => {
  const normalized = String(value ?? "").trim();

  return normalized || "-";
};

const formatAmount = (value, currency = "") => {
  const number = Number(value);

  if (!Number.isFinite(number)) return "-";

  const formatted = number.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return currency ? `${formatted} ${currency}` : formatted;
};

const formatDate = (value) => {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString();
};

export default function MerchantSettlementTransactionRow({ transaction }) {
  const isMatched = transaction?.matchStatus === "matched";

  const countryLabel =
    transaction?.countryName ||
    transaction?.countryCode ||
    transaction?.isoCountry ||
    "-";

  return (
    <tr className="border-b border-outline-variant/10 transition-colors last:border-b-0 hover:bg-surface-container-low/50">
      {/* Transaction */}
      <td className="px-4 py-4 align-top">
        <div className="min-w-44">
          <p className="text-sm font-bold text-on-surface">
            {formatText(
              transaction?.paymentId ||
                transaction?.trackingId ||
                transaction?.orderId,
            )}
          </p>

          {transaction?.trackingId ? (
            <p className="mt-1 text-xs text-on-surface-variant">
              Tracking: {transaction.trackingId}
            </p>
          ) : null}

          <p className="mt-1 text-xs text-on-surface-variant">
            {formatDate(transaction?.transactionDate)}
          </p>
        </div>
      </td>

      {/* Merchant */}
      <td className="px-4 py-4 align-top">
        <div className="min-w-44">
          <p className="text-sm font-bold text-on-surface">
            {formatText(transaction?.merchantCompanyName)}
          </p>

          <p className="mt-1 text-xs text-on-surface-variant">
            MID: {formatText(transaction?.memberId)}
          </p>

          {transaction?.bankAccountId ? (
            <p className="mt-1 text-xs text-on-surface-variant">
              Account: {transaction.bankAccountId}
            </p>
          ) : null}
        </div>
      </td>

      {/* Processing */}
      <td className="px-4 py-4 align-top">
        <div className="min-w-32">
          <p className="text-sm font-semibold text-on-surface">
            {formatText(transaction?.paymentBrand)}
          </p>

          <p className="mt-1 text-xs text-on-surface-variant">
            {formatText(transaction?.currency)}
          </p>

          {transaction?.transactionMode ? (
            <p className="mt-1 text-xs text-on-surface-variant">
              {transaction.transactionMode}
            </p>
          ) : null}
        </div>
      </td>

      {/* Country */}
      <td className="px-4 py-4 align-top">
        <div className="min-w-32">
          <p className="text-sm font-semibold text-on-surface">
            {countryLabel}
          </p>

          <p className="mt-1 text-xs text-on-surface-variant">
            {formatText(transaction?.countryCategory)}
          </p>
        </div>
      </td>

      {/* Amount */}
      <td className="px-4 py-4 text-right align-top">
        <div className="min-w-32 space-y-1">
          <p className="text-sm font-bold text-on-surface">
            {formatAmount(transaction?.capturedAmount, transaction?.currency)}
          </p>

          <p className="text-xs text-on-surface-variant">
            Auth {formatAmount(transaction?.authAmount, transaction?.currency)}
          </p>
        </div>
      </td>

      {/* Fees */}
      <td className="px-4 py-4 text-right align-top">
        <div className="min-w-32">
          <p className="text-sm font-bold text-on-surface">
            {formatAmount(transaction?.totalFees, transaction?.currency)}
          </p>

          <p className="mt-1 text-xs text-on-surface-variant">
            MDR {formatAmount(transaction?.mdrFee, transaction?.currency)}
          </p>
        </div>
      </td>

      {/* Settlement */}
      <td className="px-4 py-4 text-right align-top">
        <p className="min-w-32 text-sm font-bold text-on-surface">
          {formatAmount(transaction?.netSettlement, transaction?.currency)}
        </p>
      </td>

      {/* Transaction Status */}
      <td className="px-4 py-4 text-center align-top">
        <span className="inline-flex rounded-full bg-surface-container px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
          {formatText(transaction?.status)}
        </span>
      </td>

      {/* Fee Match */}
      <td className="px-4 py-4 text-center align-top">
        <span
          className={`inline-flex rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${
            isMatched
              ? "bg-success/10 text-success"
              : "bg-warning/10 text-warning"
          }`}
        >
          {isMatched ? "Matched" : "Unmatched Fee"}
        </span>
      </td>
    </tr>
  );
}
