import {
	CreditCard,
	Store,
	Search,
	SlidersHorizontal,
	Landmark,
	MoreVertical,
	CircleUserRound,
	ArrowRightLeft,
	Banknote,
} from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import {
	fetchPayments,
	selectPaymentsFullState,
} from "../store/slices/Payments.slice";
import { useEffect, useState } from "react";
import { selectCurrentUser } from "../store/slices/Auth.slice";
import { toast } from "react-hot-toast";
import Badge from "../component/UI/Badge";
import FilterModal from "../component/FilterModal";

const statusClasses = {
	settled: "bg-green-500/10 text-green-600",
	pending: "bg-orange-400/10 text-orange-600",
	partially_paid: "bg-yellow-400/10 text-yellow-600",
};

const DASHBOARD_FILTERS_STORAGE_KEY = "dashboard-filters";
const DEFAULT_VISIBLE_COLUMNS = [
	"acquirer",
	"merchantName",
	"startDate",
	"endDate",
	"processingCurrency",
	"receivedAmount",
	"paidAmount",
	"settlementPaidAmount",
	"settlementCurrency",
	"balance",
	"status",
];

const FILTERABLE_COLUMNS = [
	{ key: "acquirer", label: "Bank (Acquirer)" },
	{ key: "merchantName", label: "Merchant" },
	{ key: "startDate", label: "Start Date" },
	{ key: "endDate", label: "End Date" },
	{ key: "processingCurrency", label: "Proc. Currency" },
	{ key: "receivedAmount", label: "Received" },
	{ key: "paidAmount", label: "Paid In Amount" },
	{ key: "settlementPaidAmount", label: "Actual Paid" },
	{ key: "settlementCurrency", label: "Settle Currency" },
	{ key: "balance", label: "Balance" },
	{ key: "status", label: "Status" },
];

function addAmountToBreakdown(map, currency, amount) {
	const normalizedCurrency = String(currency || "UNKNOWN").trim().toUpperCase();
	const numericAmount = Number(amount) || 0;
	map.set(normalizedCurrency, (map.get(normalizedCurrency) || 0) + numericAmount);
}

function finalizeBreakdownMap(map) {
	return [...map.entries()]
		.filter(([, amount]) => amount !== 0)
		.sort(
			(left, right) =>
				Math.abs(right[1]) - Math.abs(left[1]) ||
				left[0].localeCompare(right[0]),
		)
		.map(([currency, amount]) => ({ currency, amount }));
}

function deriveGroupedStatus(statusCounts, totalCount) {
	if (statusCounts.partially_paid > 0) return "partially_paid";
	if (statusCounts.settled === totalCount) return "settled";
	if (statusCounts.pending === totalCount) return "pending";
	if (statusCounts.settled > 0 || statusCounts.pending > 0) {
		return "partially_paid";
	}
	return "pending";
}

function buildMerchantGroups(transactions) {
	const groups = new Map();

	for (const tx of transactions) {
		const merchantName = tx.merchantName || tx.merchant || "Unknown Merchant";
		const merchantTag = tx.merchantTag || "";
		const groupKey = `${merchantName}::${merchantTag}`;

		if (!groups.has(groupKey)) {
			groups.set(groupKey, {
				merchantName,
				merchantTag,
				mids: new Set(),
				transactionCount: 0,
				receivedBreakdownMap: new Map(),
				paidBreakdownMap: new Map(),
				settlementPaidBreakdownMap: new Map(),
				balanceBreakdownMap: new Map(),
				statusCounts: {
					settled: 0,
					partially_paid: 0,
					pending: 0,
				},
				connectedBanksMap: new Map(),
			});
		}

		const group = groups.get(groupKey);
		const acquirer = tx.acquirer || tx.bank || "Unknown";
		const processingCurrency = tx.processingCurrency || tx.receivedCurrency || "UNKNOWN";
		const settlementCurrency =
			tx.settlementDisplayCurrency || tx.settlementCurrency || "UNKNOWN";

		group.transactionCount += 1;
		if (tx.mid) group.mids.add(tx.mid);
		group.statusCounts[tx.status] = (group.statusCounts[tx.status] || 0) + 1;
		addAmountToBreakdown(
			group.receivedBreakdownMap,
			processingCurrency,
			tx.receivedAmount ?? tx.payable,
		);
		addAmountToBreakdown(group.paidBreakdownMap, processingCurrency, tx.paidAmount);
		addAmountToBreakdown(
			group.settlementPaidBreakdownMap,
			settlementCurrency,
			tx.settlementPaidAmount,
		);
		addAmountToBreakdown(group.balanceBreakdownMap, processingCurrency, tx.balance);

		if (!group.connectedBanksMap.has(acquirer)) {
			group.connectedBanksMap.set(acquirer, {
				acquirer,
				transactionCount: 0,
				mids: new Set(),
				receivedBreakdownMap: new Map(),
				paidBreakdownMap: new Map(),
				balanceBreakdownMap: new Map(),
				statusCounts: {
					settled: 0,
					partially_paid: 0,
					pending: 0,
				},
			});
		}

		const bankGroup = group.connectedBanksMap.get(acquirer);
		bankGroup.transactionCount += 1;
		if (tx.mid) bankGroup.mids.add(tx.mid);
		bankGroup.statusCounts[tx.status] =
			(bankGroup.statusCounts[tx.status] || 0) + 1;
		addAmountToBreakdown(
			bankGroup.receivedBreakdownMap,
			processingCurrency,
			tx.receivedAmount ?? tx.payable,
		);
		addAmountToBreakdown(
			bankGroup.paidBreakdownMap,
			processingCurrency,
			tx.paidAmount,
		);
		addAmountToBreakdown(
			bankGroup.balanceBreakdownMap,
			processingCurrency,
			tx.balance,
		);
	}

	return [...groups.values()]
		.map((group) => {
			const connectedBanks = [...group.connectedBanksMap.values()]
				.map((bank) => ({
					acquirer: bank.acquirer,
					transactionCount: bank.transactionCount,
					mids: [...bank.mids].sort((left, right) => left.localeCompare(right)),
					receivedBreakdown: finalizeBreakdownMap(bank.receivedBreakdownMap),
					paidBreakdown: finalizeBreakdownMap(bank.paidBreakdownMap),
					balanceBreakdown: finalizeBreakdownMap(bank.balanceBreakdownMap),
					status: deriveGroupedStatus(bank.statusCounts, bank.transactionCount),
				}))
				.sort(
					(left, right) =>
						right.transactionCount - left.transactionCount ||
						left.acquirer.localeCompare(right.acquirer),
				);

			return {
				merchantName: group.merchantName,
				merchantTag: group.merchantTag,
				mids: [...group.mids].sort((left, right) => left.localeCompare(right)),
				transactionCount: group.transactionCount,
				bankCount: connectedBanks.length,
				receivedBreakdown: finalizeBreakdownMap(group.receivedBreakdownMap),
				paidBreakdown: finalizeBreakdownMap(group.paidBreakdownMap),
				settlementPaidBreakdown: finalizeBreakdownMap(
					group.settlementPaidBreakdownMap,
				),
				balanceBreakdown: finalizeBreakdownMap(group.balanceBreakdownMap),
				statusCounts: group.statusCounts,
				status: deriveGroupedStatus(group.statusCounts, group.transactionCount),
				connectedBanks,
			};
		})
		.sort(
			(left, right) =>
				right.transactionCount - left.transactionCount ||
				left.merchantName.localeCompare(right.merchantName),
		);
}

