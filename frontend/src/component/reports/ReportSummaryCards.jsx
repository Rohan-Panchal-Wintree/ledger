import { CreditCard, Landmark, WalletCards } from "lucide-react";

import { formatNumber } from "../../utils/appUtils";

function SummaryMetricCard({ label, value, icon: Icon, highlighted = false }) {
  return (
    <div
      className={
        highlighted
          ? "rounded-2xl border border-primary/10 bg-primary p-5"
          : "rounded-2xl border border-outline-variant/10 bg-surface-lowest p-5"
      }
    >
      <div className="flex items-start justify-between">
        <span
          className={`text-xs font-bold uppercase tracking-widest ${
            highlighted ? "text-white/80" : "text-on-surface-variant"
          }`}
        >
          {label}
        </span>

        <Icon
          className={highlighted ? "text-white" : "text-primary"}
          size={20}
        />
      </div>

      <div className="mt-8">
        <div
          className={`text-3xl font-extrabold tracking-tight ${
            highlighted ? "text-white" : "text-on-surface"
          }`}
        >
          {formatNumber(value)}
        </div>
      </div>
    </div>
  );
}

function CurrencyList({ title, items = {} }) {
  const entries = Object.entries(items).filter(
    ([, amount]) => Number(amount) !== 0,
  );

  return (
    <div className="rounded-2xl bg-surface-lowest p-5">
      <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-surface-variant">
        {title}
      </h3>

      <div className="mt-4 rounded-2xl bg-surface-low">
        {entries.length === 0 ? (
          <p className="px-4 py-3 text-sm text-surface-variant">
            No data available.
          </p>
        ) : (
          entries.map(([currency, amount]) => (
            <div
              key={currency}
              className="flex items-center justify-between gap-4 px-4 py-3"
            >
              <span className="rounded-lg bg-surface-container-highest px-2 py-1 text-sm font-bold text-on-surface">
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
  const metricCards = [
    {
      label: "Wiresheet Received All",
      value: summary.totalReceived,
      icon: Landmark,
      highlighted: true,
    },
    {
      label: "Paid Against Processing",
      value: summary.totalPaidAgainstProcessing,
      icon: WalletCards,
    },
    {
      label: "Total Settlement",
      value: summary.totalSettlement,
      icon: CreditCard,
    },
    {
      label: "Miscellaneous",
      value: summary.totalMiscellaneous,
      icon: CreditCard,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        {metricCards.map((card) => (
          <SummaryMetricCard
            key={card.label}
            label={card.label}
            value={card.value}
            icon={card.icon}
            highlighted={card.highlighted}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <CurrencyList
          title="Wiresheet Recieved all currencies"
          items={summary.received}
        />

        <CurrencyList
          title="Paid for all currencies"
          items={summary.paidAgainstProcessing}
        />

        <CurrencyList
          title="All currencies settlement"
          items={summary.settlement}
        />
      </div>
    </div>
  );
}
