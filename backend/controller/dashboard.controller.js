import { Payment } from "../models/payment.model.js";
import { UnmatchedPayment } from "../models/unmatchedPayment.model.js";
import { Wiresheet } from "../models/wiresheet.model.js";
import { WiresheetTransaction } from "../models/wiresheet-transaction.model.js";
import { MiscellaneousPayment } from "../models/miscellaneous-payment.model.js";

const toNumber = (value) => Number(value) || 0;

const startOfDate = (value) => {
	const date = new Date(value);
	date.setUTCHours(0, 0, 0, 0);
	return date;
};

const endOfDate = (value) => {
	const date = new Date(value);
	date.setUTCHours(23, 59, 59, 999);
	return date;
};

const getDateRange = (paymentDate) => ({
	$gte: startOfDate(paymentDate),
	$lte: endOfDate(paymentDate),
});

const getDisplayCurrency = (currency, paymentMethod) => {
	if (paymentMethod === "CRYPTO" && currency === "USD") return "USDT";
	return currency || "UNKNOWN";
};

const miscLabels = {
	repayment: "Repayment",
	bank_rr: "Bank RR",
	rr: "Cap RR",
	agent: "Agent",
	overcapped_rr_refund: "Overcapped RR Refund",
	chb_refund: "CHB Refund",
	adjustment: "Adjustment",
	other: "Other",
};

const getLatestPaymentDate = async () => {
	// 1. Latest matched payment
	const latestPayment = await Payment.findOne({
		paidToMerchantDate: { $ne: null },
	})
		.sort({ paidToMerchantDate: -1, createdAt: -1 })
		.lean();

	if (latestPayment?.paidToMerchantDate) {
		return {
			type: "payment",
			date: latestPayment.paidToMerchantDate.toISOString().slice(0, 10),
		};
	}

	// 2. Latest unmatched payment
	const latestUnmatched = await UnmatchedPayment.findOne({
		paidToMerchantDate: { $ne: null },
	})
		.sort({ paidToMerchantDate: -1, createdAt: -1 })
		.lean();

	if (latestUnmatched?.paidToMerchantDate) {
		return {
			type: "unmatched",
			date: latestUnmatched.paidToMerchantDate.toISOString().slice(0, 10),
		};
	}

	// 3. Latest wiresheet fallback
	const latestWiresheet = await Wiresheet.findOne()
		.sort({ createdAt: -1 })
		.lean();

	if (latestWiresheet?.startDate) {
		return {
			type: "wiresheet",
			date: latestWiresheet.startDate.toISOString().slice(0, 10),
		};
	}

	return null;
};