function getSearchableMerchantGroupValues(group) {
	return [
		group.merchantName,
		group.merchantTag,
		group.status,
		...group.mids,
		...group.connectedBanks.map((bank) => bank.acquirer),
		...group.receivedBreakdown.map((entry) => `${entry.currency} ${entry.amount}`),
		...group.balanceBreakdown.map((entry) => `${entry.currency} ${entry.amount}`),
	]
		.filter(Boolean)
		.map((value) => String(value).toLowerCase());
}

function createDefaultFilters() {
	return {
		startDate: "",
		endDate: "",
		minAmount: "",
		maxAmount: "",
		merchants: [],
		acquirers: [],
		processingCurrencies: [],
		settlementCurrencies: [],
		partners: [],
		statuses: [],
		visibleColumns: DEFAULT_VISIBLE_COLUMNS,
	};
}

function readSavedFilters() {
	if (typeof window === "undefined") {
		return createDefaultFilters();
	}

	try {
		const savedFilters = window.localStorage.getItem(
			DASHBOARD_FILTERS_STORAGE_KEY,
		);

		if (!savedFilters) {
			return createDefaultFilters();
		}

		return {
			...createDefaultFilters(),
			...JSON.parse(savedFilters),
		};
	} catch {
		return createDefaultFilters();
	}
}

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
		filters.merchants.length > 0 ||
		filters.acquirers.length > 0 ||
		filters.processingCurrencies.length > 0 ||
		filters.settlementCurrencies.length > 0 ||
		filters.partners.length > 0 ||
		filters.statuses.length > 0,
	);
}

function getSearchableDateParts(value) {
	if (!value) return [];

	const date = new Date(value);

	if (Number.isNaN(date.getTime())) {
		return [String(value)];
	}

	return [
		date.toISOString(),
		date.toISOString().slice(0, 10),
		date.toLocaleDateString("en-GB"),
		date.toLocaleDateString("en-US"),
	];
}

function getSearchableTransactionValues(transaction) {
	return [
		transaction.acquirer,
		transaction.bank,
		transaction.balance,
		transaction.endDate,
		transaction.lastPaidToMerchantDate,
		transaction.lastPaymentBank,
		transaction.lastPaymentRate,
		transaction.lastSettlementAmount,
		transaction.merchant,
		transaction.merchantName,
		transaction.merchantTag,
		transaction.mid,
		transaction.paid,
		transaction.amountPaid,
		transaction.payable,
		transaction.amount,
		transaction.paymentMethod,
		transaction.processingCurrency,
		transaction.settlementCurrency,
		transaction.startDate,
		transaction.status,
		...getSearchableDateParts(transaction.startDate),
		...getSearchableDateParts(transaction.endDate),
		...getSearchableDateParts(transaction.lastPaidToMerchantDate),
	]
		.filter((value) => value !== undefined && value !== null && value !== "")
		.map((value) => String(value).toLowerCase());
}

