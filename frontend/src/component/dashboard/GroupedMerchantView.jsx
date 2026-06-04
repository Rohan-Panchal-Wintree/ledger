import { useMemo, useState } from "react";
import {
  CalendarRange,
  CircleDollarSign,
  Landmark,
  Wallet,
} from "lucide-react";

import Accordion from "../UI/Accordion";
import Tabs from "../UI/Tabs";

import {
  buildGroupedMerchantDashboardData,
  formatDashboardDateRangeLabel,
} from "../../utils/dashboardUtils";

function SummaryCard({ label, value }) {
  return (
    <div className="rounded-2xl bg-surface-container-low px-4 py-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
        {label}
      </p>

      <p className="mt-1 text-lg font-extrabold text-on-surface">{value}</p>
    </div>
  );
}

function CurrencyList({ items = [], variant = "primary", formatAmount }) {
  if (!items.length) {
    return (
      <div className="rounded-lg bg-surface-container-low px-4 py-3 text-sm font-semibold text-on-surface-variant">
        No currency data available.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div
          key={`${variant}-${item.currency}`}
          className="flex items-center justify-between rounded-lg bg-surface-container-low px-4 py-3"
        >
          <span
            className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${
              variant === "primary"
                ? "bg-primary/8 text-primary"
                : "bg-surface-container text-on-surface"
            }`}
          >
            {item.currency}
          </span>

          <span className="text-sm font-extrabold text-on-surface">
            {formatAmount(item.amount, item.currency)}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function GroupedMerchantView({
  transactions = [],
  formatAmount,
  formatDate,
  formatPlainNumber,
}) {
  const merchantGroups = useMemo(() => {
    return buildGroupedMerchantDashboardData(transactions);
  }, [transactions]);

  const [expandedMerchantKey, setExpandedMerchantKey] = useState(
    merchantGroups[0]?.merchantKey || null,
  );

  const [activeMidByMerchant, setActiveMidByMerchant] = useState({});
  const [activeAcquirerByMid, setActiveAcquirerByMid] = useState({});

  const resolvedActiveMid = (merchant) => {
    const selectedMid = activeMidByMerchant[merchant.merchantKey];

    return (
      merchant.midTabs.find((item) => item.mid === selectedMid) ||
      merchant.midTabs[0] ||
      null
    );
  };

  const resolvedActiveAcquirer = (merchantKey, midEntry) => {
    const storageKey = `${merchantKey}__${midEntry.mid}`;
    const selectedAcquirer = activeAcquirerByMid[storageKey];

    return (
      midEntry.acquirerTabs.find(
        (item) => item.acquirer === selectedAcquirer,
      ) ||
      midEntry.acquirerTabs[0] ||
      null
    );
  };

  if (merchantGroups.length === 0) {
    return (
      <section className="overflow-hidden rounded-lg border border-outline-variant/10 bg-surface-container-lowest">
        <div className="px-8 py-12 text-center text-sm font-medium text-on-surface-variant">
          No merchant data available.
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      {merchantGroups.map((merchant) => {
        const isExpanded = expandedMerchantKey === merchant.merchantKey;
        const activeMid = resolvedActiveMid(merchant);
        const activeAcquirer = activeMid
          ? resolvedActiveAcquirer(merchant.merchantKey, activeMid)
          : null;

        return (
          <Accordion
            key={merchant.merchantKey}
            open={isExpanded}
            onToggle={(nextOpen) =>
              setExpandedMerchantKey(nextOpen ? merchant.merchantKey : null)
            }
            title={merchant.merchantName}
            subtitle={`${merchant.midCount} MID${
              merchant.midCount > 1 ? "s" : ""
            } · Period ${formatDashboardDateRangeLabel(
              merchant.earliestStartDate,
              merchant.latestEndDate,
              formatDate,
            )}`}
            icon={<Landmark className="text-primary" size={18} />}
            meta={
              <div className="grid grid-cols-3 gap-3 md:min-w-105">
                <SummaryCard
                  label="Wiresheet"
                  value={formatPlainNumber(merchant.totalReceived)}
                />

                <SummaryCard
                  label="Actual Paid"
                  value={formatPlainNumber(merchant.totalActualPaid)}
                />

                <SummaryCard
                  label="Balance"
                  value={formatPlainNumber(merchant.totalBalance)}
                />
              </div>
            }
          >
            {activeMid && activeAcquirer ? (
              <div className="space-y-4 border-t border-outline-variant/10 pt-4">
                <div className="overflow-x-auto scrollbar-hide">
                  <Tabs
                    activeTab={activeMid.mid}
                    onChange={(nextMid) =>
                      setActiveMidByMerchant((prev) => ({
                        ...prev,
                        [merchant.merchantKey]: nextMid,
                      }))
                    }
                    tabs={merchant.midTabs.map((midItem) => ({
                      label: `MID ${midItem.mid}`,
                      value: midItem.mid,
                    }))}
                  />
                </div>

                <div className="overflow-x-auto scrollbar-hide">
                  <Tabs
                    activeTab={activeAcquirer.acquirer}
                    onChange={(nextAcquirer) =>
                      setActiveAcquirerByMid((prev) => ({
                        ...prev,
                        [`${merchant.merchantKey}__${activeMid.mid}`]:
                          nextAcquirer,
                      }))
                    }
                    tabs={activeMid.acquirerTabs.map((acquirer) => ({
                      label: acquirer.acquirer,
                      value: acquirer.acquirer,
                    }))}
                  />
                </div>

                <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
                  <div className="space-y-4">
                    <div className="rounded-lg border border-outline-variant/10 bg-surface-container-lowest p-5">
                      <div className="mb-4 flex items-center justify-between gap-4">
                        <div>
                          <h4 className="text-base font-bold text-on-surface">
                            {activeAcquirer.acquirer}
                          </h4>

                          <p className="mt-1 text-sm text-on-surface-variant">
                            MID {activeMid.mid} · Acquirer-level summary for
                            this merchant.
                          </p>
                        </div>

                        <Landmark className="shrink-0 text-primary" size={18} />
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <SummaryCard
                          label="Wiresheet Total All Curr"
                          value={formatPlainNumber(
                            activeAcquirer.totalReceived,
                          )}
                        />

                        <SummaryCard
                          label="Settled Amount All Curr"
                          value={formatPlainNumber(activeAcquirer.totalPaidIn)}
                        />

                        <SummaryCard
                          label="Actual Paid (unconverted)"
                          value={formatPlainNumber(
                            activeAcquirer.totalActualPaid,
                          )}
                        />

                        <SummaryCard
                          label="Remaining Balance"
                          value={formatPlainNumber(activeAcquirer.totalBalance)}
                        />
                      </div>
                    </div>

                    <div className="rounded-lg border border-outline-variant/10 bg-surface-container-lowest p-5">
                      <div className="mb-4 flex items-center gap-2">
                        <CalendarRange className="text-primary" size={18} />

                        <h4 className="text-base font-bold text-on-surface">
                          Dates & Status
                        </h4>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <SummaryCard
                          label="Start Date"
                          value={formatDate(activeAcquirer.earliestStartDate)}
                        />

                        <SummaryCard
                          label="End Date"
                          value={formatDate(activeAcquirer.latestEndDate)}
                        />

                        <SummaryCard
                          label="Settled"
                          value={activeAcquirer.statusCounts.settled}
                        />

                        <SummaryCard
                          label="Partial / Pending"
                          value={`${activeAcquirer.statusCounts.partially_paid} / ${activeAcquirer.statusCounts.pending}`}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-lg border border-outline-variant/10 bg-surface-container-lowest p-5">
                      <div className="mb-4 flex items-center gap-2">
                        <Wallet className="text-primary" size={18} />

                        <h4 className="text-base font-bold text-on-surface">
                          Wiresheet Received Currencies
                        </h4>
                      </div>

                      <CurrencyList
                        items={activeAcquirer.receivedCurrencies}
                        variant="primary"
                        formatAmount={formatAmount}
                      />
                    </div>

                    <div className="rounded-lg border border-outline-variant/10 bg-surface-container-lowest p-5">
                      <div className="mb-4 flex items-center gap-2">
                        <CircleDollarSign className="text-primary" size={18} />

                        <h4 className="text-base font-bold text-on-surface">
                          Settlement Currencies
                        </h4>
                      </div>

                      <CurrencyList
                        items={activeAcquirer.paidCurrencies}
                        variant="secondary"
                        formatAmount={formatAmount}
                      />

                      <div className="mt-3 flex items-center justify-between rounded-lg bg-surface-container-low px-4 py-3">
                        <span className="rounded-full bg-surface-container px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-on-surface">
                          Rate Applied
                        </span>

                        <span className="text-sm font-extrabold text-on-surface">
                          --
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </Accordion>
        );
      })}
    </section>
  );
}
