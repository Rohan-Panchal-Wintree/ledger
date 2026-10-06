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

function hasAnyReportValue(bank) {
	const summary = bank?.summary || {};

	const hasSummaryValue =
		sumObjectValues(summary.received) !== 0 ||
		sumObjectValues(summary.paidAgainstProcessing) !== 0 ||
		sumObjectValues(summary.settlement) !== 0 ||
		sumObjectValues(summary.miscellaneous) !== 0;

	const hasMerchantData = (bank?.merchants || []).some((merchant) => {
		return (
			sumObjectValues(merchant.received) !== 0 ||
			sumObjectValues(merchant.paidAgainstProcessing) !== 0 ||
			sumObjectValues(merchant.settlement) !== 0 ||
			(merchant.transactions || []).length > 0
		);
	});

	return hasSummaryValue || hasMerchantData;
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

const EMPTY_REPORT_FILTERS = {
	paymentDate: "",
	fromDate: "",
	toDate: "",
	banks: "",
	merchants: "",
	mids: "",
	currencies: "",
	paymentMethods: "",
	statuses: "",
};

function cleanCsv(value) {
	return String(value || "")
		.split(",")
		.map((item) => item.trim())
		.filter(Boolean)
		.join(",");
}

function buildReportParams(filters = {}) {
	const params = {};

	if (filters.fromDate && filters.toDate) {
		params.fromDate = filters.fromDate;
		params.toDate = filters.toDate;
	} else if (filters.paymentDate) {
		params.paymentDate = filters.paymentDate;
	}

	const banks = cleanCsv(filters.banks);
	const merchants = cleanCsv(filters.merchants);
	const mids = cleanCsv(filters.mids);
	const currencies = cleanCsv(filters.currencies);
	const paymentMethods = cleanCsv(filters.paymentMethods);
	const statuses = cleanCsv(filters.statuses);

	if (banks) params.banks = banks;
	if (merchants) params.merchants = merchants;
	if (mids) params.mids = mids;
	if (currencies) params.currencies = currencies;
	if (paymentMethods) params.paymentMethods = paymentMethods;
	if (statuses) params.statuses = statuses;

	return params;
}

function getReportPeriodLabel(filters = {}) {
	if (filters.fromDate && filters.toDate) {
		return `${filters.fromDate} to ${filters.toDate}`;
	}

	if (filters.paymentDate) {
		return new Date(filters.paymentDate).toLocaleDateString("en-GB", {
			day: "2-digit",
			month: "short",
			year: "numeric",
		});
	}

	return "All available reports";
}

export default function Reports() {
	const [draftFilters, setDraftFilters] = useState(EMPTY_REPORT_FILTERS);
	const [appliedFilters, setAppliedFilters] = useState(EMPTY_REPORT_FILTERS);
	const [selectedBankReport, setSelectedBankReport] = useState(null);
	const [downloadingType, setDownloadingType] = useState(null);

	const reportParams = useMemo(
		() => buildReportParams(appliedFilters),
		[appliedFilters],
	);

	const paymentDayReportQuery = usePaymentDayReport(reportParams);
	const paymentDayReport = paymentDayReportQuery.data || {};
	const reportSummary = paymentDayReport.summary || {};
	const bankReports = useMemo(() => {
		return (paymentDayReport.banks || []).filter(hasAnyReportValue);
	}, [paymentDayReport.banks]);

	const loading = paymentDayReportQuery.isLoading;
	const isFetching = paymentDayReportQuery.isFetching;

	const reportViewData = useMemo(() => {
		const reportPeriodLabel = getReportPeriodLabel(appliedFilters);

		const receivedBreakdownByAcquirer = bankReports
			.map((bank) => ({
				originalBankData: bank,
				acquirer: bank.bank || "Unknown Bank",
				bankKey: bank.bankKey || bank.bank || "Unknown Bank",
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
			.filter((bank) => {
				return (
					bank.totalReceived !== 0 ||
					bank.totalPaidAgainstProcessing !== 0 ||
					bank.totalSettlement !== 0 ||
					sumObjectValues(bank.miscellaneous) !== 0 ||
					bank.merchants.length > 0
				);
			})
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
	}, [appliedFilters, bankReports, reportSummary]);

	const {
		receivedBreakdownByAcquirer,
		totalTransactionCount,
		statusBreakdownItems,
		currencyBreakdownItems,
		highestCurrencyAmount,
		totalReceivedAllCurrencies,
	} = reportViewData;

	const hasReportData = totalTransactionCount > 0;

	const handleApplyReportDate = (date) => {
		const nextFilters = {
			...EMPTY_REPORT_FILTERS,
			paymentDate: date,
		};

		setDraftFilters(nextFilters);
		setAppliedFilters(nextFilters);
		setSelectedBankReport(null);
	};
	const handleFilterChange = (event) => {
		const { name, value } = event.target;

		setDraftFilters((prev) => ({
			...prev,
			[name]: value,
			paymentDate:
				name === "fromDate" || name === "toDate" ? "" : prev.paymentDate,
		}));
	};

	const handleSearchReports = () => {
		if (
			(draftFilters.fromDate && !draftFilters.toDate) ||
			(!draftFilters.fromDate && draftFilters.toDate)
		) {
			toast.error("Both from date and to date are required.");
			return;
		}

		if (
			draftFilters.fromDate &&
			draftFilters.toDate &&
			new Date(draftFilters.fromDate) > new Date(draftFilters.toDate)
		) {
			toast.error("From date cannot be after to date.");
			return;
		}

		const nextFilters = {
			...draftFilters,
			paymentDate:
				draftFilters.fromDate && draftFilters.toDate
					? ""
					: draftFilters.paymentDate,
		};

		setDraftFilters(nextFilters);
		setAppliedFilters(nextFilters);
		setSelectedBankReport(null);
	};

	const handleClearFilters = () => {
		setDraftFilters(EMPTY_REPORT_FILTERS);
		setAppliedFilters(EMPTY_REPORT_FILTERS);
		setSelectedBankReport(null);
	};

	const getExportParams = () => reportParams;
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
		<div className="w-full space-y-6 bg-surface">
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

						{Object.keys(reportParams).length ? (
							<Badge variant="DP" className="px-3 py-1.5 text-xs">
								Filtered
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
							disabled={Boolean(downloadingType) || !hasReportData}
							title={!hasReportData ? "No report data available" : undefined}
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
							disabled={Boolean(downloadingType) || !hasReportData}
							title={!hasReportData ? "No report data available" : undefined}
							onClick={handleDownloadPdf}
						>
							PDF
						</Button>
					</div>
				}
			/>

			<ReportDateSelector
				appliedFilters={appliedFilters}
				draftFilters={draftFilters}
				isFetching={isFetching}
				onApplyDate={handleApplyReportDate}
				onFilterChange={handleFilterChange}
				onSearchReports={handleSearchReports}
				onClearFilters={handleClearFilters}
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
