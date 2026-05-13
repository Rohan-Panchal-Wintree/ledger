import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  CreditCard,
  Landmark,
  CheckCircle2,
  Clock3,
  AlertTriangle,
  Calendar,
  X,
} from "lucide-react";

import {
  useBankReports,
  usePaymentDayReport,
  useReportDates,
} from "../queries/reportQueries";

export default function Reports() {
  const [selectedDate, setSelectedDate] = useState("");
  const [appliedDate, setAppliedDate] = useState("");

  const today = new Date().toISOString().slice(0, 10);
  const reportParams = appliedDate ? { paymentDate: appliedDate } : {};

  const reportDatesQuery = useReportDates();
  const bankReportsQuery = useBankReports(reportParams);
  const paymentDayReportQuery = usePaymentDayReport(reportParams);

  const reportDateButtons = (reportDatesQuery.data || [])
    .filter((date) => {
      const parsedDate = new Date(date);
      return !Number.isNaN(parsedDate.getTime()) && date <= today;
    })
    .sort((a, b) => new Date(b) - new Date(a))
    .slice(0, 5);
  const bankReports = bankReportsQuery.data || [];
  const paymentDayReport = paymentDayReportQuery.data || {};
  const reportSummary = paymentDayReport.summary || {};

  const loading = bankReportsQuery.isLoading || paymentDayReportQuery.isLoading;
  const isFetching =
    bankReportsQuery.isFetching || paymentDayReportQuery.isFetching;

  const handleReportDateClick = (date) => {
    setSelectedDate(date);
    setAppliedDate(date);
  };

  const handleGetReport = () => {
    if (!selectedDate) return;
    setAppliedDate(selectedDate);
  };

  const handleClearDate = () => {
    setSelectedDate("");
    setAppliedDate("");
  };

  useEffect(() => {
    const error =
      reportDatesQuery.error ||
      bankReportsQuery.error ||
      paymentDayReportQuery.error;

    if (error) {
      toast.error(
        error?.response?.data?.message ||
          error?.response?.data?.error ||
          error?.message ||
          "Failed to load reports.",
      );
    }
  }, [
    reportDatesQuery.error,
    bankReportsQuery.error,
    paymentDayReportQuery.error,
  ]);

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

  const totalReceivedAllCurrencies = reportSummary.totalReceived || 0;
  const totalPaidEuro = reportSummary.settlement?.EUR || 0;
  const totalPaidUsdt = reportSummary.settlement?.USDT || 0;

  const sortedReportDates = [...reportDateButtons].sort(
    (a, b) => new Date(a) - new Date(b),
  );

  const earliestReportDate = sortedReportDates[0];
  const latestReportDate = sortedReportDates[sortedReportDates.length - 1];

  const reportPeriodLabel = appliedDate
    ? new Date(appliedDate).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : earliestReportDate && latestReportDate
      ? `${new Date(earliestReportDate).toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })} → ${new Date(latestReportDate).toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })}`
      : "No period available";

  console.log("bank reports", bankReports);

  const receivedBreakdownByAcquirer = bankReports
    .map((item) => ({
      acquirer: item.bank || "Unknown Bank",
      totalReceived: item.totalReceived || 0,
      periodLabel: reportPeriodLabel,
      currencies: Object.entries(item.received || {})
        .map(([currency, amount]) => ({
          currency,
          amount: Number(amount) || 0,
        }))
        .filter((entry) => entry.amount > 0)
        .sort((a, b) => b.amount - a.amount),
    }))
    .sort((a, b) => b.totalReceived - a.totalReceived);

  const totalTransactionCount = bankReports.reduce(
    (sum, item) => sum + (Number(item.transactionCount) || 0),
    0,
  );

  const statusBreakdownItems = [
    {
      label: "Completed",
      value: bankReports.reduce(
        (sum, item) => sum + (Number(item.statusCounts?.settled) || 0),
        0,
      ),
      icon: CheckCircle2,
      dotClass: "bg-success",
      iconClass: "text-success",
    },
    {
      label: "Partially Paid",
      value: bankReports.reduce(
        (sum, item) => sum + (Number(item.statusCounts?.partially_paid) || 0),
        0,
      ),
      icon: AlertTriangle,
      dotClass: "bg-warning",
      iconClass: "text-warning",
    },
    {
      label: "Pending",
      value: bankReports.reduce(
        (sum, item) => sum + (Number(item.statusCounts?.pending) || 0),
        0,
      ),
      icon: Clock3,
      dotClass: "bg-info",
      iconClass: "text-info",
    },
  ];

  const currencyBreakdownItems = Object.entries(reportSummary.received || {})
    .map(([currency, amount]) => ({
      currency,
      amount: Number(amount) || 0,
    }))
    .filter((item) => item.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  const highestCurrencyAmount = currencyBreakdownItems[0]?.amount || 0;

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
              Transactions: {totalTransactionCount}
            </div>

            {appliedDate && (
              <div className="badge badge-outline border-brand text-brand">
                Date: {appliedDate}
              </div>
            )}

            {isFetching && (
              <div className="badge badge-outline border-brand text-brand">
                Updating...
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-surface-lowest px-5 py-5">
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-on-surface">
              Select Report Date
            </h2>
            <p className="mt-1 text-sm text-surface-variant">
              Choose a date or use one of the quick report date buttons.
            </p>
          </div>

          {/* Date Picker */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2 rounded-full bg-surface-container-low px-3 py-2">
              <Calendar size={16} className="text-on-surface-variant" />

              <input
                type="date"
                value={selectedDate}
                max={today}
                onChange={(event) => {
                  setSelectedDate(event.target.value);
                }}
                className="w-35 bg-transparent text-sm font-semibold text-on-surface-variant outline-none"
              />

              <button
                type="button"
                onClick={handleGetReport}
                disabled={!selectedDate || isFetching}
                className="rounded-full bg-primary px-3 py-1 text-xs font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
              >
                Get
              </button>

              {(selectedDate || appliedDate) && (
                <button
                  type="button"
                  onClick={handleClearDate}
                  className="flex h-6 w-6 items-center justify-center rounded-full text-on-surface-variant transition hover:bg-surface-container hover:text-on-surface"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {reportDateButtons.slice(0, 10).map((date) => (
                <button
                  key={date}
                  type="button"
                  onClick={() => handleReportDateClick(date)}
                  className={`rounded-full border px-4 py-2.5 text-sm font-semibold transition ${
                    appliedDate === date
                      ? "border-primary bg-primary text-white"
                      : "border-outline-variant/20 bg-surface-container-low text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
                  }`}
                >
                  {date}
                </button>
              ))}
            </div>
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
                {receivedBreakdownByAcquirer.map((entry) => {
                  const miscellaneousEntries = Object.entries(
                    entry.miscellaneous || {},
                  ).filter(([, amount]) => Number(amount) > 0);

                  return (
                    <div
                      key={entry.acquirer}
                      className="overflow-hidden rounded-2xl border border-base-300 bg-surface-lowest"
                    >
                      {/* Header */}
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
                        </div>

                        <div className="text-left md:text-right">
                          <p className="text-xs capitalize text-surface-variant">
                            Period
                          </p>

                          <p className="text-md font-bold text-on-surface">
                            {entry.periodLabel}
                          </p>
                        </div>
                      </div>

                      {/* Received */}
                      <div className="px-4 pt-5">
                        <h5 className="mb-4 text-base font-bold text-on-surface">
                          Received
                        </h5>

                        <div className="overflow-x-auto">
                          <table className="table w-full [&_th]:px-0 [&_td]:px-0">
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
                                  <td className="px-0">
                                    <span className="badge badge-outline border-base-300 bg-surface-low text-on-surface">
                                      {currencyEntry.currency}
                                    </span>
                                  </td>

                                  <td className="px-0 text-right font-semibold text-on-surface">
                                    {formatPlainNumber(currencyEntry.amount)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Miscellaneous */}
                      {miscellaneousEntries.length > 0 && (
                        <div className="border-t border-base-300 px-4 pt-5">
                          <h5 className="mb-4 text-base font-bold text-on-surface">
                            Miscellaneous
                          </h5>

                          <div className="overflow-x-auto">
                            <table className="table w-full [&_th]:px-0 [&_td]:px-0">
                              <thead>
                                <tr className="text-xs uppercase tracking-wider text-surface-variant">
                                  <th>Type</th>
                                  <th className="text-right">Amount</th>
                                </tr>
                              </thead>

                              <tbody>
                                {miscellaneousEntries.map(([label, amount]) => (
                                  <tr key={`${entry.acquirer}-${label}`}>
                                    <td className="font-medium text-on-surface">
                                      {label}
                                    </td>

                                    <td className="text-right font-semibold text-on-surface">
                                      {formatPlainNumber(amount)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* Bottom Summary */}
                      <div className="space-y-4 border-t border-base-300 px-4 py-5">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-md font-bold text-on-surface">
                              Total Received
                            </p>

                            <p className="text-xs text-surface-variant">
                              Sum up of received amount from the wiresheets
                            </p>
                          </div>

                          <p className="text-right text-md font-extrabold text-on-surface">
                            {formatPlainNumber(entry.totalReceived || 0)}
                          </p>
                        </div>

                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-md font-bold text-on-surface">
                              Total Paid
                            </p>

                            <p className="text-xs text-surface-variant">
                              Sum up of paid amount before conversion
                            </p>
                          </div>

                          <p className="text-right text-md font-extrabold text-on-surface">
                            {formatPlainNumber(entry.paid || 0)}
                          </p>
                        </div>

                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-md font-bold text-on-surface">
                              Settlement Amount
                            </p>

                            <p className=" text-xs text-surface-variant">
                              Sum up of actual amount settled via crypto/wire
                            </p>
                          </div>

                          <p className="text-right text-md font-extrabold text-on-surface">
                            {formatPlainNumber(
                              entry.totalSettlementAmount || 0,
                            )}
                          </p>
                        </div>

                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-md font-bold text-on-surface">
                              Miscellaneous
                            </p>

                            <p className="text-xs text-surface-variant">
                              Other settlements except wiresheet payments
                            </p>
                          </div>

                          <p className="text-right text-md font-extrabold text-on-surface">
                            {formatPlainNumber(entry.miscellaneousTotal || 0)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* Status Breakdown Sidebar */}
        <section className="rounded-2xl bg-surface-lowest">
          {/* Bank Totals */}
          <div className="border-b border-base-300 bg-surface-low px-5 py-4">
            <div className="mb-4">
              <h3 className="mt-1 text-lg font-bold tracking-tight text-on-surface">
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
