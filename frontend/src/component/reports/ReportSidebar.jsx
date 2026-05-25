import EmptyState from "../UI/EmptyState";
import { formatNumber } from "../../utils/appUtils";

export default function ReportSidebar({
  receivedBreakdownByAcquirer = [],
  statusBreakdownItems = [],
  currencyBreakdownItems = [],
  highestCurrencyAmount = 0,
  totalReceivedAllCurrencies = 0,
}) {
  return (
    <section className="rounded-2xl bg-surface-lowest">
      <div className="border-b border-base-300 px-5 py-4">
        <div className="mb-4">
          <h3 className="mt-1 text-lg font-bold tracking-tight text-on-surface">
            Received Summary
          </h3>

          <p className="mt-1 text-sm text-surface-variant">
            Total received amount grouped by acquirer.
          </p>
        </div>

        <div className="rounded-2xl border border-base-300 bg-surface-lowest overflow-hidden">
          {receivedBreakdownByAcquirer.length === 0 ? (
            <EmptyState
              title="No received summary"
              description="No acquirer summary is available for this report."
            />
          ) : (
            <>
              <div className="divide-y divide-base-300">
                {receivedBreakdownByAcquirer.map((entry) => (
                  <div
                    key={entry.acquirer}
                    className="flex items-center justify-between gap-4 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-on-surface">
                        {entry.acquirer}
                      </p>

                      <p className="text-xs text-surface-variant">
                        {Object.keys(entry.received || {}).length}{" "}
                        {Object.keys(entry.received || {}).length > 1
                          ? "currencies"
                          : "currency"}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-sm font-extrabold text-on-surface">
                        {formatNumber(entry.totalReceived || 0)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-base-300 bg-surface-low px-4 py-4">
                <div className="flex items-end justify-between gap-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-surface-variant">
                    Grand Total
                  </p>

                  <p className="text-2xl font-extrabold tracking-tight text-brand">
                    {formatNumber(totalReceivedAllCurrencies)}
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="px-5 py-4">
        <h3 className="text-lg font-bold text-on-surface">
          Transaction Status
        </h3>

        <p className="mt-1 text-sm text-surface-variant">
          Current status summary of filtered transactions.
        </p>
      </div>

      <div className="space-y-4 p-4 md:p-5">
        {statusBreakdownItems.length === 0 ? (
          <EmptyState
            title="No status data"
            description="No transaction status summary is available."
          />
        ) : (
          statusBreakdownItems.map((item) => {
            const Icon = item.icon;

            return (
              <div
                key={item.label}
                className="rounded-2xl border border-base-300 bg-surface-low p-4"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl border border-base-300 bg-surface-lowest p-2.5">
                      <Icon className={`h-4 w-4 ${item.iconClass}`} />
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-on-surface">
                          {item.label}
                        </span>

                        <span
                          className={`inline-block h-2.5 w-2.5 rounded-full ${item.dotClass}`}
                        />
                      </div>

                      <p className="text-xs text-surface-variant">
                        Transaction count
                      </p>
                    </div>
                  </div>

                  <div className="text-2xl font-extrabold text-on-surface">
                    {item.value}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="border-t border-base-300 px-5 py-4">
        <h3 className="text-lg font-bold text-on-surface">
          Currency Breakdown
        </h3>

        <p className="mt-1 text-sm text-surface-variant">
          Currencies ranked from highest to lowest received amount across all
          acquirers.
        </p>
      </div>

      <div className="space-y-4 px-5 pb-5">
        {currencyBreakdownItems.length === 0 ? (
          <EmptyState
            title="No currency data"
            description="No currency breakdown is available for this report."
          />
        ) : (
          currencyBreakdownItems.map((item) => {
            const progressValue =
              highestCurrencyAmount > 0
                ? (item.amount / highestCurrencyAmount) * 100
                : 0;

            return (
              <div
                key={item.currency}
                className="rounded-2xl border border-base-300 bg-surface-low p-4"
              >
                <div className="mb-3 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-on-surface">
                      {item.currency}
                    </p>

                    <p className="text-xs text-surface-variant">
                      Received amount
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-lg font-extrabold tracking-tight text-on-surface">
                      {formatNumber(item.amount)}
                    </p>
                  </div>
                </div>

                <progress
                  className="progress progress-primary w-full"
                  value={progressValue}
                  max="100"
                />
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