const getLedgerRowsDirect = async ({
	paymentDate,
	acquirer,
	merchantName,
	mid,
	status,
	paymentMethod,
	settlementCurrency,
}) => {
	const paymentDateMatch = paymentDate
		? { paidToMerchantDate: getDateRange(paymentDate) }
		: {};

	const payments = await Payment.find(paymentDateMatch)
		.populate({
			path: "wiresheetTransactionId",
			populate: [
				{ path: "merchantId", select: "merchantName merchantTag" },
				{
					path: "merchantMappingId",
					select:
						"mid acquirerId processingCurrency settlementCurrency paymentMethod",
					populate: { path: "acquirerId", select: "name" },
				},
			],
		})
		.populate({
			path: "merchantMappingId",
			select:
				"mid acquirerId processingCurrency settlementCurrency paymentMethod",
			populate: { path: "acquirerId", select: "name" },
		})
		.sort({ paidToMerchantDate: -1, createdAt: -1 })
		.lean();

	const settlementRows = payments.map((payment) => {
		const transaction = payment.wiresheetTransactionId || {};
		const mapping =
			payment.merchantMappingId || transaction.merchantMappingId || {};
		const acquirerName = mapping.acquirerId?.name || payment.paymentBank || "";

		const displayCurrency = getDisplayCurrency(
			payment.settlementCurrency,
			payment.paymentMethod,
		);

		return {
			_id: payment._id,
			type: "payment",
			merchantName: transaction.merchantName || payment.merchantName || "",
			merchantTag: transaction.merchantTag || "",
			mid: transaction.mid || payment.sourceMid || mapping.mid || "",
			acquirer: acquirerName,

			startDate: transaction.startDate || payment.sourceStartDate,
			endDate: transaction.endDate || payment.sourceEndDate,

			processingCurrency:
				transaction.processingCurrency ||
				payment.sourceProcessingCurrency ||
				"",
			receivedCurrency:
				transaction.processingCurrency ||
				payment.sourceProcessingCurrency ||
				"",
			receivedAmount: toNumber(transaction.processingAmount),

			paymentMethod:
				payment.paymentMethod || mapping.paymentMethod || "UNKNOWN",

			settlementCurrency: payment.settlementCurrency || "",
			settlementDisplayCurrency: displayCurrency,

			paidAmount: toNumber(payment.amountPaid),
			settlementPaidAmount: toNumber(payment.settlementAmount),
			balance: toNumber(transaction.balance),

			status: transaction.status || "settled",

			lastPaidToMerchantDate: payment.paidToMerchantDate,
			lastPaymentRate: toNumber(payment.paymentRate),
			lastPaymentBank: payment.paymentBank || "",
			lastPaidAmount: toNumber(payment.amountPaid),
			lastSettlementAmount: toNumber(payment.settlementAmount),

			paymentCategory: "settlement",
			paymentCategoryLabel: "Settlement",

			paymentSheetFilename: payment.sourceOriginalFilename || "",
			paymentSheetDateLabel: payment.paymentSheetDateLabel || "",
		};
	});

	const miscMatch = paymentDate
		? { paymentSheetDate: getDateRange(paymentDate) }
		: {};

	const miscPayments = await MiscellaneousPayment.find(miscMatch)
		.populate("merchantId", "merchantName merchantTag")
		.populate({
			path: "merchantMappingId",
			select:
				"mid acquirerId processingCurrency settlementCurrency paymentMethod",
			populate: { path: "acquirerId", select: "name" },
		})
		.sort({ paymentSheetDate: -1, createdAt: -1 })
		.lean();

	const miscRows = miscPayments.map((entry) => {
		const mapping = entry.merchantMappingId || {};
		const displayCurrency = getDisplayCurrency(
			entry.settlementCurrency,
			entry.paymentMethod,
		);

		return {
			_id: entry._id,
			type: "miscellaneous",
			merchantName:
				entry.merchantId?.merchantName ||
				entry.merchantName ||
				"Unknown Merchant",
			merchantTag: entry.merchantId?.merchantTag || "",
			mid: mapping.mid || entry.mid || "",
			acquirer: mapping.acquirerId?.name || entry.bankLabel || "",

			startDate: entry.startDate || null,
			endDate: entry.endDate || null,

			processingCurrency: entry.processingCurrency || "",
			receivedCurrency: entry.processingCurrency || "",
			receivedAmount: 0,

			paymentMethod: entry.paymentMethod || mapping.paymentMethod || "UNKNOWN",

			settlementCurrency: entry.settlementCurrency || "",
			settlementDisplayCurrency: displayCurrency,

			paidAmount: toNumber(entry.amountPaid),
			settlementPaidAmount: toNumber(entry.settlementAmount),
			balance: 0,

			status: "settled",

			lastPaidToMerchantDate: entry.paymentSheetDate,
			lastPaymentRate: toNumber(entry.rate),
			lastPaymentBank: entry.bankLabel || "",
			lastPaidAmount: toNumber(entry.amountPaid),
			lastSettlementAmount: toNumber(entry.settlementAmount),

			paymentCategory: entry.entryType,
			paymentCategoryLabel: miscLabels[entry.entryType] || "Other",

			paymentSheetFilename: "Manual miscellaneous entry",
			paymentSheetDateLabel: entry.paymentSheetDateLabel || "",
		};
	});

	return [...settlementRows, ...miscRows].filter((row) => {
		if (acquirer && row.acquirer !== acquirer) return false;
		if (
			merchantName &&
			!row.merchantName?.toLowerCase().includes(merchantName.toLowerCase())
		)
			return false;
		if (mid && row.mid !== mid) return false;
		if (status && row.status !== status) return false;
		if (paymentMethod && row.paymentMethod !== paymentMethod) return false;
		if (
			settlementCurrency &&
			row.settlementCurrency !== settlementCurrency &&
			row.settlementDisplayCurrency !== settlementCurrency
		) {
			return false;
		}

		return true;
	});
};

