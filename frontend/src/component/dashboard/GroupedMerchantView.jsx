import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Landmark,
  CalendarRange,
  Wallet,
  CircleDollarSign,
} from "lucide-react";

function getMerchantKey(tx) {
  return tx.merchantName || tx.merchant || "Unknown Merchant";
}

function getSafeNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function formatDateRangeLabel(startDate, endDate, formatDate) {
  const start = startDate ? formatDate(startDate) : "-";
  const end = endDate ? formatDate(endDate) : "-";
  return `${start} → ${end}`;
}

function buildCurrencySummary(items) {
  return [...items.entries()]
    .map(([currency, amount]) => ({
      currency,
      amount,
    }))
    .sort(
      (a, b) => b.amount - a.amount || a.currency.localeCompare(b.currency),
    );
}

export default function GroupedMerchantView({
  transactions,
  formatAmount,
  formatDate,
  formatPlainNumber,
}) {
  const merchantGroups = useMemo(() => {
    const merchantMap = new Map();

    transactions.forEach((tx) => {
      const merchantName = tx.merchantName || tx.merchant || "Unknown Merchant";
      const merchantKey = getMerchantKey(tx);
      const mid = tx.mid || "NO-MID";
      const acquirer = tx.acquirer || tx.bank || "Unknown";
      const receivedCurrency =
        tx.processingCurrency || tx.receivedCurrency || "UNKNOWN";
      const paidCurrency =
        tx.settlementDisplayCurrency || tx.settlementCurrency || "UNKNOWN";

      const receivedAmount = getSafeNumber(tx.receivedAmount ?? tx.payable);
      const paidInAmount = getSafeNumber(tx.paidAmount);
      const actualPaidAmount = getSafeNumber(tx.settlementPaidAmount);
      const balanceAmount = getSafeNumber(tx.balance);

      if (!merchantMap.has(merchantKey)) {
        merchantMap.set(merchantKey, {
          merchantKey,
          merchantName,
          totalReceived: 0,
          totalPaidIn: 0,
          totalActualPaid: 0,
          totalBalance: 0,
          earliestStartDate: null,
          latestEndDate: null,
          mids: new Map(),
        });
      }

      const merchantEntry = merchantMap.get(merchantKey);

      merchantEntry.totalReceived += receivedAmount;
      merchantEntry.totalPaidIn += paidInAmount;
      merchantEntry.totalActualPaid += actualPaidAmount;
      merchantEntry.totalBalance += balanceAmount;

      if (tx.startDate) {
        const start = new Date(tx.startDate);
        if (!Number.isNaN(start.getTime())) {
          if (
            !merchantEntry.earliestStartDate ||
            start < merchantEntry.earliestStartDate
          ) {
            merchantEntry.earliestStartDate = start;
          }
        }
      }

      if (tx.endDate) {
        const end = new Date(tx.endDate);
        if (!Number.isNaN(end.getTime())) {
          if (
            !merchantEntry.latestEndDate ||
            end > merchantEntry.latestEndDate
          ) {
            merchantEntry.latestEndDate = end;
          }
        }
      }

      if (!merchantEntry.mids.has(mid)) {
        merchantEntry.mids.set(mid, {
          mid,
          totalReceived: 0,
          totalPaidIn: 0,
          totalActualPaid: 0,
          totalBalance: 0,
          earliestStartDate: null,
          latestEndDate: null,
          acquirers: new Map(),
        });
      }

      const midEntry = merchantEntry.mids.get(mid);

      midEntry.totalReceived += receivedAmount;
      midEntry.totalPaidIn += paidInAmount;
      midEntry.totalActualPaid += actualPaidAmount;
      midEntry.totalBalance += balanceAmount;

      if (tx.startDate) {
        const start = new Date(tx.startDate);
        if (!Number.isNaN(start.getTime())) {
          if (
            !midEntry.earliestStartDate ||
            start < midEntry.earliestStartDate
          ) {
            midEntry.earliestStartDate = start;
          }
        }
      }

      if (tx.endDate) {
        const end = new Date(tx.endDate);
        if (!Number.isNaN(end.getTime())) {
          if (!midEntry.latestEndDate || end > midEntry.latestEndDate) {
            midEntry.latestEndDate = end;
          }
        }
      }

      if (!midEntry.acquirers.has(acquirer)) {
        midEntry.acquirers.set(acquirer, {
          acquirer,
          totalReceived: 0,
          totalPaidIn: 0,
          totalActualPaid: 0,
          totalBalance: 0,
          earliestStartDate: null,
          latestEndDate: null,
          receivedCurrencies: new Map(),
          paidCurrencies: new Map(),
          statusCounts: {
            settled: 0,
            partially_paid: 0,
            pending: 0,
          },
        });
      }

      const acquirerEntry = midEntry.acquirers.get(acquirer);

      acquirerEntry.totalReceived += receivedAmount;
      acquirerEntry.totalPaidIn += paidInAmount;
      acquirerEntry.totalActualPaid += actualPaidAmount;
      acquirerEntry.totalBalance += balanceAmount;

      acquirerEntry.receivedCurrencies.set(
        receivedCurrency,
        (acquirerEntry.receivedCurrencies.get(receivedCurrency) || 0) +
          receivedAmount,
      );

      acquirerEntry.paidCurrencies.set(
        paidCurrency,
        (acquirerEntry.paidCurrencies.get(paidCurrency) || 0) +
          actualPaidAmount,
      );

      if (tx.status && acquirerEntry.statusCounts[tx.status] !== undefined) {
        acquirerEntry.statusCounts[tx.status] += 1;
      }

      if (tx.startDate) {
        const start = new Date(tx.startDate);
        if (!Number.isNaN(start.getTime())) {
          if (
            !acquirerEntry.earliestStartDate ||
            start < acquirerEntry.earliestStartDate
          ) {
            acquirerEntry.earliestStartDate = start;
          }
        }
      }

      if (tx.endDate) {
        const end = new Date(tx.endDate);
        if (!Number.isNaN(end.getTime())) {
          if (
            !acquirerEntry.latestEndDate ||
            end > acquirerEntry.latestEndDate
          ) {
            acquirerEntry.latestEndDate = end;
          }
        }
      }
    });

    return [...merchantMap.values()]
      .map((merchant) => ({
        ...merchant,
        midCount: merchant.mids.size,
        midTabs: [...merchant.mids.values()]
          .map((midEntry) => ({
            ...midEntry,
            acquirerCount: midEntry.acquirers.size,
            acquirerTabs: [...midEntry.acquirers.values()]
              .map((acquirerEntry) => ({
                ...acquirerEntry,
                receivedCurrencies: buildCurrencySummary(
                  acquirerEntry.receivedCurrencies,
                ),
                paidCurrencies: buildCurrencySummary(
                  acquirerEntry.paidCurrencies,
                ),
              }))
              .sort(
                (a, b) =>
                  b.totalReceived - a.totalReceived ||
                  a.acquirer.localeCompare(b.acquirer),
              ),
          }))
          .sort(
            (a, b) =>
              b.totalReceived - a.totalReceived || a.mid.localeCompare(b.mid),
          ),
      }))
      .sort(
        (a, b) =>
          b.totalReceived - a.totalReceived ||
          a.merchantName.localeCompare(b.merchantName),
      );
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
          <div
            key={merchant.merchantKey}
            className="overflow-hidden rounded-lg border border-outline-variant/10 bg-surface-container-lowest"
          >
            <button
              type="button"
              onClick={() =>
                setExpandedMerchantKey((prev) =>
                  prev === merchant.merchantKey ? null : merchant.merchantKey,
                )
              }
              className="w-full text-left transition-colors hover:bg-surface-container-low/45"
            >
              <div className="flex flex-col gap-4 px-6 py-5 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-4">
                  <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/8">
                    {isExpanded ? (
                      <ChevronDown className="text-primary" size={18} />
                    ) : (
                      <ChevronRight className="text-primary" size={18} />
                    )}
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-bold text-on-surface">
                        {merchant.merchantName}
                      </h3>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="rounded-full bg-primary/8 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-primary">
                        {merchant.midCount} MID
                        {merchant.midCount > 1 ? "s" : ""}
                      </span>
                      <span className="rounded-full bg-surface-container px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-on-surface">
                        Period{" "}
                        {formatDateRangeLabel(
                          merchant.earliestStartDate,
                          merchant.latestEndDate,
                          formatDate,
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 md:min-w-105 md:grid-cols-3">
                  <div className="rounded-lg bg-surface-container-low px-4 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                      All Received
                    </p>
                    <p className="mt-1 text-lg font-extrabold text-on-surface">
                      {formatPlainNumber(merchant.totalReceived)}
                    </p>
                  </div>

                  <div className="rounded-lg bg-surface-container-low px-4 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                      All Actual Paid
                    </p>
                    <p className="mt-1 text-lg font-extrabold text-on-surface">
                      {formatPlainNumber(merchant.totalActualPaid)}
                    </p>
                  </div>

                  <div className="rounded-lg bg-surface-container-low px-4 py-3 col-span-2 md:col-span-1">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                      Balance
                    </p>
                    <p className="mt-1 text-lg font-extrabold text-on-surface">
                      {formatPlainNumber(merchant.totalBalance)}
                    </p>
                  </div>
                </div>
              </div>
            </button>

            {isExpanded && activeMid && activeAcquirer && (
              <div className="border-t border-outline-variant/10">
                <div className="overflow-x-auto scrollbar-hide px-6 pt-4">
                  <div className="mb-4 flex w-fit items-center gap-1 rounded-xl bg-surface-container-low p-1">
                    {merchant.midTabs.map((midItem) => {
                      const isActive = activeMid.mid === midItem.mid;

                      return (
                        <button
                          key={midItem.mid}
                          type="button"
                          onClick={() =>
                            setActiveMidByMerchant((prev) => ({
                              ...prev,
                              [merchant.merchantKey]: midItem.mid,
                            }))
                          }
                          className={`flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm transition ${
                            isActive
                              ? "bg-surface-container-lowest font-bold text-primary"
                              : "font-semibold text-on-surface-variant hover:text-on-surface"
                          }`}
                        >
                          MID {midItem.mid}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="overflow-x-auto scrollbar-hide px-6">
                  <div className="mb-4 flex w-fit items-center gap-1 rounded-xl bg-surface-container-low p-1">
                    {activeMid.acquirerTabs.map((acquirer) => {
                      const isActive =
                        activeAcquirer.acquirer === acquirer.acquirer;

                      return (
                        <button
                          key={`${activeMid.mid}-${acquirer.acquirer}`}
                          type="button"
                          onClick={() =>
                            setActiveAcquirerByMid((prev) => ({
                              ...prev,
                              [`${merchant.merchantKey}__${activeMid.mid}`]:
                                acquirer.acquirer,
                            }))
                          }
                          className={`flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm transition ${
                            isActive
                              ? "bg-surface-container-lowest font-bold text-primary"
                              : "font-semibold text-on-surface-variant hover:text-on-surface"
                          }`}
                        >
                          <Landmark className="h-4 w-4" />
                          {acquirer.acquirer}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid gap-4 px-6 pb-6 lg:grid-cols-[1.1fr_1fr]">
                  <div className="space-y-4">
                    <div className="rounded-lg border border-outline-variant/10 bg-surface-container-lowest p-5">
                      <div className="mb-4 flex items-center justify-between">
                        <div>
                          <h4 className="text-base font-bold text-on-surface">
                            {activeAcquirer.acquirer}
                          </h4>
                          <p className="mt-1 text-sm text-on-surface-variant">
                            MID {activeMid.mid} · Acquirer-level summary for
                            this merchant.
                          </p>
                        </div>
                        <Landmark className="text-primary" size={18} />
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-lg bg-surface-container-low p-4">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                            Received Total
                          </p>
                          <p className="mt-1 text-xl font-extrabold text-on-surface">
                            {formatPlainNumber(activeAcquirer.totalReceived)}
                          </p>
                        </div>

                        <div className="rounded-lg bg-surface-container-low p-4">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                            Paid In Amount
                          </p>
                          <p className="mt-1 text-xl font-extrabold text-on-surface">
                            {formatPlainNumber(activeAcquirer.totalPaidIn)}
                          </p>
                        </div>

                        <div className="rounded-lg bg-surface-container-low p-4">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                            Actual Paid
                          </p>
                          <p className="mt-1 text-xl font-extrabold text-on-surface">
                            {formatPlainNumber(activeAcquirer.totalActualPaid)}
                          </p>
                        </div>

                        <div className="rounded-lg bg-surface-container-low p-4">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                            Remaining Balance
                          </p>
                          <p className="mt-1 text-xl font-extrabold text-on-surface">
                            {formatPlainNumber(activeAcquirer.totalBalance)}
                          </p>
                        </div>
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
                        <div className="rounded-lg bg-surface-container-low p-4">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                            Start Date
                          </p>
                          <p className="mt-1 text-sm font-bold text-on-surface">
                            {formatDate(activeAcquirer.earliestStartDate)}
                          </p>
                        </div>

                        <div className="rounded-lg bg-surface-container-low p-4">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                            End Date
                          </p>
                          <p className="mt-1 text-sm font-bold text-on-surface">
                            {formatDate(activeAcquirer.latestEndDate)}
                          </p>
                        </div>

                        <div className="rounded-lg bg-surface-container-low p-4">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                            Settled
                          </p>
                          <p className="mt-1 text-xl font-extrabold text-on-surface">
                            {activeAcquirer.statusCounts.settled}
                          </p>
                        </div>

                        <div className="rounded-lg bg-surface-container-low p-4">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                            Partial / Pending
                          </p>
                          <p className="mt-1 text-xl font-extrabold text-on-surface">
                            {activeAcquirer.statusCounts.partially_paid} /{" "}
                            {activeAcquirer.statusCounts.pending}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-lg border border-outline-variant/10 bg-surface-container-lowest p-5">
                      <div className="mb-4 flex items-center gap-2">
                        <Wallet className="text-primary" size={18} />
                        <h4 className="text-base font-bold text-on-surface">
                          Received Currencies
                        </h4>
                      </div>

                      <div className="space-y-3">
                        {activeAcquirer.receivedCurrencies.map((item) => (
                          <div
                            key={`received-${activeMid.mid}-${item.currency}`}
                            className="flex items-center justify-between rounded-lg bg-surface-container-low px-4 py-3"
                          >
                            <span className="rounded-full bg-primary/8 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-primary">
                              {item.currency}
                            </span>
                            <span className="text-sm font-extrabold text-on-surface">
                              {formatAmount(item.amount, item.currency)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-lg border border-outline-variant/10 bg-surface-container-lowest p-5">
                      <div className="mb-4 flex items-center gap-2">
                        <CircleDollarSign className="text-primary" size={18} />
                        <h4 className="text-base font-bold text-on-surface">
                          Paid Currencies
                        </h4>
                      </div>

                      <div className="space-y-3">
                        {activeAcquirer.paidCurrencies.map((item) => (
                          <div
                            key={`paid-${activeMid.mid}-${item.currency}`}
                            className="flex items-center justify-between rounded-lg bg-surface-container-low px-4 py-3"
                          >
                            <span className="rounded-full bg-surface-container px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-on-surface">
                              {item.currency}
                            </span>
                            <span className="text-sm font-extrabold text-on-surface">
                              {formatAmount(item.amount, item.currency)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
