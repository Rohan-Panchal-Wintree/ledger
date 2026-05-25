import { CreditCard, Landmark, WalletCards } from "lucide-react";

import { formatNumber } from "../../utils/appUtils";

function CurrencyList({ title, items = {} }) {
  const entries = Object.entries(items).filter(
    ([, amount]) => Number(amount) !== 0,
  );

  return (
    <div className="rounded-2xl bg-surface-lowest p-5">
      <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-surface-variant">
        {title}
      </h3>

      <div className="mt-4 bg-surface-low rounded-2xl">
        {entries.length === 0 ? (
          <p className="text-sm text-surface-variant">No data available.</p>
        ) : (
          entries.map(([currency, amount]) => (
            <div
              key={currency}
              className="flex items-center justify-between gap-4 px-4 py-3"
            >
              <span className="text-sm font-bold text-on-surface px-2 py-1 bg-surface-container-highest rounded-lg">
                {currency}
              </span>

              <span className="text-sm font-extrabold text-on-surface">
                {formatNumber(amount)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function ReportSummaryCards({ summary = {} }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl bg-linear-to-br from-primary to-accent p-5 text-white">
          <Landmark className="h-5 w-5 text-white" />

          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-white/75">
            Total Received
          </p>

          <h2 className="mt-2 text-3xl font-extrabold text-white">
            {formatNumber(summary.totalReceived)}
          </h2>
        </div>

        <div className="rounded-2xl bg-surface-lowest p-5">
          <WalletCards className="h-5 w-5 text-brand" />

          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-surface-variant">
            Paid Against Processing
          </p>

          <h2 className="mt-2 text-2xl font-extrabold text-on-surface">
            {formatNumber(summary.totalPaidAgainstProcessing)}
          </h2>
        </div>

        <div className="rounded-2xl bg-surface-lowest p-5">
          <CreditCard className="h-5 w-5 text-brand" />

          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-surface-variant">
            Total Settlement
          </p>

          <h2 className="mt-2 text-2xl font-extrabold text-on-surface">
            {formatNumber(summary.totalSettlement)}
          </h2>
        </div>

        <div className="rounded-2xl bg-surface-lowest p-5">
          <CreditCard className="h-5 w-5 text-brand" />

          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-surface-variant">
            Miscellaneous
          </p>

          <h2 className="mt-2 text-2xl font-extrabold text-on-surface">
            {formatNumber(summary.totalMiscellaneous)}
          </h2>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3 bg-surface-lowest">
        <CurrencyList
          title="Recieved from all currencies"
          items={summary.received}
        />
        <CurrencyList
          title="Paid for all currencies"
          items={summary.paidAgainstProcessing}
        />
        <CurrencyList
          title="All Settlement By Currency"
          items={summary.settlement}
        />
      </div>
    </div>
  );
}
