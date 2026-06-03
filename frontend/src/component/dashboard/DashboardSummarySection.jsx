import { ArrowRightLeft, Banknote, CircleUserRound } from "lucide-react";

import StatCard from "../UI/StatCard";

import { formatNumber } from "../../utils/appUtils";
import {
  getDashboardAmountSummarySections,
  getDashboardStatusBreakdownItems,
} from "../../utils/dashboardUtils";

export default function DashboardSummarySection({ summary = {} }) {
  const amountSummarySections = getDashboardAmountSummarySections(summary);
  const statusBreakdownItems = getDashboardStatusBreakdownItems(summary);

  return (
    <section className="mb-12 grid grid-cols-1 gap-6 md:grid-cols-4">
      <div className="group flex flex-col justify-between rounded-lg bg-linear-to-br from-primary to-primary-container p-8 text-white transition-all duration-300 md:col-span-2">
        <div className="flex items-start justify-between">
          <span className="text-xs font-bold uppercase tracking-widest text-white/70">
            Total Amount Paid
          </span>

          <Banknote className="text-white/50" size={20} />
        </div>

        <div className="mt-8 rounded-2xl border border-white/12 bg-white/8 p-5 backdrop-blur-xs">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {amountSummarySections.map((section) => (
              <div key={section.title} className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/55">
                  {section.totalLabel}
                </p>

                <p className="mt-1 truncate text-xl font-extrabold tracking-tight text-white">
                  {formatNumber(section.totalValue)}
                </p>
              </div>
            ))}
          </div>

          <div className="my-4 h-px bg-white/10" />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {amountSummarySections.map((section) => (
              <div
                key={`${section.title}-breakdown`}
                className="min-w-0 rounded-md bg-white/6 px-3 py-2"
              >
                <div className="space-y-1.5">
                  {Object.entries(section.values || {}).length > 0 ? (
                    Object.entries(section.values || {}).map(
                      ([currency, amount]) => (
                        <div
                          key={`${section.title}-${currency}`}
                          className="flex items-center justify-between gap-3"
                        >
                          <span className="text-[10px] font-bold uppercase tracking-widest text-white/60">
                            {currency}
                          </span>

                          <span className="truncate text-right text-xs font-extrabold text-white">
                            {formatNumber(amount)}
                          </span>
                        </div>
                      ),
                    )
                  ) : (
                    <div className="text-xs font-semibold text-white/60">-</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <StatCard
          label="Unmatched Count"
          value={summary.unmatchedCount || 0}
          helper="Pending reconciliation rows"
          icon={CircleUserRound}
          className="p-8"
        />

        <StatCard
          label="Transaction count"
          value={summary.totalTransactions || 0}
          icon={ArrowRightLeft}
          className="p-8"
        />
      </div>

      <div className="rounded-lg bg-surface-container-low p-4">
        <div className="flex flex-col gap-4">
          {statusBreakdownItems.map((item) => (
            <div
              key={item.label}
              className="flex flex-1 flex-col justify-center rounded-lg border border-outline-variant/10 bg-surface-container-lowest p-5 transition-colors"
            >
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                  {item.label}
                </span>

                <div className={`h-2 w-2 rounded-full ${item.dotClassName}`} />
              </div>

              <div className="text-3xl font-extrabold text-on-surface">
                {item.value}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
