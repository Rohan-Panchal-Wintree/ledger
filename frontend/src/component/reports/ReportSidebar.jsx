import EmptyState from "../UI/EmptyState";

import { formatNumber } from "../../utils/appUtils";

function SidebarSectionHeader({ title, description, className = "" }) {
  return (
    <div className={`px-5 py-4 ${className}`}>
      <h3 className="text-lg font-bold text-on-surface">{title}</h3>

      {description ? (
        <p className="mt-1 text-sm text-surface-variant">{description}</p>
      ) : null}
    </div>
  );
}

function ReceivedSummaryList({
  receivedBreakdownByAcquirer = [],
  totalReceivedAllCurrencies = 0,
}) {
  if (receivedBreakdownByAcquirer.length === 0) {
    return (
      <EmptyState
        title="No received summary"
        description="No acquirer summary is available for this report."
      />
    );
  }

  return (
    <>
      <div className="divide-y divide-base-300">
        {receivedBreakdownByAcquirer.map((entry) => {
          const currencyCount = Object.keys(entry.received || {}).length;

          return (
            <div
              key={entry.acquirer}
              className="flex items-center justify-between gap-4 px-4 py-3 table-row-hover"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-on-surface">
                  {entry.acquirer}
                </p>

                <p className="text-xs text-surface-variant">
                  {currencyCount}{" "}
                  {currencyCount === 1 ? "currency" : "currencies"}
                </p>
              </div>

              <div className="text-right">
                <p className="text-sm font-extrabold text-on-surface">
                  {formatNumber(entry.totalReceived || 0)}
                </p>
              </div>
            </div>
          );
        })}
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
  );
}

function StatusSummaryList({ items = [] }) {
  if (!items.length) return null;

  return (
    <>
      <SidebarSectionHeader
        title="Transaction Status"
        description="Current status summary of filtered transactions."
      />

      <div className="space-y-4 p-4 md:p-5">
        {items.map((item) => {
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
        })}
      </div>
    </>
  );
}

function CurrencyBreakdownList({
  currencyBreakdownItems = [],
  highestCurrencyAmount = 0,
}) {
  if (currencyBreakdownItems.length === 0) {
    return (
      <div className="px-5 pb-5">
        <EmptyState
          title="No currency data"
          description="No currency breakdown is available for this report."
        />
      </div>
    );
  }

  return (
    <div className="space-y-4 px-5 pb-5">
      {currencyBreakdownItems.map((item) => {
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

                <p className="text-xs text-surface-variant">Received amount</p>
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
      })}
    </div>
  );
}

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
        <SidebarSectionHeader
          title="Received Summary"
          description="Total received amount grouped by acquirer."
          className="px-0 pt-0"
        />

        <div className="overflow-hidden rounded-2xl border border-base-300 bg-surface-lowest">
          <ReceivedSummaryList
            receivedBreakdownByAcquirer={receivedBreakdownByAcquirer}
            totalReceivedAllCurrencies={totalReceivedAllCurrencies}
          />
        </div>
      </div>

      <StatusSummaryList items={statusBreakdownItems} />

      <div className="border-t border-base-300">
        <SidebarSectionHeader
          title="Currency Breakdown"
          description="Currencies ranked from highest to lowest received amount across all acquirers."
        />

        <CurrencyBreakdownList
          currencyBreakdownItems={currencyBreakdownItems}
          highestCurrencyAmount={highestCurrencyAmount}
        />
      </div>
    </section>
  );
}