export default function Dashboard() {
	const dispatch = useDispatch();
	const { transactions, loading, error } = useSelector(selectPaymentsFullState);
	const currentUser = useSelector(selectCurrentUser);
	const [searchQuery, setSearchQuery] = useState("");
	const [rowsPerPage, setRowsPerPage] = useState(50);
	const [currentPage, setCurrentPage] = useState(1);
	const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
	const [filters, setFilters] = useState(readSavedFilters);
	const [tableView, setTableView] = useState("merchant");

	function formatAmount(amount, currency = "EUR") {
		const num = Number(amount);
		if (isNaN(num)) return "0.00";

		if (currency === "USDT") {
			return `USDT ${num.toLocaleString("en-US", {
				minimumFractionDigits: 2,
				maximumFractionDigits: 2,
			})}`;
		}

		const currencyLocaleMap = {
			INR: "en-IN",
			USD: "en-US",
			EUR: "en-US",
			GBP: "en-GB",
			CAD: "en-CA",
			AUD: "en-AU",
			JPY: "ja-JP",
		};

		const locale = currencyLocaleMap[currency] || "en-US";

		return num.toLocaleString(locale, {
			style: "currency",
			currency: currency === "USDT" ? "USD" : currency,
			minimumFractionDigits: 2,
			maximumFractionDigits: 2,
		});
	}

	function formatDate(date) {
		if (!date) return "-";

		const d = new Date(date);
		if (isNaN(d)) return "-";

		return d.toISOString().split("T")[0];
	}

	function formatPlainNumber(amount) {
		const num = Number(amount);
		if (isNaN(num)) return "0.00";

		return num.toLocaleString("en-US", {
			minimumFractionDigits: 2,
			maximumFractionDigits: 2,
		});
	}

	const normalizedSearchQuery = searchQuery.trim().toLowerCase();
	const hasAppliedFilters = hasActiveDataFilters(filters);
	const merchantOptions = [
		...new Set(
			transactions
				.map((transaction) => transaction.merchantName)
				.filter(Boolean),
		),
	]
		.sort((left, right) => left.localeCompare(right))
		.map((merchant) => ({
			label: merchant,
			value: merchant,
		}));
	const acquirerOptions = [
		...new Set(
			transactions.map((transaction) => transaction.acquirer).filter(Boolean),
		),
	]
		.sort((left, right) => left.localeCompare(right))
		.map((acquirer) => ({
			label: acquirer,
			value: acquirer,
		}));
	const partnerOptions = [
		{ label: "Transactworld", value: "transactworld" },
		{ label: "Dreamz Pay", value: "dreamzpay" },
	];

	const baseFilteredTransactions = transactions.filter((transaction) => {
		const transactionStartDate = transaction.startDate
			? new Date(transaction.startDate)
			: null;
		const transactionEndDate = transaction.endDate
			? new Date(transaction.endDate)
			: null;
		const payableAmount = Number(transaction.receivedAmount ?? transaction.payable) || 0;
		const merchantName = transaction.merchantName || transaction.merchant || "";
		const acquirerName = transaction.acquirer || transaction.bank || "";
		const partnerValue = getPartnerValue(transaction.merchantTag);

		if (
			filters.startDate &&
			(!transactionStartDate ||
				Number.isNaN(transactionStartDate.getTime()) ||
				transactionStartDate < new Date(filters.startDate))
		) {
			return false;
		}

		if (filters.endDate) {
			const endDate = new Date(filters.endDate);
			endDate.setHours(23, 59, 59, 999);

			if (
				!transactionEndDate ||
				Number.isNaN(transactionEndDate.getTime()) ||
				transactionEndDate > endDate
			) {
				return false;
			}
		}

		if (filters.minAmount && payableAmount < Number(filters.minAmount)) {
			return false;
		}

		if (filters.maxAmount && payableAmount > Number(filters.maxAmount)) {
			return false;
		}

		if (
			filters.merchants.length > 0 &&
			!filters.merchants.includes(merchantName)
		) {
			return false;
		}

		if (
			filters.acquirers.length > 0 &&
			!filters.acquirers.includes(acquirerName)
		) {
			return false;
		}

		if (
			filters.processingCurrencies.length > 0 &&
			!filters.processingCurrencies.includes(transaction.processingCurrency)
		) {
			return false;
		}

		if (
			filters.settlementCurrencies.length > 0 &&
			!filters.settlementCurrencies.includes(transaction.settlementDisplayCurrency || transaction.settlementCurrency)
		) {
			return false;
		}

		if (
			filters.partners.length > 0 &&
			!filters.partners.includes(partnerValue)
		) {
			return false;
		}

		if (
			filters.statuses.length > 0 &&
			!filters.statuses.includes(transaction.status)
		) {
			return false;
		}

		return true;
	});

	const searchableTransactions = hasAppliedFilters
		? baseFilteredTransactions
		: transactions.filter((transaction) => {
				if (!normalizedSearchQuery) return true;

				return getSearchableTransactionValues(transaction).some((value) =>
					value.includes(normalizedSearchQuery),
				);
			});
	const merchantGroups = buildMerchantGroups(
		hasAppliedFilters ? baseFilteredTransactions : transactions,
	);
	const filteredMerchantGroups = hasAppliedFilters
		? merchantGroups
		: merchantGroups.filter((group) =>
				getSearchableMerchantGroupValues(group).some((value) =>
					value.includes(normalizedSearchQuery),
				),
			);
	const tableRows =
		tableView === "merchant" ? filteredMerchantGroups : searchableTransactions;
	const hasTransactionData = transactions.length > 0;
	const filtersHideAllResults =
		hasAppliedFilters && hasTransactionData && tableRows.length === 0;
	const hasNoLedgerData =
		!loading && !error && !hasAppliedFilters && transactions.length === 0;

	const totalPages = Math.max(
		1,
		Math.ceil(tableRows.length / rowsPerPage),
	);
	const safeCurrentPage = Math.min(currentPage, totalPages);
	const startIndex = (safeCurrentPage - 1) * rowsPerPage;
	const paginatedTableRows = tableRows.slice(startIndex, startIndex + rowsPerPage);
	const showingFrom = tableRows.length > 0 ? startIndex + 1 : 0;
	const showingTo = Math.min(
		startIndex + paginatedTableRows.length,
		tableRows.length,
	);
	const summaryTransactions = hasAppliedFilters
		? baseFilteredTransactions
		: transactions;
	const visibleColumnKeys =
		filters.visibleColumns.length > 0
			? filters.visibleColumns
			: DEFAULT_VISIBLE_COLUMNS;
	const visibleColumns = FILTERABLE_COLUMNS.filter((column) =>
		visibleColumnKeys.includes(column.key),
	);

	const receivedBreakdownByAcquirer = [...new Map(
		summaryTransactions.reduce((map, tx) => {
			const acquirer = tx.acquirer || "Unknown";
			const currency = tx.processingCurrency || tx.receivedCurrency || "UNKNOWN";
			const amount = Number(tx.receivedAmount ?? tx.payable) || 0;

			if (!map.has(acquirer)) {
				map.set(acquirer, {
					acquirer,
					totalReceived: 0,
					currencies: new Map(),
				});
			}

			const entry = map.get(acquirer);
			entry.totalReceived += amount;
			entry.currencies.set(currency, (entry.currencies.get(currency) || 0) + amount);
			return map;
		}, new Map()),
	).values()]
		.map((entry) => ({
			acquirer: entry.acquirer,
			totalReceived: entry.totalReceived,
			currencies: [...entry.currencies.entries()]
				.sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
				.map(([currency, amount]) => ({ currency, amount })),
		}))
		.sort((left, right) => right.totalReceived - left.totalReceived || left.acquirer.localeCompare(right.acquirer));

	const totalReceivedAllCurrencies = summaryTransactions.reduce(
		(sum, tx) => sum + (Number(tx.receivedAmount ?? tx.payable) || 0),
		0,
	);

	const totalPaidAmount = summaryTransactions.reduce(
		(sum, tx) => sum + (Number(tx.paidAmount) || 0),
		0,
	);

	const totalBalanceAmount = summaryTransactions.reduce(
		(sum, tx) => sum + (Number(tx.balance) || 0),
		0,
	);

	const totalPaidEuro = summaryTransactions
		.filter((tx) => (tx.paymentMethod || "") === "WIRE")
		.reduce((sum, tx) => sum + (Number(tx.settlementPaidAmount) || 0), 0);

	const totalPaidUsdt = summaryTransactions
		.filter((tx) => (tx.paymentMethod || "") === "CRYPTO")
		.reduce((sum, tx) => sum + (Number(tx.settlementPaidAmount) || 0), 0);

	function getMerchantShortName(name) {
		if (!name) return "-";

		if (name.includes("Transactworld")) return "TW";
		if (name.includes("Dreamzpay")) return "DP";

		return name;
	}

	const completedCount = summaryTransactions.filter(
		(tx) => tx.status === "settled",
	).length;
	const merchantsPaidCount = new Set(
		summaryTransactions
			.filter((tx) => tx.status === "settled")
			.map((tx) => tx.merchantName || tx.merchant)
			.filter(Boolean),
	).size;
	const partiallyPaidCount = summaryTransactions.filter(
		(tx) => tx.status === "partially_paid",
	).length;
	const pendingCount = summaryTransactions.filter(
		(tx) => tx.status === "pending",
	).length;
	const statusBreakdownItems = [
		{
			label: "Completed",
			value: completedCount,
			dotClassName: "bg-green-500",
		},
		{
			label: "Partially Paid",
			value: partiallyPaidCount,
			dotClassName: "bg-orange-400",
		},
		{
			label: "Pending",
			value: pendingCount,
			dotClassName: "bg-yellow-400",
		},
	];

	const handleApplyFilters = (nextFilters) => {
		setFilters({
			...createDefaultFilters(),
			...nextFilters,
			visibleColumns:
				nextFilters.visibleColumns.length > 0
					? nextFilters.visibleColumns
					: DEFAULT_VISIBLE_COLUMNS,
		});
		setSearchQuery("");
		setCurrentPage(1);
		setIsFilterModalOpen(false);
	};

	const handleResetFilters = () => {
		setFilters(createDefaultFilters());
		setSearchQuery("");
		setCurrentPage(1);
	};

	const renderCellContent = (item, columnKey) => {
		switch (columnKey) {
			case "acquirer":
				return (
					<div className="flex items-center gap-3">
						<div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/6 shadow-sm transition-transform duration-200 group-hover:scale-105">
							<Landmark className="text-primary" size={16} />
						</div>
						<div className="min-w-0">
							<span className="block truncate text-sm font-bold text-on-surface">
								{item.acquirer || "-"}
							</span>
						</div>
					</div>
				);
			case "merchantName":
				return (
					<div
						className="flex items-center justify-between gap-2 text-sm font-bold text-on-surface capitalize"
						title={item.merchantName}
					>
						<div className="min-w-0">
							<span className="block truncate max-w-37.5 font-semibold text-on-surface">
								{item.merchantName || "-"}
							</span>
							<span className="mt-1 block text-[11px] font-medium uppercase tracking-wide text-on-surface-variant/75">
								MID {item.mid || "-"}
							</span>
						</div>

						<Badge
							variant={getMerchantShortName(item.merchantTag)}
							className="ml-2 shrink-0 shadow-xs"
						>
							{getMerchantShortName(item.merchantTag)}
						</Badge>
					</div>
				);
			case "startDate":
			case "endDate":
				return formatDate(item[columnKey]);
			case "processingCurrency":
				return (
					<span className="rounded-full bg-primary/8 px-3 py-1.5 font-bold tracking-wide text-primary">
						{item.processingCurrency || "-"}
					</span>
				);
			case "settlementCurrency":
				return (
					<span className="rounded-full bg-surface-container px-3 py-1.5 font-bold tracking-wide text-on-surface">
						{item.settlementDisplayCurrency || item.settlementCurrency || "-"}
					</span>
				);
			case "rate":
				return (
					<span className="rounded-full bg-primary/8 px-3 py-1.5 font-bold uppercase tracking-widest text-primary shadow-xs">
						{Number(item.lastPaymentRate || 0).toFixed(2)}
					</span>
				);
			case "receivedAmount":
				return formatAmount(
					item.receivedAmount || 0,
					item.receivedCurrency || item.processingCurrency || "EUR",
				);
			case "paidAmount":
				return formatAmount(
					item.paidAmount || 0,
					item.processingCurrency || item.receivedCurrency || "EUR",
				);
			case "settlementPaidAmount":
				return formatAmount(
					item.settlementPaidAmount || 0,
					item.settlementDisplayCurrency || item.settlementCurrency || "EUR",
				);
			case "balance":
				return formatAmount(
					item.balance || 0,
					item.processingCurrency || item.receivedCurrency || "EUR",
				);
			case "status":
				return (
					<span
						className={`rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest shadow-xs ${statusClasses[item.status]}`}
					>
						{String(item.status || "pending").replace(/_/g, " ")}
					</span>
				);
			default:
				return item[columnKey] || "-";
		}
	};

	const renderAmountBreakdown = (entries, { align = "left" } = {}) => {
		if (!entries?.length) {
			return <span className="text-sm font-medium text-on-surface-variant">-</span>;
		}

		return (
			<div className={`flex flex-wrap gap-2 ${align === "right" ? "justify-end" : ""}`}>
				{entries.map((entry) => (
					<span
						key={`${entry.currency}-${entry.amount}`}
						className={`rounded-full px-3 py-1 text-xs font-bold tabular-nums ring-1 ${
							entry.amount < 0
								? "bg-red-50 text-red-700 ring-red-200"
								: entry.amount > 0
									? "bg-emerald-50 text-emerald-700 ring-emerald-200"
									: "bg-surface-container text-on-surface ring-outline-variant/10"
						}`}
					>
						{formatAmount(entry.amount, entry.currency)}
					</span>
				))}
			</div>
		);
	};

	const renderSummaryMetric = (label, entries, helperText) => (
		<div className="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-4">
			<p className="text-[10px] font-bold uppercase tracking-[0.22em] text-on-surface-variant">
				{label}
			</p>
			<div className="mt-3">{renderAmountBreakdown(entries)}</div>
			{helperText ? (
				<p className="mt-3 text-xs leading-5 text-on-surface-variant">{helperText}</p>
			) : null}
		</div>
	);

	useEffect(() => {
		dispatch(fetchPayments());
	}, [dispatch]);

	useEffect(() => {
		window.localStorage.setItem(
			DASHBOARD_FILTERS_STORAGE_KEY,
			JSON.stringify(filters),
		);
	}, [filters]);

	if (loading)
		return (
			<div className="p-8 flex justify-center items-center h-screen text-on-surface">
				Loading...
			</div>
		);

	return (
		<div className="w-full bg-background text-on-background">
			{error && (
				<div className="mb-6 flex items-center justify-between gap-4 rounded-lg border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
					<div>
						<p className="font-bold">Ledger data could not be loaded.</p>
						<p className="mt-1">{error}</p>
					</div>
					<button
						type="button"
						onClick={() => dispatch(fetchPayments())}
						className="shrink-0 rounded-full bg-red-600 px-4 py-2 text-xs font-bold uppercase tracking-widest text-white"
					>
						Retry
					</button>
				</div>
			)}

			{!error && filtersHideAllResults && (
				<div className="mb-6 flex items-center justify-between gap-4 rounded-lg border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
					<div>
						<p className="font-bold">Active filters are hiding all transactions.</p>
						<p className="mt-1">Clear the current filters to see the full dashboard values again.</p>
					</div>
					<button
						type="button"
						onClick={handleResetFilters}
						className="shrink-0 rounded-full bg-amber-500 px-4 py-2 text-xs font-bold uppercase tracking-widest text-white"
					>
						Clear Filters
					</button>
				</div>
			)}

			{!error && hasNoLedgerData && (
				<div className="mb-6 rounded-lg border border-outline-variant/20 bg-surface-container-low px-5 py-4 text-sm text-on-surface-variant">
					No ledger transactions were returned yet. Upload a wiresheet/payment sheet pair or retry after the backend finishes syncing.
				</div>
			)}

			<section className="mb-12 grid grid-cols-1 gap-6 xl:grid-cols-[1.5fr_1fr]">
				<div className="rounded-lg bg-linear-to-br from-primary to-primary-container p-8 text-white">
					<div className="flex items-start justify-between gap-4">
						<div>
							<p className="text-xs font-bold uppercase tracking-widest text-white/70">Total Received</p>
							<h2 className="mt-2 text-2xl font-extrabold tracking-tight text-white">{formatPlainNumber(totalReceivedAllCurrencies)}</h2>
							<p className="mt-2 text-sm text-white/75">Received in multiple currencies from wiresheets.</p>
						</div>
						<Landmark className="text-white/55" size={22} />
					</div>
					<div className="mt-8 space-y-4">
						{receivedBreakdownByAcquirer.map((entry) => (
							<div key={entry.acquirer} className="rounded-lg border border-white/12 bg-white/8 p-5 backdrop-blur-xs">
								<div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
									<p className="text-lg font-bold text-white">{entry.acquirer}</p>
									<p className="text-2xl font-extrabold tracking-tight text-white">{formatPlainNumber(entry.totalReceived)}</p>
								</div>
								<div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
									{entry.currencies.map((currencyEntry) => (
										<div key={`${entry.acquirer}-${currencyEntry.currency}`} className="rounded-lg border border-white/10 bg-black/10 px-4 py-3">
											<p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/65">{currencyEntry.currency}</p>
											<p className="mt-2 text-xl font-extrabold tracking-tight text-white">{formatPlainNumber(currencyEntry.amount)}</p>
										</div>
									))}
								</div>
							</div>
						))}
					</div>
				</div>
				<div className="space-y-6">
					<div className="rounded-lg border border-outline-variant/10 bg-surface-container-lowest p-8">
						<div className="flex items-start justify-between gap-4">
							<div>
								<p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Paid Overview</p>
								<p className="mt-2 text-sm text-on-surface-variant">Simple view of how your payment sheet works.</p>
							</div>
							<CreditCard className="text-primary" size={22} />
						</div>
						<div className="mt-8 space-y-4">
							<div className="rounded-lg border border-outline-variant/10 bg-surface-container-low p-5">
								<p className="text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">Paid In Amount</p>
								<p className="mt-2 text-3xl font-extrabold tracking-tight text-on-surface">{formatPlainNumber(totalPaidAmount)}</p>
								<p className="mt-2 text-xs text-on-surface-variant">Reconciliation through payment-sheet Amount column</p>
							</div>
							<div className="rounded-lg border border-outline-variant/10 bg-surface-container-low p-5">
								<p className="text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">Amount In EUR</p>
								<p className="mt-2 text-3xl font-extrabold tracking-tight text-on-surface">{formatAmount(totalPaidEuro, "EUR")}</p>
								<p className="mt-2 text-xs text-on-surface-variant">Actual wire amount going in client bank</p>
							</div>
							<div className="rounded-lg border border-outline-variant/10 bg-surface-container-low p-5">
								<p className="text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">Amount In USDT</p>
								<p className="mt-2 text-3xl font-extrabold tracking-tight text-on-surface">USDT {formatPlainNumber(totalPaidUsdt)}</p>
								<p className="mt-2 text-xs text-on-surface-variant">Actual crypto amount going in client wallet</p>
							</div>
						</div>
					</div>
					<div className="rounded-lg bg-surface-container-low p-4">
						<div className="flex flex-col gap-4">
							{statusBreakdownItems.map((item) => (
								<div key={item.label} className="flex flex-1 flex-col justify-center rounded-lg border border-outline-variant/10 bg-surface-container-lowest p-5 transition-colors">
									<div className="mb-1 flex items-center justify-between">
										<span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">{item.label}</span>
										<div className={`h-2 w-2 rounded-full ${item.dotClassName}`} />
									</div>
									<div className="text-3xl font-extrabold text-on-surface">{item.value}</div>
								</div>
							))}
						</div>
					</div>
				</div>
			</section>

			{/* Table Section */}
			<section className="overflow-hidden rounded-lg border border-outline-variant/10 bg-surface-container-lowest">
				<div className="flex items-center justify-between border-b border-outline-variant/5 px-8 py-6">
					<div>
						<h3 className="text-xl font-bold tracking-tight text-on-surface">
							Final Payment Report
						</h3>
						<p className="mt-1 text-sm text-on-surface-variant">
							Merchant View groups connected banks together so anyone can understand merchant-level settlement quickly.
						</p>
					</div>
					<div className="flex items-center gap-3">
						<div className="flex items-center gap-1 rounded-full bg-surface-container-low p-1">
							<button
								type="button"
								onClick={() => {
									setTableView("merchant");
									setCurrentPage(1);
								}}
								className={`rounded-full px-4 py-2 text-xs font-bold uppercase tracking-widest transition ${
									tableView === "merchant"
										? "bg-primary text-white"
										: "text-on-surface-variant"
								}`}
							>
								Merchant View
							</button>
							<button
								type="button"
								onClick={() => {
									setTableView("transaction");
									setCurrentPage(1);
								}}
								className={`rounded-full px-4 py-2 text-xs font-bold uppercase tracking-widest transition ${
									tableView === "transaction"
										? "bg-primary text-white"
										: "text-on-surface-variant"
								}`}
							>
								Transaction View
							</button>
						</div>
						<div className="relative">
							<Search
								className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant"
								size={16}
							/>
							<input
								type="text"
								placeholder={
									tableView === "merchant"
										? "Search merchants, mids, banks..."
										: "Search transactions..."
								}
								value={searchQuery}
								onChange={(e) => {
									if (hasAppliedFilters && e.target.value.trim() !== "") {
										toast.warning(
											"A filter is applied. Clear filters to search through data.",
											{
												id: "dashboard-filter-search-warning",
											},
										);
										return;
									}

									setSearchQuery(e.target.value);
									setCurrentPage(1);
								}}
								className="w-64 rounded-full border-none bg-surface-container-low py-2 pl-10 pr-4 text-sm text-on-surface outline-none transition-all focus:ring-2 focus:ring-primary/20"
							/>
						</div>
						<button
							type="button"
							onClick={() => setIsFilterModalOpen(true)}
							className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-all ${
								hasAppliedFilters
									? "bg-primary/12 text-primary shadow-sm hover:bg-primary/18"
									: "text-on-surface-variant hover:bg-surface-container-low"
							}`}
						>
							<SlidersHorizontal size={16} />
							Filters
						</button>
					</div>
				</div>

				<div className="overflow-x-auto scrollbar-hide">
					{tableView === "merchant" ? (
						<div className="space-y-4 p-4 md:p-6">
							<div className="grid gap-3 rounded-2xl border border-outline-variant/10 bg-surface-container-low p-4 md:grid-cols-4">
								<div>
									<p className="text-[10px] font-bold uppercase tracking-[0.22em] text-on-surface-variant">
										Received
									</p>
									<p className="mt-2 text-sm text-on-surface-variant">
										Total wiresheet amount coming from all connected banks.
									</p>
								</div>
								<div>
									<p className="text-[10px] font-bold uppercase tracking-[0.22em] text-on-surface-variant">
										Paid In Amount
									</p>
									<p className="mt-2 text-sm text-on-surface-variant">
										Amount matched from payment sheet in the processing currency.
									</p>
								</div>
								<div>
									<p className="text-[10px] font-bold uppercase tracking-[0.22em] text-on-surface-variant">
										Actual Paid
									</p>
									<p className="mt-2 text-sm text-on-surface-variant">
										Real EUR or USDT amount sent to the merchant.
									</p>
								</div>
								<div>
									<p className="text-[10px] font-bold uppercase tracking-[0.22em] text-on-surface-variant">
										Negative Amounts
									</p>
									<p className="mt-2 text-sm text-on-surface-variant">
										Red values show deductions like chargebacks that may be adjusted against another connected bank.
									</p>
								</div>
							</div>
							<table className="w-full border-collapse text-left">
							<thead className="bg-surface-container-low/50">
								<tr>
									<th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
										Merchant
									</th>
									<th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
										Bank Story
									</th>
									<th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
										Merchant Net Summary
									</th>
									<th className="px-8 py-4 text-center text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
										Status
									</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-outline-variant/5">
								{paginatedTableRows.length > 0 ? (
									paginatedTableRows.map((group, index) => (
										<tr
											key={`${group.merchantName}-${startIndex + index}`}
										className="align-top transition-all duration-200 hover:bg-surface-container-low/45"
										>
											<td className="px-8 py-5">
												<div className="min-w-[240px]">
													<div className="flex items-start gap-3">
														<div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-sm">
															<Store size={18} />
														</div>
														<div className="min-w-0">
															<p className="text-base font-bold text-on-surface">
																{group.merchantName}
															</p>
															<div className="mt-2 flex flex-wrap items-center gap-2">
																<Badge
																	variant={getMerchantShortName(group.merchantTag)}
																	className="shadow-xs"
																>
																	{getMerchantShortName(group.merchantTag)}
																</Badge>
																<span className="text-xs text-on-surface-variant">
																	{group.transactionCount} settlement rows
																</span>
																<span className="text-xs text-on-surface-variant">
																	{group.bankCount} connected banks
																</span>
															</div>
															<div className="mt-4">
																<p className="text-[10px] font-bold uppercase tracking-[0.22em] text-on-surface-variant">
																	Connected MIDs
																</p>
																<div className="mt-2 flex flex-wrap gap-2">
																	{group.mids.length > 0 ? (
																		group.mids.map((mid) => (
																			<span
																				key={mid}
																				className="rounded-full bg-surface-container px-3 py-1 text-xs font-bold text-on-surface"
																			>
																				{mid}
																			</span>
																		))
																	) : (
																		<span className="text-sm text-on-surface-variant">-</span>
																	)}
																</div>
															</div>
														</div>
													</div>
												</div>
											</td>
											<td className="px-8 py-5">
												<div className="min-w-[380px] space-y-3">
													{group.connectedBanks.map((bank) => (
														<div
															key={bank.acquirer}
															className="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-4 shadow-sm"
														>
															<div className="flex items-center justify-between gap-3">
																<div>
																	<p className="text-sm font-bold text-on-surface">
																		{bank.acquirer}
																	</p>
																	<p className="mt-1 text-xs text-on-surface-variant">
																		{bank.transactionCount} settlement rows routed through this bank
																	</p>
																</div>
																<span
																	className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${statusClasses[bank.status]}`}
																>
																	{bank.status.replace(/_/g, " ")}
																</span>
															</div>
															<div className="mt-3 grid gap-3 md:grid-cols-3">
																<div>
																	<p className="mb-2 text-[10px] font-bold uppercase tracking-[0.22em] text-on-surface-variant">
																		Received
																	</p>
																	{renderAmountBreakdown(bank.receivedBreakdown)}
																</div>
																<div>
																	<p className="mb-2 text-[10px] font-bold uppercase tracking-[0.22em] text-on-surface-variant">
																		Paid
																	</p>
																	{renderAmountBreakdown(bank.paidBreakdown)}
																</div>
																<div>
																	<p className="mb-2 text-[10px] font-bold uppercase tracking-[0.22em] text-on-surface-variant">
																		Balance
																	</p>
																	{renderAmountBreakdown(bank.balanceBreakdown)}
																</div>
															</div>
														</div>
													))}
												</div>
											</td>
											<td className="px-8 py-5">
												<div className="grid min-w-[340px] gap-3">
													{renderSummaryMetric(
														"Received",
														group.receivedBreakdown,
														"Gross amount received from all connected banks before merchant payout adjustment.",
													)}
													{renderSummaryMetric(
														"Paid In Amount",
														group.paidBreakdown,
														"Payment sheet amount matched in the original processing currency.",
													)}
													{renderSummaryMetric(
														"Actual Paid",
														group.settlementPaidBreakdown,
														"Real EUR or USDT value sent out to the merchant after conversion.",
													)}
													{renderSummaryMetric(
														"Open Balance",
														group.balanceBreakdown,
														"Any remaining amount still pending after deductions and payment matching.",
													)}
												</div>
											</td>
											<td className="px-8 py-5 text-center">
												<div className="flex flex-col items-center gap-2">
													<span
														className={`rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest ${statusClasses[group.status]}`}
													>
														{group.status.replace(/_/g, " ")}
													</span>
													<p className="text-[11px] text-on-surface-variant">
														S {group.statusCounts.settled} | P {group.statusCounts.partially_paid} | N {group.statusCounts.pending}
													</p>
												</div>
											</td>
										</tr>
									))
								) : (
									<tr>
										<td
											colSpan={4}
											className="px-8 py-12 text-center text-sm font-medium text-on-surface-variant"
										>
											No merchants found.
										</td>
									</tr>
								)}
							</tbody>
						</table>
						</div>
					) : (
						<table className="w-full border-collapse text-left">
							<thead className="bg-surface-container-low/50">
								<tr>
									{visibleColumns.map((column) => (
										<th
											key={column.key}
											className={`whitespace-nowrap px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant ${
												[
													"processingCurrency",
													"settlementCurrency",
													"rate",
													"status",
												].includes(column.key)
													? "text-center"
													: ["receivedAmount", "paidAmount", "settlementPaidAmount", "balance"].includes(column.key)
														? "text-right"
														: ""
											}`}
										>
											{column.label}
										</th>
									))}
									<th className="whitespace-nowrap px-8 py-4 text-right text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
										Actions
									</th>
								</tr>
							</thead>

							<tbody className="divide-y divide-outline-variant/5">
								{paginatedTableRows.length > 0 ? (
									paginatedTableRows.map((item, index) => (
										<tr
											key={`${item.acquirer}-${item.merchant}-${startIndex + index}`}
											className="group border-transparent transition-all duration-200 hover:bg-surface-container-low/45"
										>
											{visibleColumns.map((column) => (
												<td
													key={`${column.key}-${startIndex + index}`}
													className={`px-8 py-4 ${
														column.key === "merchantName"
															? ""
															: [
																		"processingCurrency",
																		"settlementCurrency",
																		"rate",
																		"status",
																  ].includes(column.key)
																? "whitespace-nowrap text-center text-xs font-bold text-on-surface"
																: ["receivedAmount", "paidAmount", "settlementPaidAmount", "balance"].includes(column.key)
																	? "whitespace-nowrap text-right text-sm font-extrabold tabular-nums text-on-surface"
																	: "whitespace-nowrap text-sm font-medium text-on-surface-variant"
													}`}
												>
													{renderCellContent(item, column.key)}
												</td>
											))}
											<td className="whitespace-nowrap px-8 py-4 text-right">
												<button
													type="button"
													className="rounded-full p-2 transition-colors hover:bg-surface-container"
												>
													<MoreVertical
														className="text-on-surface-variant"
														size={18}
													/>
												</button>
											</td>
										</tr>
									))
								) : (
									<tr>
										<td
											colSpan={visibleColumns.length + 1}
											className="px-8 py-12 text-center text-sm font-medium text-on-surface-variant"
										>
											No transactions found.
										</td>
									</tr>
								)}
							</tbody>
						</table>
					)}
				</div>

				<div className="flex items-center justify-between bg-surface-container-low/30 px-8 py-4 text-xs font-bold uppercase tracking-widest text-on-surface-variant">
					<div className="flex items-center gap-4">
						<div>
							Showing {showingFrom > 0 ? `${showingFrom}-${showingTo}` : "0"} of{" "}
							{tableRows.length} {tableView === "merchant" ? "merchants" : "transactions"}
						</div>
						<label className="flex items-center gap-2">
							<span>Rows</span>
							<select
								value={rowsPerPage}
								onChange={(e) => {
									setRowsPerPage(Number(e.target.value));
									setCurrentPage(1);
								}}
								className="rounded-full bg-surface-container px-3 py-2 text-xs font-bold text-on-surface outline-none"
							>
								<option value={25}>25</option>
								<option value={50}>50</option>
								<option value={100}>100</option>
							</select>
						</label>
					</div>
					<div className="flex items-center gap-2">
						<span>
							Page {showingFrom === 0 ? 0 : safeCurrentPage} of{" "}
							{tableRows.length === 0 ? 0 : totalPages}
						</span>
						<button
							type="button"
							onClick={() => setCurrentPage(Math.max(1, safeCurrentPage - 1))}
							disabled={safeCurrentPage === 1 || tableRows.length === 0}
							className="rounded-full px-4 py-2 transition-colors hover:bg-surface-container"
						>
							Previous
						</button>
						<button
							type="button"
							onClick={() =>
								setCurrentPage(Math.min(totalPages, safeCurrentPage + 1))
							}
							disabled={safeCurrentPage === totalPages || tableRows.length === 0}
							className="rounded-full bg-primary px-4 py-2 text-white transition-colors"
						>
							Next
						</button>
					</div>
				</div>
			</section>
			<FilterModal
				isOpen={isFilterModalOpen}
				onClose={() => setIsFilterModalOpen(false)}
				filters={filters}
				onApply={handleApplyFilters}
				onReset={handleResetFilters}
				options={{
					transactions,
					merchants: merchantOptions,
					acquirers: acquirerOptions,
					partners: partnerOptions,
					columns: FILTERABLE_COLUMNS,
				}}
				isAdmin={currentUser?.role === "admin"}
			/>
		</div>
	);
}
