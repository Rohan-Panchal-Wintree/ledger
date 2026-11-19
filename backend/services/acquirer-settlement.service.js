import { createHash } from "node:crypto";
import { moneyUnits } from "./settlement-money.service.js";

export const settlementDownloadError = (message, statusCode = 400) => {
	const error = new Error(message);
	error.statusCode = statusCode;
	throw error;
};

export const normalizeAcquirer = (value) =>
	String(value ?? "").replace(/\s+/g, " ").trim().toUpperCase();

export const isValidSettlementAcquirer = (value) => {
	const name = normalizeAcquirer(value);
	return Boolean(name) && !["-", "NA", "N/A", "NULL", "UNKNOWN"].includes(name);
};

export const acquirerMatchRegex = (value) => {
	const name = normalizeAcquirer(value);
	if (!name) settlementDownloadError("Acquirer is required.");
	const escaped = name.split(" ").map((part) =>
		part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
	).join("\\s+");
	return new RegExp(`^\\s*${escaped}\\s*$`, "i");
};

// These fields are additive before the currency-level settlement expense.
// Expense, totalFees and netSettlement are intentionally calculated separately
// for each acquirer using the existing builder and its configured rates.
const additiveMoneyFields = [
	"capturedAmount", "reversalAmount", "chargebackAmount", "mdrFee",
	"approvalFee", "declineFee", "reversalFee", "chargebackFee",
	"rollingReserveAmount", "feesBeforeSettlementExpense", "settlementExpenseBase",
];
const countFields = ["txns", "successTxns", "failedTxns", "adjustmentTxns"];

export const assertAcquirerSettlementTotals = (report, parts) => {
	const currencies = Object.keys(report.currencySummary || {});
	const splitCurrencies = new Set(parts.flatMap((part) => Object.keys(part.currencySummary)));
	if (currencies.length !== splitCurrencies.size || currencies.some((c) => !splitCurrencies.has(c))) {
		settlementDownloadError("Acquirer currencies do not match the saved merchant report.", 409);
	}
	for (const currency of currencies) {
		for (const field of [...additiveMoneyFields, ...countFields]) {
			const read = (row) => {
				if (additiveMoneyFields.includes(field)) return moneyUnits(row?.[field]);
				const count = Number(row?.[field] ?? 0);
				if (!Number.isSafeInteger(count) || count < 0) {
					settlementDownloadError("Report contains invalid transaction counts.", 409);
				}
				return count;
			};
			const expected = read(report.currencySummary[currency]);
			const actual = parts.reduce((sum, part) => sum + read(part.currencySummary[currency]), 0);
			if (!Number.isSafeInteger(actual) || expected !== actual) {
				settlementDownloadError(
					`Acquirer reconciliation failed for ${currency}/${field}. Check transaction mappings and the saved report scope.`,
					409,
				);
			}
		}
	}
	if (parts.reduce((sum, part) => sum + part.summary.totalTransactions, 0) !== report.summary?.totalTransactions) {
		settlementDownloadError("Acquirer transaction counts do not match the saved report.", 409);
	}
};

const requireExactKeys = (value, expected, label) => {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		settlementDownloadError(`${label} must be an object.`);
	}
	const missing = expected.filter((key) => !Object.hasOwn(value, key));
	const unexpected = Object.keys(value).filter((key) => !expected.includes(key));
	if (missing.length || unexpected.length) {
		settlementDownloadError(`${label}: ${[
			missing.length ? `missing ${missing.join(", ")}` : "",
			unexpected.length ? `unexpected ${unexpected.join(", ")}` : "",
		].filter(Boolean).join("; ")}.`);
	}
};

