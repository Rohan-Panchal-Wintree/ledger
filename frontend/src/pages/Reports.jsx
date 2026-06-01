import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  FileSpreadsheet,
  FileText,
} from "lucide-react";

import Badge from "../component/UI/Badge";
import Button from "../component/UI/Button";
import PageHeader from "../component/UI/PageHeader";
import Spinner from "../component/UI/Spinner";

import AcquirerBreakdownSection from "../component/reports/AcquirerBreakdownSection";
import ReportDateSelector from "../component/reports/ReportDateSelector";
import ReportDetail from "./ReportDetail";
import ReportSidebar from "../component/reports/ReportSidebar";
import ReportSummaryCards from "../component/reports/ReportSummaryCards";

import {
  exportBankReportsExcel,
  exportBankReportsPdf,
  usePaymentDayReport,
} from "../queries/reportQueries";

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

function downloadBlobFile(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;

  document.body.appendChild(link);
  link.click();
  link.remove();

  window.URL.revokeObjectURL(url);
}

export default function Reports() {
  const [appliedDate, setAppliedDate] = useState("");
  const [selectedBankReport, setSelectedBankReport] = useState(null);
  const [downloadingType, setDownloadingType] = useState(null);

  const reportParams = appliedDate ? { paymentDate: appliedDate } : {};

  const paymentDayReportQuery = usePaymentDayReport(reportParams);

  const paymentDayReport = paymentDayReportQuery.data || {};
  const reportSummary = paymentDayReport.summary || {};
  const bankReports = paymentDayReport.banks || [];

  const loading = paymentDayReportQuery.isLoading;
  const isFetching = paymentDayReportQuery.isFetching;

  const reportViewData = useMemo(() => {
    const reportPeriodLabel = appliedDate
      ? new Date(appliedDate).toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
      : "All available reports";

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

    const statusCounts = reportSummary.statusCounts;

    const statusBreakdownItems = statusCounts
      ? [
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
        ]
      : [];

    const currencyBreakdownItems = Object.entries(reportSummary.received || {})
      .map(([currency, amount]) => ({
        currency,
        amount: Number(amount) || 0,
      }))
      .filter((item) => item.amount > 0)
      .sort((a, b) => b.amount - a.amount);

    const highestCurrencyAmount = currencyBreakdownItems[0]?.amount || 0;

    const totalReceivedAllCurrencies = Number(reportSummary.totalReceived || 0);

    return {
      receivedBreakdownByAcquirer,
      totalTransactionCount,
      statusBreakdownItems,
      currencyBreakdownItems,
      highestCurrencyAmount,
      totalReceivedAllCurrencies,
    };
  }, [appliedDate, bankReports, reportSummary]);

  const {
    receivedBreakdownByAcquirer,
    totalTransactionCount,
    statusBreakdownItems,
    currencyBreakdownItems,
    highestCurrencyAmount,
    totalReceivedAllCurrencies,
  } = reportViewData;

  const handleApplyReportDate = (date) => {
    setAppliedDate(date);
    setSelectedBankReport(null);
  };

  const getExportParams = () => ({
    ...(appliedDate ? { paymentDate: appliedDate } : {}),
  });

  const handleDownloadExcel = async () => {
    try {
      setDownloadingType("excel");

      const blob = await exportBankReportsExcel(getExportParams());

      downloadBlobFile(blob, "bank-settlement-report.xlsx");
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to download Excel report."));
    } finally {
      setDownloadingType(null);
    }
  };

  const handleDownloadPdf = async () => {
    try {
      setDownloadingType("pdf");

      const blob = await exportBankReportsPdf(getExportParams());

      downloadBlobFile(blob, "bank-settlement-report.pdf");
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to download PDF report."));
    } finally {
      setDownloadingType(null);
    }
  };

  useEffect(() => {
    if (paymentDayReportQuery.error) {
      toast.error(
        getErrorMessage(paymentDayReportQuery.error, "Failed to load reports."),
      );
    }
  }, [paymentDayReportQuery.error]);

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
      <PageHeader
        title="Payment Reports Overview"
        description="A clean overview of received amounts, settlement totals, and transaction status."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className="bg-surface-low px-3 py-1.5 text-xs"
            >
              Transactions: {totalTransactionCount}
            </Badge>

            {appliedDate ? (
              <Badge variant="DP" className="px-3 py-1.5 text-xs">
                Date: {appliedDate}
              </Badge>
            ) : null}

            {isFetching ? (
              <Badge variant="DP" className="px-3 py-1.5 text-xs">
                Updating...
              </Badge>
            ) : null}

            <Button
              type="button"
              variant="secondary"
              size="sm"
              leftIcon={<FileSpreadsheet className="h-4 w-4" />}
              loading={downloadingType === "excel"}
              disabled={Boolean(downloadingType)}
              onClick={handleDownloadExcel}
            >
              Excel
            </Button>

            <Button
              type="button"
              variant="secondary"
              size="sm"
              leftIcon={<FileText className="h-4 w-4" />}
              loading={downloadingType === "pdf"}
              disabled={Boolean(downloadingType)}
              onClick={handleDownloadPdf}
            >
              PDF
            </Button>
          </div>
        }
      />

      <ReportDateSelector
        appliedDate={appliedDate}
        isFetching={isFetching}
        onApplyDate={handleApplyReportDate}
      />

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
