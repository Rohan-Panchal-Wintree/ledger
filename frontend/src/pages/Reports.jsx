import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  CreditCard,
  Landmark,
  CheckCircle2,
  Clock3,
  AlertTriangle,
} from "lucide-react";
import {
  fetchPayments,
  selectPaymentsFullState,
} from "../store/slices/Payments.slice";

// --- Constants ---
const DASHBOARD_FILTERS_STORAGE_KEY = "dashboard-filters";

// --- Helpers ---
function getPartnerValue(merchantTag) {
  const normalizedTag = String(merchantTag || "").toLowerCase();
  if (normalizedTag.includes("transactworld")) return "transactworld";
  if (normalizedTag.includes("dreamz")) return "dreamzpay";
  return "";
}

function hasActiveDataFilters(filters) {
  return Boolean(
    filters.startDate ||
    filters.endDate ||
    filters.minAmount ||
    filters.maxAmount ||
    filters.merchants?.length > 0 ||
    filters.acquirers?.length > 0 ||
    filters.processingCurrencies?.length > 0 ||
    filters.settlementCurrencies?.length > 0 ||
    filters.partners?.length > 0 ||
    filters.statuses?.length > 0,
  );
}

function readSavedFilters() {
  const defaultFilters = {
    merchants: [],
    acquirers: [],
    processingCurrencies: [],
    settlementCurrencies: [],
    partners: [],
    statuses: [],
    visibleColumns: [],
  };

  if (typeof window === "undefined") return defaultFilters;

  try {
    const saved = window.localStorage.getItem(DASHBOARD_FILTERS_STORAGE_KEY);
    return saved ? JSON.parse(saved) : defaultFilters;
  } catch {
    return defaultFilters;
  }
}