const buildGroupedData = (rows) => {
	const groupMap = new Map();

	for (const row of rows) {
		const key = `${row.merchantName}|${row.mid}|${row.acquirer}`;

		if (!groupMap.has(key)) {
			groupMap.set(key, {
				merchantName: row.merchantName,
				mid: row.mid,
				acquirer: row.acquirer,
				received: {},
				paid: {},
				settlement: {},
				totalReceived: 0,
				totalPaid: 0,
				totalSettlementAmount: 0,
				totalBalance: 0,
				transactionCount: 0,
				statusCounts: {
					pending: 0,
					partially_paid: 0,
					settled: 0,
				},
				rates: [],
			});
		}

		const group = groupMap.get(key);

		const receivedCurrency = row.receivedCurrency || "UNKNOWN";
		const paidCurrency = row.settlementDisplayCurrency || "UNKNOWN";

		group.received[receivedCurrency] =
			toNumber(group.received[receivedCurrency]) + toNumber(row.receivedAmount);

		group.paid[paidCurrency] =
			toNumber(group.paid[paidCurrency]) + toNumber(row.paidAmount);

		group.settlement[paidCurrency] =
			toNumber(group.settlement[paidCurrency]) +
			toNumber(row.settlementPaidAmount);

		group.totalReceived += toNumber(row.receivedAmount);
		group.totalPaid += toNumber(row.paidAmount);
		group.totalSettlementAmount += toNumber(row.settlementPaidAmount);
		group.totalBalance += toNumber(row.balance);
		group.transactionCount += 1;

		if (row.lastPaymentRate) group.rates.push(toNumber(row.lastPaymentRate));

		if (row.status === "settled") group.statusCounts.settled += 1;
		else if (row.status === "partially_paid")
			group.statusCounts.partially_paid += 1;
		else group.statusCounts.pending += 1;
	}

	return [...groupMap.values()].map((group) => ({
		...group,
		averageRate:
			group.rates.length > 0
				? group.rates.reduce((sum, rate) => sum + rate, 0) / group.rates.length
				: 0,
		rates: undefined,
	}));
};

const buildSummary = ({ rows, unmatchedPayments, wiresheets }) => {
	const summary = {
		totalReceived: 0,
		totalPaid: 0,
		totalSettlementAmount: 0,
		totalBalance: 0,
		totalTransactions: rows.length,
		pendingCount: 0,
		partiallyPaidCount: 0,
		settledCount: 0,
		unmatchedCount: unmatchedPayments.length,
		wiresheetCount: wiresheets.length,
	};

	for (const row of rows) {
		summary.totalReceived += toNumber(row.receivedAmount);
		summary.totalPaid += toNumber(row.paidAmount);
		summary.totalSettlementAmount += toNumber(row.settlementPaidAmount);
		summary.totalBalance += toNumber(row.balance);

		if (row.status === "settled") summary.settledCount += 1;
		else if (row.status === "partially_paid") summary.partiallyPaidCount += 1;
		else summary.pendingCount += 1;
	}

	return summary;
};

const buildDashboardPayload = async (filters) => {
	const rows = await getLedgerRowsDirect(filters);

	const unmatchedPayments = await UnmatchedPayment.find(
		filters.paymentDate
			? {
					paidToMerchantDate: getDateRange(filters.paymentDate),
					status: "pending_reconciliation",
				}
			: { status: "pending_reconciliation" },
	)
		.sort({ createdAt: -1 })
		.lean();

	const wiresheets = await Wiresheet.find()
		.populate("acquirerId", "name")
		.sort({ createdAt: -1 })
		.lean();

	return {
		paymentDate: filters.paymentDate || null,
		summary: buildSummary({ rows, unmatchedPayments, wiresheets }),
		groupedData: buildGroupedData(rows),
		transactions: rows,
		unmatchedPayments,
		wiresheets: wiresheets.map((item) => ({
			wiresheetId: item._id,
			wiresheetName: item.wiresheetName,
			acquirerName: item.acquirerId?.name || "",
			startDate: item.startDate,
			endDate: item.endDate,
			uploadedAt: item.createdAt,
			totalPayable: item.totalPayable,
			totalPaid: item.totalPaid,
			totalBalance: item.totalBalance,
			status: item.status,
		})),
	};
};
export const getDashboardLatest = async (_req, res) => {
	const latestData = await getLatestPaymentDate();

	if (!latestData) {
		return res.json({
			success: true,
			data: {
				dashboardSource: null,
				paymentDate: null,
				summary: {},
				groupedData: [],
				transactions: [],
				unmatchedPayments: [],
				wiresheets: [],
			},
		});
	}

	const data = await buildDashboardPayload({
		paymentDate: latestData.date,
	});

	return res.json({
		success: true,
		data: {
			dashboardSource: latestData.type,
			...data,
		},
	});
};
export const getDashboardByPeriod = async (req, res) => {
	const data = await buildDashboardPayload(req.query);

	return res.json({
		success: true,
		data,
	});
};

export const getWiresheetUploads = async (_req, res) => {
	const wiresheets = await Wiresheet.find()
		.populate("acquirerId", "name")
		.sort({ createdAt: -1 })
		.lean();

	return res.json({
		success: true,
		data: wiresheets.map((item) => ({
			wiresheetId: item._id,
			wiresheetName: item.wiresheetName,
			acquirerName: item.acquirerId?.name || "",
			startDate: item.startDate,
			endDate: item.endDate,
			uploadedAt: item.createdAt,
			totalPayable: item.totalPayable,
			totalPaid: item.totalPaid,
			totalBalance: item.totalBalance,
			status: item.status,
		})),
	});
};