export const validateAcquirerConversions = (parts, payload, convert) => {
	const settlementCurrencies = payload?.settlementCurrenciesByAcquirer;
	if (settlementCurrencies !== undefined) {
		requireExactKeys(settlementCurrencies, parts.map((part) => part.acquirer), "Acquirer settlement currencies");
	}
	requireExactKeys(payload?.ratesByAcquirer, parts.map((part) => part.acquirer), "Acquirer rate mappings");
	return parts.map((part) => {
		// Retain the old single-target payload for existing API callers.
		const settlementCurrency = normalizeAcquirer(settlementCurrencies === undefined
			? payload?.settlementCurrency : settlementCurrencies[part.acquirer]);
		if (!["EUR", "USDT"].includes(settlementCurrency)) {
			settlementDownloadError(`${part.acquirer}: Settlement currency must be EUR or USDT.`);
		}
		const rates = payload.ratesByAcquirer[part.acquirer];
		const currencies = Object.keys(part.currencySummary);
		requireExactKeys(rates, currencies, `Rates for ${part.acquirer}`);
		for (const currency of currencies) {
			const raw = rates[currency];
			if (!["string", "number"].includes(typeof raw) || String(raw).trim() === "" ||
				!Number.isFinite(Number(raw)) || Number(raw) <= 0) {
				settlementDownloadError(`Invalid rate for ${part.acquirer}/${currency}.`);
			}
			if (currency === settlementCurrency && Number(raw) !== 1) {
				settlementDownloadError(`${currency} to ${currency} must use rate 1.`);
			}
		}
		try {
			return convert(part, { settlementCurrency, rates });
		} catch (error) {
			settlementDownloadError(`${part.acquirer}: ${error.message}`);
		}
	});
};

export const safeSettlementFilePart = (value) =>
	String(value ?? "").normalize("NFKD").replace(/[^A-Za-z0-9_-]+/g, "-")
		.replace(/^-+|-+$/g, "").slice(0, 80) || "unknown";

export const createAcquirerSettlementService = ({ Report, Transaction, getTransactionQuery, buildReportData, resolveReportPeriods = async (reports) => reports }) => {
	const load = async (id) => {
		if (!/^[a-f\d]{24}$/i.test(String(id))) settlementDownloadError("Invalid settlement report ID.");
		const savedReport = await Report.findById(id).lean();
		if (!savedReport) settlementDownloadError("Settlement report not found.", 404);
		const [report] = await resolveReportPeriods([savedReport]);
		if (!report.settlementBatchId || !report.memberId) {
			settlementDownloadError("Report is missing its settlement batch or MID.", 409);
		}
		const groups = await Transaction.aggregate([
			{ $match: getTransactionQuery(report, "matched") },
			{ $group: { _id: { acquirer: "$acquirer", currency: "$currency" }, count: { $sum: 1 } } },
		]);
		if (!groups.length) settlementDownloadError("No matched transactions found for this report.", 409);
		const names = new Set();
		for (const group of groups) {
			const name = normalizeAcquirer(group._id.acquirer);
			const currency = normalizeAcquirer(group._id.currency);
			if (!isValidSettlementAcquirer(name)) {
				settlementDownloadError("Some matched transactions have no valid acquirer. Backfill their acquirer mappings before downloading.", 409);
			}
			if (!/^[A-Z]{3,5}$/.test(currency) || !Object.hasOwn(report.currencySummary || {}, currency)) {
				settlementDownloadError(`Invalid or unexpected source currency: ${currency || "(missing)"}.`, 409);
			}
			names.add(name);
		}
		const parts = [];
		for (const acquirer of [...names].sort()) {
			const data = await buildReportData({
				settlementBatchId: report.settlementBatchId,
				memberId: report.memberId,
				reportId: report._id,
				acquirer,
			});
			if (!data.summary.totalTransactions) settlementDownloadError(`No transactions found for ${acquirer}.`, 409);
			parts.push({
				...report,
				acquirer,
				summary: data.summary,
				currencySummary: data.currencySummary,
				statusSummary: data.statusSummary,
				brandSummary: data.paymentBrandSummary,
				modeSummary: data.modeSummary,
				reportData: { ...data, merchantName: report.merchantName, reportDate: report.reportDate,
					fromDate: report.fromDate, toDate: report.toDate,
					datestampPeriod: report.reportData?.datestampPeriod || data.datestampPeriod },
				settlementConversion: null,
			});
		}
		assertAcquirerSettlementTotals(report, parts);
		// Protect previews against source changes between opening the modal and downloading.
		const snapshot = createHash("sha256").update(JSON.stringify(parts.map((part) => ({
			acquirer: part.acquirer, currencySummary: part.currencySummary,
		})))).digest("hex");
		return { report, parts, snapshot };
	};
	const discovery = ({ report, parts, snapshot }) => ({
		reportId: String(report._id), memberId: report.memberId, merchantName: report.merchantName, snapshot,
		acquirers: parts.map((part) => ({
			acquirer: part.acquirer,
			currencies: Object.entries(part.currencySummary).sort(([a], [b]) => a.localeCompare(b))
				.map(([currency, row]) => ({ currency, netPayable: row.netSettlement })),
		})),
	});
	return { load, discovery };
};