export default function Reports() {
  const dispatch = useDispatch();
  const { transactions, loading } = useSelector(selectPaymentsFullState);
  const filters = readSavedFilters();

  useEffect(() => {
    dispatch(fetchPayments());
  }, [dispatch]);

  // --- Formatters ---
  function formatAmount(amount, currency = "EUR") {
    const num = Number(amount);
    if (isNaN(num)) return "0.00";

    if (currency === "USDT") {
      return `USDT ${num.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;
    }

    return num.toLocaleString("en-US", {
      style: "currency",
      currency: currency === "USDT" ? "USD" : currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  function formatPlainNumber(amount) {
    const num = Number(amount);
    return isNaN(num)
      ? "0.00"
      : num.toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
  }

  function formatDisplayDate(dateValue) {
    if (!dateValue) return "-";
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return "-";

    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  function formatDateRange(startDate, endDate) {
    if (!startDate && !endDate) return "Period not available";
    if (startDate && !endDate) return `From ${formatDisplayDate(startDate)}`;
    if (!startDate && endDate) return `Until ${formatDisplayDate(endDate)}`;
    return `${formatDisplayDate(startDate)} - ${formatDisplayDate(endDate)}`;
  }

  // --- Derived Data ---
  const hasAppliedFilters = hasActiveDataFilters(filters);

  const summaryTransactions = hasAppliedFilters
    ? transactions.filter((tx) => {
        const partnerValue = getPartnerValue(tx.merchantTag);

        if (
          filters.merchants?.length > 0 &&
          !filters.merchants.includes(tx.merchantName)
        )
          return false;
        if (
          filters.acquirers?.length > 0 &&
          !filters.acquirers.includes(tx.acquirer)
        )
          return false;
        if (
          filters.partners?.length > 0 &&
          !filters.partners.includes(partnerValue)
        )
          return false;
        if (
          filters.statuses?.length > 0 &&
          !filters.statuses.includes(tx.status)
        )
          return false;

        return true;
      })
    : transactions;

  const totalReceivedAllCurrencies = summaryTransactions.reduce(
    (sum, tx) => sum + (Number(tx.receivedAmount ?? tx.payable) || 0),
    0,
  );

  const totalPaidEuro = summaryTransactions
    .filter((tx) => tx.paymentMethod === "WIRE")
    .reduce((sum, tx) => sum + (Number(tx.settlementPaidAmount) || 0), 0);

  const totalPaidUsdt = summaryTransactions
    .filter((tx) => tx.paymentMethod === "CRYPTO")
    .reduce((sum, tx) => sum + (Number(tx.settlementPaidAmount) || 0), 0);

  // --- Grouping Logic ---
  const receivedBreakdownByAcquirer = [
    ...new Map(
      summaryTransactions.reduce((map, tx) => {
        const acquirer = tx.acquirer || "Unknown";
        const currency =
          tx.processingCurrency || tx.receivedCurrency || "UNKNOWN";
        const amount = Number(tx.receivedAmount ?? tx.payable) || 0;
        const startDate = tx.startDate ? new Date(tx.startDate) : null;
        const endDate = tx.endDate ? new Date(tx.endDate) : null;

        if (!map.has(acquirer)) {
          map.set(acquirer, {
            acquirer,
            totalReceived: 0,
            currencies: new Map(),
            minStartDate: null,
            maxEndDate: null,
          });
        }

        const entry = map.get(acquirer);
        entry.totalReceived += amount;
        entry.currencies.set(
          currency,
          (entry.currencies.get(currency) || 0) + amount,
        );

        if (startDate && !Number.isNaN(startDate.getTime())) {
          if (!entry.minStartDate || startDate < entry.minStartDate)
            entry.minStartDate = startDate;
        }
        if (endDate && !Number.isNaN(endDate.getTime())) {
          if (!entry.maxEndDate || endDate > entry.maxEndDate)
            entry.maxEndDate = endDate;
        }

        return map;
      }, new Map()),
    ).values(),
  ]
    .map((entry) => ({
      acquirer: entry.acquirer,
      totalReceived: entry.totalReceived,
      periodLabel: formatDateRange(entry.minStartDate, entry.maxEndDate),
      currencies: [...entry.currencies.entries()]
        .map(([currency, amount]) => ({ currency, amount }))
        .sort((a, b) => b.amount - a.amount),
    }))
    .sort((a, b) => b.totalReceived - a.totalReceived);

  const statusBreakdownItems = [
    {
      label: "Completed",
      value: summaryTransactions.filter((tx) => tx.status === "settled").length,
      icon: CheckCircle2,
      dotClass: "bg-success",
      iconClass: "text-success",
    },
    {
      label: "Partially Paid",
      value: summaryTransactions.filter((tx) => tx.status === "partially_paid")
        .length,
      icon: AlertTriangle,
      dotClass: "bg-warning",
      iconClass: "text-warning",
    },
    {
      label: "Pending",
      value: summaryTransactions.filter((tx) => tx.status === "pending").length,
      icon: Clock3,
      dotClass: "bg-info",
      iconClass: "text-info",
    },
  ];

  const currencyBreakdownItems = [
    ...receivedBreakdownByAcquirer
      .reduce((map, acquirer) => {
        acquirer.currencies.forEach((currencyItem) => {
          const currency = currencyItem.currency || "UNKNOWN";
          const amount = Number(currencyItem.amount) || 0;

          // ignore negative and zero values
          if (amount <= 0) return;

          map.set(currency, (map.get(currency) || 0) + amount);
        });

        return map;
      }, new Map())
      .entries(),
  ]
    .map(([currency, amount]) => ({
      currency,
      amount,
    }))
    .sort((a, b) => b.amount - a.amount);

  const highestCurrencyAmount = currencyBreakdownItems[0]?.amount || 0;

  // console.log(
  //   "EUR rows:",
  //   summaryTransactions
  //     .filter(
  //       (tx) =>
  //         (tx.processingCurrency || tx.receivedCurrency || "UNKNOWN") === "EUR",
  //     )
  //     .map((tx) => ({
  //       acquirer: tx.acquirer,
  //       currency: tx.processingCurrency || tx.receivedCurrency || "UNKNOWN",
  //       amount: Number(tx.receivedAmount ?? tx.payable) || 0,
  //       receivedAmount: tx.receivedAmount,
  //       payable: tx.payable,
  //     })),
  // );

  if (loading) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center bg-surface p-4">
        <span className="loading loading-spinner loading-xl text-primary"></span>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 bg-surface p-4 md:p-6">
      {/* Header */}
      <div className="rounded-2xl bg-surface-lowest px-5 py-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-on-surface">
              Payment Reports Overview
            </h1>
            <p className="mt-1 text-sm text-surface-variant">
              A clean overview of received amounts, settlement totals, and
              transaction status.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <div className="badge badge-outline border-base-300 bg-surface-low text-on-surface">
              Transactions: {summaryTransactions.length}
            </div>
            {hasAppliedFilters && (
              <div className="badge badge-outline border-brand text-brand">
                Filters Applied
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Top Cards */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Total Received */}
        <div className="rounded-2xl bg-linear-to-br from-primary to-accent p-5 text-white">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/75">
                Total Received
              </p>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-white">
                {formatPlainNumber(totalReceivedAllCurrencies)}
              </h2>
              <p className="mt-2 text-sm text-white/80">
                Combined received amount across all acquirers and currencies.
              </p>
            </div>
            <div className="rounded-xl p-3">
              <Landmark className="h-5 w-5 text-white" />
            </div>
          </div>
        </div>

        {/* Settled EUR */}
        <div className="rounded-2xl bg-surface-lowest p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-surface-variant">
                Settled In EUR
              </p>
              <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-on-surface">
                {formatAmount(totalPaidEuro, "EUR")}
              </h2>
              <p className="mt-2 text-sm text-surface-variant">
                Total settlement amount paid through wire payments.
              </p>
            </div>
            <div className="rounded-xl p-3">
              <CreditCard className="h-5 w-5 text-brand" />
            </div>
          </div>
        </div>

        {/* Settled USDT */}
        <div className="rounded-2xl bg-surface-lowest p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-surface-variant">
                Settled In USDT
              </p>
              <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-on-surface">
                USDT {formatPlainNumber(totalPaidUsdt)}
              </h2>
              <p className="mt-2 text-sm text-surface-variant">
                Total settlement amount paid through crypto payments.
              </p>
            </div>
            <div className="rounded-xl p-3">
              <CreditCard className="h-5 w-5 text-brand" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid Content */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.6fr_0.9fr] items-start">
        {/* Acquirer Breakdown Table */}
        <section className="rounded-2xl bg-surface-lowest">
          <div className="border-b border-base-300 px-5 py-4">
            <h3 className="text-lg font-bold text-on-surface">
              Received Breakdown by Acquirer
            </h3>
            <p className="mt-1 text-sm text-surface-variant">
              Currency-wise amount split and period for each acquirer.
            </p>
          </div>

          <div className="p-4 md:p-5">
            {receivedBreakdownByAcquirer.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-base-300 bg-surface-low p-8 text-center text-sm text-surface-variant">
                No transaction data available for this view.
              </div>
            ) : (
              <div className="space-y-4">
                {receivedBreakdownByAcquirer.map((entry) => (
                  <div
                    key={entry.acquirer}
                    className="overflow-hidden rounded-2xl border border-base-300 bg-surface-lowest"
                  >
                    <div className="flex flex-col gap-4 border-b border-base-300 bg-surface-low px-4 py-4 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-1">
                        <h4 className="text-base font-bold text-on-surface">
                          {entry.acquirer}
                        </h4>
                        <p className="text-sm text-surface-variant">
                          {entry.currencies.length}{" "}
                          {entry.currencies.length > 1
                            ? "currencies"
                            : "currency"}{" "}
                          available
                        </p>
                        <p className="text-sm font-medium text-surface-variant">
                          Period: {entry.periodLabel}
                        </p>
                      </div>
                      <div className="text-left md:text-right">
                        <p className="text-xs uppercase tracking-[0.18em] text-surface-variant">
                          Total
                        </p>
                        <p className="text-2xl font-extrabold tracking-tight text-on-surface">
                          {formatPlainNumber(entry.totalReceived)}
                        </p>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="table">
                        <thead>
                          <tr className="text-xs uppercase tracking-wider text-surface-variant">
                            <th>Currency</th>
                            <th className="text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {entry.currencies.map((currencyEntry) => (
                            <tr
                              key={`${entry.acquirer}-${currencyEntry.currency}`}
                            >
                              <td>
                                <span className="badge badge-outline border-base-300 bg-surface-low text-on-surface">
                                  {currencyEntry.currency}
                                </span>
                              </td>
                              <td className="text-right font-semibold text-on-surface">
                                {formatPlainNumber(currencyEntry.amount)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Status Breakdown Sidebar */}
        <section className="rounded-2xl bg-surface-lowest">
          {/* Bank Totals */}
          <div className="border-b border-base-300 bg-surface-low px-5 py-4">
            <div className="mb-4">
              <h3 className="mt-1 text-lg font-extrabold tracking-tight text-on-surface">
                Received Summary
              </h3>
              <p className="mt-1 text-sm text-surface-variant">
                Total received amount grouped by acquirer.
              </p>
            </div>

            <div className="rounded-2xl border border-base-300 bg-surface-lowest">
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
                        {entry.currencies.length}{" "}
                        {entry.currencies.length > 1
                          ? "currencies"
                          : "currency"}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-sm font-extrabold text-on-surface">
                        {formatPlainNumber(entry.totalReceived)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-base-300 bg-surface-low px-4 py-4">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-surface-variant">
                      Grand Total
                    </p>
                  </div>

                  <p className="text-2xl font-extrabold tracking-tight text-brand">
                    {formatPlainNumber(totalReceivedAllCurrencies)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="border-b border-base-300 px-5 py-4">
            <h3 className="text-lg font-bold text-on-surface">
              Transaction Status
            </h3>
            <p className="mt-1 text-sm text-surface-variant">
              Current status summary of filtered transactions.
            </p>
          </div>

          <div className="space-y-4 p-4 md:p-5">
            {statusBreakdownItems.map((item) => {
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

          {/* Currency Breakdown */}
          <div className="border-t border-base-300 px-5 py-4">
            <h3 className="text-lg font-bold text-on-surface">
              Currency Breakdown
            </h3>
            <p className="mt-1 text-sm text-surface-variant">
              Currencies ranked from highest to lowest received amount across
              all acquirers.
            </p>
          </div>

          <div className="space-y-4 px-5 pb-5">
            {currencyBreakdownItems.length === 0 ? (
              <div className="rounded-2xl border border-base-300 bg-surface-low p-4 text-sm text-surface-variant">
                No currency data available.
              </div>
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
                          {formatPlainNumber(item.amount)}
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
      </div>
    </div>
  );
}
