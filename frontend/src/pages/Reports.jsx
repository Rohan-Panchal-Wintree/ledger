import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { AlertTriangle, CheckCircle2, Clock3 } from "lucide-react";

import Button from "../component/UI/Button";
import DatePicker from "../component/UI/DatePicker";
import Spinner from "../component/UI/Spinner";

import AcquirerBreakdownSection from "../component/reports/AcquirerBreakdownSection";
import ReportDetail from "./ReportDetail";
import ReportSidebar from "../component/reports/ReportSidebar";
import ReportSummaryCards from "../component/reports/ReportSummaryCards";

import { usePaymentDayReport, useReportDates } from "../queries/reportQueries";

import { getErrorMessage } from "../utils/appUtils";

function sumObjectValues(values = {}) {
  return Object.values(values).reduce(
    (sum, value) => sum + Number(value || 0),
    0,
  );
}

function getTransactionCount(banks = []) {
  return banks.reduce(
    (bankSum, bank) =>
      bankSum +
      (bank.merchants || []).reduce(
        (merchantSum, merchant) =>
          merchantSum + (merchant.transactions?.length || 0),
        0,
      ),
    0,
  );
}

export default function Reports() {
  const [selectedDate, setSelectedDate] = useState("");
  const [appliedDate, setAppliedDate] = useState("");
  const [selectedBankReport, setSelectedBankReport] = useState(null);

  const today = new Date().toISOString().slice(0, 10);
  const reportParams = appliedDate ? { paymentDate: appliedDate } : {};

  const reportDatesQuery = useReportDates();
  const paymentDayReportQuery = usePaymentDayReport(reportParams);

  const paymentDayReport = paymentDayReportQuery.data || {};
  const reportSummary = paymentDayReport.summary || {};
  const bankReports = paymentDayReport.banks || [];

  const loading = paymentDayReportQuery.isLoading;
  const isFetching = paymentDayReportQuery.isFetching;

  const reportDateButtons = (reportDatesQuery.data || [])
    .filter((date) => {
      const parsedDate = new Date(date);
      return !Number.isNaN(parsedDate.getTime()) && date <= today;
    })
    .sort((a, b) => new Date(b) - new Date(a))
    .slice(0, 5);

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

  const totalReceivedAllCurrencies =
    reportSummary.totalReceived || sumObjectValues(reportSummary.received);

  const receivedBreakdownByAcquirer = bankReports
    .map((bank) => ({
      originalBankData: bank,
      acquirer: bank.bank || "Unknown Bank",
      periodLabel: reportPeriodLabel,

      received: bank.summary?.received || {},
      paidAgainstProcessing: bank.summary?.paidAgainstProcessing || {},
      settlement: bank.summary?.settlement || {},
      miscellaneous: bank.summary?.miscellaneous || {},

      totalReceived: sumObjectValues(bank.summary?.received),
      totalPaidAgainstProcessing: sumObjectValues(
        bank.summary?.paidAgainstProcessing,
      ),
      totalSettlement: sumObjectValues(bank.summary?.settlement),

      merchants: bank.merchants || [],
    }))
    .sort((a, b) => b.totalReceived - a.totalReceived);

  const totalTransactionCount = getTransactionCount(bankReports);
  const statusCounts = reportSummary.statusCounts || {};

  const statusBreakdownItems = [
    {
      label: "Completed",
      value: statusCounts.settled || 0,
      icon: CheckCircle2,
      dotClass: "bg-success",
      iconClass: "text-success",
    },
    {
      label: "Partially Paid",
      value: statusCounts.partially_paid || 0,
      icon: AlertTriangle,
      dotClass: "bg-warning",
      iconClass: "text-warning",
    },
    {
      label: "Pending",
      value: statusCounts.pending || 0,
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

  const handleReportDateClick = (date) => {
    setSelectedDate(date);
    setAppliedDate(date);
    setSelectedBankReport(null);
  };

  const handleGetReport = () => {
    if (!selectedDate) return;

    setAppliedDate(selectedDate);
    setSelectedBankReport(null);
  };

  const handleClearDate = () => {
    setSelectedDate("");
    setAppliedDate("");
    setSelectedBankReport(null);
  };

  useEffect(() => {
    const error = reportDatesQuery.error || paymentDayReportQuery.error;

    if (error) {
      toast.error(getErrorMessage(error, "Failed to load reports."));
    }
  }, [reportDatesQuery.error, paymentDayReportQuery.error]);

  if (loading) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center bg-surface p-4">
        <Spinner type="xl" />
      </div>
    );
  }

  if (selectedBankReport) {
    return (
      <ReportDetail
        data={selectedBankReport}
        onBack={() => setSelectedBankReport(null)}
      />
    );
  }

  return (
    <div className="w-full space-y-6 bg-surface p-4 md:p-6">
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

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <DatePicker
              value={selectedDate}
              max={today}
              onChange={setSelectedDate}
              onApply={handleGetReport}
              onClear={handleClearDate}
              applyDisabled={!selectedDate || isFetching}
              showClear={Boolean(selectedDate || appliedDate)}
            />

            <div className="flex flex-wrap gap-2">
              {reportDateButtons.map((date) => (
                <Button
                  key={date}
                  type="button"
                  onClick={() => handleReportDateClick(date)}
                  variant={appliedDate === date ? "primary" : "secondary"}
                  size="sm"
                  rounded="full"
                >
                  {date}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <ReportSummaryCards summary={reportSummary} />

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[1.6fr_0.9fr]">
        <AcquirerBreakdownSection
          receivedBreakdownByAcquirer={receivedBreakdownByAcquirer}
          onViewFullReport={(bankData) => setSelectedBankReport(bankData)}
        />

        <ReportSidebar
          receivedBreakdownByAcquirer={receivedBreakdownByAcquirer}
          statusBreakdownItems={statusBreakdownItems}
          currencyBreakdownItems={currencyBreakdownItems}
          highestCurrencyAmount={highestCurrencyAmount}
          totalReceivedAllCurrencies={totalReceivedAllCurrencies}
        />
      </div>
    </div>
  );
}
