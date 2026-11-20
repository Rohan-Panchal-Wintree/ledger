import mongoose from "mongoose";
import xlsx from "xlsx";
import fs from "fs";
import readline from "readline";
import { parse } from "csv-parse";
import path from "path";
import PDFDocument from "pdfkit";
import {
	calculateMdr, moneyUnits, preciseMoney, settlementExpenseAmount, sumMoney,
} from "../services/settlement-money.service.js";
import {
	acquirerMatchRegex,
	createAcquirerSettlementService,
	isValidSettlementAcquirer,
	safeSettlementFilePart,
	settlementDownloadError,
	validateAcquirerConversions,
} from "../services/acquirer-settlement.service.js";
import {
	buildCombinedAcquirerPdfBuffer,
} from "../services/settlement-pdf.service.js";
import {
	getReportTransactionPeriod,
	resolveDatestampBatchPeriods,
	resolveDatestampReportPeriods,
} from "../services/settlement-report-period.service.js";
import { mailTransporter } from "../utils/SendEmail.js";
import { safeDeleteTempFile } from "../utils/tempFile.js";
import {
	isSettlementTransactionFilename,
	iterateXlsxSettlementRows,
	parseSettlementUploadPeriod,
	parseSettlementTransactionDate,
	settlementDateToExcelCell,
	formatSettlementReportDate as formatDate,
	SETTLEMENT_ACQUIRER_HEADERS,
	SETTLEMENT_ROW_LOCATION,
	validateSettlementAcquirerHeader,
} from "../utils/settlementUpload.js";
import { publishSettlementEmailJob } from "../utils/rabbitmq.js";

import { User } from "../models/user.model.js";
import { CountryMaster } from "../models/country-master.model.js";
import { MerchantAccount } from "../models/merchant-account.model.js";
import { MerchantFeeConfig } from "../models/merchant-fee-config.model.js";
import { MerchantTransaction } from "../models/merchant-transaction.model.js";
import { MerchantSettlementBatch } from "../models/merchant-settlement-batch.model.js";
import { MerchantFeeConfigHistory } from "../models/merchant-fee-config-history.model.js";
import { MerchantSettlementReport } from "../models/merchant-settlement-report.model.js";
import { MerchantTransactionUpload } from "../models/merchant-transaction-upload.model.js";
import { MerchantFeeChangeRequest } from "../models/merchant-fee-change-request.model.js";
/*
|--------------------------------------------------------------------------
| Basic helpers
|--------------------------------------------------------------------------
*/

const roundMoney = (value) => {
	const number = Number(value || 0);

	if (!Number.isFinite(number)) return 0;

	return Math.round((number + Number.EPSILON) * 100) / 100;
};

const normalizeText = (value) =>
	String(value || "")
		.replace(/\s+/g, " ")
		.trim();

const normalizeUpper = (value) => normalizeText(value).toUpperCase();

const cleanCell = (value) => normalizeText(value).replace(/^'+/, "");

const parseNumber = (value) => {
	if (value === null || value === undefined) return 0;

	const clean = String(value)
		.replace(/,/g, "")
		.replace(/%/g, "")
		.replace(/[^0-9.-]/g, "")
		.trim();

	const parsed = Number(clean);

	return Number.isFinite(parsed) ? parsed : 0;
};

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

const getDateRange = (date) => ({
	$gte: startOfDate(date),
	$lte: endOfDate(date),
});

const normalizeHeader = (key) =>
	String(key || "")
		.replace(/_\d+$/g, "")
		.replace(/\s+/g, " ")
		.trim()
		.toUpperCase();

const assignNormalizedValue = (target, key, value) => {
	const normalizedKey = normalizeHeader(key);
	const current = target[normalizedKey];

	const currentClean = normalizeText(current);
	const nextClean = normalizeText(value);

	if (!currentClean && nextClean) {
		target[normalizedKey] = value;
		return;
	}

	if (target[normalizedKey] === undefined) {
		target[normalizedKey] = value;
	}
};

const getValue = (row, keys) => {
	for (const key of keys) {
		const normalizedKey = normalizeHeader(key);

		if (
			row[normalizedKey] !== undefined &&
			row[normalizedKey] !== null &&
			row[normalizedKey] !== ""
		) {
			return row[normalizedKey];
		}
	}

	return "";
};

const getValueIgnoringDash = (row, keys) => {
	for (const key of keys) {
		const normalizedKey = normalizeHeader(key);
		const value = row[normalizedKey];

		const cleaned = cleanCell(value);
		const upperCleaned = normalizeUpper(cleaned);

		if (
			cleaned &&
			upperCleaned !== "-" &&
			upperCleaned !== "NA" &&
			upperCleaned !== "N/A" &&
			upperCleaned !== "NULL"
		) {
			return value;
		}
	}

	return "";
};

const findCsvHeaderLine = async (filePath) => {
	const input = fs.createReadStream(filePath);

	const rl = readline.createInterface({
		input,
		crlfDelay: Infinity,
	});

	let lineNumber = 0;

	try {
		for await (const line of rl) {
			lineNumber += 1;

			const upper = line.toUpperCase();

			const isHeader =
				upper.includes("TRANSACTION DATE") ||
				upper.includes("DATESTAMP") ||
				upper.includes("TIME STAMP") ||
				upper.includes("TIMESTAMP");

			if (isHeader) {
				return lineNumber;
			}
		}
	} finally {
		rl.close();
		input.destroy();
	}

	return null;
};

async function* iterateCsvTransactionRows(filePath, { onHeader } = {}) {
	const headerLine = await findCsvHeaderLine(filePath);

	if (!headerLine) {
		throw new Error("Could not find transaction header row in CSV file");
	}

	const input = fs.createReadStream(filePath);
	const stream = parse({
		columns: (headers) => {
			onHeader?.({ headers, rowNumber: headerLine });
			return headers;
		},
		info: true,

		from_line: headerLine,

		skip_empty_lines: true,

		relax_column_count: true,

		bom: true,

		trim: true,
	});
	input.on("error", (error) => stream.destroy(error));
	input.pipe(stream);

	try {
		for await (const { record: row, info } of stream) {
			const normalizedRow = {};

			for (const [key, value] of Object.entries(row)) {
				assignNormalizedValue(normalizedRow, key, value);
			}

			Object.defineProperty(normalizedRow, SETTLEMENT_ROW_LOCATION, { value: { rowNumber: info.lines } });
			yield normalizedRow;
		}
	} finally {
		input.destroy();
		stream.destroy();
	}
}

export async function* iterateTransactionRows(file, options = {}) {
	if (!file?.path) {
		throw new Error(
			`Temporary upload path is missing for ${file?.originalname || "file"}`,
		);
	}

	const filename = String(file.originalname || "").toLowerCase();

	if (filename.endsWith(".csv")) {
		yield* iterateCsvTransactionRows(file.path, options);
		return;
	}

	if (filename.endsWith(".xlsx")) {
		yield* iterateXlsxSettlementRows(file.path, options);
		return;
	}

	throw new Error(
		`Only CSV and XLSX transaction files are supported. Received: ${file.originalname}`,
	);
}

const parseWorkbookRows = (filePath) => {
	const workbook = xlsx.readFile(filePath, {
		cellDates: true,
	});

	const rows = [];

	for (const sheetName of workbook.SheetNames) {
		const sheetRows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], {
			defval: "",
			raw: false,
		});

		for (const row of sheetRows) {
			const normalizedRow = {};

			for (const [key, value] of Object.entries(row)) {
				assignNormalizedValue(normalizedRow, key, value);
			}

			rows.push(normalizedRow);
		}
	}

	return rows;
};

const toCents = (value) => {
	const number = Number(value || 0);

	if (!Number.isFinite(number)) return 0;

	return Math.round((number + Number.EPSILON) * 100);
};

const fromCents = (value) => roundMoney(Number(value || 0) / 100);
const addCents = (currentCents, value) =>
	Number(currentCents || 0) + toCents(value);

const setMoneyFromCents = (target, centsMap, fields) => {
	for (const field of fields) {
		target[field] = fromCents(centsMap[field] || 0);
	}
};

const addMoneyToBucket = (bucket, field, value) => {
	bucket._units = bucket._units || {};
	// Accumulate micro-units so MDR is never rounded per transaction.
	bucket._units[field] = moneyUnits(sumMoney([(bucket._units[field] || 0) / 1_000_000, value]));
	bucket[field] = bucket._units[field] / 1_000_000;
};

const removeInternalCents = (map) => {
	for (const item of Object.values(map || {})) {
		delete item._units;
	}
};

const percentToBasisPoints = (percent) => {
	const number = Number(percent || 0);

	if (!Number.isFinite(number)) return 0;

	return Math.round(number * 100);
};

const percentFeeCents = (amountCents, percent) => {
	const basisPoints = percentToBasisPoints(percent);

	/*
		Use floor so deductions never overcharge merchant.
		Example:
		34.64 * 5.25% = 1.8186
		fee = 1.81, not 1.82
	*/
	return Math.floor((Number(amountCents || 0) * basisPoints) / 10000);
};

const parseAccountIds = (value) =>
	String(value || "")
		.split(",")
		.map((item) => item.trim())
		.filter(Boolean);

/*
|--------------------------------------------------------------------------
| Status rules
|--------------------------------------------------------------------------
|
| TEAM RULE
|
| DATESTAMP
| Failed:
| - AUTH FAILED
| - CONFIRMATION STARTED
|
| Success:
| - CAPTURE SUCCESSFUL
| - SETTLED
| - RR SENT
| - REVERSED
| - CHARGEBACK
| - CHARGEBACK REVERSED
|
| TIMESTAMP
| Adjustments only:
| - REVERSED
| - CHARGEBACK
| - CHARGEBACK REVERSED
|
*/

const DATESTAMP_SUCCESS_STATUSES = new Set([
	"CAPTURE SUCCESSFUL",
	"SETTLED",
	"RR SENT",
	"REVERSED",
	"CHARGEBACK",
	"CHARGEBACK REVERSED",

	/*
	 * Keep these two aliases because your old code already supported them.
	 * If upstream guarantees they never occur, they can later be removed.
	 */
	"CAPTURED",
	"RR SETTLE",
]);

const DATESTAMP_FAILED_STATUSES = new Set([
	"AUTH FAILED",
	"CONFIRMATION STARTED",
]);

const TIMESTAMP_ADJUSTMENT_STATUSES = new Set([
	"REVERSED",
	"CHARGEBACK",
	"CHARGEBACK REVERSED",
]);

const isDatestampSource = (sourceFileType) =>
	normalizeUpper(sourceFileType) === "DATESTAMP";

const isTimestampSource = (sourceFileType) =>
	normalizeUpper(sourceFileType) === "TIMESTAMP";

/*
 * Success means SUCCESS only from DATESTAMP.
 * A timestamp CHARGEBACK / REVERSED is NOT success.
 */
const isSuccessStatus = (status, sourceFileType) =>
	isDatestampSource(sourceFileType) &&
	DATESTAMP_SUCCESS_STATUSES.has(normalizeUpper(status));

/*
 * Failed means only DATESTAMP:
 * AUTH FAILED or CONFIRMATION STARTED.
 */
const isDeclineStatus = (status, sourceFileType) =>
	isDatestampSource(sourceFileType) &&
	DATESTAMP_FAILED_STATUSES.has(normalizeUpper(status));

/*
 * Adjustments come only from TIMESTAMP.
 */
const isAdjustmentStatus = (status, sourceFileType) =>
	isTimestampSource(sourceFileType) &&
	TIMESTAMP_ADJUSTMENT_STATUSES.has(normalizeUpper(status));

const isReversalStatus = (status, sourceFileType) =>
	isTimestampSource(sourceFileType) && normalizeUpper(status) === "REVERSED";

const isChargebackStatus = (status, sourceFileType) =>
	isTimestampSource(sourceFileType) && normalizeUpper(status) === "CHARGEBACK";

const isChargebackReversedStatus = (status, sourceFileType) =>
	isTimestampSource(sourceFileType) &&
	normalizeUpper(status) === "CHARGEBACK REVERSED";

const isAllowedStatusForSource = (status, sourceFileType) => {
	const value = normalizeUpper(status);

	if (isTimestampSource(sourceFileType)) {
		return TIMESTAMP_ADJUSTMENT_STATUSES.has(value);
	}

	if (isDatestampSource(sourceFileType)) {
		return (
			DATESTAMP_SUCCESS_STATUSES.has(value) ||
			DATESTAMP_FAILED_STATUSES.has(value)
		);
	}

	return false;
};

/*
|--------------------------------------------------------------------------
| Fee country parsing
|--------------------------------------------------------------------------
*/

const parseFeeCountryRule = (value) => {
	const raw = normalizeText(value);
	const upper = normalizeUpper(raw);

	let gatewayName = "ALL";
	let countryPart = upper;

	const gatewayMatch = upper.match(/\(([^)]+)\)/);

	if (gatewayMatch?.[1]) {
		gatewayName = normalizeUpper(gatewayMatch[1]);
		countryPart = normalizeUpper(upper.replace(/\([^)]+\)/g, ""));
	}

	countryPart = countryPart.trim();

	if (!countryPart || countryPart === "-" || countryPart === "ALL") {
		return {
			countryRuleRaw: raw || "All",
			countryScope: "ALL",
			countryCode: "",
			countryCategory: "ALL",
			gatewayName,
		};
	}

	if (countryPart === "EU") {
		return {
			countryRuleRaw: raw,
			countryScope: "EU",
			countryCode: "",
			countryCategory: "EU",
			gatewayName,
		};
	}

	if (
		countryPart === "NONEU" ||
		countryPart === "NON EU" ||
		countryPart === "NON-EU"
	) {
		return {
			countryRuleRaw: raw,
			countryScope: "NONEU",
			countryCode: "",
			countryCategory: "NONEU",
			gatewayName,
		};
	}

	return {
		countryRuleRaw: raw,
		countryScope: "COUNTRY",
		countryCode: countryPart,
		countryCategory: "ALL",
		gatewayName,
	};
};

/*
|--------------------------------------------------------------------------
| Country master lookup
|--------------------------------------------------------------------------
*/

const buildCountryMasterMap = async () => {
	const countries = await CountryMaster.find({ status: "active" }).lean();

	const map = new Map();

	for (const country of countries) {
		const item = {
			transactionCountryName: normalizeUpper(country.transactionCountryName),
			feeCountryCode: normalizeUpper(country.feeCountryCode),
			countryCategory: normalizeUpper(country.countryCategory),
		};

		if (item.transactionCountryName) {
			map.set(item.transactionCountryName, item);
		}

		if (item.feeCountryCode) {
			map.set(item.feeCountryCode, item);
		}

		for (const alias of country.aliases || []) {
			const key = normalizeUpper(alias);
			if (key) map.set(key, item);
		}
	}

	return map;
};

const resolveTransactionCountry = (isoCountry, countryMap) => {
	const key = normalizeUpper(isoCountry);

	if (!key || key === "-" || key === "NA" || key === "N/A") {
		return {
			countryName: "ALL",
			countryCode: "",
			countryCategory: "ALL",
		};
	}

	const found = countryMap.get(key);

	if (found) {
		return {
			countryName: found.transactionCountryName,
			countryCode: found.feeCountryCode,
			countryCategory: found.countryCategory,
		};
	}

	/*
		If ISO Country is not in country master,
		do not mark it as NonEU.
		It should fall back to fee Country = All.
	*/
	return {
		countryName: key,
		countryCode: "",
		countryCategory: "ALL",
	};
};

/*
|--------------------------------------------------------------------------
| Brand matching
|--------------------------------------------------------------------------
*/

const normalizePaymentBrandForMatching = (brand) => {
	const value = normalizeUpper(brand);

	if (!value || value === "-") return "NA";

	if (value.includes("MASTER") || value === "MC") return "MC";
	if (value.includes("VISA")) return "VISA";
	if (value.includes("APPLE")) return "APPLEPAY";
	if (value.includes("GOOGLE")) return "GOOGLEPAY";

	return value;
};

const getPaymentBrandGroup = (brand) => {
	const value = normalizeUpper(brand);

	if (value.includes("APPLE")) return "Apple Pay";
	if (value.includes("GOOGLE")) return "Google Pay";

	if (value.includes("VISA")) return "Visa";

	if (
		value.includes("MASTER") ||
		value === "MC" ||
		value === "MASTERCARD" ||
		value === "MASTER CARD"
	) {
		return "Mastercard";
	}

	return value || "Other";
};

const expandFeeBrands = (brand) => {
	const value = normalizeUpper(brand);

	if (
		value === "VISA/MC" ||
		value === "VISA / MC" ||
		value === "VISA/MASTERCARD" ||
		value === "VISA / MASTERCARD"
	) {
		return ["VISA", "MC"];
	}

	if (
		value === "APPLEPAY/GOOGLEPAY" ||
		value === "APPLE PAY/GOOGLE PAY" ||
		value === "APPLEPAY / GOOGLEPAY" ||
		value === "APPLE PAY / GOOGLE PAY"
	) {
		return ["APPLEPAY", "GOOGLEPAY"];
	}

	return [normalizePaymentBrandForMatching(value)];
};

const RATE_FIELDS = [
	"mdrPercent",
	"approvalFee",
	"declineFee",
	"reversalFee",
	"chargebackFee",
	"rollingReservePercent",
	"settlementExpensePercent",
	"type",
];

const pickRateSnapshot = (fee = {}) => ({
	mdrPercent: Number(fee.mdrPercent || 0),
	approvalFee: Number(fee.approvalFee || 0),
	declineFee: Number(fee.declineFee || 0),
	reversalFee: Number(fee.reversalFee || 0),
	chargebackFee: Number(fee.chargebackFee || 0),
	rollingReservePercent: Number(fee.rollingReservePercent || 0),
	settlementExpensePercent: Number(fee.settlementExpensePercent || 0),
	type: normalizeText(fee.type || ""),
});

const getChangedRateFields = (oldRates = {}, newRates = {}) =>
	RATE_FIELDS.filter((field) => {
		if (field === "type") {
			return normalizeText(oldRates[field]) !== normalizeText(newRates[field]);
		}

		return Number(oldRates[field] || 0) !== Number(newRates[field] || 0);
	});

/*
|--------------------------------------------------------------------------
| Fee upload / CRUD
|--------------------------------------------------------------------------
*/

export const uploadMerchantFees = async (req, res) => {
	const file = req.files?.file?.[0];

	if (!file) {
		return res.status(400).json({
			success: false,
			message: "Fee file is required",
		});
	}

	try {
		const rows = parseWorkbookRows(file.path);

		const docs = [];
		const skippedRows = [];

		for (const row of rows) {
			const merchantName =
				normalizeText(getValue(row, ["MerchantName", "Merchant Name"])) || "NA";

			const memberId =
				normalizeText(getValue(row, ["Member ID", "Merchant ID"])) || "NA";

			let accountIds = parseAccountIds(
				getValue(row, ["Bank Account ID", "Account ID"]),
			);

			if (!accountIds.length) {
				accountIds = [];
			}

			const currency = normalizeUpper(getValue(row, ["Currency"])) || "NA";

			const brand =
				normalizeUpper(getValue(row, ["Payment Brand", "Brand"])) || "NA";

			if (
				!merchantName ||
				merchantName === "NA" ||
				!memberId ||
				memberId === "NA"
			) {
				skippedRows.push(row);
				continue;
			}

			const countryRule = parseFeeCountryRule(getValue(row, ["Country"]));

			docs.push({
				merchantName,
				memberId,

				partnerName: normalizeText(getValue(row, ["Partner", "Partner Name"])),

				accountIds,

				country: countryRule.countryRuleRaw,

				countryRuleRaw: countryRule.countryRuleRaw,

				countryScope: countryRule.countryScope,

				countryCode: countryRule.countryCode,

				countryCategory: countryRule.countryCategory,

				gatewayName: countryRule.gatewayName,

				type: normalizeText(getValue(row, ["Type"])),

				currency,
				brand,

				mdrPercent: parseNumber(getValue(row, ["MDR", "MDR %"])),

				approvalFee: parseNumber(getValue(row, ["Approval Fee"])),

				declineFee: parseNumber(getValue(row, ["Decline Fee"])),

				reversalFee: parseNumber(getValue(row, ["Reversal Fee"])),

				chargebackFee: parseNumber(getValue(row, ["Chargeback Fee"])),

				rollingReservePercent: parseNumber(
					getValue(row, ["RR", "Rolling Reserve"]),
				),

				settlementExpensePercent: parseNumber(
					getValue(row, ["Settlement Exp", "Settlement Expense"]),
				),

				status: "active",

				createdBy: req.user._id,

				updatedBy: req.user._id,
			});
		}

		if (docs.length) {
			await MerchantFeeConfig.insertMany(docs, {
				ordered: false,
			});
		}

		return res.status(201).json({
			success: true,

			message: "Merchant fee file uploaded successfully",

			data: {
				totalRows: rows.length,

				insertedRows: docs.length,

				skippedRows: skippedRows.length,
			},
		});
	} finally {
		/*
		 * ALWAYS delete Multer's temporary file.
		 *
		 * Runs on:
		 * - success
		 * - parsing error
		 * - Mongo error
		 * - response return
		 */
		await safeDeleteTempFile(file.path);
	}
};

export const createMerchantFee = async (req, res) => {
	const countryRule = parseFeeCountryRule(req.body.country);

	const payload = {
		...req.body,
		merchantName: normalizeText(req.body.merchantName),
		memberId: normalizeText(req.body.memberId),
		currency: normalizeUpper(req.body.currency),
		brand: normalizeUpper(req.body.brand),

		country: countryRule.countryRuleRaw,
		countryRuleRaw: countryRule.countryRuleRaw,
		countryScope: countryRule.countryScope,
		countryCode: countryRule.countryCode,
		countryCategory: countryRule.countryCategory,
		gatewayName: countryRule.gatewayName,

		createdBy: req.user._id,
		updatedBy: req.user._id,
	};

	if (!normalizeText(req.body.changeReason)) {
		return res.status(400).json({
			success: false,
			message: "changeReason is required to create a fee change request",
		});
	}

	const newRates = pickRateSnapshot(payload);

	const request = await MerchantFeeChangeRequest.create({
		feeConfigId: null,
		action: "CREATE",
		status: "PENDING_APPROVAL",

		memberId: payload.memberId,
		merchantName: payload.merchantName,
		partnerName: payload.partnerName,
		accountIds: payload.accountIds || [],

		brand: payload.brand,
		currency: payload.currency,

		country: payload.country,
		countryRuleRaw: payload.countryRuleRaw,
		countryScope: payload.countryScope,
		countryCode: payload.countryCode,
		countryCategory: payload.countryCategory,
		gatewayName: payload.gatewayName,

		oldRates: {},
		newRates,
		changedFields: RATE_FIELDS,

		changeReason: normalizeText(req.body.changeReason),
		requestedByName: normalizeText(req.body.requestedByName),
		requestedByEmail: normalizeText(req.body.requestedByEmail),

		makerId: req.user._id,
		makerName: req.user.name || "",
		makerEmail: req.user.email || "",

		source: "manual",
	});

	return res.status(201).json({
		success: true,
		message: "Fee create request created and waiting for checker approval",
		data: request,
	});
};

export const updateMerchantFee = async (req, res) => {
	const existing = await MerchantFeeConfig.findById(req.params.id);

	if (!existing) {
		return res.status(404).json({
			success: false,
			message: "Merchant fee not found",
		});
	}

	if (!normalizeText(req.body.changeReason)) {
		return res.status(400).json({
			success: false,
			message: "changeReason is required to create a fee change request",
		});
	}

	const payload = {
		...req.body,
		updatedBy: req.user._id,
	};

	if (payload.merchantName) {
		payload.merchantName = normalizeText(payload.merchantName);
	}

	if (payload.memberId) {
		payload.memberId = normalizeText(payload.memberId);
	}

	if (payload.currency) {
		payload.currency = normalizeUpper(payload.currency);
	}

	if (payload.brand) {
		payload.brand = normalizeUpper(payload.brand);
	}

	if (payload.country !== undefined) {
		const countryRule = parseFeeCountryRule(payload.country);

		payload.country = countryRule.countryRuleRaw;
		payload.countryRuleRaw = countryRule.countryRuleRaw;
		payload.countryScope = countryRule.countryScope;
		payload.countryCode = countryRule.countryCode;
		payload.countryCategory = countryRule.countryCategory;
		payload.gatewayName = countryRule.gatewayName;
	}

	const oldRates = pickRateSnapshot(existing);
	const newRates = pickRateSnapshot({
		...existing.toObject(),
		...payload,
	});

	const changedFields = getChangedRateFields(oldRates, newRates);

	if (!changedFields.length) {
		return res.json({
			success: true,
			message: "No rate changes detected",
			data: existing,
		});
	}

	const request = await MerchantFeeChangeRequest.create({
		feeConfigId: existing._id,
		action: "UPDATE",
		status: "PENDING_APPROVAL",

		memberId: existing.memberId,
		merchantName: existing.merchantName,
		partnerName: payload.partnerName ?? existing.partnerName,
		accountIds: payload.accountIds ?? existing.accountIds,

		brand: payload.brand ?? existing.brand,
		currency: payload.currency ?? existing.currency,

		country: payload.country ?? existing.country,
		countryRuleRaw: payload.countryRuleRaw ?? existing.countryRuleRaw,
		countryScope: payload.countryScope ?? existing.countryScope,
		countryCode: payload.countryCode ?? existing.countryCode,
		countryCategory: payload.countryCategory ?? existing.countryCategory,
		gatewayName: payload.gatewayName ?? existing.gatewayName,

		oldRates,
		newRates,
		changedFields,

		changeReason: normalizeText(req.body.changeReason),
		requestedByName: normalizeText(req.body.requestedByName),
		requestedByEmail: normalizeText(req.body.requestedByEmail),

		makerId: req.user._id,
		makerName: req.user.name || "",
		makerEmail: req.user.email || "",

		source: "manual",
	});

	return res.status(201).json({
		success: true,
		message: "Fee change request created and waiting for checker approval",
		data: request,
	});
};

// Reactivates an inactive fees
export const activateMerchantFee = async (req, res) => {
	const { id } = req.params;

	if (!mongoose.Types.ObjectId.isValid(id)) {
		return res.status(400).json({
			success: false,
			message: "Invalid merchant fee ID",
		});
	}

	const fee = await MerchantFeeConfig.findById(id);

	if (!fee) {
		return res.status(404).json({
			success: false,
			message: "Merchant fee not found",
		});
	}

	if (fee.status === "active") {
		return res.status(200).json({
			success: true,
			message: "Merchant fee is already active",
			data: fee,
		});
	}

	fee.status = "active";
	fee.updatedBy = req.user._id;

	await fee.save();

	return res.status(200).json({
		success: true,
		message: "Merchant fee activated successfully",
		data: fee,
	});
};

// Deactivates the fees instead of DELETEING the fees
export const deleteMerchantFee = async (req, res) => {
	const fee = await MerchantFeeConfig.findByIdAndUpdate(
		req.params.id,
		{
			status: "inactive",
			updatedBy: req.user._id,
		},
		{ new: true },
	);

	if (!fee) {
		return res.status(404).json({
			success: false,
			message: "Merchant fee not found",
		});
	}

	return res.json({
		success: true,
		message: "Merchant fee deactivated successfully",
		data: fee,
	});
};

const getPagination = (query) => {
	const page = Math.max(Number(query.page) || 1, 1);
	const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
	const skip = (page - 1) * limit;

	return { page, limit, skip };
};

export const listMerchantFees = async (req, res) => {
	const { search, status, currency, brand, countryScope, countryCode } =
		req.query;
	const { page, limit, skip } = getPagination(req.query);

	const query = {};

	if (status) query.status = status;
	if (currency) query.currency = normalizeUpper(currency);
	if (brand) query.brand = normalizeUpper(brand);
	if (countryScope) query.countryScope = normalizeUpper(countryScope);
	if (countryCode) query.countryCode = normalizeUpper(countryCode);

	if (search) {
		const normalizedSearch = String(search).trim();

		if (normalizedSearch) {
			const escapedSearch = normalizedSearch.replace(
				/[.*+?^${}()|[\]\\]/g,
				"\\$&",
			);

			const searchRegex = new RegExp(escapedSearch, "i");

			const searchConditions = [
				{ merchantName: searchRegex },
				{ memberId: searchRegex },
				{ partnerName: searchRegex },
				{ accountIds: searchRegex },
				{ country: searchRegex },
				{ countryCode: searchRegex },
				{ countryScope: searchRegex },
				{ gatewayName: searchRegex },
				{ currency: searchRegex },
				{ brand: searchRegex },
				{ type: searchRegex },
				{ status: searchRegex },
			];

			const numericSearch = Number(normalizedSearch);

			if (Number.isFinite(numericSearch)) {
				searchConditions.push(
					{ mdrPercent: numericSearch },
					{ approvalFee: numericSearch },
					{ declineFee: numericSearch },
					{ reversalFee: numericSearch },
					{ chargebackFee: numericSearch },
					{ rollingReservePercent: numericSearch },
					{ settlementExpensePercent: numericSearch },
				);
			}

			query.$or = searchConditions;
		}
	}

	const [data, total] = await Promise.all([
		MerchantFeeConfig.find(query)
			.populate("createdBy", "name email")
			.populate("updatedBy", "name email")
			.sort({ createdAt: -1 })
			.skip(skip)
			.limit(limit)
			.lean(),

		MerchantFeeConfig.countDocuments(query),
	]);

	return res.json({
		success: true,
		data,
		meta: {
			total,
			page,
			limit,
			totalPages: Math.ceil(total / limit),
		},
	});
};

export const getMerchantFee = async (req, res) => {
	if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
		return res.status(400).json({
			success: false,
			message: "Invalid merchant fee id",
		});
	}

	const fee = await MerchantFeeConfig.findById(req.params.id).lean();

	if (!fee) {
		return res.status(404).json({
			success: false,
			message: "Merchant fee not found",
		});
	}

	return res.json({
		success: true,
		data: fee,
	});
};

export const approveMerchantFeeChangeRequest = async (req, res) => {
	const request = await MerchantFeeChangeRequest.findById(req.params.id);

	if (!request) {
		return res.status(404).json({
			success: false,
			message: "Fee change request not found",
		});
	}

	if (request.status !== "PENDING_APPROVAL") {
		return res.status(400).json({
			success: false,
			message: "Only pending requests can be approved",
		});
	}

	if (String(request.makerId) === String(req.user._id)) {
		return res.status(403).json({
			success: false,
			message: "Maker and checker cannot be the same user",
		});
	}

	let fee = null;

	if (request.action === "CREATE") {
		fee = await MerchantFeeConfig.create({
			memberId: request.memberId,
			merchantName: request.merchantName,
			partnerName: request.partnerName,
			accountIds: request.accountIds || [],

			brand: request.brand,
			currency: request.currency,

			country: request.country,
			countryRuleRaw: request.countryRuleRaw,
			countryScope: request.countryScope,
			countryCode: request.countryCode,
			countryCategory: request.countryCategory,
			gatewayName: request.gatewayName,

			...request.newRates,

			status: "active",
			createdBy: request.makerId,
			updatedBy: req.user._id,
		});

		request.feeConfigId = fee._id;
	} else {
		fee = await MerchantFeeConfig.findById(request.feeConfigId);

		if (!fee) {
			return res.status(404).json({
				success: false,
				message: "Merchant fee config not found",
			});
		}
	}

	if (request.action === "UPDATE") {
		for (const field of request.changedFields) {
			fee[field] = request.newRates[field];
		}

		fee.updatedBy = req.user._id;
		await fee.save();
	}

	if (request.action === "DEACTIVATE") {
		fee.status = "inactive";
		fee.updatedBy = req.user._id;
		await fee.save();
	}

	request.status = "APPROVED";
	request.checkerId = req.user._id;
	request.checkerName = req.user.name || "";
	request.checkerEmail = req.user.email || "";
	request.checkerComment = normalizeText(req.body.checkerComment || "");
	request.approvedAt = new Date();

	await request.save();

	await MerchantFeeConfigHistory.create({
		feeConfigId: fee._id,
		action:
			request.action === "CREATE"
				? "CREATED"
				: request.action === "UPDATE"
					? "UPDATED"
					: "DEACTIVATED",

		memberId: request.memberId,
		merchantName: request.merchantName,
		partnerName: request.partnerName,
		accountIds: request.accountIds,

		brand: request.brand,
		currency: request.currency,

		country: request.country,
		countryRuleRaw: request.countryRuleRaw,
		countryScope: request.countryScope,
		countryCode: request.countryCode,
		countryCategory: request.countryCategory,
		gatewayName: request.gatewayName,

		oldRates: request.oldRates,
		newRates: request.newRates,
		changedFields: request.changedFields,

		changeReason: request.changeReason,
		requestedByName: request.requestedByName,
		requestedByEmail: request.requestedByEmail,

		changedBy: request.makerId,
		changedByName: request.makerName,
		changedByEmail: request.makerEmail,

		approvedByName: request.checkerName,
		approvedByEmail: request.checkerEmail,

		source: request.source,
		uploadedFileName: request.uploadedFileName,
	});

	return res.json({
		success: true,
		message: "Fee change approved and applied successfully",
		data: request,
	});
};

export const rejectMerchantFeeChangeRequest = async (req, res) => {
	const request = await MerchantFeeChangeRequest.findById(req.params.id);

	if (!request) {
		return res.status(404).json({
			success: false,
			message: "Fee change request not found",
		});
	}

	if (request.status !== "PENDING_APPROVAL") {
		return res.status(400).json({
			success: false,
			message: "Only pending requests can be rejected",
		});
	}

	if (!normalizeText(req.body.checkerComment)) {
		return res.status(400).json({
			success: false,
			message: "checkerComment is required when rejecting a fee change request",
		});
	}

	if (String(request.makerId) === String(req.user._id)) {
		return res.status(403).json({
			success: false,
			message: "Maker and checker cannot be the same user",
		});
	}

	request.status = "REJECTED";
	request.checkerId = req.user._id;
	request.checkerName = req.user.name || "";
	request.checkerEmail = req.user.email || "";
	request.checkerComment = normalizeText(req.body.checkerComment || "");
	request.rejectedAt = new Date();

	await request.save();

	return res.json({
		success: true,
		message: "Fee change request rejected",
		data: request,
	});
};

export const listMerchantFeeChangeRequests = async (req, res) => {
	const { status, memberId, brand, currency, countryCode, makerId } = req.query;

	const query = {};

	if (status) query.status = normalizeUpper(status);
	if (memberId) query.memberId = normalizeText(memberId);
	if (brand) query.brand = normalizeUpper(brand);
	if (currency) query.currency = normalizeUpper(currency);
	if (countryCode) query.countryCode = normalizeUpper(countryCode);
	if (makerId) query.makerId = makerId;

	const data = await MerchantFeeChangeRequest.find(query)
		.populate("makerId", "name email")
		.populate("checkerId", "name email")
		.sort({ createdAt: -1 })
		.lean();

	return res.json({
		success: true,
		data,
	});
};

/*
|--------------------------------------------------------------------------
| Fee matching
|--------------------------------------------------------------------------
*/

const feeExactKey = ({
	memberId,
	currency,
	brand,
	countryScope,
	countryCode,
	gatewayName = "ALL",
}) =>
	[
		normalizeUpper(memberId),
		normalizeUpper(currency),
		normalizePaymentBrandForMatching(brand),
		normalizeUpper(countryScope || "ALL"),
		normalizeUpper(countryCode || ""),
		normalizeUpper(gatewayName || "ALL"),
	].join("__");

const buildFeeIndexes = async () => {
	const fees = await MerchantFeeConfig.find({
		status: "active",
	}).lean();

	const exactFeeMap = new Map();

	for (const fee of fees) {
		const brands = expandFeeBrands(fee.brand);

		const countryScope = normalizeUpper(fee.countryScope || "ALL");
		const countryCode = normalizeUpper(fee.countryCode || "");
		const gatewayName = normalizeUpper(fee.gatewayName || "ALL");

		for (const brand of brands) {
			const key = feeExactKey({
				memberId: fee.memberId,
				currency: fee.currency,
				brand,
				countryScope,
				countryCode,
				gatewayName,
			});

			exactFeeMap.set(key, fee);
		}
	}

	return { exactFeeMap };
};

const findFeeFromIndexes = (row, feeIndexes) => {
	const base = {
		memberId: row.memberId,
		currency: row.currency,
		brand: row.paymentBrand,
	};

	const attempts = [];

	/*
		1. Specific country match.
		Example:
		ISO Country = TURKEY
		CountryMaster feeCountryCode = TR
		Fee Country = TR
	*/
	if (row.countryCode && row.countryCategory !== "ALL") {
		attempts.push({
			countryScope: "COUNTRY",
			countryCode: row.countryCode,
			gatewayName: "ALL",
			matchType: "country_exact",
		});
	}

	/*
		2. EU / NonEU category match.
		Example:
		ISO Country = GERMANY
		CountryMaster category = EU
		Fee Country = EU
	*/
	if (["EU", "NONEU"].includes(normalizeUpper(row.countryCategory))) {
		attempts.push({
			countryScope: normalizeUpper(row.countryCategory),
			countryCode: "",
			gatewayName: "ALL",
			matchType: "category_exact",
		});
	}

	/*
		3. All fallback.
		Example:
		Fee Country = All
	*/
	attempts.push({
		countryScope: "ALL",
		countryCode: "",
		gatewayName: "ALL",
		matchType: "all_fallback",
	});

	for (const attempt of attempts) {
		const key = feeExactKey({
			...base,
			countryScope: attempt.countryScope,
			countryCode: attempt.countryCode,
			gatewayName: attempt.gatewayName,
		});

		const fee = feeIndexes.exactFeeMap.get(key);

		if (fee) {
			return {
				fee,
				matchType: attempt.matchType,
			};
		}
	}

	return {
		fee: null,
		matchType: "unmatched",
	};
};
/*
|--------------------------------------------------------------------------
| Transaction normalization
|--------------------------------------------------------------------------
*/

const normalizeNA = (value) => {
	const cleaned = cleanCell(value);

	if (!cleaned || cleaned === "-") {
		return "NA";
	}

	return cleaned;
};

const normalizeTransactionRow = (row) => ({
	transactionDate: parseSettlementTransactionDate(
		getValue(row, [
			"Datestamp",
			"Date Stamp",
			"Timestamp",
			"Time Stamp",
			"Transaction Date(MM/DD/YYYY)",
			"Transaction Date (MM/DD/YYYY)",
			"Transaction Date",
		]),
	),

	memberId: cleanCell(getValue(row, ["Member ID"])),

	merchantCompanyName: cleanCell(getValue(row, ["Merchant Company Name"])),

	partnerName: cleanCell(getValue(row, ["Partner Name"])),

	bankAccountId: cleanCell(getValue(row, ["Bank Account ID"])),

	isoCountry: normalizeUpper(
		cleanCell(
			getValueIgnoringDash(row, [
				"ISO Country",
				"ISO country",
				"Transaction Country",
				"Country",
				"Country Name",
			]),
		),
	),
	paymentBrand: normalizePaymentBrandForMatching(
		getValue(row, ["Payment Brand", "Payment Method", "Brand"]),
	),

	currency: normalizeUpper(getValue(row, ["Currency"])),

	trackingId: cleanCell(getValue(row, ["Tracking ID"])),
	paymentId: cleanCell(getValue(row, ["Payment ID"])),
	orderId: cleanCell(getValue(row, ["Order ID"])),

	transactionMode: normalizeUpper(getValue(row, ["Transaction Mode"])),

	authAmount: parseNumber(getValue(row, ["Auth Amount"])),
	capturedAmountFromFile: parseNumber(getValue(row, ["Captured Amount"])),
	refundAmount: parseNumber(getValue(row, ["Refund Amount"])),
	chargebackAmount: parseNumber(getValue(row, ["Chargeback Amount"])),

	status: normalizeText(getValue(row, ["Status"])),
	reason: normalizeText(getValue(row, ["Reason", "Remark"])),
	acquirer: normalizeUpper(
		getValue(row, SETTLEMENT_ACQUIRER_HEADERS),
	),
});

const normalizeTransactionForMatching = (row) => ({
	...row,
	memberId: normalizeNA(row.memberId),
	merchantCompanyName: normalizeNA(row.merchantCompanyName),
	bankAccountId: normalizeNA(row.bankAccountId),
	paymentBrand: normalizePaymentBrandForMatching(normalizeNA(row.paymentBrand)),
	currency: normalizeUpper(normalizeNA(row.currency)),
	isoCountry: normalizeUpper(normalizeNA(row.isoCountry)),
});

const isMissingRequiredTransactionField = (row) =>
	!row.memberId ||
	row.memberId === "NA" ||
	!row.currency ||
	row.currency === "NA" ||
	!row.paymentBrand ||
	row.paymentBrand === "NA";

const calculateFees = ({ row, fee, sourceFileType }) => {
	const status = normalizeUpper(row.status);

	const isSuccess = isSuccessStatus(status, sourceFileType);
	const isDecline = isDeclineStatus(status, sourceFileType);

	const isReversalAdjustment = isReversalStatus(status, sourceFileType);

	const isChargebackAdjustment = isChargebackStatus(status, sourceFileType);

	const isChargebackReversedAdjustment = isChargebackReversedStatus(
		status,
		sourceFileType,
	);

	/*
	 * DATESTAMP SUCCESS
	 *
	 * All statuses that the team considers successful use the
	 * captured/auth amount as the successful transaction amount.
	 *
	 * This includes REVERSED / CHARGEBACK in DATESTAMP because
	 * the team explicitly classifies those DATESTAMP rows as success.
	 */
	const salesAmount = isSuccess
		? Number(row.capturedAmountFromFile || row.authAmount || 0)
		: 0;

	/*
	 * TIMESTAMP REVERSED = adjustment.
	 */
	const reversalAmount = isReversalAdjustment
		? Number(
				row.refundAmount || row.capturedAmountFromFile || row.authAmount || 0,
			)
		: 0;

	/*
	 * TIMESTAMP CHARGEBACK = adjustment.
	 */
	const chargebackAmountValue = isChargebackAdjustment
		? Number(
				row.chargebackAmount ||
					row.capturedAmountFromFile ||
					row.authAmount ||
					0,
			)
		: 0;

	/*
	 * IMPORTANT:
	 * CHARGEBACK REVERSED is classified as an adjustment,
	 * but the team has only given us the COUNT classification.
	 *
	 * Do not invent a debit/credit amount here until they confirm
	 * its financial treatment.
	 */
	const chargebackReversedAmountValue = isChargebackReversedAdjustment ? 0 : 0;

	/*
	 * Settled / success amount comes ONLY from DATESTAMP success.
	 *
	 * Timestamp adjustments must not increase success amount.
	 */
	const capturedAmount = salesAmount;

	const capturedCents = toCents(capturedAmount);

	/*
	 * MDR, Approval and RR apply to actual successful processing rows,
	 * not timestamp adjustment rows.
	 */
	const mdrFee = isSuccess
		? calculateMdr(capturedAmount, fee.mdrPercent || 0)
		: 0;

	const rollingReserveAmount = isSuccess
		? fromCents(percentFeeCents(capturedCents, fee.rollingReservePercent))
		: 0;

	const approvalFee = isSuccess ? roundMoney(fee.approvalFee) : 0;

	/*
	 * CONFIRMATION STARTED belongs to FAILED according to team rule.
	 */
	const declineFee = isDecline ? roundMoney(fee.declineFee) : 0;

	const reversalFee = isReversalAdjustment ? roundMoney(fee.reversalFee) : 0;

	const chargebackFee = isChargebackAdjustment
		? roundMoney(fee.chargebackFee)
		: 0;

	const settlementExpense = 0;

	const totalFees = preciseMoney(
		mdrFee +
			approvalFee +
			declineFee +
			reversalFee +
			chargebackFee +
			rollingReserveAmount +
			reversalAmount +
			chargebackAmountValue +
			chargebackReversedAmountValue,
	);

	/*
	 * For timestamp adjustment:
	 * capturedAmount = 0
	 *
	 * therefore reversal / chargeback naturally produces
	 * negative settlement impact.
	 */
	const netSettlement = sumMoney([capturedAmount, -totalFees]);

	return {
		capturedAmount,

		reversalAmount,
		chargebackAmountValue,

		mdrFee,
		approvalFee,
		declineFee,
		reversalFee,
		chargebackFee,
		rollingReserveAmount,
		settlementExpense,

		totalFees,
		netSettlement,
	};
};

const insertTransactionsInChunks = async (docs, chunkSize = 1000) => {
	if (!docs.length) return 0;

	let insertedRows = 0;

	for (let i = 0; i < docs.length; i += chunkSize) {
		const chunk = docs.slice(i, i + chunkSize);

		await MerchantTransaction.insertMany(chunk, {
			ordered: false,
		});

		insertedRows += chunk.length;
	}

	return insertedRows;
};

/*
|--------------------------------------------------------------------------
| Settlement batch upload
|--------------------------------------------------------------------------
*/

export const processTransactionFile = async ({
	file,
	sourceFileType,
	settlementBatchId,
	userId,
	feeIndexes,
	countryMap,
}) => {
	/*
	 * Because CSV is streamed, totalRows is not known
	 * until the stream finishes.
	 */
	const upload = await MerchantTransactionUpload.create({
		settlementBatchId,
		fileName: file.originalname,
		sourceFileType,

		totalRows: 0,
		validRows: 0,
		matchedRows: 0,
		unmatchedFeeRows: 0,
		skippedRows: 0,

		uploadedBy: userId,
	});

	let totalRows = 0;
	let matchedRows = 0;
	let unmatchedFeeRows = 0;
	let skippedRows = 0;
	let insertedRows = 0;

	/*
	 * Only this many Mongo documents are retained
	 * before being flushed.
	 */
	const BATCH_SIZE = 1000;
	const batch = [];

	const flushBatch = async () => {
		if (!batch.length) {
			return;
		}

		/*
		 * Remove everything from the active batch.
		 *
		 * After Mongo finishes inserting it,
		 * these objects can be garbage-collected.
		 */
		const toInsert = batch.splice(0, batch.length);

		insertedRows += await insertTransactionsInChunks(toInsert, BATCH_SIZE);
	};

	/*
	 * Stream CSV rows one by one.
	 *
	 * There is NO:
	 *
	 * const rows = [...]
	 *
	 * anymore.
	 */
	for await (const rawRow of iterateTransactionRows(file)) {
		totalRows += 1;

		let row = normalizeTransactionRow(rawRow);

		row = normalizeTransactionForMatching(row);

		/*
		 * Datestamp SUCCESS:
		 * CAPTURE SUCCESSFUL
		 * SETTLED
		 * RR SENT
		 * REVERSED
		 * CHARGEBACK
		 * CHARGEBACK REVERSED
		 *
		 * Datestamp FAILED:
		 * AUTH FAILED
		 * CONFIRMATION STARTED
		 *
		 * Timestamp ADJUSTMENTS:
		 * REVERSED
		 * CHARGEBACK
		 * CHARGEBACK REVERSED
		 */
		if (!isAllowedStatusForSource(row.status, sourceFileType)) {
			skippedRows += 1;
			continue;
		}

		if (isMissingRequiredTransactionField(row)) {
			skippedRows += 1;
			continue;
		}

		/*
		 * Resolve transaction country.
		 */
		const country = resolveTransactionCountry(row.isoCountry, countryMap);

		row.countryName = country.countryName;
		row.countryCode = country.countryCode;
		row.countryCategory = country.countryCategory;

		/*
		 * Find applicable merchant fee configuration.
		 */
		const { fee, matchType } = findFeeFromIndexes(row, feeIndexes);

		if (!fee) {
			unmatchedFeeRows += 1;

			batch.push({
				settlementBatchId,
				uploadId: upload._id,
				sourceFileType,

				...row,

				matchStatus: "unmatched_fee",
				matchType: "unmatched",
			});
		} else {
			const feeAmounts = calculateFees({
				row,
				fee,
				sourceFileType,
			});

			matchedRows += 1;

			batch.push({
				settlementBatchId,
				uploadId: upload._id,
				sourceFileType,

				...row,

				feeConfigId: fee._id,

				matchedFeeCountry: fee.country || "",
				matchedFeeCountryScope: fee.countryScope || "",
				matchedFeeCountryCode: fee.countryCode || "",
				matchedFeeCountryCategory: fee.countryCategory || "",
				matchedFeeGatewayName: fee.gatewayName || "ALL",

				...feeAmounts,

				matchStatus: "matched",
				matchType,
			});
		}

		/*
		 * Pause CSV consumption every 1000 accepted rows
		 * and persist them before continuing.
		 */
		if (batch.length >= BATCH_SIZE) {
			await flushBatch();
		}
	}

	/*
	 * Persist final partial batch.
	 *
	 * Example:
	 *
	 * 1000
	 * 1000
	 * 1000
	 * 327
	 */
	await flushBatch();

	/*
	 * Now we know the final counters.
	 */
	await MerchantTransactionUpload.updateOne(
		{
			_id: upload._id,
		},
		{
			$set: {
				totalRows,
				validRows: insertedRows,
				matchedRows,
				unmatchedFeeRows,
				skippedRows,
			},
		},
	);

	return {
		uploadId: upload._id,
		fileName: file.originalname,
		sourceFileType,

		totalRows,
		insertedRows,
		matchedRows,
		unmatchedFeeRows,
		skippedRows,
	};
};

export const listMerchantTransactions = async (req, res) => {
	const {
		search,
		matchStatus,
		sourceFileType,
		settlementBatchId,
		uploadId,
		reportId,
		memberId,
		status,
		currency,
		brand,
		countryCategory,
		countryCode,
		fromDate,
		toDate,
	} = req.query;

	const { page, limit, skip } = getPagination(req.query);

	const query = {};

	if (matchStatus) query.matchStatus = matchStatus;
	if (sourceFileType) query.sourceFileType = sourceFileType;
	if (settlementBatchId) query.settlementBatchId = settlementBatchId;
	if (uploadId) query.uploadId = uploadId;
	if (reportId) query.reportId = reportId;
	if (memberId) query.memberId = memberId;
	if (status) query.status = new RegExp(status, "i");
	if (currency) query.currency = normalizeUpper(currency);
	if (brand) query.paymentBrand = normalizeUpper(brand);
	if (countryCategory) query.countryCategory = normalizeUpper(countryCategory);
	if (countryCode) query.countryCode = normalizeUpper(countryCode);

	if (fromDate || toDate) {
		query.transactionDate = {};
		if (fromDate) query.transactionDate.$gte = startOfDate(fromDate);
		if (toDate) query.transactionDate.$lte = endOfDate(toDate);
	}

	if (search) {
		query.$or = [
			{ merchantCompanyName: new RegExp(search, "i") },
			{ memberId: new RegExp(search, "i") },
			{ bankAccountId: new RegExp(search, "i") },
			{ paymentId: new RegExp(search, "i") },
			{ trackingId: new RegExp(search, "i") },
			{ orderId: new RegExp(search, "i") },
			{ isoCountry: new RegExp(search, "i") },
			{ countryName: new RegExp(search, "i") },
			{ countryCode: new RegExp(search, "i") },
		];
	}

	const [data, total] = await Promise.all([
		MerchantTransaction.find(query)
			.populate("feeConfigId")
			.populate("settlementBatchId", "batchName reportDate status")
			.populate("uploadId", "fileName sourceFileType")
			.populate("reportId", "merchantName memberId emailStatus")
			.sort({ transactionDate: -1, createdAt: -1 })
			.skip(skip)
			.limit(limit)
			.lean(),

		MerchantTransaction.countDocuments(query),
	]);

	return res.json({
		success: true,
		data,
		meta: {
			total,
			page,
			limit,
			totalPages: Math.ceil(total / limit),
		},
	});
};

export const validateSettlementTransactionFile = async (file, sourceFileType) => {
	try {
		let headerFound = false;
		let invalidCount = 0;
		const samples = [];
		for await (const rawRow of iterateTransactionRows(file, {
			onHeader: (header) => {
				validateSettlementAcquirerHeader(header);
				headerFound = true;
			},
		})) {
			const row = normalizeTransactionForMatching(normalizeTransactionRow(rawRow));
			// Validate the rows that the importer will persist, including unmatched fees.
			if (!isAllowedStatusForSource(row.status, sourceFileType) || isMissingRequiredTransactionField(row)) continue;
			if (isValidSettlementAcquirer(row.acquirer)) continue;
			invalidCount++;
			if (samples.length < 5) {
				const { sheetName, rowNumber } = rawRow[SETTLEMENT_ROW_LOCATION];
				samples.push(`${sheetName ? `sheet "${sheetName}", row` : "CSV line"} ${rowNumber} (${row.status})`);
			}
		}
		if (!headerFound) settlementDownloadError("No transaction header was found. Add the required transaction columns, including \"Acquirer-wise\".");
		if (invalidCount) {
			settlementDownloadError(`${invalidCount} transaction row(s) have a missing or invalid acquirer: ${samples.join("; ")}${invalidCount > samples.length ? `; and ${invalidCount - samples.length} more` : ""}. Fill in the correct acquirer in "Acquirer-wise"; blanks, -, NA, N/A, NULL, and UNKNOWN are not accepted.`);
		}
	} catch (error) {
		settlementDownloadError(`"${file.originalname}": ${error.message} No settlement data was saved.`);
	}
};

export const uploadSettlementBatchTransactions = async (req, res) => {
	/*
	 * Large CSV processing may legitimately take several minutes.
	 */
	req.setTimeout?.(10 * 60 * 1000);
	res.setTimeout?.(10 * 60 * 1000);

	const datestampFile =
		req.files?.datestampFile?.[0] ||
		req.files?.datestamp?.[0] ||
		req.files?.dateStampFile?.[0];

	const timestampFile =
		req.files?.timestampFile?.[0] ||
		req.files?.timestamp?.[0] ||
		req.files?.timeStampFile?.[0];

	/*
	 * CSV is streamed; XLSX worksheets are read through the transaction reader.
	 */
	const receivedFiles = [datestampFile, timestampFile].filter(Boolean);
	const cleanupFiles = () => Promise.all(receivedFiles.map((file) => safeDeleteTempFile(file.path)));
	const rejectUpload = async (message) => {
		await cleanupFiles();
		return res.status(400).json({ success: false, message });
	};
	if (!datestampFile) {
		return rejectUpload("A datestamp file is required. The timestamp file is optional.");
	}

	const invalidFile = receivedFiles.find(
		(file) => !isSettlementTransactionFilename(file.originalname),
	);

	if (invalidFile) {
		return rejectUpload(`Only CSV and XLSX settlement transaction files are supported. Invalid file: ${invalidFile.originalname}`);
	}

	let period;
	try {
		period = parseSettlementUploadPeriod(req.body);
	} catch (error) {
		return rejectUpload(error.message);
	}
	const { reportDate, fromDate, toDate } = period;
	// Validate every file before creating a batch, upload record, or transaction.
	try {
		if (datestampFile) await validateSettlementTransactionFile(datestampFile, "datestamp");
		if (timestampFile) await validateSettlementTransactionFile(timestampFile, "timestamp");
	} catch (error) {
		return rejectUpload(error.message);
	}

	const settlementBatch = await MerchantSettlementBatch.create({
		batchName:
			req.body.batchName || `Settlement Batch ${new Date().toISOString()}`,

		reportDate,

		fromDate,

		toDate,

		datestampFileName: datestampFile?.originalname || "",

		timestampFileName: timestampFile?.originalname || "",

		status: "processing",

		uploadedBy: req.user._id,
	}).catch(async (error) => {
		await cleanupFiles();
		throw error;
	});

	try {
		/*
		 * These are relatively small lookup maps and
		 * can remain in memory while the supplied files process.
		 */
		const feeIndexes = await buildFeeIndexes();

		const countryMap = await buildCountryMasterMap();

		const fileResults = [];

		/*
		 * IMPORTANT:
		 * Process sequentially.
		 *
		 * Do NOT Promise.all() these two files.
		 */
		if (datestampFile) {
			const datestampResult = await processTransactionFile({
				file: datestampFile,
				sourceFileType: "datestamp",
				settlementBatchId: settlementBatch._id,
				userId: req.user._id,
				feeIndexes,
				countryMap,
			});

			fileResults.push(datestampResult);
		}

		if (timestampFile) {
			const timestampResult = await processTransactionFile({
				file: timestampFile,
				sourceFileType: "timestamp",
				settlementBatchId: settlementBatch._id,
				userId: req.user._id,
				feeIndexes,
				countryMap,
			});

			fileResults.push(timestampResult);
		}

		/*
		 * Generate reports after all supplied transaction files are persisted.
		 */
		const generatedReportIds = await generateReportsForBatch({
			settlementBatchId: settlementBatch._id,

			userId: req.user._id,
		});

		const totals = fileResults.reduce(
			(acc, item) => {
				acc.totalRows += Number(item.totalRows || 0);

				acc.validRows += Number(item.insertedRows || 0);

				acc.matchedRows += Number(item.matchedRows || 0);

				acc.unmatchedFeeRows += Number(item.unmatchedFeeRows || 0);

				acc.skippedRows += Number(item.skippedRows || 0);

				return acc;
			},
			{
				totalRows: 0,
				validRows: 0,
				matchedRows: 0,
				unmatchedFeeRows: 0,
				skippedRows: 0,
			},
		);

		await MerchantSettlementBatch.updateOne(
			{
				_id: settlementBatch._id,
			},
			{
				$set: {
					...totals,

					generatedReportIds,

					status: "completed",
				},
			},
		);

		return res.status(201).json({
			success: true,

			message: "Settlement batch uploaded and reports generated successfully",

			data: {
				settlementBatchId: settlementBatch._id,

				files: fileResults,

				generatedReportIds,

				...totals,
			},
		});
	} catch (error) {
		console.error("Settlement batch upload failed:", error);

		/*
		 * Roll back anything written by this batch.
		 */
		await Promise.all([
			MerchantTransaction.deleteMany({
				settlementBatchId: settlementBatch._id,
			}),

			MerchantTransactionUpload.deleteMany({
				settlementBatchId: settlementBatch._id,
			}),

			MerchantSettlementReport.deleteMany({
				settlementBatchId: settlementBatch._id,
			}),

			MerchantSettlementBatch.deleteOne({
				_id: settlementBatch._id,
			}),
		]);

		const statusCode = error.statusCode === 400 ? 400 : 500;
		return res.status(statusCode).json({
			success: false,

			message: statusCode === 400 ? error.message : "Settlement batch upload failed. All partial data was removed.",

			error: error.message,
		});
	} finally {
		/*
		 * Multer diskStorage created these temporary files.
		 *
		 * Always delete them regardless of:
		 * - success
		 * - CSV parsing error
		 * - Mongo error
		 * - report error
		 */
		await Promise.all([
			datestampFile?.path
				? safeDeleteTempFile(datestampFile.path)
				: Promise.resolve(),

			timestampFile?.path
				? safeDeleteTempFile(timestampFile.path)
				: Promise.resolve(),
		]);
	}
};

/*
|--------------------------------------------------------------------------
| Merchant / email resolver
|--------------------------------------------------------------------------
*/

const resolveMerchantByMemberId = async (memberId) => {
	const normalizedMemberId = normalizeText(memberId);

	const accounts = await MerchantAccount.find({
		$or: [{ memberId: normalizedMemberId }, { mid: normalizedMemberId }],
		status: "active",
	})
		.populate("merchantId", "merchantName merchantTag status")
		.sort({ updatedAt: -1, createdAt: -1 })
		.lean();

	if (!accounts.length) {
		return {
			merchantId: null,
			merchantAccountId: null,
			merchantName: null,
		};
	}

	const uniqueMerchantIds = [
		...new Set(
			accounts
				.map((account) =>
					String(account.merchantId?._id || account.merchantId || ""),
				)
				.filter(Boolean),
		),
	];

	if (uniqueMerchantIds.length > 1) {
		console.warn(
			`Member ID ${normalizedMemberId} is mapped to multiple merchants: ${uniqueMerchantIds.join(", ")}`,
		);

		return {
			merchantId: null,
			merchantAccountId: null,
			merchantName: null,
		};
	}

	const account =
		accounts.find(
			(item) =>
				item.merchantId?.merchantName && item.merchantId.merchantName !== "-",
		) || accounts[0];

	return {
		merchantId: account.merchantId?._id || account.merchantId || null,
		merchantAccountId: account._id || null,
		merchantName: account.merchantId?.merchantName || null,
	};
};

const getMerchantEmailRecipients = async ({
	merchantId,
	merchantAccountId,
}) => {
	if (!merchantId) return [];

	const query = {
		role: "merchant",
		merchantId,
		isActive: true,
		email: { $exists: true, $ne: "" },
	};

	if (merchantAccountId) {
		query.$or = [{ merchantAccountId }, { merchantAccountId: null }];
	}

	const users = await User.find(query)
		.select("_id name email merchantId merchantAccountId")
		.lean();

	return users.map((user) => ({
		userId: user._id,
		name: user.name,
		email: user.email,
	}));
};

/*
|--------------------------------------------------------------------------
| Report generation
|--------------------------------------------------------------------------
*/

const MDR_CALCULATION_VERSION = 2;

// Correct legacy transaction MDR in memory; retain every other stored charge.
export const withPreciseTransactionMdr = (txn) => {
	const rate = txn.feeConfigId?.mdrPercent;
	if (!isSuccessStatus(normalizeUpper(txn.status), txn.sourceFileType) || rate == null) return txn;
	const mdrFee = calculateMdr(txn.capturedAmount || 0, rate);
	return {
		...txn, mdrFee,
		totalFees: sumMoney([txn.totalFees || 0, -(txn.mdrFee || 0), mdrFee]),
		netSettlement: sumMoney([txn.netSettlement || 0, txn.mdrFee || 0, -mdrFee]),
	};
};

export const buildMerchantReportData = async ({
	settlementBatchId,
	memberId,
	reportDate,
	fromDate,
	toDate,
	acquirer,
	reportId,
}) => {
	const query = {
		settlementBatchId: new mongoose.Types.ObjectId(settlementBatchId),
		matchStatus: "matched",
	};

	if (memberId) query.memberId = memberId;

	if (reportDate) {
		query.transactionDate = getDateRange(reportDate);
	} else if (fromDate || toDate) {
		query.transactionDate = {};
		if (fromDate) query.transactionDate.$gte = startOfDate(fromDate);
		if (toDate) query.transactionDate.$lte = endOfDate(toDate);
	}

	if (reportId) {
		const selectedReport =
			await MerchantSettlementReport.findById(reportId).lean();
		if (
			!selectedReport ||
			String(selectedReport.settlementBatchId?._id || selectedReport.settlementBatchId) !== String(settlementBatchId) ||
			selectedReport.memberId !== memberId
		) {
			settlementDownloadError(
				"Report does not belong to this settlement batch and MID.",
			);
		}
		Object.assign(query, getReportTransactionQuery(selectedReport, "matched"));
	}
	if (acquirer !== undefined) query.acquirer = acquirerMatchRegex(acquirer);

	const storedTransactions = await MerchantTransaction.find(query)
		.populate("feeConfigId")
		.sort({ transactionDate: 1 })
		.lean();
	const transactions = storedTransactions.map(withPreciseTransactionMdr);

	const first = transactions[0];

	const transactionDates = transactions
		.map((txn) => (txn.transactionDate ? new Date(txn.transactionDate) : null))
		.filter((date) => date && !Number.isNaN(date.getTime()))
		.sort((a, b) => a.getTime() - b.getTime());

	const transactionFromDate = transactionDates[0] || null;
	const transactionToDate =
		transactionDates[transactionDates.length - 1] || transactionFromDate;
	const datestampDates = transactions
		.filter((txn) => isDatestampSource(txn.sourceFileType))
		.map((txn) => txn.transactionDate ? new Date(txn.transactionDate) : null)
		.filter((date) => date && Number.isFinite(date.getTime()))
		.sort((a, b) => a.getTime() - b.getTime());
	const datestampPeriod = {
		fromDate: datestampDates[0] || null,
		toDate: datestampDates[datestampDates.length - 1] || null,
	};

	const summary = {
		totalTransactions: transactions.length,

		successTransactions: 0,
		declinedTransactions: 0,
		reversalTransactions: 0,
		chargebackTransactions: 0,

		settledTransactions: 0,
		captureSuccessfulTransactions: 0,
		rrSettleTransactions: 0,
		authFailedTransactions: 0,

		grossAmount: 0,
		capturedAmount: 0,
		reversalAmount: 0,
		chargebackAmount: 0,

		mdrFee: 0,
		approvalFee: 0,
		declineFee: 0,
		reversalFee: 0,
		chargebackFee: 0,
		settlementExpense: 0,
		rollingReserveAmount: 0,

		totalFees: 0,
		netSettlement: 0,
	};

	const currencySummary = {};
	const paymentBrandSummary = {};
	const declinedBrandSummary = {};
	const adjustmentSummary = {};
	const statusSummary = {};
	const modeSummary = {};
	const feeRateSummary = {};
	const daySummaryMap = {};

	const summaryCents = {
		grossAmount: 0,
		capturedAmount: 0,
		reversalAmount: 0,
		chargebackAmount: 0,
		approvalFee: 0,
		declineFee: 0,
		reversalFee: 0,
		chargebackFee: 0,
		rollingReserveAmount: 0,
	};

	for (const txn of transactions) {
		const status = normalizeUpper(txn.status);
		const currency = txn.currency || "UNKNOWN";
		const brandGroup = getPaymentBrandGroup(txn.paymentBrand);
		const fee = txn.feeConfigId || {};

		const sourceFileType = txn.sourceFileType;

		const isSuccessTxn = isSuccessStatus(status, sourceFileType);

		const isDeclineTxn = isDeclineStatus(status, sourceFileType);

		const isAdjustmentTxn = isAdjustmentStatus(status, sourceFileType);

		const isReversalTxn = isReversalStatus(status, sourceFileType);

		const isChargebackTxn = isChargebackStatus(status, sourceFileType);

		const isChargebackReversedTxn = isChargebackReversedStatus(
			status,
			sourceFileType,
		);

		const day = txn.transactionDate
			? new Date(txn.transactionDate).toISOString().slice(0, 10)
			: "UNKNOWN";

		/*
		 * HEADLINE COUNTS
		 */
		if (isSuccessTxn) {
			summary.successTransactions += 1;
		}

		if (isDeclineTxn) {
			summary.declinedTransactions += 1;
		}

		/*
		 * Adjustments are kept OUT of successful.
		 */
		if (isReversalTxn) {
			summary.reversalTransactions += 1;
		}

		/*
		 * Keep CHARGEBACK REVERSED inside chargebackTransactions
		 * so your existing PDF:
		 *
		 * reversals + chargebacks = adjustments
		 *
		 * still works without changing your Mongo summary schema.
		 */
		if (isChargebackTxn || isChargebackReversedTxn) {
			summary.chargebackTransactions += 1;
		}

		/*
		 * Detail counters.
		 */
		if (isDatestampSource(sourceFileType) && status === "SETTLED") {
			summary.settledTransactions += 1;
		}

		if (
			isDatestampSource(sourceFileType) &&
			(status === "CAPTURE SUCCESSFUL" || status === "CAPTURED")
		) {
			summary.captureSuccessfulTransactions += 1;
		}

		if (
			isDatestampSource(sourceFileType) &&
			(status === "RR SENT" || status === "RR SETTLE")
		) {
			summary.rrSettleTransactions += 1;
		}

		if (
			isDatestampSource(sourceFileType) &&
			(status === "AUTH FAILED" || status === "CONFIRMATION STARTED")
		) {
			summary.authFailedTransactions += 1;
		}

		// if (status === "SETTLED") summary.settledTransactions += 1;
		// if (status === "CAPTURE SUCCESSFUL" || status === "CAPTURED") {
		// 	summary.captureSuccessfulTransactions += 1;
		// }
		// if (status === "RR SETTLE") summary.rrSettleTransactions += 1;
		// if (status === "AUTH FAILED") summary.authFailedTransactions += 1;

		summaryCents.grossAmount = addCents(
			summaryCents.grossAmount,
			txn.capturedAmount,
		);
		summaryCents.capturedAmount = addCents(
			summaryCents.capturedAmount,
			txn.capturedAmount,
		);
		summaryCents.reversalAmount = addCents(
			summaryCents.reversalAmount,
			txn.reversalAmount,
		);
		summaryCents.chargebackAmount = addCents(
			summaryCents.chargebackAmount,
			txn.chargebackAmountValue,
		);

		summaryCents.approvalFee = addCents(
			summaryCents.approvalFee,
			txn.approvalFee,
		);
		summaryCents.declineFee = addCents(summaryCents.declineFee, txn.declineFee);
		summaryCents.reversalFee = addCents(
			summaryCents.reversalFee,
			txn.reversalFee,
		);
		summaryCents.chargebackFee = addCents(
			summaryCents.chargebackFee,
			txn.chargebackFee,
		);
		summaryCents.rollingReserveAmount = addCents(
			summaryCents.rollingReserveAmount,
			txn.rollingReserveAmount,
		);

		const statusKey = txn.status || "UNKNOWN";
		statusSummary[statusKey] = statusSummary[statusKey] || {
			status: statusKey,
			txns: 0,
			capturedAmount: 0,
			reversalAmount: 0,
			chargebackAmount: 0,
			totalFees: 0,
			netSettlement: 0,
		};

		statusSummary[statusKey].txns += 1;
		addMoneyToBucket(
			statusSummary[statusKey],
			"capturedAmount",
			txn.capturedAmount,
		);
		addMoneyToBucket(
			statusSummary[statusKey],
			"reversalAmount",
			txn.reversalAmount,
		);
		addMoneyToBucket(
			statusSummary[statusKey],
			"chargebackAmount",
			txn.chargebackAmountValue,
		);
		addMoneyToBucket(statusSummary[statusKey], "totalFees", txn.totalFees);
		addMoneyToBucket(
			statusSummary[statusKey],
			"netSettlement",
			txn.netSettlement,
		);

		currencySummary[currency] = currencySummary[currency] || {
			currency,

			txns: 0,
			successTxns: 0,
			failedTxns: 0,
			adjustmentTxns: 0,

			capturedAmount: 0,
			reversalAmount: 0,
			chargebackAmount: 0,

			mdrFee: 0,
			approvalFee: 0,
			declineFee: 0,
			reversalFee: 0,
			chargebackFee: 0,
			rollingReserveAmount: 0,

			feesBeforeSettlementExpense: 0,
			settlementExpenseBase: 0,
			settlementExpensePercent: 0,
			settlementExpense: 0,

			totalFees: 0,
			netSettlement: 0,
		};

		currencySummary[currency].txns += 1;

		if (isSuccessTxn) {
			currencySummary[currency].successTxns += 1;
		}

		if (isDeclineTxn) {
			currencySummary[currency].failedTxns += 1;
		}

		if (isAdjustmentTxn) {
			currencySummary[currency].adjustmentTxns += 1;
		}
		addMoneyToBucket(
			currencySummary[currency],
			"capturedAmount",
			txn.capturedAmount,
		);
		addMoneyToBucket(
			currencySummary[currency],
			"reversalAmount",
			txn.reversalAmount,
		);
		addMoneyToBucket(
			currencySummary[currency],
			"chargebackAmount",
			txn.chargebackAmountValue,
		);
		addMoneyToBucket(currencySummary[currency], "totalFees", txn.totalFees);
		addMoneyToBucket(
			currencySummary[currency],
			"rollingReserveAmount",
			txn.rollingReserveAmount,
		);
		addMoneyToBucket(
			currencySummary[currency],
			"netSettlement",
			txn.netSettlement,
		);

		addMoneyToBucket(currencySummary[currency], "mdrFee", txn.mdrFee);
		addMoneyToBucket(currencySummary[currency], "approvalFee", txn.approvalFee);
		addMoneyToBucket(currencySummary[currency], "declineFee", txn.declineFee);
		addMoneyToBucket(currencySummary[currency], "reversalFee", txn.reversalFee);
		addMoneyToBucket(
			currencySummary[currency],
			"chargebackFee",
			txn.chargebackFee,
		);

		if (
			!currencySummary[currency].settlementExpensePercent &&
			txn.feeConfigId?.settlementExpensePercent
		) {
			currencySummary[currency].settlementExpensePercent =
				txn.feeConfigId.settlementExpensePercent;
		}
		if (isSuccessTxn) {
			const paymentKey = `${brandGroup}__${currency}`;

			paymentBrandSummary[paymentKey] = paymentBrandSummary[paymentKey] || {
				brandGroup,
				currency,
				txns: 0,
				capturedAmount: 0,
				reversalAmount: 0,
				chargebackAmount: 0,
				totalFees: 0,
				netSettlement: 0,
			};

			paymentBrandSummary[paymentKey].txns += 1;

			addMoneyToBucket(
				paymentBrandSummary[paymentKey],
				"capturedAmount",
				txn.capturedAmount,
			);
			addMoneyToBucket(
				paymentBrandSummary[paymentKey],
				"reversalAmount",
				txn.reversalAmount,
			);
			addMoneyToBucket(
				paymentBrandSummary[paymentKey],
				"chargebackAmount",
				txn.chargebackAmountValue,
			);
			addMoneyToBucket(
				paymentBrandSummary[paymentKey],
				"totalFees",
				txn.totalFees,
			);
			addMoneyToBucket(
				paymentBrandSummary[paymentKey],
				"netSettlement",
				txn.netSettlement,
			);
		}

		if (isDeclineTxn) {
			const countryCategory = normalizeUpper(txn.countryCategory || "ALL");

			const region =
				countryCategory === "NONEU"
					? "NON EU"
					: countryCategory === "EU"
						? "EU"
						: "ALL";

			const declineFeeRate = roundMoney(fee.declineFee || txn.declineFee || 0);

			const declineKey = [brandGroup, currency, region, declineFeeRate].join(
				"__",
			);

			declinedBrandSummary[declineKey] = declinedBrandSummary[declineKey] || {
				brandGroup,
				currency,
				region,
				declineFeeRate,
				txns: 0,
				declineFee: 0,
				netSettlement: 0,
			};

			declinedBrandSummary[declineKey].txns += 1;

			addCountryToBucket(
				declinedBrandSummary[declineKey],
				txn.countryName || txn.isoCountry || txn.countryCode,
			);

			addMoneyToBucket(
				declinedBrandSummary[declineKey],
				"declineFee",
				txn.declineFee,
			);

			addMoneyToBucket(
				declinedBrandSummary[declineKey],
				"netSettlement",
				txn.netSettlement,
			);
		}
		if (isAdjustmentTxn) {
			const adjustmentKey = `${status}__${currency}`;

			adjustmentSummary[adjustmentKey] = adjustmentSummary[adjustmentKey] || {
				status: txn.status,
				currency,
				txns: 0,

				reversalAmount: 0,
				reversalFeeRate: Number(fee.reversalFee || 0),
				reversalFee: 0,

				chargebackAmount: 0,
				chargebackFeeRate: Number(fee.chargebackFee || 0),
				chargebackFee: 0,

				totalDeduction: 0,
				netSettlement: 0,
			};
			const bucket = adjustmentSummary[adjustmentKey];

			if (
				isReversalStatus(status, sourceFileType) &&
				!Number(bucket.reversalFeeRate || 0) &&
				Number(fee.reversalFee || 0)
			) {
				bucket.reversalFeeRate = Number(fee.reversalFee);
			}

			if (
				isChargebackStatus(status, sourceFileType) &&
				!Number(bucket.chargebackFeeRate || 0) &&
				Number(fee.chargebackFee || 0)
			) {
				bucket.chargebackFeeRate = Number(fee.chargebackFee);
			}

			bucket.txns += 1;

			addMoneyToBucket(bucket, "reversalAmount", txn.reversalAmount);
			addMoneyToBucket(bucket, "reversalFee", txn.reversalFee);
			addMoneyToBucket(bucket, "chargebackAmount", txn.chargebackAmountValue);
			addMoneyToBucket(bucket, "chargebackFee", txn.chargebackFee);

			bucket.totalDeduction = sumMoney([
				bucket.reversalAmount, bucket.reversalFee,
				bucket.chargebackAmount, bucket.chargebackFee,
			]);

			addMoneyToBucket(bucket, "netSettlement", txn.netSettlement);
		}

		if (txn.transactionMode) {
			modeSummary[txn.transactionMode] = modeSummary[txn.transactionMode] || {
				mode: txn.transactionMode,
				txns: 0,
			};
			modeSummary[txn.transactionMode].txns += 1;
		}

		if (isSuccessTxn && Number(txn.capturedAmount || 0) > 0) {
			const matchedFeeCountryScope =
				txn.matchedFeeCountryScope || fee.countryScope || "";
			const matchedFeeCountryCode =
				txn.matchedFeeCountryCode || fee.countryCode || "";

			const appliedRateRegion = getAppliedFeeRegionLabel({
				matchedFeeCountryScope,
				matchedFeeCountryCode,
				countryCategory: txn.countryCategory,
			});

			const rateKey = [
				currency,
				brandGroup,
				appliedRateRegion,
				fee.mdrPercent || 0,
				fee.approvalFee || 0,
				fee.declineFee || 0,
				fee.reversalFee || 0,
				fee.chargebackFee || 0,
				fee.rollingReservePercent || 0,
				fee.settlementExpensePercent || 0,
			].join("__");

			feeRateSummary[rateKey] = feeRateSummary[rateKey] || {
				currency,
				brandGroup,

				countryCategory: txn.countryCategory || "ALL",
				countryCode: txn.countryCode || "",
				countryName: txn.countryName || txn.isoCountry || txn.countryCode || "",

				appliedRateRegion,
				matchedFeeCountryScope,
				matchedFeeCountryCode,

				countryNames: [],

				mdrPercent: fee.mdrPercent || 0,
				approvalFeeRate: fee.approvalFee || 0,
				declineFeeRate: fee.declineFee || 0,
				reversalFeeRate: fee.reversalFee || 0,
				chargebackFeeRate: fee.chargebackFee || 0,
				rollingReservePercent: fee.rollingReservePercent || 0,
				settlementExpensePercent: fee.settlementExpensePercent || 0,

				txns: 0,
				capturedAmount: 0,
				reversalAmount: 0,
				chargebackAmount: 0,

				mdrFee: 0,
				approvalFee: 0,
				declineFee: 0,
				reversalFee: 0,
				chargebackFee: 0,
				settlementExpense: 0,
				rollingReserveAmount: 0,
				totalFees: 0,
				netSettlement: 0,
			};

			const rateBucket = feeRateSummary[rateKey];

			addCountryToBucket(
				rateBucket,
				txn.countryName || txn.isoCountry || txn.countryCode,
			);

			rateBucket.txns += 1;
			addMoneyToBucket(rateBucket, "capturedAmount", txn.capturedAmount);
			addMoneyToBucket(rateBucket, "reversalAmount", txn.reversalAmount);
			addMoneyToBucket(
				rateBucket,
				"chargebackAmount",
				txn.chargebackAmountValue,
			);
			addMoneyToBucket(rateBucket, "mdrFee", txn.mdrFee);
			addMoneyToBucket(rateBucket, "approvalFee", txn.approvalFee);
			addMoneyToBucket(rateBucket, "declineFee", txn.declineFee);
			addMoneyToBucket(rateBucket, "reversalFee", txn.reversalFee);
			addMoneyToBucket(rateBucket, "chargebackFee", txn.chargebackFee);
			addMoneyToBucket(rateBucket, "settlementExpense", txn.settlementExpense);
			addMoneyToBucket(
				rateBucket,
				"rollingReserveAmount",
				txn.rollingReserveAmount,
			);
			addMoneyToBucket(rateBucket, "totalFees", txn.totalFees);
			addMoneyToBucket(rateBucket, "netSettlement", txn.netSettlement);
		}

		if (isSuccessTxn || isAdjustmentTxn || isDeclineTxn) {
			const dayKey = `${day}_${currency}`;

			daySummaryMap[dayKey] = daySummaryMap[dayKey] || {
				date: day,
				currency,

				totalTxns: 0,
				successTxns: 0,
				failedTxns: 0,
				adjustmentTxns: 0,

				capturedAmount: 0,
				totalFees: 0,
				netSettlement: 0,
			};

			const bucket = daySummaryMap[dayKey];

			bucket.totalTxns += 1;

			if (isSuccessTxn) {
				bucket.successTxns += 1;
			}

			if (isDeclineTxn) {
				bucket.failedTxns += 1;
			}

			if (isAdjustmentTxn) {
				bucket.adjustmentTxns += 1;
			}

			addMoneyToBucket(bucket, "capturedAmount", txn.capturedAmount);

			addMoneyToBucket(bucket, "totalFees", txn.totalFees);

			addMoneyToBucket(bucket, "netSettlement", txn.netSettlement);
		}
	}

	setMoneyFromCents(summary, summaryCents, Object.keys(summaryCents));

	for (const currencyRow of Object.values(currencySummary)) {
		currencyRow.feesBeforeSettlementExpense = sumMoney([
			currencyRow.mdrFee, currencyRow.approvalFee, currencyRow.declineFee,
			currencyRow.reversalFee, currencyRow.chargebackFee, currencyRow.rollingReserveAmount,
			currencyRow.reversalAmount, currencyRow.chargebackAmount,
		]);
		currencyRow.settlementExpenseBase = sumMoney([
			currencyRow.capturedAmount, -currencyRow.feesBeforeSettlementExpense,
		]);
		currencyRow.settlementExpense = settlementExpenseAmount(
			currencyRow.settlementExpenseBase, currencyRow.settlementExpensePercent,
		);
		currencyRow.totalFees = sumMoney([
			currencyRow.feesBeforeSettlementExpense, currencyRow.settlementExpense,
		]);
		currencyRow.netSettlement = roundMoney(sumMoney([
			currencyRow.capturedAmount, -currencyRow.totalFees,
		]));
	}

	for (const field of ["mdrFee", "feesBeforeSettlementExpense", "settlementExpenseBase",
		"settlementExpense", "totalFees", "netSettlement"]) {
		summary[field] = sumMoney(Object.values(currencySummary).map((row) => row[field]));
	}

	summary.settlementExpensePercent = [
		...new Set(
			Object.values(currencySummary).map((row) =>
				Number(row.settlementExpensePercent || 0),
			),
		),
	].join(", ");

	removeInternalCents(statusSummary);
	removeInternalCents(currencySummary);
	removeInternalCents(paymentBrandSummary);
	removeInternalCents(declinedBrandSummary);
	removeInternalCents(adjustmentSummary);
	removeInternalCents(feeRateSummary);
	removeInternalCents(daySummaryMap);
	return {
		mdrCalculationVersion: MDR_CALCULATION_VERSION,
		merchantName: first?.merchantCompanyName || "Unknown Merchant",
		memberId: first?.memberId || memberId,
		partnerName: first?.partnerName || "",
		reportDate: reportDate || toDate || transactionToDate || new Date(),
		fromDate: fromDate || reportDate || transactionFromDate || null,
		toDate: toDate || reportDate || transactionToDate || null,
		datestampPeriod,
		transactionPeriod: {
			fromDate: fromDate || reportDate || transactionFromDate,
			toDate: toDate || reportDate || transactionToDate,
		},

		summary,
		currencySummary,
		statusSummary,
		modeSummary,
		paymentBrandSummary,
		declinedBrandSummary,
		adjustmentSummary,
		feeRateSummary,
		daySummary: Object.values(daySummaryMap),
	};
};

export const generateMerchantSettlementReport = async (req, res) => {
	const { settlementBatchId, memberId, reportDate, fromDate, toDate } =
		req.body;

	if (!settlementBatchId) {
		return res.status(400).json({
			success: false,
			message: "settlementBatchId is required for manual report generation",
		});
	}

	const reportData = await buildMerchantReportData({
		settlementBatchId,
		memberId,
		reportDate,
		fromDate,
		toDate,
	});

	if (!reportData.summary.totalTransactions) {
		return res.status(400).json({
			success: false,
			message: "No matched settlement transactions found for this report",
		});
	}

	const merchantRefs = await resolveMerchantByMemberId(reportData.memberId);

	const emailRecipients = await getMerchantEmailRecipients({
		merchantId: merchantRefs.merchantId,
		merchantAccountId: merchantRefs.merchantAccountId,
	});

	const finalMerchantName =
		merchantRefs.merchantName || reportData.merchantName || "Unknown Merchant";

	reportData.merchantName = finalMerchantName;

	const report = await MerchantSettlementReport.create({
		settlementBatchId,
		merchantId: merchantRefs.merchantId,
		merchantAccountId: merchantRefs.merchantAccountId,

		merchantName: finalMerchantName,
		memberId: reportData.memberId,
		reportDate: reportData.reportDate,
		fromDate: reportData.fromDate,
		toDate: reportData.toDate,

		summary: reportData.summary,
		currencySummary: reportData.currencySummary,
		statusSummary: reportData.statusSummary,
		brandSummary: reportData.paymentBrandSummary,
		modeSummary: reportData.modeSummary,
		reportData,

		emailRecipients,
		merchantEmail: emailRecipients.map((item) => item.email).join(","),
		emailTo: emailRecipients.map((item) => item.email).join(","),
		emailStatus: "draft",

		createdBy: req.user._id,
	});

	const reportTransactionUpdateQuery = {
		settlementBatchId,
		memberId: reportData.memberId,
		matchStatus: "matched",
	};

	if (reportDate || fromDate || toDate) {
		reportTransactionUpdateQuery.transactionDate =
			getReportDateQuery(reportData);
	}

	await MerchantTransaction.updateMany(reportTransactionUpdateQuery, {
		$set: {
			reportId: report._id,
		},
	});

	return res.status(201).json({
		success: true,
		message: "Merchant settlement report generated successfully",
		data: report,
	});
};

const generateReportsForBatch = async ({ settlementBatchId, userId }) => {
	const groups = await MerchantTransaction.aggregate([
		{
			$match: {
				settlementBatchId: new mongoose.Types.ObjectId(settlementBatchId),
				matchStatus: "matched",
			},
		},
		{
			$group: {
				_id: {
					memberId: "$memberId",
				},
			},
		},
	]);

	const reports = [];

	for (const group of groups) {
		const reportData = await buildMerchantReportData({
			settlementBatchId,
			memberId: group._id.memberId,
		});

		if (!reportData.memberId || reportData.summary.totalTransactions === 0) {
			continue;
		}

		const merchantRefs = await resolveMerchantByMemberId(reportData.memberId);

		const emailRecipients = await getMerchantEmailRecipients({
			merchantId: merchantRefs.merchantId,
			merchantAccountId: merchantRefs.merchantAccountId,
		});

		const report = await MerchantSettlementReport.create({
			settlementBatchId,
			merchantId: merchantRefs.merchantId,
			merchantAccountId: merchantRefs.merchantAccountId,

			merchantName: reportData.merchantName,
			memberId: reportData.memberId,
			reportDate: reportData.reportDate,
			fromDate: reportData.fromDate,
			toDate: reportData.toDate,

			summary: reportData.summary,
			currencySummary: reportData.currencySummary,
			statusSummary: reportData.statusSummary,
			brandSummary: reportData.paymentBrandSummary,
			modeSummary: reportData.modeSummary,
			reportData,

			emailRecipients,
			merchantEmail: emailRecipients.map((x) => x.email).join(","),
			emailTo: emailRecipients.map((x) => x.email).join(","),
			emailStatus: "draft",

			createdBy: userId,
		});

		await MerchantTransaction.updateMany(
			{
				settlementBatchId,
				memberId: reportData.memberId,
				matchStatus: "matched",
			},
			{
				$set: {
					reportId: report._id,
				},
			},
		);

		reports.push(report._id);
	}

	return reports;
};

/*
|--------------------------------------------------------------------------
| Report list / get
|--------------------------------------------------------------------------
*/

const cleanText = (value) =>
	String(value || "")
		.replace(/^'+/g, "")
		.replace(/\s+/g, " ")
		.trim();

const slugify = (value) =>
	cleanText(value)
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");

const formatNumber = (value) =>
	Number(value || 0).toLocaleString("en-US", {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	});

const formatInt = (value) =>
	Number(value || 0).toLocaleString("en-US", {
		maximumFractionDigits: 0,
	});

const formatMoney = (value, currency = "") =>
	`${currency ? `${currency} ` : ""}${formatNumber(value)}`;

const displayCountryCode = (value) => {
	const code = normalizeUpper(value);

	const map = {
		"UNITED KINGDOM": "GB",
		"GREAT BRITAIN": "GB",
		UK: "GB",
		SWITZERLAND: "CH",
		NETHERLANDS: "NL",
		GERMANY: "DE",
		NORWAY: "NO",
		IRELAND: "IE",
		ITALY: "IT",
		SPAIN: "ES",
		FRANCE: "FR",
		TURKEY: "TR",
		KAZAKHSTAN: "KZ",
		JAPAN: "JP",
	};

	return map[code] || code || "-";
};
const shortPaymentMethod = (value) => {
	const text = String(value || "").trim();

	if (text === "Mastercard") return "MC";
	if (text === "Apple Pay") return "Apple";
	if (text === "Google Pay") return "Google";

	return text || "-";
};

const toDisplayCountryName = (value) => {
	const text = normalizeText(value);
	const upper = normalizeUpper(text);

	if (!text || text === "-" || upper === "ALL") return "";

	if (/^[A-Z]{2}$/.test(upper)) {
		try {
			const displayName = new Intl.DisplayNames(["en"], {
				type: "region",
			});

			return displayName.of(upper) || upper;
		} catch {
			const fallback = {
				GB: "United Kingdom",
				UK: "United Kingdom",
				US: "United States",
				DE: "Germany",
				FR: "France",
				NL: "Netherlands",
				ES: "Spain",
				IT: "Italy",
				IE: "Ireland",
				NO: "Norway",
				CH: "Switzerland",
				SE: "Sweden",
				AU: "Australia",
				CA: "Canada",
				BR: "Brazil",
				JP: "Japan",
				TR: "Turkey",
				KZ: "Kazakhstan",
			};

			return fallback[upper] || upper;
		}
	}

	return text.toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
};

const getCountryListText = (countries = []) => {
	const cleanCountries = [
		...new Set(
			(countries || [])
				.map((item) => toDisplayCountryName(item))
				.filter(Boolean),
		),
	];

	if (!cleanCountries.length) return "";

	return `Countries Included: ${cleanCountries.join(", ")}`;
};

const addCountryToBucket = (bucket, countryName) => {
	const displayName = toDisplayCountryName(countryName);

	if (!displayName) return;

	bucket.countryNames = bucket.countryNames || [];

	if (!bucket.countryNames.includes(displayName)) {
		bucket.countryNames.push(displayName);
	}
};

const getAppliedFeeRegionLabel = ({
	matchedFeeCountryScope,
	matchedFeeCountryCode,
	countryCategory,
}) => {
	const scope = normalizeUpper(matchedFeeCountryScope || "");
	const code = normalizeUpper(matchedFeeCountryCode || "");
	const category = normalizeUpper(countryCategory || "ALL");

	if (scope === "COUNTRY" && code) {
		return `${toDisplayCountryName(code)} (${code})`;
	}

	if (scope === "EU" || category === "EU") return "EU";

	if (scope === "NONEU" || category === "NONEU") return "NON EU";

	return "ALL";
};

const buildFeeRateDisplayRows = (feeRateSummary = {}) =>
	Object.values(feeRateSummary).map((row) => ({
		paymentMethod: row.brandGroup,
		region: row.appliedRateRegion || row.countryCategory || "ALL",
		code: displayCountryCode(row.matchedFeeCountryCode || row.countryCode),
		countryName: row.countryName || "",
		countryNames: row.countryNames || [],
		currency: row.currency,

		txns: row.txns || 0,

		mdrPercent: row.mdrPercent || 0,
		approvalFeeRate: row.approvalFeeRate || 0,
		declineFeeRate: row.declineFeeRate || 0,
		reversalFeeRate: row.reversalFeeRate || 0,
		chargebackFeeRate: row.chargebackFeeRate || 0,
		rollingReservePercent: row.rollingReservePercent || 0,
		settlementExpensePercent: row.settlementExpensePercent || 0,

		capturedAmount: row.capturedAmount || 0,
		mdrFee: row.mdrFee || 0,
		approvalFee: row.approvalFee || 0,
		declineFee: row.declineFee || 0,
		reversalFee: row.reversalFee || 0,
		chargebackFee: row.chargebackFee || 0,
		rollingReserveAmount: row.rollingReserveAmount || 0,
		settlementExpense: row.settlementExpense || 0,
		totalFees: row.totalFees || 0,
		netSettlement: row.netSettlement || 0,
	}));

const safeSheetName = (name) =>
	String(name || "Sheet")
		.replace(/[\\/?*[\]:]/g, "")
		.slice(0, 31);

const getPrimaryCurrency = (report) =>
	Object.keys(report.currencySummary || {})[0] || "";

const getReportDateQuery = (report) => {
	const period = getReportTransactionPeriod(report);
	if (period.fromDate || period.toDate) {
		const query = {};

		if (period.fromDate) {
			query.$gte = startOfDate(period.fromDate);
		}

		if (period.toDate) {
			query.$lte = endOfDate(period.toDate);
		}

		return query;
	}

	return getDateRange(report.reportDate);
};

export const getReportTransactionQuery = (report, matchStatus = "matched") => {
	const query = {
		memberId: report.memberId,
		matchStatus,
	};

	if (report.settlementBatchId) {
		query.settlementBatchId = report.settlementBatchId._id || report.settlementBatchId;
	}

	if (matchStatus === "matched" && report._id) {
		query.$or = [
			{ reportId: report._id },
			{
				memberId: report.memberId,
				transactionDate: getReportDateQuery(report),
			},
		];
	} else {
		query.transactionDate = getReportDateQuery(report);
	}

	return query;
};

export const refreshSettlementMdr = async (report) => {
	if (report.reportData?.mdrCalculationVersion === MDR_CALCULATION_VERSION ||
		report.mdrCalculationVersion === MDR_CALCULATION_VERSION) return report;
	if (!report._id || !report.settlementBatchId || !report.memberId) return report;
	const data = await buildMerchantReportData({
		settlementBatchId: report.settlementBatchId._id || report.settlementBatchId,
		memberId: report.memberId, reportId: report._id,
	});
	const rateVolumes = (rows) => {
		const groups = {};
		for (const row of Object.values(rows || {})) {
			const key = JSON.stringify([row.currency, row.brandGroup,
				row.appliedRateRegion || row.countryCategory || "ALL", Number(row.mdrPercent || 0)]);
			groups[key] = sumMoney([groups[key] || 0, row.capturedAmount]);
		}
		return groups;
	};
	const savedRates = rateVolumes(report.reportData?.feeRateSummary);
	const currentRates = rateVolumes(data.feeRateSummary);
	if (Object.keys(savedRates).length &&
		(Object.keys(savedRates).length !== Object.keys(currentRates).length ||
			Object.entries(savedRates).some(([key, amount]) => moneyUnits(amount) !== moneyUnits(currentRates[key])))) {
		settlementDownloadError("Cannot refresh MDR: configured rates differ from the saved report. Review the rates and regenerate this report.", 409);
	}
	// A read must never silently change the saved transaction scope or other fees.
	const preservedFields = ["capturedAmount", "reversalAmount", "chargebackAmount", "approvalFee",
		"declineFee", "reversalFee", "chargebackFee", "rollingReserveAmount",
		"txns", "successTxns", "failedTxns", "adjustmentTxns", "settlementExpensePercent"];
	if (data.summary.totalTransactions !== report.summary?.totalTransactions ||
		Object.keys(data.currencySummary).length !== Object.keys(report.currencySummary || {}).length ||
		Object.entries(data.currencySummary).some(([currency, row]) => !report.currencySummary?.[currency] ||
			preservedFields.some((field) => moneyUnits(row[field]) !== moneyUnits(report.currencySummary[currency][field])))) {
		settlementDownloadError("Cannot refresh MDR: saved report transactions or non-MDR charges have changed. Regenerate this report.", 409);
	}
	return {
		...report, summary: data.summary, currencySummary: data.currencySummary,
		statusSummary: data.statusSummary, brandSummary: data.paymentBrandSummary, modeSummary: data.modeSummary,
		reportData: { ...report.reportData, ...data,
			transactionPeriod: getReportTransactionPeriod(report),
			fromDate: report.fromDate, toDate: report.toDate, reportDate: report.reportDate },
	};
};

const withDatestampReportPeriods = async (reports) => {
	const refreshed = [];
	for (const report of reports) refreshed.push(await refreshSettlementMdr(report));
	return resolveDatestampReportPeriods(refreshed, {
		Transaction: MerchantTransaction, getTransactionQuery: getReportTransactionQuery,
	});
};

export const listMerchantSettlementReports = async (req, res) => {
	const {
		search,
		settlementBatchId,
		emailStatus,
		page = 1,
		limit = 50,
	} = req.query;

	const pageNumber = Math.max(Number(page) || 1, 1);
	const limitNumber = Math.min(Math.max(Number(limit) || 50, 1), 500);

	const skip = (pageNumber - 1) * limitNumber;

	const query = {};

	if (settlementBatchId) {
		query.settlementBatchId = settlementBatchId;
	}

	if (emailStatus) {
		query.emailStatus = emailStatus;
	}

	if (search) {
		const regex = new RegExp(String(search).trim(), "i");

		query.$or = [
			{ merchantName: regex },
			{ memberId: regex },
			{ emailTo: regex },
		];
	}

	const [data, total] = await Promise.all([
		MerchantSettlementReport.find(query)
			.populate(
				"settlementBatchId",
				"batchName reportDate fromDate toDate status",
			)
			.sort({ createdAt: -1 })
			.skip(skip)
			.limit(limitNumber)
			.lean(),

		MerchantSettlementReport.countDocuments(query),
	]);
	const reports = await withDatestampReportPeriods(data);

	return res.json({
		success: true,

		data: reports,

		meta: {
			total,
			page: pageNumber,
			limit: limitNumber,
			totalPages: Math.ceil(total / limitNumber),
		},
	});
};

export const getMerchantSettlementReport = async (req, res) => {
	const report = await MerchantSettlementReport.findById(req.params.id).lean();

	if (!report) {
		return res.status(404).json({
			success: false,
			message: "Report not found",
		});
	}

	return res.json({
		success: true,
		data: (await withDatestampReportPeriods([report]))[0],
	});
};

const drawPdfTable = ({
	doc,
	FONT,
	title,
	columns,
	rows,
	fontSize = 7.5,
	minRowHeight = 27,
	headerHeight = 27,
	rowPaddingY = 7,
}) => {
	if (!rows?.length) return;

	const C = {
		primary: "#1234BC",
		text: "#191C1E",
		border: "#C5CDDC",
		header: "#EEF2FF",
		alternate: "#F7F9FC",
		white: "#FFFFFF",
	};

	const margin = doc.page.margins.left;
	const usableWidth = doc.page.width - margin * 2;
	const bottomLimit = doc.page.height - 55;

	const totalWidth = columns.reduce((sum, column) => sum + column.width, 0);

	if (totalWidth > usableWidth + 1) {
		throw new Error(`PDF table "${title}" exceeds page width`);
	}

	const regular = FONT?.regular || "Helvetica";
	const bold = FONT?.semiBold || "Helvetica-Bold";

	const getValue = (row, column) =>
		typeof column.value === "function" ? column.value(row) : row[column.key];

	const getRowHeight = (row) => {
		let height = minRowHeight;

		for (const column of columns) {
			const value = String(getValue(row, column) ?? "-");

			doc.font(row._bold || column.bold ? bold : regular).fontSize(fontSize);

			const textHeight = doc.heightOfString(value, {
				width: column.width - 16,
				lineGap: 1,
			});

			height = Math.max(height, textHeight + rowPaddingY * 2);
		}

		return Math.ceil(height);
	};

	const drawTitle = (continued = false) => {
		const y = doc.y + 7;

		doc
			.font(bold)
			.fontSize(11)
			.fillColor(C.text)
			.text(continued ? `${title} (continued)` : title, margin, y, {
				width: usableWidth,
				lineBreak: false,
			});

		doc.y = y + 22;
	};

	const drawHeader = () => {
		const y = doc.y;

		// Square header: no rounded corners
		doc.rect(margin, y, totalWidth, headerHeight).fill(C.header);

		let x = margin;

		columns.forEach((column) => {
			const align = column.align || "left";

			doc
				.font(bold)
				.fontSize(Math.min(fontSize, 7.1))
				.fillColor(C.primary)
				.text(column.label, x + 8, y + 9, {
					width: column.width - 16,
					align,
					lineBreak: false,
				});

			x += column.width;
		});

		doc.y = y + headerHeight;
	};

	let gridTop = 0;
	let horizontalLines = [];
	let rowIndex = 0;

	// Draw the entire grid only once per page.
	// This prevents overlapping or double borders.
	const drawGrid = () => {
		const gridBottom = doc.y;

		doc.lineWidth(0.55).strokeColor(C.border);

		// Outer border
		doc.rect(margin, gridTop, totalWidth, gridBottom - gridTop).stroke();

		// Internal vertical boundaries
		let x = margin;

		columns.slice(0, -1).forEach((column) => {
			x += column.width;

			doc.moveTo(x, gridTop).lineTo(x, gridBottom).stroke();
		});

		// Internal horizontal boundaries
		horizontalLines.forEach((y) => {
			doc
				.moveTo(margin, y)
				.lineTo(margin + totalWidth, y)
				.stroke();
		});
	};

	const startTable = (continued = false) => {
		drawTitle(continued);
		gridTop = doc.y;
		drawHeader();

		horizontalLines = [doc.y];
	};

	if (doc.y + 90 > bottomLimit) {
		doc.addPage();
		doc.y = 42;
	}

	startTable();

	for (const row of rows) {
		const rowHeight = getRowHeight(row);

		if (doc.y + rowHeight > bottomLimit) {
			drawGrid();

			doc.addPage();
			doc.y = 42;

			startTable(true);
		}

		const y = doc.y;

		const fill = row._highlight
			? C.header
			: rowIndex % 2 === 0
				? C.white
				: C.alternate;

		doc.rect(margin, y, totalWidth, rowHeight).fill(fill);

		let x = margin;

		columns.forEach((column) => {
			const value = String(getValue(row, column) ?? "-");
			const align = column.align || "left";

			doc
				.font(row._bold || column.bold ? bold : regular)
				.fontSize(fontSize)
				.fillColor(column.highlight ? C.primary : C.text)
				.text(value, x + 8, y + rowPaddingY, {
					width: column.width - 16,
					align,
					lineGap: 1,
					height: Math.max(1, rowHeight - rowPaddingY * 2),
					ellipsis: true,
				});

			x += column.width;
		});

		doc.y = y + rowHeight;
		horizontalLines.push(doc.y);
		rowIndex++;
	}

	// Last horizontal boundary is already part
	// of the outer border.
	horizontalLines.pop();

	drawGrid();

	doc.y += 13;
};

const getReportFonts = () => {
	const fontDir = path.resolve(process.cwd(), "assets/fonts");

	const regular = path.join(fontDir, "Poppins-Regular.ttf");
	const medium = path.join(fontDir, "Poppins-Medium.ttf");
	const semiBold = path.join(fontDir, "Poppins-SemiBold.ttf");
	const bold = path.join(fontDir, "Poppins-Bold.ttf");

	const hasPoppins =
		fs.existsSync(regular) && fs.existsSync(semiBold) && fs.existsSync(bold);

	return {
		hasPoppins,
		regular,
		medium: fs.existsSync(medium) ? medium : semiBold,
		semiBold,
		bold,
	};
};

const registerReportFonts = (doc) => {
	const fonts = getReportFonts();

	if (!fonts.hasPoppins) {
		return {
			regular: "Helvetica",
			medium: "Helvetica-Bold",
			semiBold: "Helvetica-Bold",
			bold: "Helvetica-Bold",
		};
	}

	doc.registerFont("Poppins", fonts.regular);
	doc.registerFont("Poppins-Medium", fonts.medium);
	doc.registerFont("Poppins-SemiBold", fonts.semiBold);
	doc.registerFont("Poppins-Bold", fonts.bold);

	return {
		regular: "Poppins",
		medium: "Poppins-Medium",
		semiBold: "Poppins-SemiBold",
		bold: "Poppins-Bold",
	};
};

const drawInfoBox = ({ doc, FONT, title, lines, color = "#eff6ff" }) => {
	const margin = doc.page.margins?.left || 30;
	const usableWidth = doc.page.width - margin * 2;
	const height = 58 + lines.length * 13;

	if (doc.y + height > doc.page.height - 58) {
		doc.addPage();
		doc.y = 42;
	}

	const y = doc.y;

	doc
		.roundedRect(margin, y, usableWidth, height, 8)
		.fill(color)
		.strokeColor("#dbeafe")
		.stroke();

	doc
		.fillColor("#111827")
		.font(FONT.semiBold)
		.fontSize(11)
		.text(title, margin + 14, y + 12, {
			width: usableWidth - 28,
		});

	let lineY = y + 32;

	for (const line of lines) {
		doc
			.fillColor("#374151")
			.font(FONT.regular)
			.fontSize(8)
			.text(line, margin + 14, lineY, {
				width: usableWidth - 28,
			});

		lineY += 13;
	}

	doc.y = y + height + 12;
};

const uniqueRateList = (values, formatter) => {
	const list = [
		...new Set(
			values
				.map((value) => Number(value || 0))
				.filter((value) => Number.isFinite(value)),
		),
	];

	if (!list.length) return "-";

	return list.map(formatter).join(", ");
};

const getFeeRegionLabel = (region) => {
	const value = normalizeUpper(region || "ALL");

	if (value === "NONEU") return "NON EU";
	if (value === "EU") return "EU";
	if (value === "ALL") return "ALL";

	return value;
};

const buildFinalSettlementRowsByCurrency = (currencyRow) => [
	{
		description: "Success Amount",
		amount: formatMoney(currencyRow.capturedAmount, currencyRow.currency),
		_bold: true,
	},
	{
		description: "Less: MDR Fee",
		amount: `-${formatMoney(currencyRow.mdrFee, currencyRow.currency)}`,
	},
	{
		description: "Less: Approval Fees",
		amount: `-${formatMoney(currencyRow.approvalFee, currencyRow.currency)}`,
	},
	{
		description: "Less: Decline Fees",
		amount: `-${formatMoney(currencyRow.declineFee, currencyRow.currency)}`,
	},
	{
		description: "Less: Reversal Amount",
		amount: `-${formatMoney(currencyRow.reversalAmount, currencyRow.currency)}`,
	},
	{
		description: "Less: Reversal Fees",
		amount: `-${formatMoney(currencyRow.reversalFee, currencyRow.currency)}`,
	},
	{
		description: "Less: Chargeback Amount",
		amount: `-${formatMoney(currencyRow.chargebackAmount, currencyRow.currency)}`,
	},
	{
		description: "Less: Chargeback Fees",
		amount: `-${formatMoney(currencyRow.chargebackFee, currencyRow.currency)}`,
	},
	{
		description: "Less: Rolling Reserve",
		amount: `-${formatMoney(
			currencyRow.rollingReserveAmount,
			currencyRow.currency,
		)}`,
	},
	{
		description: "Subtotal Before Settlement Expense",
		amount: formatMoney(
			currencyRow.settlementExpenseBase,
			currencyRow.currency,
		),
		_highlight: true,
	},
	{
		description: `Less: Settlement Expense (${formatNumber(
			currencyRow.settlementExpensePercent || 0,
		)}%)`,
		amount: `-${formatMoney(
			currencyRow.settlementExpense,
			currencyRow.currency,
		)}`,
	},
	{
		description: "Net Payable",
		amount: formatMoney(currencyRow.netSettlement, currencyRow.currency),
		_bold: true,
		_highlight: true,
	},
];

const ensurePdfSpace = (doc, height) => {
	if (doc.y + height > doc.page.height - 58) {
		doc.addPage();
		doc.y = 42;
	}
};

const drawSmallLabelValue = ({
	doc,
	FONT,
	label,
	value,
	x,
	y,
	width,
	align = "left",
	bold = false,
}) => {
	doc
		.fillColor("#6b7280")
		.font(FONT.regular)
		.fontSize(6.5)
		.text(String(label || "").toUpperCase(), x, y, {
			width,
			align,
			lineBreak: false,
		});

	doc
		.fillColor("#111827")
		.font(bold ? FONT.bold : FONT.semiBold)
		.fontSize(8)
		.text(String(value ?? "-"), x, y + 11, {
			width,
			align,
			lineBreak: false,
		});
};

const drawPill = ({ doc, FONT, text, x, y, width }) => {
	doc
		.roundedRect(x, y, width, 18, 9)
		.fill("#f3f4f6")
		.strokeColor("#e5e7eb")
		.stroke();

	doc
		.fillColor("#374151")
		.font(FONT.medium)
		.fontSize(6.5)
		.text(String(text || "-"), x + 8, y + 5, {
			width: width - 16,
			lineBreak: false,
		});
};

const drawChargeBreakdownCard = ({
	doc,
	FONT,
	title,
	subtitle,
	stats = [],
	rates = [],
	charges = [],
	note = "",
	accent = "#1234bc",
}) => {
	const margin = doc.page.margins?.left || 30;
	const usableWidth = doc.page.width - margin * 2;

	const chargeLineHeight = 18;
	const noteText = normalizeText(note);

	doc.font(FONT.regular).fontSize(7);

	const noteHeight = noteText
		? doc.heightOfString(noteText, {
				width: usableWidth - 52,
				lineGap: 1,
			}) + 18
		: 0;

	const height =
		92 +
		noteHeight +
		Math.ceil(rates.length / 3) * 24 +
		charges.length * chargeLineHeight;

	ensurePdfSpace(doc, height + 10);

	const y = doc.y;

	doc
		.roundedRect(margin, y, usableWidth, height, 8)
		.fill("#ffffff")
		.strokeColor("#e5e7eb")
		.stroke();

	doc.rect(margin, y, 5, height).fill(accent);

	doc
		.fillColor("#111827")
		.font(FONT.bold)
		.fontSize(11)
		.text(title, margin + 14, y + 12, {
			width: usableWidth - 28,
			lineBreak: false,
		});

	doc
		.fillColor("#6b7280")
		.font(FONT.regular)
		.fontSize(7)
		.text(subtitle, margin + 14, y + 29, {
			width: usableWidth - 28,
			lineBreak: false,
		});

	const statY = y + 48;
	const statWidth = (usableWidth - 28) / Math.max(stats.length, 1);

	stats.forEach((item, index) => {
		drawSmallLabelValue({
			doc,
			FONT,
			label: item.label,
			value: item.value,
			x: margin + 14 + index * statWidth,
			y: statY,
			width: statWidth - 8,
			align: item.align || "left",
			bold: item.bold,
		});
	});

	let rateY = y + 82;

	if (noteText) {
		const noteY = y + 76;

		doc
			.roundedRect(margin + 14, noteY, usableWidth - 28, noteHeight, 6)
			.fill("#f8fafc")
			.strokeColor("#e5e7eb")
			.stroke();

		doc
			.fillColor("#374151")
			.font(FONT.regular)
			.fontSize(7)
			.text(noteText, margin + 26, noteY + 8, {
				width: usableWidth - 52,
				lineGap: 1,
			});

		rateY = noteY + noteHeight + 8;
	}
	const pillGap = 6;
	const pillWidth = (usableWidth - 28 - pillGap * 2) / 3;

	rates.forEach((rate, index) => {
		const col = index % 3;
		const row = Math.floor(index / 3);

		drawPill({
			doc,
			FONT,
			text: rate,
			x: margin + 14 + col * (pillWidth + pillGap),
			y: rateY + row * 24,
			width: pillWidth,
		});
	});

	const chargeStartY = rateY + Math.ceil(rates.length / 3) * 24 + 4;

	doc.rect(margin + 14, chargeStartY, usableWidth - 28, 20).fill("#1234bc");

	doc
		.fillColor("#ffffff")
		.font(FONT.semiBold)
		.fontSize(7)
		.text("Charge Type", margin + 22, chargeStartY + 6, {
			width: usableWidth * 0.26,
		})
		.text("Basis", margin + usableWidth * 0.36, chargeStartY + 6, {
			width: usableWidth * 0.22,
			align: "right",
		})
		.text("Rate", margin + usableWidth * 0.6, chargeStartY + 6, {
			width: usableWidth * 0.16,
			align: "right",
		})
		.text("Amount", margin + usableWidth * 0.78, chargeStartY + 6, {
			width: usableWidth * 0.18,
			align: "right",
		});

	let lineY = chargeStartY + 24;

	charges.forEach((charge) => {
		doc
			.fillColor("#111827")
			.font(FONT.semiBold)
			.fontSize(7)
			.text(charge.type, margin + 22, lineY, {
				width: usableWidth * 0.26,
			})
			.font(FONT.regular)
			.text(charge.basis, margin + usableWidth * 0.36, lineY, {
				width: usableWidth * 0.22,
				align: "right",
			})
			.text(charge.rate, margin + usableWidth * 0.6, lineY, {
				width: usableWidth * 0.16,
				align: "right",
			})
			.font(charge.bold ? FONT.bold : FONT.semiBold)
			.text(charge.amount, margin + usableWidth * 0.78, lineY, {
				width: usableWidth * 0.18,
				align: "right",
			});

		lineY += chargeLineHeight;
	});

	doc.y = y + height + 12;
};

const getPdfCountryCode = (row = {}) => {
	const code = normalizeUpper(row.code || row.countryCode || "");

	if (!code || code === "-" || code === "ALL") return "";

	return code;
};

const getRegionCountryLabel = (region, countryCode) => {
	if (!countryCode) return region || "ALL";

	return `${region || "ALL"} / ${countryCode}`;
};

const buildDetailedBrandSections = ({
	feeRateSummary = {},
	declinedBrandSummary = {},
}) => {
	const sectionMap = new Map();

	const regionOrder = {
		EU: 1,
		"NON EU": 2,
		ALL: 99,
	};

	const getSection = (paymentMethod) => {
		const name = paymentMethod || "Other";

		if (!sectionMap.has(name)) {
			sectionMap.set(name, {
				paymentMethod: name,
				successMap: new Map(),
				declineMap: new Map(),
			});
		}

		return sectionMap.get(name);
	};

	for (const row of buildFeeRateDisplayRows(feeRateSummary).filter(
		(item) => Number(item.capturedAmount || 0) > 0,
	)) {
		const section = getSection(row.paymentMethod);
		const region = row.region || "ALL";

		// Important: no countryCode in this key.
		// This reduces PDF size by grouping same-rate countries together.
		const successKey = [
			row.currency,
			region,
			row.mdrPercent || 0,
			row.approvalFeeRate || 0,
			row.rollingReservePercent || 0,
		].join("__");

		if (!section.successMap.has(successKey)) {
			section.successMap.set(successKey, {
				paymentMethod: row.paymentMethod,
				currency: row.currency,
				region,

				txns: 0,
				capturedAmount: 0,

				mdrPercent: row.mdrPercent || 0,
				approvalFeeRate: row.approvalFeeRate || 0,
				rollingReservePercent: row.rollingReservePercent || 0,

				mdrFee: 0,
				approvalFee: 0,
				rollingReserveAmount: 0,
				totalFees: 0,
				netSettlement: 0,

				countryNames: [],
			});
		}

		const bucket = section.successMap.get(successKey);

		bucket.txns += Number(row.txns || 0);

		for (const country of row.countryNames || []) {
			addCountryToBucket(bucket, country);
		}

		addCountryToBucket(bucket, row.countryName || row.code);

		addMoneyToBucket(bucket, "capturedAmount", row.capturedAmount);
		addMoneyToBucket(bucket, "mdrFee", row.mdrFee);
		addMoneyToBucket(bucket, "approvalFee", row.approvalFee);
		addMoneyToBucket(bucket, "rollingReserveAmount", row.rollingReserveAmount);
	}

	for (const row of Object.values(declinedBrandSummary || {})) {
		const section = getSection(row.brandGroup);
		const region = getFeeRegionLabel(row.region || "ALL");

		const declineFeeRate =
			row.declineFeeRate ??
			(row.txns ? roundMoney(Number(row.declineFee || 0) / row.txns) : 0);

		const declineKey = [row.currency, region, declineFeeRate].join("__");

		if (!section.declineMap.has(declineKey)) {
			section.declineMap.set(declineKey, {
				paymentMethod: row.brandGroup,
				currency: row.currency,
				region,

				txns: 0,
				declineFeeRate,
				declineFee: 0,
				netSettlement: 0,

				countryNames: [],
			});
		}

		const bucket = section.declineMap.get(declineKey);

		bucket.txns += Number(row.txns || 0);

		for (const country of row.countryNames || []) {
			addCountryToBucket(bucket, country);
		}

		addMoneyToBucket(bucket, "declineFee", row.declineFee);
		addMoneyToBucket(bucket, "netSettlement", row.netSettlement);
	}

	return [...sectionMap.values()]
		.sort((a, b) =>
			String(a.paymentMethod || "").localeCompare(
				String(b.paymentMethod || ""),
				undefined,
				{
					sensitivity: "base",
				},
			),
		)
		.map((section) => {
			const successRows = [...section.successMap.values()]
				.map((row) => {
					const totalFeesCents =
						toCents(row.mdrFee || 0) +
						toCents(row.approvalFee || 0) +
						toCents(row.rollingReserveAmount || 0);

					row.totalFees = fromCents(totalFeesCents);

					row.netSettlement = fromCents(
						toCents(row.capturedAmount || 0) - totalFeesCents,
					);

					delete row._units;

					row.countryNote = getCountryListText(row.countryNames);

					return row;
				})
				.sort((a, b) => {
					const currencyCompare = String(a.currency || "").localeCompare(
						String(b.currency || ""),
					);

					if (currencyCompare) return currencyCompare;

					return (regionOrder[a.region] || 99) - (regionOrder[b.region] || 99);
				});

			const declineRows = [...section.declineMap.values()]
				.map((row) => {
					delete row._units;

					row.countryNote = getCountryListText(row.countryNames);

					return row;
				})
				.sort((a, b) => {
					const currencyCompare = String(a.currency || "").localeCompare(
						String(b.currency || ""),
					);

					if (currencyCompare) return currencyCompare;

					return (regionOrder[a.region] || 99) - (regionOrder[b.region] || 99);
				});

			return {
				paymentMethod: section.paymentMethod,
				successRows,
				declineRows,
			};
		});
};

const buildCurrencyFinalCharges = (row) => [
	{
		type: "Success Amount",
		basis: "Successful captured amount",
		rate: "-",
		amount: formatMoney(row.capturedAmount || 0, row.currency),
		bold: true,
	},
	{
		type: "MDR Fee",
		basis: "Shown above by brand / region",
		rate: "-",
		amount: `-${formatMoney(row.mdrFee || 0, row.currency)}`,
	},
	{
		type: "Approval Fees",
		basis: "Shown above by brand / region",
		rate: "-",
		amount: `-${formatMoney(row.approvalFee || 0, row.currency)}`,
	},
	{
		type: "Decline Fees",
		basis: "Failed transactions",
		rate: "-",
		amount: `-${formatMoney(row.declineFee || 0, row.currency)}`,
	},
	{
		type: "Reversal Amount",
		basis: "Reversed transaction amount",
		rate: "-",
		amount: `-${formatMoney(row.reversalAmount || 0, row.currency)}`,
	},
	{
		type: "Reversal Fees",
		basis: "Fixed reversal fee",
		rate: "-",
		amount: `-${formatMoney(row.reversalFee || 0, row.currency)}`,
	},
	{
		type: "Chargeback Amount",
		basis: "Chargeback transaction amount",
		rate: "-",
		amount: `-${formatMoney(row.chargebackAmount || 0, row.currency)}`,
	},
	{
		type: "Chargeback Fees",
		basis: "Fixed chargeback fee",
		rate: "-",
		amount: `-${formatMoney(row.chargebackFee || 0, row.currency)}`,
	},
	{
		type: "Rolling Reserve",
		basis: "Shown above by brand / region",
		rate: "-",
		amount: `-${formatMoney(row.rollingReserveAmount || 0, row.currency)}`,
	},
	{
		type: "Subtotal Before Settlement Expense",
		basis: "-",
		rate: "-",
		amount: formatMoney(row.settlementExpenseBase || 0, row.currency),
		bold: true,
	},
	{
		type: "Settlement Expense",
		basis: formatMoney(row.settlementExpenseBase || 0, row.currency),
		rate: `${formatNumber(row.settlementExpensePercent || 0)}%`,
		amount: `-${formatMoney(row.settlementExpense || 0, row.currency)}`,
	},
	{
		type: "Net Payable",
		basis: "-",
		rate: "-",
		amount: formatMoney(row.netSettlement || 0, row.currency),
		bold: true,
	},
];

const getNonZeroCurrencyComponentText = (currencySummary = {}, field) => {
	const rows = Object.values(currencySummary || {}).filter(
		(row) => Number(row[field] || 0) !== 0,
	);

	if (!rows.length) return "0.00";

	return rows.map((row) => formatMoney(row[field], row.currency)).join(" / ");
};

const getCurrencyWiseLabel = (currencySummary = {}) => {
	const currencies = Object.keys(currencySummary || {}).filter(Boolean);

	if (currencies.length <= 1) return currencies[0] || "-";

	return "Shown currency-wise";
};

const cleanCountryNote = (countryNote = "") =>
	normalizeText(countryNote).replace(/^Countries Included:\s*/i, "") || "-";

const getAdjustmentAmount = (row = {}) =>
	roundMoney(
		Number(row.reversalAmount || 0) +
			Number(row.reversalFee || 0) +
			Number(row.chargebackAmount || 0) +
			Number(row.chargebackFee || 0),
	);

const getCurrencyStatementRows = (currencySummary = {}) =>
	Object.values(currencySummary || {}).map((row) => {
		const adjustments = getAdjustmentAmount(row);

		return {
			currency: row.currency,
			successAmount: row.capturedAmount || 0,
			mdrFee: row.mdrFee || 0,
			approvalFee: row.approvalFee || 0,
			rollingReserveAmount: row.rollingReserveAmount || 0,
			declineFee: row.declineFee || 0,
			adjustments,
			settlementExpenseText: `${formatMoney(
				row.settlementExpense || 0,
				row.currency,
			)} (${formatNumber(row.settlementExpensePercent || 0)}%)`,
			totalDeductions: row.totalFees || 0,
			netSettlement: row.netSettlement || 0,
		};
	});

const getPaymentChargeRows = (sections = []) =>
	sections.flatMap((section) =>
		(section.successRows || []).map((row) => {
			const totalChargesCents =
				toCents(row.mdrFee || 0) +
				toCents(row.approvalFee || 0) +
				toCents(row.rollingReserveAmount || 0);

			return {
				brand: section.paymentMethod,
				currency: row.currency,
				region: row.region,
				countries: cleanCountryNote(row.countryNote),

				txns: row.txns || 0,
				volume: row.capturedAmount || 0,

				mdrRate: row.mdrPercent || 0,
				mdrFee: row.mdrFee || 0,

				approvalRate: row.approvalFeeRate || 0,
				approvalFee: row.approvalFee || 0,

				rrRate: row.rollingReservePercent || 0,
				rrAmount: row.rollingReserveAmount || 0,

				totalCharges: fromCents(totalChargesCents),

				netSettlement: fromCents(
					toCents(row.capturedAmount || 0) - totalChargesCents,
				),
			};
		}),
	);

const getPaymentChargeRowsGroupedByCurrency = (sections = []) => {
	const grouped = {};

	for (const row of getPaymentChargeRows(sections)) {
		const currency = row.currency || "UNKNOWN";

		grouped[currency] = grouped[currency] || [];
		grouped[currency].push(row);
	}

	return Object.entries(grouped)
		.sort(([currencyA], [currencyB]) =>
			String(currencyA).localeCompare(String(currencyB)),
		)
		.map(([currency, rows]) => ({
			currency,
			rows: rows.sort((a, b) => {
				const brandCompare = String(a.brand || "").localeCompare(
					String(b.brand || ""),
					undefined,
					{ sensitivity: "base" },
				);

				if (brandCompare) return brandCompare;

				return String(a.region || "").localeCompare(String(b.region || ""));
			}),
		}));
};

const getChargedDeclineRows = (sections = []) =>
	sections.flatMap((section) =>
		(section.declineRows || [])
			.filter(
				(row) =>
					Number(row.declineFeeRate || 0) > 0 ||
					Number(row.declineFee || 0) > 0,
			)
			.map((row) => ({
				brand: section.paymentMethod,
				currency: row.currency,
				region: row.region,
				countries: cleanCountryNote(row.countryNote),
				failedTxns: row.txns || 0,
				declineFeeRate: row.declineFeeRate || 0,
				declineFee: row.declineFee || 0,
				netImpact: row.netSettlement || 0,
			})),
	);

const getNoDeclineFeeRows = (sections = []) =>
	sections.flatMap((section) =>
		(section.declineRows || [])
			.filter(
				(row) =>
					Number(row.txns || 0) > 0 &&
					Number(row.declineFeeRate || 0) === 0 &&
					Number(row.declineFee || 0) === 0,
			)
			.map((row) => ({
				brand: section.paymentMethod,
				currency: row.currency,
				region: row.region,
				countries: cleanCountryNote(row.countryNote),
				failedTxns: row.txns || 0,
				charged: 0,
			})),
	);

const getAllDeclineRateRows = (sections = []) =>
	sections.flatMap((section) =>
		(section.declineRows || []).map((row) => ({
			brand: section.paymentMethod,
			currency: row.currency,
			region: row.region,
			countries: cleanCountryNote(row.countryNote),
			failedTxns: row.txns || 0,
			declineFeeRate: row.declineFeeRate || 0,
			declineFee: row.declineFee || 0,
		})),
	);

const getRateCoverageRows = (sections = []) =>
	getPaymentChargeRows(sections).map((row) => ({
		brand: row.brand,
		currency: row.currency,
		region: row.region,
		countries: row.countries,
		mdrRate: row.mdrRate,
		approvalRate: row.approvalRate,
		rrRate: row.rrRate,
	}));

const getSettlementExpenseRows = (currencySummary = {}) =>
	Object.values(currencySummary || {}).map((row) => ({
		currency: row.currency,
		calculationBase: row.settlementExpenseBase || 0,
		rate: row.settlementExpensePercent || 0,
		amount: row.settlementExpense || 0,
	}));

// const getFinalSettlementRows = (currencySummary = {}) =>
// 	Object.values(currencySummary || {})
// 		.map((row) => {
// 			const settledActivity = row.capturedAmount || 0;

// 			const adjustmentAmount = fromCents(
// 				toCents(row.reversalAmount || 0) + toCents(row.chargebackAmount || 0),
// 			);

// 			const paymentFees = fromCents(
// 				toCents(row.mdrFee || 0) +
// 					toCents(row.approvalFee || 0) +
// 					toCents(row.rollingReserveAmount || 0),
// 			);

// 			const otherFees = fromCents(
// 				toCents(row.declineFee || 0) +
// 					toCents(row.reversalAmount || 0) +
// 					toCents(row.reversalFee || 0) +
// 					toCents(row.chargebackAmount || 0) +
// 					toCents(row.chargebackFee || 0),
// 			);

// 			const feesCharged = fromCents(toCents(paymentFees) + toCents(otherFees));

// 			return {
// 				currency: row.currency,

// 				settledActivity,
// 				adjustmentAmount,
// 				paymentCharges: paymentFees,
// 				otherCharges: otherFees,
// 				feesCharged,

// 				settlementExpense: row.settlementExpense || 0,
// 				settlementExpenseRate: row.settlementExpensePercent || 0,
// 				settlementExpenseBase: row.settlementExpenseBase || 0,

// 				totalDeductions: row.totalFees || 0,
// 				netPayable: row.netSettlement || 0,

// 				mdrFee: row.mdrFee || 0,
// 				approvalFee: row.approvalFee || 0,
// 				rollingReserveAmount: row.rollingReserveAmount || 0,
// 				declineFee: row.declineFee || 0,
// 				reversalAmount: row.reversalAmount || 0,
// 				reversalFee: row.reversalFee || 0,
// 				chargebackAmount: row.chargebackAmount || 0,
// 				chargebackFee: row.chargebackFee || 0,
// 			};
// 		})
// 		.sort((a, b) =>
// 			String(a.currency || "").localeCompare(String(b.currency || "")),
// 		);

const getUnifiedChargeRows = ({
	feeRateSummary = {},
	declinedBrandSummary = {},
	adjustmentSummary = {},
	currencySummary = {},
}) => {
	const rows = [];

	/*
	|--------------------------------------------------------------------------
	| 1. Processing fee rows
	|--------------------------------------------------------------------------
	| Example:
	| EUR / EU / MC
	| AUD / NON EU / Visa
	*/
	for (const row of Object.values(feeRateSummary || {})) {
		const currency = row.currency || "";

		rows.push({
			type: "processing",

			label: [
				currency,
				row.appliedRateRegion || row.countryCategory || "ALL",
				shortPaymentMethod(row.brandGroup),
			].join(" / "),

			currency,
			txns: row.txns || 0,

			successVolumeOrBasis: formatMoney(row.capturedAmount || 0, currency),

			mdr: `${formatNumber(row.mdrPercent || 0)}% = ${formatMoney(
				row.mdrFee || 0,
				currency,
			)}`,

			ap: `${formatMoney(row.approvalFeeRate || 0, currency)} × ${formatInt(
				row.txns || 0,
			)} = ${formatMoney(row.approvalFee || 0, currency)}`,

			rr: `${formatNumber(row.rollingReservePercent || 0)}% = ${formatMoney(
				row.rollingReserveAmount || 0,
				currency,
			)}`,

			chargebackReversal: "-",
			settlementExpense: "-",

			total: row.totalFees || 0,
		});
	}

	// Declined transaction charges - preserve existing backend calculation
	for (const row of Object.values(declinedBrandSummary || {})) {
		const currency = row.currency || "";
		const txns = Number(row.txns || 0);
		const declineFee = Number(row.declineFee || 0);
		const declineFeeRate = Number(row.declineFeeRate || 0);

		if (txns <= 0) continue;

		rows.push({
			type: "decline",

			label: [
				currency,
				row.region || "ALL",
				shortPaymentMethod(row.brandGroup),
				"Decline Fee",
			].join(" / "),

			currency,
			txns,

			successVolumeOrBasis:
				`${formatInt(txns)} failed txns\n` +
				`${formatMoney(declineFeeRate, currency)} / txn`,

			mdr: "-",
			ap: "-",
			rr: "-",
			chargebackReversal: "-",
			settlementExpense: "-",

			total: declineFee,
		});
	}

	/*
	|--------------------------------------------------------------------------
	| 2. Chargeback / Reversal rows
	|--------------------------------------------------------------------------
	| Do not show the word "Adjustment" to merchant.
	| Show direct words:
	| AUD / Chargeback
	| EUR / Reversal
	*/
	for (const row of Object.values(adjustmentSummary || {})) {
		const status = normalizeUpper(row.status);

		const isChargeback = status === "CHARGEBACK";
		const isReversal = status === "REVERSED";

		if (!isChargeback && !isReversal) {
			continue;
		}

		const currency = row.currency || "";

		const amount = isChargeback
			? Number(row.chargebackAmount || 0)
			: Number(row.reversalAmount || 0);

		const fixedFee = isChargeback
			? Number(row.chargebackFee || 0)
			: Number(row.reversalFee || 0);

		const configuredRate = isChargeback
			? Number(row.chargebackFeeRate || 0)
			: Number(row.reversalFeeRate || 0);

		const txns = Number(row.txns || 0);

		const effectiveRate =
			configuredRate || (txns > 0 ? roundMoney(fixedFee / txns) : 0);

		rows.push({
			type: isChargeback ? "chargeback" : "reversal",

			label: `${currency} / ${isChargeback ? "Chargeback" : "Reversal"}`,

			currency,
			txns,

			successVolumeOrBasis: `${formatMoney(amount, currency)} ${
				isChargeback ? "chargeback amount" : "reversal amount"
			}`,

			mdr: "-",
			ap: "-",
			rr: "-",

			chargebackReversal: `${formatMoney(
				fixedFee,
				currency,
			)} fixed fee\n${formatMoney(effectiveRate, currency)} / txn`,

			settlementExpense: "-",

			total: fromCents(toCents(amount) + toCents(fixedFee)),
		});
	}

	/*
	|--------------------------------------------------------------------------
	| 3. Settlement expense rows
	|--------------------------------------------------------------------------
	| Included inside the same Charges Breakdown table.
	| No separate Settlement Expense table needed.
	*/
	for (const row of Object.values(currencySummary || {})) {
		const amount = Number(row.settlementExpense || 0);

		if (amount <= 0) {
			continue;
		}

		const currency = row.currency || "";

		rows.push({
			type: "settlement_expense",

			label: `${currency} / Settlement Expense`,

			currency,
			txns: "-",

			successVolumeOrBasis: `Base ${formatMoney(
				row.settlementExpenseBase || 0,
				currency,
			)}`,

			mdr: "-",
			ap: "-",
			rr: "-",
			chargebackReversal: "-",

			settlementExpense: `${formatNumber(
				row.settlementExpensePercent || 0,
			)}% / ${formatMoney(amount, currency)}`,

			total: amount,
		});
	}

	return rows.sort((a, b) => {
		const currencyCompare = String(a.currency || "").localeCompare(
			String(b.currency || ""),
		);

		if (currencyCompare !== 0) return currencyCompare;

		const order = {
			processing: 1,
			decline: 2,
			chargeback: 3,
			reversal: 4,
			settlement_expense: 5,
		};

		return (order[a.type] || 99) - (order[b.type] || 99);
	});
};

const getFinalSettlementRows = (currencySummary = {}) =>
	Object.values(currencySummary || {})
		.map((row) => {
			const successVolume = row.capturedAmount || 0;

			const processingFees = fromCents(
				toCents(row.mdrFee || 0) +
					toCents(row.approvalFee || 0) +
					toCents(row.rollingReserveAmount || 0) +
					toCents(row.declineFee || 0),
			);

			const chargebackReversal = fromCents(
				toCents(row.reversalAmount || 0) +
					toCents(row.reversalFee || 0) +
					toCents(row.chargebackAmount || 0) +
					toCents(row.chargebackFee || 0),
			);

			return {
				currency: row.currency,

				successVolume,
				processingFees,
				chargebackReversal,

				settlementExpense: row.settlementExpense || 0,
				settlementExpenseRate: row.settlementExpensePercent || 0,
				settlementExpenseBase: row.settlementExpenseBase || 0,

				totalDeductions: row.totalFees || 0,
				netPayable: row.netSettlement || 0,

				mdrFee: row.mdrFee || 0,
				approvalFee: row.approvalFee || 0,
				rollingReserveAmount: row.rollingReserveAmount || 0,

				reversalAmount: row.reversalAmount || 0,
				reversalFee: row.reversalFee || 0,
				chargebackAmount: row.chargebackAmount || 0,
				chargebackFee: row.chargebackFee || 0,
			};
		})
		.sort((a, b) =>
			String(a.currency || "").localeCompare(String(b.currency || "")),
		);

const getOtherChargeRows = ({
	sections = [],
	adjustmentSummary = {},
	currencySummary = {},
}) => {
	const rows = [];

	for (const row of getAllDeclineRateRows(sections)) {
		if (!Number(row.failedTxns || 0)) continue;

		rows.push({
			type: "Decline Fee",
			method: shortPaymentMethod(row.brand),
			currency: row.currency,
			basis: `${formatInt(row.failedTxns)} failed txns`,
			rate: `${formatMoney(row.declineFeeRate, row.currency)} / failed txn`,
			amount: row.declineFee || 0,
		});
	}

	for (const row of Object.values(adjustmentSummary || {})) {
		const isChargeback = normalizeUpper(row.status) === "CHARGEBACK";

		const transactionAmount = isChargeback
			? Number(row.chargebackAmount || 0)
			: Number(row.reversalAmount || 0);

		const fixedFee = isChargeback
			? Number(row.chargebackFee || 0)
			: Number(row.reversalFee || 0);

		const feeRate = isChargeback
			? Number(row.chargebackFeeRate || 0)
			: Number(row.reversalFeeRate || 0);

		const txns = Number(row.txns || 0);

		rows.push({
			type: isChargeback ? "Chargeback" : "Reversal",
			method: "-",
			currency: row.currency,
			basis: `${formatMoney(transactionAmount, row.currency)} + ${formatMoney(
				fixedFee,
				row.currency,
			)} fixed fee`,
			rate: `${formatMoney(
				feeRate || (txns > 0 ? roundMoney(fixedFee / txns) : 0),
				row.currency,
			)} / txn`,
			amount: fromCents(toCents(transactionAmount) + toCents(fixedFee)),
		});
	}

	for (const row of Object.values(currencySummary || {})) {
		if (!Number(row.settlementExpense || 0)) continue;

		rows.push({
			type: "Settlement Expense",
			method: "-",
			currency: row.currency,
			basis: formatMoney(row.settlementExpenseBase || 0, row.currency),
			rate: `${formatNumber(row.settlementExpensePercent || 0)}%`,
			amount: row.settlementExpense || 0,
		});
	}

	return rows;
};

export const calculateSettlementConversion = (report, payload) => {
	const settlementCurrency = normalizeUpper(payload?.settlementCurrency);

	if (!["EUR", "USDT"].includes(settlementCurrency)) {
		throw new Error("Settlement currency must be EUR or USDT.");
	}

	const rates = payload?.rates;

	if (!rates || typeof rates !== "object" || Array.isArray(rates)) {
		throw new Error("Conversion rates are required.");
	}

	const entries = Object.entries(report.currencySummary || {}).sort(
		([a], [b]) => a.localeCompare(b),
	);

	if (!entries.length) {
		throw new Error("This report has no currency settlement amounts.");
	}

	let totalCents = 0;

	const rows = entries.map(([currency, row]) => {
		const netSettlement = Number(row.netSettlement);

		if (
			row.netSettlement === null ||
			row.netSettlement === undefined ||
			!Number.isFinite(netSettlement)
		) {
			throw new Error(`Invalid net settlement amount for ${currency}.`);
		}

		const suppliedRate = rates[currency];

		if (
			currency !== settlementCurrency &&
			typeof suppliedRate !== "string" &&
			typeof suppliedRate !== "number"
		) {
			throw new Error(`Conversion rate is required for ${currency}.`);
		}

		const rate = currency === settlementCurrency ? 1 : Number(suppliedRate);

		if (!Number.isFinite(rate) || rate <= 0) {
			throw new Error(
				`Enter a valid positive ${currency} to ${settlementCurrency} rate.`,
			);
		}

		const convertedAmount = roundMoney(netSettlement * rate);
		const convertedCents = toCents(convertedAmount);

		if (
			!Number.isFinite(netSettlement * rate) ||
			!Number.isSafeInteger(convertedCents)
		) {
			throw new Error(`Converted amount is too large for ${currency}.`);
		}

		totalCents += convertedCents;

		if (!Number.isSafeInteger(totalCents)) {
			throw new Error("Converted settlement total is too large.");
		}

		return {
			currency,
			netSettlement,
			rate,
			convertedAmount,
		};
	});

	return {
		settlementCurrency,
		rows,
		finalPayable: fromCents(totalCents),
	};
};

// export const buildSettlementPdfBuffer = async (report, conversion = null) =>
// 	new Promise((resolve, reject) => {
// 		const doc = new PDFDocument({
// 			margin: 36,
// 			size: "A4",
// 			info: {
// 				Title: `Settlement Statement - ${report.merchantName}`,
// 				Author: "Settlement Team",
// 			},
// 		});

// 		const chunks = [];

// 		doc.on("data", (chunk) => chunks.push(chunk));
// 		doc.on("end", () => resolve(Buffer.concat(chunks)));
// 		doc.on("error", reject);

// 		const FONT = registerReportFonts(doc);

// 		const summary = report.summary || {};
// 		const reportData = report.reportData || {};
// 		const currencySummary = report.currencySummary || {};
// 		const statusSummary = report.statusSummary || {};
// 		const brandSummary = report.brandSummary || {};
// 		const declinedBrandSummary = reportData.declinedBrandSummary || {};
// 		const adjustmentSummary = reportData.adjustmentSummary || {};
// 		const feeRateSummary = reportData.feeRateSummary || {};
// 		const daySummary = reportData.daySummary || [];
// 		const primaryCurrency = getPrimaryCurrency(report);
// 		const currencies = Object.keys(currencySummary || {});
// 		const isMultiCurrency = currencies.length > 1;
// 		const displayCurrency = isMultiCurrency ? "" : primaryCurrency;

// 		const margin = doc.page.margins?.left || 30;
// 		const pageWidth = doc.page.width;
// 		const usableWidth = pageWidth - margin * 2;

// 		doc.rect(0, 0, pageWidth, 82).fill("#1234bc");

// 		doc
// 			.fillColor("#ffffff")
// 			.font(FONT.bold)
// 			.fontSize(20)
// 			.text("Merchant Settlement Statement", margin, 24);

// 		doc
// 			.fillColor("#dbe4ff")
// 			.font(FONT.regular)
// 			.fontSize(9)
// 			.text(
// 				"Settlement summary, charges, reversals, chargebacks and net settlement",
// 				margin,
// 				52,
// 			);

// 		doc.y = 105;

// 		const infoRows = [
// 			["Merchant", report.merchantName],
// 			["Member ID", report.memberId],
// 			["Currency", isMultiCurrency ? "Multi Currency" : primaryCurrency || "-"],

// 			[
// 				"Period",
// 				`${formatDate(report.fromDate || report.reportDate)} - ${formatDate(
// 					report.toDate || report.reportDate,
// 				)}`,
// 			],
// 			["Generated On", formatDate(new Date())],
// 			["Email Status", report.emailStatus || "draft"],
// 		];
// 		const infoBoxY = doc.y;
// 		const infoBoxHeight = 86;

// 		doc
// 			.roundedRect(margin, infoBoxY, usableWidth, infoBoxHeight, 8)
// 			.fill("#ffffff")
// 			.strokeColor("#e5e7eb")
// 			.stroke();

// 		let infoY = infoBoxY + 12;
// 		const colWidth = usableWidth / 3;

// 		infoRows.forEach(([label, value], index) => {
// 			const row = Math.floor(index / 3);
// 			const col = index % 3;
// 			const x = margin + col * colWidth + 12;
// 			const y = infoY + row * 32;

// 			doc
// 				.fillColor("#6b7280")
// 				.font(FONT.regular)
// 				.fontSize(7)
// 				.text(label.toUpperCase(), x, y, {
// 					width: colWidth - 20,
// 					lineBreak: false,
// 				});

// 			doc
// 				.fillColor("#111827")
// 				.font(FONT.bold)
// 				.fontSize(8.5)
// 				.text(String(value || "-"), x, y + 12, {
// 					width: colWidth - 20,
// 					lineBreak: false,
// 				});
// 		});

// 		doc.y = infoBoxY + infoBoxHeight + 18;

// 		const cardGap = 10;
// 		const cardWidth = (usableWidth - cardGap * 3) / 4;
// 		const cardHeight = 66;
// 		const cardY = doc.y;

// 		const adjustmentCount =
// 			Number(summary.reversalTransactions || 0) +
// 			Number(summary.chargebackTransactions || 0);

// 		const cards = [
// 			["Total Txns", formatInt(summary.totalTransactions || 0), "#1234bc"],
// 			["Successful", formatInt(summary.successTransactions || 0), "#16a34a"],
// 			["Failed", formatInt(summary.declinedTransactions || 0), "#dc2626"],
// 			["Adjustments", formatInt(adjustmentCount), "#f59e0b"],
// 		];
// 		cards.forEach(([label, value, color], index) => {
// 			const x = margin + index * (cardWidth + cardGap);

// 			doc
// 				.roundedRect(x, cardY, cardWidth, cardHeight, 8)
// 				.fill("#ffffff")
// 				.strokeColor("#e5e7eb")
// 				.stroke();

// 			doc.rect(x, cardY, 5, cardHeight).fill(color);

// 			doc
// 				.fillColor("#6b7280")
// 				.font(FONT.regular)
// 				.fontSize(7)
// 				.text(label.toUpperCase(), x + 14, cardY + 14);

// 			doc
// 				.fillColor("#111827")
// 				.font(FONT.bold)
// 				.fontSize(10)
// 				.text(value, x + 14, cardY + 34, {
// 					width: cardWidth - 24,
// 				});
// 		});

// 		doc.y = cardY + cardHeight + 22;

// 		/*
// |--------------------------------------------------------------------------
// | Transaction Count by Currency
// |--------------------------------------------------------------------------
// */

// 		const currencyTransactionRows = Object.values(currencySummary || {})
// 			.map((row) => ({
// 				currency: row.currency || "-",
// 				successTxns: Number(row.successTxns || 0),
// 				failedTxns: Number(row.failedTxns || 0),
// 				adjustmentTxns: Number(row.adjustmentTxns || 0),
// 				totalTxns: Number(row.txns || 0),
// 			}))
// 			.sort((a, b) => String(a.currency).localeCompare(String(b.currency)));

// 		const currencyTransactionTotalRow = {
// 			currency: "TOTAL",

// 			successTxns: currencyTransactionRows.reduce(
// 				(total, row) => total + row.successTxns,
// 				0,
// 			),

// 			failedTxns: currencyTransactionRows.reduce(
// 				(total, row) => total + row.failedTxns,
// 				0,
// 			),

// 			adjustmentTxns: currencyTransactionRows.reduce(
// 				(total, row) => total + row.adjustmentTxns,
// 				0,
// 			),

// 			totalTxns: currencyTransactionRows.reduce(
// 				(total, row) => total + row.totalTxns,
// 				0,
// 			),

// 			_bold: true,
// 			_highlight: true,
// 		};

// 		drawPdfTable({
// 			doc,
// 			FONT,
// 			title: "Transaction Count by Currency",

// 			columns: [
// 				{
// 					label: "Currency",
// 					key: "currency",
// 					width: usableWidth * 0.2,
// 					bold: true,
// 				},
// 				{
// 					label: "Success",
// 					value: (row) => formatInt(row.successTxns || 0),
// 					width: usableWidth * 0.2,
// 					align: "right",
// 				},
// 				{
// 					label: "Failed",
// 					value: (row) => formatInt(row.failedTxns || 0),
// 					width: usableWidth * 0.2,
// 					align: "right",
// 				},
// 				{
// 					label: "Adjustments",
// 					value: (row) => formatInt(row.adjustmentTxns || 0),
// 					width: usableWidth * 0.2,
// 					align: "right",
// 				},
// 				{
// 					label: "Total",
// 					value: (row) => formatInt(row.totalTxns || 0),
// 					width: usableWidth * 0.2,
// 					align: "right",
// 					bold: true,
// 				},
// 			],

// 			rows: [...currencyTransactionRows, currencyTransactionTotalRow],

// 			fontSize: 8,
// 			minRowHeight: 28,
// 			rowPaddingY: 7,
// 		});

// 		const detailedBrandSections = buildDetailedBrandSections({
// 			feeRateSummary,
// 			declinedBrandSummary,
// 		});

// 		/*drawPdfTable({
// 			doc,
// 			FONT,
// 			title: "Currency-wise Payable Summary",
// 			columns: [
// 				{
// 					label: "Currency",
// 					key: "currency",
// 					width: usableWidth * 0.13,
// 					bold: true,
// 				},
// 				{
// 					label: "Success Amount",
// 					value: (row) => formatMoney(row.successAmount, row.currency),
// 					width: usableWidth * 0.22,
// 					align: "right",
// 				},
// 				{
// 					label: "Total Deductions",
// 					value: (row) => formatMoney(row.totalDeductions, row.currency),
// 					width: usableWidth * 0.22,
// 					align: "right",
// 					bold: true,
// 				},
// 				{
// 					label: "Settlement Expense",
// 					key: "settlementExpenseText",
// 					width: usableWidth * 0.22,
// 					align: "right",
// 				},
// 				{
// 					label: "Net Payable",
// 					value: (row) => formatMoney(row.netSettlement, row.currency),
// 					width: usableWidth * 0.21,
// 					align: "right",
// 					bold: true,
// 				},
// 			],
// 			rows: getCurrencyStatementRows(currencySummary),
// 			fontSize: 7,
// 			minRowHeight: 30,
// 		});

// 		drawPdfTable({
// 			doc,
// 			FONT,
// 			title: "Currency-wise Fee Breakdown",
// 			columns: [
// 				{
// 					label: "Currency",
// 					key: "currency",
// 					width: usableWidth * 0.12,
// 					bold: true,
// 				},
// 				{
// 					label: "MDR",
// 					value: (row) => formatMoney(row.mdrFee, row.currency),
// 					width: usableWidth * 0.16,
// 					align: "right",
// 				},
// 				{
// 					label: "Approval",
// 					value: (row) => formatMoney(row.approvalFee, row.currency),
// 					width: usableWidth * 0.16,
// 					align: "right",
// 				},
// 				{
// 					label: "RR",
// 					value: (row) => formatMoney(row.rollingReserveAmount, row.currency),
// 					width: usableWidth * 0.14,
// 					align: "right",
// 				},
// 				{
// 					label: "Decline",
// 					value: (row) => formatMoney(row.declineFee, row.currency),
// 					width: usableWidth * 0.14,
// 					align: "right",
// 				},
// 				{
// 					label: "Adjustments",
// 					value: (row) => formatMoney(row.adjustments, row.currency),
// 					width: usableWidth * 0.14,
// 					align: "right",
// 				},
// 				{
// 					label: "Total Deduct",
// 					value: (row) => formatMoney(row.totalDeductions, row.currency),
// 					width: usableWidth * 0.14,
// 					align: "right",
// 					bold: true,
// 				},
// 			],
// 			rows: getCurrencyStatementRows(currencySummary),
// 			fontSize: 7,
// 			minRowHeight: 30,
// 		}); */

// 	drawPdfTable({
// 		doc,
// 		FONT,
// 		title: "Final Settlement Summary",
// 		columns: [
// 			{
// 				label: "Currency",
// 				key: "currency",
// 				width: usableWidth * 0.12,
// 				bold: true,
// 			},
// 			{
// 				label: "Success Volume",
// 				value: (row) => formatMoney(row.successVolume, row.currency),
// 				width: usableWidth * 0.18,
// 				align: "right",
// 			},
// 			{
// 				label: "Processing Fees",
// 				value: (row) => formatMoney(row.processingFees, row.currency),
// 				width: usableWidth * 0.18,
// 				align: "right",
// 			},
// 			{
// 				label: "Chargeback / Reversal",
// 				value: (row) => formatMoney(row.chargebackReversal, row.currency),
// 				width: usableWidth * 0.2,
// 				align: "right",
// 			},
// 			{
// 				label: "Settlement Exp.",
// 				value: (row) => formatMoney(row.settlementExpense, row.currency),
// 				width: usableWidth * 0.15,
// 				align: "right",
// 			},
// 			{
// 				label: "Net Payable",
// 				value: (row) => formatMoney(row.netPayable, row.currency),
// 				width: usableWidth * 0.17,
// 				align: "right",
// 				bold: true,
// 			},
// 		],
// 		rows: getFinalSettlementRows(currencySummary),
// 		fontSize: 6.8,
// 		minRowHeight: 38,
// 		headerHeight: 28,
// 		rowPaddingY: 8,
// 	});

// 		drawPdfTable({
// 			doc,
// 			FONT,
// 			title: "Charges Explained by Currency",
// 			columns: [
// 				{
// 					label: "Currency",
// 					key: "currency",
// 					width: usableWidth * 0.09,
// 					bold: true,
// 				},
// 				{
// 					label: "Payment Charges",
// 					value: (row) =>
// 						[
// 							`MDR: ${formatMoney(row.mdrFee, row.currency)}`,
// 							`Approval: ${formatMoney(row.approvalFee, row.currency)}`,
// 							`RR: ${formatMoney(row.rollingReserveAmount, row.currency)}`,
// 						].join("\n"),
// 					width: usableWidth * 0.24,
// 					align: "right",
// 				},
// 				{
// 					label: "Other Charges",
// 					value: (row) =>
// 						[
// 							`Decline: ${formatMoney(row.declineFee, row.currency)}`,
// 							`Reversal: ${formatMoney(
// 								fromCents(
// 									toCents(row.reversalAmount) + toCents(row.reversalFee),
// 								),
// 								row.currency,
// 							)}`,
// 							`Chargeback: ${formatMoney(
// 								fromCents(
// 									toCents(row.chargebackAmount) + toCents(row.chargebackFee),
// 								),
// 								row.currency,
// 							)}`,
// 						].join("\n"),
// 					width: usableWidth * 0.24,
// 					align: "right",
// 				},
// 				{
// 					label: "Settlement Expense",
// 					value: (row) =>
// 						[
// 							`Base: ${formatMoney(row.settlementExpenseBase, row.currency)}`,
// 							`Rate: ${formatNumber(row.settlementExpenseRate)}%`,
// 							`Charged: ${formatMoney(row.settlementExpense, row.currency)}`,
// 						].join("\n"),
// 					width: usableWidth * 0.27,
// 					align: "right",
// 				},
// 				{
// 					label: "Net Payable",
// 					value: (row) => formatMoney(row.netPayable, row.currency),
// 					width: usableWidth * 0.16,
// 					align: "right",
// 					bold: true,
// 				},
// 			],
// 			rows: getFinalSettlementRows(currencySummary),
// 			fontSize: 6.4,
// 			minRowHeight: 64,
// 			headerHeight: 30,
// 			rowPaddingY: 8,
// 		});
// 		/*
// 		drawPdfTable({
// 			doc,
// 			FONT,
// 			title: "Settlement Expense by Currency",
// 			columns: [
// 				{
// 					label: "Currency",
// 					key: "currency",
// 					width: usableWidth * 0.16,
// 					bold: true,
// 				},
// 				{
// 					label: "Calculation Base",
// 					value: (row) =>
// 						formatMoney(row.settlementExpenseBase || 0, row.currency),
// 					width: usableWidth * 0.32,
// 					align: "right",
// 				},
// 				{
// 					label: "Applied Rate",
// 					value: (row) => `${formatNumber(row.settlementExpensePercent || 0)}%`,
// 					width: usableWidth * 0.2,
// 					align: "right",
// 				},
// 				{
// 					label: "Amount Charged",
// 					value: (row) => formatMoney(row.settlementExpense || 0, row.currency),
// 					width: usableWidth * 0.32,
// 					align: "right",
// 					bold: true,
// 				},
// 			],
// 			rows: Object.values(currencySummary || {}).sort((a, b) =>
// 				String(a.currency || "").localeCompare(String(b.currency || "")),
// 			),
// 			fontSize: 7,
// 			minRowHeight: 32,
// 			rowPaddingY: 8,
// 		});*/

// 		/*drawPdfTable({
// 			doc,
// 			FONT,
// 			title: "Your Applied Rates and Charges",
// 			columns: [
// 				{
// 					label: "Payment Method",
// 					key: "brand",
// 					width: usableWidth * 0.13,
// 					bold: true,
// 				},
// 				{
// 					label: "Currency / Region",
// 					value: (row) => `${row.currency}\n${row.region}`,
// 					width: usableWidth * 0.12,
// 				},
// 				{
// 					label: "Transactions",
// 					value: (row) =>
// 						[
// 							`${formatInt(row.txns)} successful`,
// 							formatMoney(row.volume, row.currency),
// 						].join("\n"),
// 					width: usableWidth * 0.15,
// 					align: "right",
// 				},
// 				{
// 					label: "MDR",
// 					value: (row) =>
// 						[
// 							`${formatNumber(row.mdrRate)}%`,
// 							formatMoney(row.mdrFee, row.currency),
// 						].join("\n"),
// 					width: usableWidth * 0.14,
// 					align: "right",
// 				},
// 				{
// 					label: "Approval Fee",
// 					value: (row) =>
// 						[
// 							`${formatMoney(row.approvalRate, row.currency)} / txn`,
// 							formatMoney(row.approvalFee, row.currency),
// 						].join("\n"),
// 					width: usableWidth * 0.16,
// 					align: "right",
// 				},
// 				{
// 					label: "Rolling Reserve",
// 					value: (row) =>
// 						[
// 							`${formatNumber(row.rrRate)}%`,
// 							formatMoney(row.rrAmount, row.currency),
// 						].join("\n"),
// 					width: usableWidth * 0.14,
// 					align: "right",
// 				},
// 				{
// 					label: "Total Charges",
// 					value: (row) => formatMoney(row.totalCharges, row.currency),
// 					width: usableWidth * 0.16,
// 					align: "right",
// 					bold: true,
// 				},
// 			],
// 			rows: getPaymentChargeRows(detailedBrandSections),
// 			fontSize: 6.5,
// 			minRowHeight: 52,
// 			rowPaddingY: 8,
// 		}); */

// 		for (const currencyGroup of getPaymentChargeRowsGroupedByCurrency(
// 			detailedBrandSections,
// 		)) {
// 			drawPdfTable({
// 				doc,
// 				FONT,
// 				title: `${currencyGroup.currency} Processing - Payment Methods and Rates`,
// 				columns: [
// 					{
// 						label: "Payment Method",
// 						value: (row) => shortPaymentMethod(row.brand),
// 						width: usableWidth * 0.14,
// 						bold: true,
// 					},
// 					{
// 						label: "Region",
// 						key: "region",
// 						width: usableWidth * 0.1,
// 					},
// 					{
// 						label: "Settled Activity",
// 						value: (row) =>
// 							[
// 								`${formatInt(row.txns)} txns`,
// 								formatMoney(row.volume, row.currency),
// 							].join("\n"),
// 						width: usableWidth * 0.18,
// 						align: "right",
// 					},
// 					{
// 						label: "Merchant Rates",
// 						value: (row) =>
// 							[
// 								`MDR ${formatNumber(row.mdrRate)}%`,
// 								`Approval ${formatMoney(row.approvalRate, row.currency)} / txn`,
// 								`RR ${formatNumber(row.rrRate)}%`,
// 							].join("\n"),
// 						width: usableWidth * 0.22,
// 						align: "right",
// 					},
// 					{
// 						label: "Charges",
// 						value: (row) =>
// 							[
// 								`MDR ${formatMoney(row.mdrFee, row.currency)}`,
// 								`Approval ${formatMoney(row.approvalFee, row.currency)}`,
// 								`RR ${formatMoney(row.rrAmount, row.currency)}`,
// 							].join("\n"),
// 						width: usableWidth * 0.22,
// 						align: "right",
// 					},
// 					{
// 						label: "Total",
// 						value: (row) => formatMoney(row.totalCharges, row.currency),
// 						width: usableWidth * 0.14,
// 						align: "right",
// 						bold: true,
// 					},
// 				],
// 				rows: currencyGroup.rows,
// 				fontSize: 6.5,
// 				minRowHeight: 56,
// 				headerHeight: 30,
// 				rowPaddingY: 8,
// 			});
// 		}

// 		/*
// 		drawPdfTable({
// 			doc,
// 			FONT,
// 			title: "Rate Coverage",
// 			columns: [
// 				{
// 					label: "Payment Method",
// 					key: "brand",
// 					width: usableWidth * 0.18,
// 					bold: true,
// 				},
// 				{
// 					label: "Currency",
// 					key: "currency",
// 					width: usableWidth * 0.11,
// 				},
// 				{
// 					label: "Region",
// 					key: "region",
// 					width: usableWidth * 0.13,
// 				},
// 				{
// 					label: "Countries Included",
// 					key: "countries",
// 					width: usableWidth * 0.34,
// 				},
// 				{
// 					label: "Applied Rates",
// 					value: (row) =>
// 						[
// 							`MDR: ${formatNumber(row.mdrRate)}%`,
// 							`Approval: ${formatMoney(row.approvalRate, row.currency)} / txn`,
// 							`RR: ${formatNumber(row.rrRate)}%`,
// 						].join("\n"),
// 					width: usableWidth * 0.24,
// 					align: "right",
// 				},
// 			],
// 			rows: getRateCoverageRows(detailedBrandSections),
// 			fontSize: 6.8,
// 			minRowHeight: 52,
// 			rowPaddingY: 8,
// 		});

// 		drawPdfTable({
// 			doc,
// 			FONT,
// 			title: "Decline Rates and Charges",
// 			columns: [
// 				{
// 					label: "Payment Method",
// 					key: "brand",
// 					width: usableWidth * 0.17,
// 					bold: true,
// 				},
// 				{
// 					label: "Currency / Region",
// 					value: (row) => `${row.currency}\n${row.region}`,
// 					width: usableWidth * 0.16,
// 				},
// 				{
// 					label: "Countries",
// 					key: "countries",
// 					width: usableWidth * 0.27,
// 				},
// 				{
// 					label: "Failed Txns",
// 					value: (row) => formatInt(row.failedTxns),
// 					width: usableWidth * 0.12,
// 					align: "right",
// 				},
// 				{
// 					label: "Rate / Failed Txn",
// 					value: (row) =>
// 						`${formatMoney(row.declineFeeRate, row.currency)} / txn`,
// 					width: usableWidth * 0.14,
// 					align: "right",
// 				},
// 				{
// 					label: "Amount Charged",
// 					value: (row) => formatMoney(row.declineFee, row.currency),
// 					width: usableWidth * 0.14,
// 					align: "right",
// 					bold: true,
// 				},
// 			],
// 			rows: getAllDeclineRateRows(detailedBrandSections),
// 			fontSize: 6.7,
// 			minRowHeight: 42,
// 			rowPaddingY: 8,
// 		});

// 		drawPdfTable({
// 			doc,
// 			FONT,
// 			title: "Reversal and Chargeback Details",
// 			columns: [
// 				{
// 					label: "Type",
// 					key: "status",
// 					width: usableWidth * 0.12,
// 					bold: true,
// 				},
// 				{
// 					label: "Currency",
// 					key: "currency",
// 					width: usableWidth * 0.09,
// 				},
// 				{
// 					label: "Txns",
// 					value: (row) => formatInt(row.txns),
// 					width: usableWidth * 0.07,
// 					align: "right",
// 				},
// 				{
// 					label: "Amount Reversed / ChargedBack",
// 					value: (row) =>
// 						formatMoney(
// 							Number(row.reversalAmount || 0) +
// 								Number(row.chargebackAmount || 0),
// 							row.currency,
// 						),
// 					width: usableWidth * 0.24,
// 					align: "right",
// 				},
// 				{
// 					label: "Fee Rate",
// 					value: (row) => {
// 						const isChargeback = normalizeUpper(row.status) === "CHARGEBACK";

// 						const configuredRate = isChargeback
// 							? Number(row.chargebackFeeRate || 0)
// 							: Number(row.reversalFeeRate || 0);

// 						const totalFixedFee = isChargeback
// 							? Number(row.chargebackFee || 0)
// 							: Number(row.reversalFee || 0);

// 						const txns = Number(row.txns || 0);

// 						const effectiveRate =
// 							configuredRate ||
// 							(txns > 0 ? roundMoney(totalFixedFee / txns) : 0);

// 						return isChargeback
// 							? `${formatMoney(effectiveRate, row.currency)} per chargeback`
// 							: `${formatMoney(effectiveRate, row.currency)} per reversal`;
// 					},
// 					width: usableWidth * 0.16,
// 					align: "right",
// 				},
// 				{
// 					label: "Fixed Fee Charged",
// 					value: (row) =>
// 						formatMoney(
// 							Number(row.reversalFee || 0) + Number(row.chargebackFee || 0),
// 							row.currency,
// 						),
// 					width: usableWidth * 0.14,
// 					align: "right",
// 				},
// 				{
// 					label: "Total Deduction",
// 					value: (row) =>
// 						formatMoney(
// 							Number(row.reversalAmount || 0) +
// 								Number(row.chargebackAmount || 0) +
// 								Number(row.reversalFee || 0) +
// 								Number(row.chargebackFee || 0),
// 							row.currency,
// 						),
// 					width: usableWidth * 0.16,
// 					align: "right",
// 					bold: true,
// 				},
// 			],
// 			rows: Object.values(adjustmentSummary || {}),
// 			fontSize: 6.6,
// 			minRowHeight: 38,
// 			rowPaddingY: 8,
// 		});

// 		drawPdfTable({
// 			doc,
// 			FONT,
// 			title: "Settlement Expense Calculation",
// 			columns: [
// 				{
// 					label: "Currency",
// 					key: "currency",
// 					width: usableWidth * 0.15,
// 					bold: true,
// 				},
// 				{
// 					label: "Calculation Base",
// 					value: (row) => formatMoney(row.calculationBase, row.currency),
// 					width: usableWidth * 0.3,
// 					align: "right",
// 				},
// 				{
// 					label: "Applied Rate",
// 					value: (row) => `${formatNumber(row.rate)}%`,
// 					width: usableWidth * 0.2,
// 					align: "right",
// 				},
// 				{
// 					label: "Amount Charged",
// 					value: (row) => formatMoney(row.amount, row.currency),
// 					width: usableWidth * 0.35,
// 					align: "right",
// 					bold: true,
// 				},
// 			],
// 			rows: getSettlementExpenseRows(currencySummary),
// 			fontSize: 7,
// 			minRowHeight: 32,
// 		}); */

// 		drawPdfTable({
// 			doc,
// 			FONT,
// 			title: "Other Charges",
// 			columns: [
// 				{
// 					label: "Charge Type",
// 					key: "type",
// 					width: usableWidth * 0.2,
// 					bold: true,
// 				},
// 				{
// 					label: "Method",
// 					key: "method",
// 					width: usableWidth * 0.12,
// 				},
// 				{
// 					label: "Currency",
// 					key: "currency",
// 					width: usableWidth * 0.1,
// 				},
// 				{
// 					label: "Basis",
// 					key: "basis",
// 					width: usableWidth * 0.28,
// 					align: "right",
// 				},
// 				{
// 					label: "Rate",
// 					key: "rate",
// 					width: usableWidth * 0.15,
// 					align: "right",
// 				},
// 				{
// 					label: "Amount",
// 					value: (row) => formatMoney(row.amount, row.currency),
// 					width: usableWidth * 0.15,
// 					align: "right",
// 					bold: true,
// 				},
// 			],
// 			rows: getOtherChargeRows({
// 				sections: detailedBrandSections,
// 				adjustmentSummary,
// 				currencySummary,
// 			}),
// 			fontSize: 6.7,
// 			minRowHeight: 40,
// 			rowPaddingY: 8,
// 		});

// 		if (!isMultiCurrency) {
// 			const currencyRow = Object.values(currencySummary || {})[0];

// 			if (currencyRow) {
// 				drawInfoBox({
// 					doc,
// 					FONT,
// 					title: "Final Settlement Calculation",
// 					lines: [
// 						"Single-currency report: final settlement calculation is shown below.",
// 						"Net Payable = Success Amount - MDR - Approval Fee - Rolling Reserve - Decline Fee - Adjustments - Settlement Expense.",
// 					],
// 					color: "#f8fafc",
// 				});

// 				drawChargeBreakdownCard({
// 					doc,
// 					FONT,
// 					title: `${currencyRow.currency} - Final Settlement Calculation`,
// 					subtitle: "Single-currency payable calculation",
// 					accent: "#16a34a",
// 					stats: [
// 						{
// 							label: "Success Amount",
// 							value: formatMoney(
// 								currencyRow.capturedAmount,
// 								currencyRow.currency,
// 							),
// 							bold: true,
// 						},
// 						{
// 							label: "Total Deductions",
// 							value: formatMoney(currencyRow.totalFees, currencyRow.currency),
// 							bold: true,
// 						},
// 						{
// 							label: "Settlement Expense",
// 							value: formatMoney(
// 								currencyRow.settlementExpense || 0,
// 								currencyRow.currency,
// 							),
// 							bold: true,
// 						},
// 						{
// 							label: "Net Payable",
// 							value: formatMoney(
// 								currencyRow.netSettlement,
// 								currencyRow.currency,
// 							),
// 							bold: true,
// 						},
// 					],
// 					rates: [
// 						`Settlement Expense ${formatNumber(
// 							currencyRow.settlementExpensePercent || 0,
// 						)}%`,
// 					],
// 					charges: buildCurrencyFinalCharges(currencyRow),
// 				});
// 			}
// 		}

// 		drawPdfTable({
// 			doc,
// 			FONT,
// 			title: "Day-wise Summary",
// 			columns: [
// 				{
// 					label: "Date",
// 					key: "date",
// 					width: usableWidth * 0.14,
// 					bold: true,
// 				},
// 				{
// 					label: "Currency",
// 					key: "currency",
// 					width: usableWidth * 0.09,
// 				},
// 				{
// 					label: "Total",
// 					value: (row) => row.totalTxns ?? row.txns ?? 0,
// 					width: usableWidth * 0.08,
// 					align: "right",
// 				},
// 				{
// 					label: "Success",
// 					value: (row) => row.successTxns ?? 0,
// 					width: usableWidth * 0.09,
// 					align: "right",
// 				},
// 				{
// 					label: "Failed",
// 					value: (row) => row.failedTxns ?? 0,
// 					width: usableWidth * 0.09,
// 					align: "right",
// 				},
// 				{
// 					label: "Adjust.",
// 					value: (row) => row.adjustmentTxns ?? 0,
// 					width: usableWidth * 0.09,
// 					align: "right",
// 				},
// 				{
// 					label: "Settled Activity",
// 					value: (row) => formatMoney(row.capturedAmount, row.currency),
// 					width: usableWidth * 0.17,
// 					align: "right",
// 				},
// 				{
// 					label: "Charges",
// 					value: (row) => formatMoney(row.totalFees, row.currency),
// 					width: usableWidth * 0.12,
// 					align: "right",
// 				},
// 				{
// 					label: "Net",
// 					value: (row) => formatMoney(row.netSettlement, row.currency),
// 					width: usableWidth * 0.13,
// 					align: "right",
// 					bold: true,
// 				},
// 			],
// 			rows: daySummary,
// 		});

// 		if (conversion) {
// 			drawPdfTable({
// 				doc,
// 				FONT,
// 				title: `Settlement Conversion to ${conversion.settlementCurrency}`,
// 				columns: [
// 					{
// 						label: "Currency",
// 						key: "currency",
// 						width: usableWidth * 0.14,
// 					},
// 					{
// 						label: "Net Payable",
// 						value: (row) => formatMoney(row.netSettlement, row.currency),
// 						width: usableWidth * 0.24,
// 						align: "right",
// 					},
// 					{
// 						label: "Conversion Rate",
// 						value: (row) =>
// 							`1 ${row.currency} = ${row.rate} ${conversion.settlementCurrency}`,
// 						width: usableWidth * 0.34,
// 					},
// 					{
// 						label: "Converted Payable",
// 						value: (row) =>
// 							formatMoney(row.convertedAmount, conversion.settlementCurrency),
// 						width: usableWidth * 0.28,
// 						align: "right",
// 						bold: true,
// 					},
// 				],
// 				rows: conversion.rows,
// 				fontSize: 8,
// 				minRowHeight: 32,
// 			});

// 			drawInfoBox({
// 				doc,
// 				FONT,
// 				title: "Final Settlement Payable",
// 				lines: [
// 					`Settlement Currency: ${conversion.settlementCurrency}`,
// 					`Final Payable: ${formatMoney(
// 						conversion.finalPayable,
// 						conversion.settlementCurrency,
// 					)}`,
// 					"Calculated from net payable amounts after existing deductions.",
// 					"Each converted amount is rounded to two decimal places before summing.",
// 				],
// 				color: "#f0fdf4",
// 			});
// 		}

// 		doc.end();
// 	});

// export const downloadMerchantSettlementPdf = async (req, res) => {
// 	const report = await MerchantSettlementReport.findById(req.params.id).lean();

// 	if (!report) {
// 		return res.status(404).json({
// 			success: false,
// 			message: "Report not found",
// 		});
// 	}

// 	const buffer = await buildSettlementPdfBuffer(report);

// 	const fileName = `${slugify(report.merchantName)}-${report.memberId}-settlement.pdf`;

// 	res.setHeader("Content-Disposition", `attachment; filename=${fileName}`);
// 	res.setHeader("Content-Type", "application/pdf");

// 	return res.send(buffer);
// };

export const buildSettlementPdfBuffer = async (report, conversion = null, options = {}) => {
	[report] = await withDatestampReportPeriods([report]);
	if (conversion) {
		conversion = calculateSettlementConversion(report, {
			settlementCurrency: conversion.settlementCurrency,
			rates: Object.fromEntries((conversion.rows || []).map((row) => [row.currency, row.rate])),
		});
	}
	return new Promise((resolve, reject) => {
		const doc = new PDFDocument({
			size: "A4",
			margin: 43,
			bufferPages: true,
			info: {
				Title: `Settlement Statement - ${report.merchantName}`,
				Author: "Settlement Team",
			},
		});

		const chunks = [];

		doc.on("data", (chunk) => chunks.push(chunk));
		doc.on("end", () => resolve(Buffer.concat(chunks)));
		doc.on("error", reject);

		const FONT = registerReportFonts(doc);

		const C = {
			primary: "#1234BC",
			text: "#191C1E",
			muted: "#647084",
			border: "#C5CDDC",
			divider: "#D7DDE7",
			header: "#EEF2FF",
			panel: "#F2F4F6",
			payable: "#EDEFFD",
			white: "#FFFFFF",
			error: "#B45346",
		};

		const summary = report.summary || {};
		const reportData = report.reportData || {};
		const currencySummary = report.currencySummary || {};

		const adjustmentSummary = reportData.adjustmentSummary || {};

		const feeRateSummary = reportData.feeRateSummary || {};

		const declinedBrandSummary = reportData.declinedBrandSummary || {};

		const primaryCurrency = getPrimaryCurrency(report);

		const currencies = Object.keys(currencySummary);
		const isMultiCurrency = currencies.length > 1;

		const finalSettlementRows = getFinalSettlementRows(currencySummary);

		const unifiedChargeRows = getUnifiedChargeRows({
			feeRateSummary,
			declinedBrandSummary,
			adjustmentSummary,
			currencySummary,
		});

		const totalNetPayable = finalSettlementRows.reduce(
			(total, row) => total + Number(row.netPayable || 0),
			0,
		);

		const adjustmentCount =
			Number(summary.reversalTransactions || 0) +
			Number(summary.chargebackTransactions || 0);

		const margin = doc.page.margins.left;
		const pageWidth = doc.page.width;
		const pageHeight = doc.page.height;
		const usableWidth = pageWidth - margin * 2;

		const regular = FONT.regular;
		const semiBold = FONT.semiBold;
		const bold = FONT.bold;

		const settlementCurrency =
			conversion?.settlementCurrency ||
			(isMultiCurrency ? "Multi Currency" : primaryCurrency || "-");
		const finalPayableText = conversion
			? formatMoney(conversion.finalPayable, conversion.settlementCurrency)
			: isMultiCurrency ? "See currency totals" : formatMoney(totalNetPayable, primaryCurrency);

		const print = (
			value,
			x,
			y,
			size = 9,
			color = C.text,
			font = regular,
			options = {},
		) => {
			doc
				.font(font)
				.fontSize(size)
				.fillColor(color)
				.text(String(value ?? "-"), x, y, {
					lineBreak: false,
					...options,
				});
		};

		const line = (y) => {
			doc
				.moveTo(margin, y)
				.lineTo(pageWidth - margin, y)
				.lineWidth(0.7)
				.strokeColor(C.divider)
				.stroke();
		};

		const ensureSpace = (height) => {
			if (doc.y + height > pageHeight - 55) {
				doc.addPage();
				doc.y = 42;
			}
		};

		const drawPageHeader = (title, subtitle) => {
			// Blue strip with square corners
			doc.rect(0, 0, pageWidth, 5).fill(C.primary);

			print(
				options.audience === "internal" ? "SETTLEMENT  /  ACQUIRER REPORTING" : "SETTLEMENT  /  MERCHANT REPORTING",
				margin,
				28,
				8,
				C.primary,
				semiBold,
			);

			print(title, margin, 48, 17, C.text, bold, { width: usableWidth });

			print(
				report.acquirer ? `Acquirer: ${report.acquirer}` : subtitle,
				margin,
				77,
				9,
				C.muted,
				regular,
				{ width: usableWidth },
			);

			line(98);
			doc.y = 115;
		};

		const drawMerchantInfo = () => {
			const y = doc.y;
			const height = 101;

			doc.roundedRect(margin, y, usableWidth, height, 8).fill(C.panel);

			const details = [
				["MERCHANT", report.merchantName || "-"],
				["MEMBER ID", report.memberId || "-"],
				["SETTLEMENT CURRENCY", settlementCurrency],
				[
					"REPORTING PERIOD",
					report.fromDate && report.toDate
						? `${formatDate(report.fromDate)} - ${formatDate(report.toDate)}`
						: "No datestamp transactions",
				],
				["GENERATED ON", formatDate(new Date(), Intl.DateTimeFormat().resolvedOptions().timeZone)],
				[
					"FINAL PAYABLE",
					finalPayableText,
				],
			];

			const colWidth = usableWidth / 3;

			details.forEach(([label, value], index) => {
				const col = index % 3;
				const row = Math.floor(index / 3);

				const x = margin + col * colWidth + 15;
				const top = y + 14 + row * 48;

				if (label === "FINAL PAYABLE") {
					// Compact highlighted card within existing panel
					const cardX = x - 7;
					const cardY = top - 7;
					const cardWidth = colWidth - 16;
					const cardHeight = 42;

					doc
						.roundedRect(cardX, cardY, cardWidth, cardHeight, 6)
						.fill(C.payable);

					doc.rect(cardX, cardY, 3, cardHeight).fill(C.primary);

					print(
						"FINAL PAYABLE",
						cardX + 12,
						cardY + 7,
						7,
						C.primary,
						semiBold,
						{
							width: cardWidth - 20,
						},
					);

					print(value, cardX + 12, cardY + 21, 12, C.primary, bold, {
						width: cardWidth - 20,
					});

					return;
				}

				print(label, x, top, 7.1, C.muted, semiBold, {
					width: colWidth - 25,
				});

				print(value, x, top + 16, 8.6, C.text, bold, {
					width: colWidth - 25,
				});
			});

			doc.y = y + height + 13;
		};

		const drawSummaryCards = () => {
			const cards = [
				{
					label: "TOTAL TRANSACTIONS",
					value: formatInt(summary.totalTransactions || 0),
				},
				{
					label: "SUCCESSFUL",
					value: formatInt(summary.successTransactions || 0),
				},
				{
					label: "FAILED",
					value: formatInt(summary.declinedTransactions || 0),
				},
				{
					label: "CHARGEBACK / REVERSAL",
					value: formatInt(
						Number(summary.chargebackTransactions || 0) +
							Number(summary.reversalTransactions || 0),
					),
				},
			];

			const gap = 10;
			const cardWidth = (usableWidth - gap * 3) / 4;
			const cardHeight = 65;
			const y = doc.y;

			cards.forEach((card, index) => {
				const x = margin + index * (cardWidth + gap);

				doc
					.roundedRect(x, y, cardWidth, cardHeight, 7)
					.fillAndStroke(C.white, C.divider);

				print(card.label, x + 14, y + 13, 7, C.muted, semiBold, {
					width: cardWidth - 24,
				});

				print(card.value, x + 14, y + 32, 18, C.text, bold, {
					width: cardWidth - 24,
				});
			});

			doc.y = y + cardHeight + 13;
		};

		const drawFinalPayable = () => {
			const boxHeight = 55;
			const bottomLimit = pageHeight - 80;

			// Draw the box only if it fits on the current page.
			// Never create a new page just for FINAL PAYABLE.
			if (doc.y + boxHeight + 12 > bottomLimit) {
				return;
			}

			const y = doc.y + 8;

			doc.roundedRect(margin, y, usableWidth, boxHeight, 7).fill(C.payable);

			// Blue vertical accent
			doc.rect(margin, y, 4, boxHeight).fill(C.primary);

			print("FINAL PAYABLE", margin + 16, y + 11, 8, C.primary, semiBold);

			print(
				`SETTLEMENT CURRENCY / ${settlementCurrency}`,
				margin + 16,
				y + 29,
				7,
				C.muted,
				regular,
			);

			print(finalPayableText, margin + usableWidth * 0.46, y + 16, 18, C.primary, bold, {
				width: usableWidth * 0.51,
				align: "right",
			});

			doc.y = y + boxHeight + 8;
		};

		/*
    |--------------------------------------------------------------------------
    | PAGE 1 - SETTLEMENT SUMMARY
    |--------------------------------------------------------------------------
    */

		drawPageHeader(
			options.audience === "internal" ? "Acquirer settlement statement" : "Merchant settlement statement",
			"Settlement activity and payout summary",
		);

		drawMerchantInfo();
		drawSummaryCards();

		const transactionRows = Object.values(currencySummary)
			.map((row) => ({
				currency: row.currency || "-",
				successTxns: Number(row.successTxns || 0),
				failedTxns: Number(row.failedTxns || 0),
				adjustmentTxns: Number(row.adjustmentTxns || 0),
				totalTxns: Number(row.txns || 0),
			}))
			.sort((a, b) => String(a.currency).localeCompare(String(b.currency)));

		const totalTransactionRow = {
			currency: "TOTAL",
			successTxns: transactionRows.reduce(
				(sum, row) => sum + row.successTxns,
				0,
			),
			failedTxns: transactionRows.reduce((sum, row) => sum + row.failedTxns, 0),
			adjustmentTxns: transactionRows.reduce(
				(sum, row) => sum + row.adjustmentTxns,
				0,
			),
			totalTxns: transactionRows.reduce((sum, row) => sum + row.totalTxns, 0),
			_bold: true,
			_highlight: true,
		};

		drawPdfTable({
			doc,
			FONT,
			title: "Transaction activity",
			columns: [
				{
					label: "Currency",
					key: "currency",
					width: usableWidth * 0.285,
					bold: true,
				},
				{
					label: "Successful",
					value: (r) => formatInt(r.successTxns),
					width: usableWidth * 0.18,
					align: "center",
				},
				{
					label: "Failed",
					value: (r) => formatInt(r.failedTxns),
					width: usableWidth * 0.18,
					align: "center",
				},
				{
					label: "CB / REV",
					value: (r) => formatInt(r.adjustmentTxns),
					width: usableWidth * 0.19,
					align: "center",
				},
				{
					label: "Total",
					value: (r) => formatInt(r.totalTxns),
					width: usableWidth * 0.165,
					align: "right",
				},
			],
			rows: [...transactionRows, totalTransactionRow],
			fontSize: 8.3,
			minRowHeight: 30,
			headerHeight: 27,
			rowPaddingY: 8,
		});

		drawPdfTable({
			doc,
			FONT,
			title: "Settlement by currency",
			columns: [
				{
					label: "Currency",
					key: "currency",
					width: usableWidth * 0.145,
					bold: true,
				},
				{
					label: "Gross volume",
					value: (r) => formatNumber(r.successVolume),
					width: usableWidth * 0.18,
					align: "right",
				},
				{
					label: "Processing fees",
					value: (r) => formatNumber(r.processingFees),
					width: usableWidth * 0.18,
					align: "right",
				},
				{
					label: "CB / REV",
					value: (r) => formatNumber(r.chargebackReversal),
					width: usableWidth * 0.17,
					align: "right",
				},
				{
					label: "Settlement fee",
					value: (r) => formatNumber(r.settlementExpense),
					width: usableWidth * 0.16,
					align: "right",
				},
				{
					label: "Net payable",
					value: (r) => formatNumber(r.netPayable),
					width: usableWidth * 0.165,
					align: "right",
					bold: true,
					highlight: true,
				},
			],
			rows: finalSettlementRows,
			fontSize: 7.5,
			minRowHeight: 33,
			headerHeight: 29,
			rowPaddingY: 9,
		});

		/*
    |--------------------------------------------------------------------------
    | PAGE 2 - CHARGES AND CONVERSION
    |--------------------------------------------------------------------------
    */

		const currentPage = doc.bufferedPageRange();

		if (doc.y > doc.page.margins.top + 10) {
			doc.addPage();
		}

		drawPageHeader(
			"Charges & conversion details",
			"Itemized fees, adjustments and settlement expenses",
		);

		doc.y = 108;

		// Use existing charge data; only change its presentation.

		const chargeRows = unifiedChargeRows.map((row) => {
			const txns = Number(row.txns || 0);

			// Show amounts without repeating currency
			const amount = (value) => formatNumber(value);

			let basis = String(row.successVolumeOrBasis || "-");
			let details = "-";

			switch (row.type) {
				case "processing": {
					details = [
						row.mdr !== "-" ? `MDR: ${row.mdr}` : "",
						row.ap !== "-" ? `Approval: ${row.ap}` : "",
						row.rr !== "-" ? `Reserve: ${row.rr}` : "",
					]
						.filter(Boolean)
						.join("\n");
					break;
				}

				case "decline": {
					const parts = basis.split("\n");

					const rate = Number(String(parts[1] || "0").replace(/[^0-9.-]/g, ""));

					basis = `${formatInt(txns)} failed txns`;
					details = `Decline: ${amount(rate)} × ${formatInt(txns)} = ${amount(row.total)}`;
					break;
				}

				case "chargeback":
				case "reversal": {
					const deductedAmount = Number(basis.replace(/[^0-9.-]/g, "")) || 0;

					const totalFee = Math.max(
						0,
						Math.round((Number(row.total || 0) - deductedAmount) * 100) / 100,
					);

					const perTxnFee = txns ? totalFee / txns : 0;

					basis = `${row.currency} ${amount(deductedAmount)}`;
					details = [
						`Amount: ${amount(deductedAmount)}`,
						`Fee: ${amount(perTxnFee)} × ${formatInt(txns)} = ${amount(totalFee)}`,
					].join("\n");
					break;
				}

				case "settlement_expense": {
					basis = basis.replace(/^Base\s*/i, "").trim();

					const rate =
						String(row.settlementExpense || "").match(/[\d.]+%/)?.[0] || "0%";

					details = `Settlement: ${rate} = ${amount(row.total)}`;
					break;
				}
			}

			return {
				description: row.label,
				txns: row.txns === "-" ? "-" : formatInt(txns),
				basis,

				// Remove currency codes from fee calculation text only
				details: String(details || "-")
					.replace(/\b(?:USD|AUD|EUR|CAD|GBP|USDT)\s+(?=[\d,.]+)/gi, "")
					.trim(),

				total: amount(row.total),
			};
		});

		if (chargeRows.length) {
			drawPdfTable({
				doc,
				FONT,
				title: "Detailed charges",
				columns: [
					{
						label: "Description",
						key: "description",
						width: usableWidth * 0.3,
						bold: true,
					},
					{
						label: "Txns",
						key: "txns",
						width: usableWidth * 0.075,
						align: "center",
					},
					{
						label: "Volume / basis",
						key: "basis",
						width: usableWidth * 0.17,
						align: "right",
					},
					{
						label: "Fee calculation / details",
						key: "details",
						width: usableWidth * 0.305,
					},
					{
						label: "Total",
						key: "total",
						width: usableWidth * 0.15,
						align: "right",
					},
				],
				rows: chargeRows,
				fontSize: 7,
				minRowHeight: 23,
				headerHeight: 25,
				rowPaddingY: 6,
			});
		}

		if (conversion?.rows?.length) {
			drawPdfTable({
				doc,
				FONT,
				title: `Currency conversion to ${conversion.settlementCurrency}`,
				columns: [
					{
						label: "Currency",
						key: "currency",
						width: usableWidth * 0.285,
						bold: true,
					},
					{
						label: "Net payable",
						value: (row) => formatMoney(row.netSettlement, row.currency),
						width: usableWidth * 0.245,
						align: "center",
					},
					{
						label: "Conversion rate",
						value: (row) =>
							`1 ${row.currency} = ${row.rate} ${conversion.settlementCurrency}`,
						width: usableWidth * 0.245,
						align: "center",
					},
					{
						label: "Converted payable",
						value: (row) =>
							formatMoney(row.convertedAmount, conversion.settlementCurrency),
						width: usableWidth * 0.225,
						align: "right",
						bold: true,
						highlight: true,
					},
				],
				rows: conversion.rows,
				fontSize: 7.5,
				minRowHeight: 31,
				headerHeight: 27,
				rowPaddingY: 8,
			});
		}

		/*
    |--------------------------------------------------------------------------
    | PAGE FOOTERS
    |--------------------------------------------------------------------------
    */

		const pages = doc.bufferedPageRange();
		const totalPages = pages.count;

		for (let i = pages.start; i < pages.start + totalPages; i++) {
			doc.switchToPage(i);

			const footerY = doc.page.height - 72;

			doc.save();

			doc
				.moveTo(margin, footerY)
				.lineTo(pageWidth - margin, footerY)
				.lineWidth(0.6)
				.strokeColor(C.divider)
				.stroke();

			doc
				.font(semiBold)
				.fontSize(7)
				.fillColor(C.muted)
				.text(
					options.audience === "internal"
						? `${report.acquirer} | ACQUIRER SETTLEMENT | ${String(report.merchantName || "").toUpperCase()}`
						: `MERCHANT SETTLEMENT STATEMENT | ${String(report.merchantName || "").toUpperCase()}`,
					margin,
					footerY + 12,
					{
						width: usableWidth - 80,
						lineBreak: false,
						ellipsis: true,
					},
				);

			if (!options.omitPageNumbers) doc
				.font(regular)
				.fontSize(7)
				.fillColor(C.muted)
				.text(
					`${i - pages.start + 1} / ${totalPages}`,
					pageWidth - margin - 60,
					footerY + 12,
					{
						width: 60,
						align: "right",
						lineBreak: false,
					},
				);

			doc.restore();
		}

		doc.end();
	});
};

const acquirerSettlementService = createAcquirerSettlementService({
	Report: MerchantSettlementReport,
	Transaction: MerchantTransaction,
	getTransactionQuery: getReportTransactionQuery,
	buildReportData: buildMerchantReportData,
	resolveReportPeriods: withDatestampReportPeriods,
});

export const getMerchantSettlementAcquirers = async (req, res) => {
	const result = await acquirerSettlementService.load(req.params.id);
	return res.json({
		success: true,
		data: acquirerSettlementService.discovery(result),
	});
};

export const downloadAcquirerSettlementPdf = async (req, res) => {
	const { report, parts, snapshot } = await acquirerSettlementService.load(req.params.id);
	if (req.body?.snapshot !== undefined && req.body.snapshot !== snapshot) {
		settlementDownloadError("Settlement amounts changed. Reopen the download dialog to refresh them.", 409);
	}
	const conversions = validateAcquirerConversions(parts, req.body, calculateSettlementConversion);
	const buffer = await buildCombinedAcquirerPdfBuffer(report, parts, conversions, buildSettlementPdfBuffer, {
		registerFonts: registerReportFonts,
	});
	const name = `MID${safeSettlementFilePart(report.memberId)}-${safeSettlementFilePart(report.merchantName)}-Acquirer-Settlement.pdf`;
	res.setHeader("Content-Type", "application/pdf");
	res.setHeader("Content-Disposition", `attachment; filename="${name}"; filename*=UTF-8''${encodeURIComponent(name)}`);
	res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");
	res.setHeader("Content-Length", buffer.length);
	return res.send(buffer);
};

export const downloadMerchantFacingSettlementPdf = async (req, res) => {
	if (!/^[a-f\d]{24}$/i.test(String(req.params.id))) settlementDownloadError("Invalid settlement report ID.");
	if (req.body?.ratesByAcquirer || req.body?.settlementCurrenciesByAcquirer) {
		settlementDownloadError("Merchant PDF uses its original merchant-wide settlementCurrency and rates.");
	}
	return downloadMerchantSettlementPdf(req, res);
};

export const downloadMerchantSettlementPdf = async (req, res) => {
	let report = await MerchantSettlementReport.findById(req.params.id).lean();

	if (!report) {
		return res.status(404).json({
			success: false,
			message: "Report not found",
		});
	}

	[report] = await withDatestampReportPeriods([report]);
	let conversion = null;

	/*
	|--------------------------------------------------------------------------
	| CASE 1: Modal values are sent from frontend
	|--------------------------------------------------------------------------
	| Example body:
	| {
	|   "settlementCurrency": "EUR",
	|   "rates": {
	|     "AUD": 0.61,
	|     "CAD": 0.68,
	|     "USD": 0.92,
	|     "EUR": 1
	|   }
	| }
	*/
	if (req.body?.settlementCurrency) {
		conversion = calculateSettlementConversion(report, {
			settlementCurrency: req.body.settlementCurrency,
			rates: req.body.rates || {},
		});
	} else {
		/*
		|--------------------------------------------------------------------------
		| CASE 2: Fallback if conversion was saved earlier
		|--------------------------------------------------------------------------
		*/
		conversion =
			report.settlementConversion ||
			report.reportData?.settlementConversion ||
			null;
	}

	const buffer = await buildSettlementPdfBuffer(report, conversion);

	const merchantName = slugify(report.merchantName || "merchant") || "merchant";
	const memberId = cleanText(report.memberId || "unknown");

	const fileName = `${memberId}-${merchantName}-settlement-report.pdf`;

	res.setHeader("Content-Type", "application/pdf");

	res.setHeader(
		"Content-Disposition",
		`attachment; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(
			fileName,
		)}`,
	);

	res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");
	res.setHeader("Content-Length", buffer.length);

	return res.send(buffer);
};

/*
|--------------------------------------------------------------------------
| Excel generation
|--------------------------------------------------------------------------
*/

const transactionToExcelRow = (txn) => ({
	Date: settlementDateToExcelCell(txn.transactionDate),
	"Source File": txn.sourceFileType,
	"Member ID": txn.memberId,
	Merchant: txn.merchantCompanyName,
	"Payment ID": txn.paymentId,
	"Tracking ID": txn.trackingId,
	"Order ID": txn.orderId,
	Currency: txn.currency,
	Brand: txn.paymentBrand,
	"ISO Country": txn.isoCountry,
	"Country Code": txn.countryCode,
	"Country Category": txn.countryCategory,
	Status: txn.status,
	"Auth Amount": txn.authAmount,
	"Captured Amount": txn.capturedAmount,
	"Reversal Amount": txn.reversalAmount,
	"Chargeback Amount": txn.chargebackAmountValue,
	"MDR Fee": txn.mdrFee,
	"Approval Fee": txn.approvalFee,
	"Decline Fee": txn.declineFee,
	"Reversal Fee": txn.reversalFee,
	"Chargeback Fee": txn.chargebackFee,
	"Settlement Expense": txn.settlementExpense,
	"Rolling Reserve": txn.rollingReserveAmount,
	"Total Fees": txn.totalFees,
	"Net Settlement": txn.netSettlement,
	"Match Type": txn.matchType,
});

export const buildSettlementExcelBuffer = async (report) => {
	[report] = await withDatestampReportPeriods([report]);
	const storedMatchedTransactions = await MerchantTransaction.find(
		getReportTransactionQuery(report, "matched"),
	)
		.populate("feeConfigId")
		.sort({ transactionDate: 1 })
		.lean();
	const matchedTransactions = storedMatchedTransactions.map(withPreciseTransactionMdr);

	const unmatchedTransactions = await MerchantTransaction.find(
		getReportTransactionQuery(report, "unmatched_fee"),
	)
		.sort({ transactionDate: 1 })
		.lean();

	const summary = report.summary || {};
	const reportData = report.reportData || {};
	const currency = getPrimaryCurrency(report);

	const wb = xlsx.utils.book_new();

	const summaryRows = [
		["Merchant", report.merchantName],
		["Member ID", report.memberId],
		["Report Date", formatDate(report.reportDate)],
		["Period From", formatDate(report.fromDate)],
		["Period To", formatDate(report.toDate)],
		["Currency", currency],
		["Email Status", report.emailStatus || "draft"],
		[],
		["Total Transactions", summary.totalTransactions || 0],
		["Success Transactions", summary.successTransactions || 0],
		["Declined Transactions", summary.declinedTransactions || 0],
		["Reversal Transactions", summary.reversalTransactions || 0],
		["Chargeback Transactions", summary.chargebackTransactions || 0],
		[],
		["Captured Amount", summary.capturedAmount || 0],
		["Reversal Amount", summary.reversalAmount || 0],
		["Chargeback Amount", summary.chargebackAmount || 0],
		[],
		["MDR Fee", summary.mdrFee || 0],
		["Approval Fee", summary.approvalFee || 0],
		["Decline Fee", summary.declineFee || 0],
		["Reversal Fee", summary.reversalFee || 0],
		["Chargeback Fee", summary.chargebackFee || 0],
		["Settlement Expense", summary.settlementExpense || 0],
		["Rolling Reserve", summary.rollingReserveAmount || 0],
		["Total Fees", summary.totalFees || 0],
		["Net Settlement", summary.netSettlement || 0],
	];

	xlsx.utils.book_append_sheet(
		wb,
		xlsx.utils.aoa_to_sheet(summaryRows),
		"Summary",
	);

	const feeRateExcelRows = buildFeeRateDisplayRows(
		reportData.feeRateSummary || {},
	).map((row) => ({
		"Payment Method": row.paymentMethod,
		Region: row.region,
		"Country Code": row.code,
		Currency: row.currency,
		Transactions: row.txns,

		"MDR %": row.mdrPercent,
		"Approval Fee / Success Txn": row.approvalFeeRate,
		"Decline Fee / Failed Txn": row.declineFeeRate,
		"Reversal Fee / Reversal Txn": row.reversalFeeRate,
		"Chargeback Fee / Chargeback Txn": row.chargebackFeeRate,
		"Rolling Reserve %": row.rollingReservePercent,
		"Settlement Expense %": row.settlementExpensePercent,

		"Captured Amount": row.capturedAmount,
		"MDR Fee Amount": row.mdrFee,
		"Approval Fee Amount": row.approvalFee,
		"Decline Fee Amount": row.declineFee,
		"Reversal Fee Amount": row.reversalFee,
		"Chargeback Fee Amount": row.chargebackFee,
		"Rolling Reserve Amount": row.rollingReserveAmount,
		"Settlement Expense Amount": row.settlementExpense,
		"Total Fees": row.totalFees,
		"Net Settlement": row.netSettlement,
	}));

	xlsx.utils.book_append_sheet(
		wb,
		xlsx.utils.json_to_sheet(feeRateExcelRows),
		safeSheetName("Applied Fee Rates"),
	);

	xlsx.utils.book_append_sheet(
		wb,
		xlsx.utils.json_to_sheet(Object.values(report.statusSummary || {})),
		safeSheetName("Status Summary"),
	);

	xlsx.utils.book_append_sheet(
		wb,
		xlsx.utils.json_to_sheet(Object.values(report.currencySummary || {})),
		safeSheetName("Currency Summary"),
	);

	xlsx.utils.book_append_sheet(
		wb,
		xlsx.utils.json_to_sheet(Object.values(report.brandSummary || {})),
		safeSheetName("Brand Summary"),
	);

	xlsx.utils.book_append_sheet(
		wb,
		xlsx.utils.json_to_sheet(reportData.daySummary || []),
		safeSheetName("Day Summary"),
	);

	const successfulRows = matchedTransactions
		.filter((txn) => isSuccessStatus(txn.status, txn.sourceFileType))
		.map(transactionToExcelRow);

	const declinedRows = matchedTransactions
		.filter((txn) => isDeclineStatus(txn.status, txn.sourceFileType))
		.map(transactionToExcelRow);

	const reversalRows = matchedTransactions
		.filter((txn) => isReversalStatus(txn.status, txn.sourceFileType))
		.map(transactionToExcelRow);

	const chargebackRows = matchedTransactions
		.filter(
			(txn) =>
				isChargebackStatus(txn.status, txn.sourceFileType) ||
				isChargebackReversedStatus(txn.status, txn.sourceFileType),
		)
		.map(transactionToExcelRow);

	xlsx.utils.book_append_sheet(
		wb,
		xlsx.utils.json_to_sheet(successfulRows),
		safeSheetName("Successful Transactions"),
	);

	xlsx.utils.book_append_sheet(
		wb,
		xlsx.utils.json_to_sheet(declinedRows),
		safeSheetName("Declined Transactions"),
	);

	xlsx.utils.book_append_sheet(
		wb,
		xlsx.utils.json_to_sheet(reversalRows),
		safeSheetName("Reversals"),
	);

	xlsx.utils.book_append_sheet(
		wb,
		xlsx.utils.json_to_sheet(chargebackRows),
		safeSheetName("Chargebacks"),
	);

	xlsx.utils.book_append_sheet(
		wb,
		xlsx.utils.json_to_sheet(matchedTransactions.map(transactionToExcelRow)),
		safeSheetName("All Transactions"),
	);

	xlsx.utils.book_append_sheet(
		wb,
		xlsx.utils.json_to_sheet(unmatchedTransactions.map(transactionToExcelRow)),
		safeSheetName("Unmatched Fee Rows"),
	);

	return xlsx.write(wb, {
		type: "buffer",
		bookType: "xlsx",
	});
};

// export const downloadMerchantSettlementExcel = async (req, res) => {
// 	const report = await MerchantSettlementReport.findById(req.params.id).lean();

// 	if (!report) {
// 		return res.status(404).json({
// 			success: false,
// 			message: "Report not found",
// 		});
// 	}

// 	const buffer = await buildSettlementExcelBuffer(report);

// 	res.setHeader(
// 		"Content-Disposition",
// 		`attachment; filename=merchant-settlement-${report.memberId}.xlsx`,
// 	);

// 	res.setHeader(
// 		"Content-Type",
// 		"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
// 	);

// 	return res.send(buffer);
// };

export const downloadMerchantSettlementExcel = async (req, res) => {
	const report = await MerchantSettlementReport.findById(req.params.id).lean();

	if (!report) {
		return res.status(404).json({
			success: false,
			message: "Report not found",
		});
	}

	const buffer = await buildSettlementExcelBuffer(report);

	const merchantName = slugify(report.merchantName || "merchant") || "merchant";

	const memberId = cleanText(report.memberId || "unknown");

	const fileName = `${merchantName}-${memberId}-settlement.xlsx`;

	res.setHeader(
		"Content-Type",
		"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	);

	res.setHeader(
		"Content-Disposition",
		`attachment; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
	);

	res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");

	res.setHeader("Content-Length", buffer.length);

	return res.send(buffer);
};

/*
|--------------------------------------------------------------------------
| Email sending
|--------------------------------------------------------------------------
*/

export const sendMailWithAttachments = async ({
	to,
	subject,
	html,
	attachments,
}) => {
	return mailTransporter.sendMail({
		from: process.env.SMTP_FROM || process.env.SMTP_USER,
		to,
		subject,
		html,
		attachments,
	});
};

export const sendMerchantSettlementEmail = async (req, res) => {
	const report = await MerchantSettlementReport.findById(req.params.id);

	if (!report) {
		return res.status(404).json({
			success: false,
			message: "Report not found",
		});
	}

	const reportObject = report.toObject();

	const recipients = report.emailRecipients || [];

	const to =
		recipients.length > 0
			? recipients.map((item) => item.email).filter(Boolean)
			: String(req.body.emailTo || report.emailTo || "")
					.split(",")
					.map((item) => item.trim())
					.filter(Boolean);

	if (!to.length) {
		return res.status(400).json({
			success: false,
			message: "No merchant email recipients found",
		});
	}

	try {
		const [excelBuffer, pdfBuffer] = await Promise.all([
			buildSettlementExcelBuffer(reportObject),
			buildSettlementPdfBuffer(
				reportObject,
				reportObject.settlementConversion ||
					reportObject.reportData?.settlementConversion ||
					null,
			),
		]);

		const baseFileName = `${slugify(report.merchantName)}-${report.memberId}-settlement`;

		await sendMailWithAttachments({
			to,
			subject: `Settlement Report - ${report.merchantName} - ${report.memberId}`,
			html: `
				<p>Dear Merchant,</p>
				<p>Please find attached your settlement report.</p>
				<p>Attached files:</p>
				<ul>
					<li>Settlement PDF Summary</li>
					<li>Settlement Excel Transaction List</li>
				</ul>
				<p>Regards,<br/>Settlement Team</p>
			`,
			attachments: [
				{
					filename: `${baseFileName}.pdf`,
					content: pdfBuffer,
					contentType: "application/pdf",
				},
				{
					filename: `${baseFileName}.xlsx`,
					content: excelBuffer,
					contentType:
						"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
				},
			],
		});

		report.emailStatus = "sent";
		report.emailSentAt = new Date();
		report.emailTo = to.join(",");
		report.emailError = "";

		await report.save();

		return res.json({
			success: true,
			message: "Settlement report email sent successfully",
			data: report,
		});
	} catch (error) {
		report.emailStatus = "failed";
		report.emailError = error.message;

		await report.save();

		return res.status(500).json({
			success: false,
			message: "Failed to send settlement report email",
			error: error.message,
		});
	}
};

export const listMerchantSettlementBatches = async (req, res) => {
	const { search, status, page = 1, limit = 50 } = req.query;

	const pageNumber = Math.max(Number(page) || 1, 1);

	const limitNumber = Math.min(Math.max(Number(limit) || 50, 1), 500);

	const skip = (pageNumber - 1) * limitNumber;

	const query = {};

	if (status) {
		query.status = status;
	}

	if (search) {
		query.batchName = new RegExp(String(search).trim(), "i");
	}

	const [data, total] = await Promise.all([
		MerchantSettlementBatch.find(query)
			.sort({ createdAt: -1 })
			.skip(skip)
			.limit(limitNumber)
			.lean(),

		MerchantSettlementBatch.countDocuments(query),
	]);
	const batches = await resolveDatestampBatchPeriods(data, MerchantTransaction);

	return res.json({
		success: true,

		data: batches,

		meta: {
			total,
			page: pageNumber,
			limit: limitNumber,
			totalPages: Math.ceil(total / limitNumber),
		},
	});
};

export const sendAllSettlementEmailsForBatch = async (req, res) => {
	const reports = await MerchantSettlementReport.find({
		settlementBatchId: req.params.batchId,
		emailStatus: { $nin: ["sent", "queued", "sending"] },
	}).lean();

	if (!reports.length) {
		return res.json({
			success: true,
			message: "No pending settlement reports found for email",
			data: {
				queuedCount: 0,
			},
		});
	}

	const results = [];

	for (const report of reports) {
		const recipients = report.emailRecipients || [];
		const to = recipients.map((item) => item.email).filter(Boolean);

		if (!to.length && !report.emailTo) {
			await MerchantSettlementReport.updateOne(
				{ _id: report._id },
				{
					$set: {
						emailStatus: "failed",
						emailError: "No merchant email recipients found",
					},
				},
			);

			results.push({
				reportId: report._id,
				memberId: report.memberId,
				status: "failed",
				message: "No merchant email recipients found",
			});

			continue;
		}

		await publishSettlementEmailJob({
			reportId: report._id,
			batchId: req.params.batchId,
			requestedBy: req.user._id,
		});

		await MerchantSettlementReport.updateOne(
			{ _id: report._id },
			{
				$set: {
					emailStatus: "queued",
					emailQueuedAt: new Date(),
					emailError: "",
				},
			},
		);

		results.push({
			reportId: report._id,
			memberId: report.memberId,
			status: "queued",
		});
	}

	return res.json({
		success: true,
		message: "Settlement emails queued successfully",
		data: {
			queuedCount: results.filter((item) => item.status === "queued").length,
			failedCount: results.filter((item) => item.status === "failed").length,
			results,
		},
	});
};

// COUNTRY

const normalizeCountryCategory = (value) => {
	const text = normalizeUpper(value);

	if (["EU", "EUROPE", "EUROPEAN UNION"].includes(text)) {
		return "EU";
	}

	if (
		[
			"NONEU",
			"NON-EU",
			"NON EU",
			"NON_EU",
			"NON EUROPE",
			"NON-EUROPE",
			"NON EUROPEAN UNION",
		].includes(text)
	) {
		return "NONEU";
	}

	return "NONEU";
};

const COUNTRY_CODE_BY_NAME = {
	"UNITED KINGDOM": "GB",
	UK: "GB",
	"GREAT BRITAIN": "GB",

	TURKEY: "TR",
	TÜRKIYE: "TR",
	KAZAKHSTAN: "KZ",
	JAPAN: "JP",

	GERMANY: "DE",
	NORWAY: "NO",
	SWITZERLAND: "CH",
	IRELAND: "IE",
	FRANCE: "FR",
	SPAIN: "ES",
	ITALY: "IT",
	NETHERLANDS: "NL",
	BELGIUM: "BE",
	AUSTRIA: "AT",
	PORTUGAL: "PT",
	POLAND: "PL",
	SWEDEN: "SE",
	DENMARK: "DK",
	FINLAND: "FI",
	CZECHIA: "CZ",
	"CZECH REPUBLIC": "CZ",
	GREECE: "GR",
	ROMANIA: "RO",
	HUNGARY: "HU",
	BULGARIA: "BG",
	CROATIA: "HR",
	SLOVAKIA: "SK",
	SLOVENIA: "SI",
	ESTONIA: "EE",
	LATVIA: "LV",
	LITHUANIA: "LT",
	LUXEMBOURG: "LU",
	MALTA: "MT",
	CYPRUS: "CY",
};

const normalizeFeeCountryCode = (value) => {
	const text = normalizeUpper(value);

	if (!text) return "";

	return COUNTRY_CODE_BY_NAME[text] || text;
};

const getCountryValue = (row, keys) => {
	for (const key of keys) {
		const value = row[key];

		if (value !== undefined && value !== null && String(value).trim()) {
			return String(value).trim();
		}
	}

	return "";
};

const normalizeCountryMasterRow = (row) => {
	const transactionCountryName = getCountryValue(row, [
		"Transaction Country Name",
		"TRANSACTION COUNTRY NAME",
		"Country Name",
		"COUNTRY NAME",
		"ISO Country",
		"ISO COUNTRY",
		"Country",
		"COUNTRY",
		"transactionCountryName",
		"countryName",
	]);

	const feeCountryCode = getCountryValue(row, [
		"Fee Country Code",
		"FEE COUNTRY CODE",
		"Country Code",
		"COUNTRY CODE",
		"Fee Code",
		"FEE CODE",
		"Code",
		"CODE",
		"feeCountryCode",
		"countryCode",
	]);

	const countryCategory = getCountryValue(row, [
		"Country Category",
		"COUNTRY CATEGORY",
		"Category",
		"CATEGORY",
		"EU/NON EU",
		"EU/NONEU",
		"countryCategory",
	]);

	if (!transactionCountryName) {
		return null;
	}

	return {
		transactionCountryName: normalizeText(transactionCountryName),
		feeCountryCode:
			normalizeFeeCountryCode(feeCountryCode) ||
			normalizeFeeCountryCode(transactionCountryName),
		countryCategory: normalizeCountryCategory(countryCategory),
	};
};

const buildCountryMasterRowsFromColumnFile = (rows) => {
	const countryMap = new Map();

	const addCountry = ({ countryName, countryCategory, isSpecific = false }) => {
		const cleanCountryName = normalizeText(countryName);

		if (!cleanCountryName) return;

		const existing = countryMap.get(cleanCountryName);

		/*
			Specific should override EU/NONEU because fee file has exact country rules.
			Example: TURKEY should resolve to TR, KAZAKHSTAN to KZ, JAPAN to JP.
		*/
		if (existing && !isSpecific) return;

		countryMap.set(cleanCountryName, {
			transactionCountryName: cleanCountryName,
			feeCountryCode: normalizeFeeCountryCode(cleanCountryName),
			countryCategory,
			sourceColumn: isSpecific
				? "Specific"
				: countryCategory === "EU"
					? "EU"
					: "NonEU",
		});
	};

	for (const row of rows) {
		const euCountry = getCountryValue(row, ["EU"]);
		const nonEuCountry = getCountryValue(row, [
			"NonEU",
			"NONEU",
			"Non EU",
			"NON EU",
			"Non-EU",
			"NON-EU",
		]);
		const specificCountry = getCountryValue(row, ["Specific", "SPECIFIC"]);

		if (euCountry) {
			addCountry({
				countryName: euCountry,
				countryCategory: "EU",
			});
		}

		if (nonEuCountry) {
			addCountry({
				countryName: nonEuCountry,
				countryCategory: "NONEU",
			});
		}

		if (specificCountry) {
			addCountry({
				countryName: specificCountry,
				countryCategory: "NONEU",
				isSpecific: true,
			});
		}

		/*
			Ignore "All" column.
			"All" is handled from fee rules as fallback, not stored as country master.
		*/
	}

	return [...countryMap.values()];
};

const buildCountryMasterRows = (rows) => {
	if (!rows.length) return [];

	const firstRow = rows[0] || {};
	const headers = Object.keys(firstRow).map((key) => normalizeText(key));

	const isColumnBasedCountryFile =
		headers.includes("EU") ||
		headers.includes("NONEU") ||
		headers.includes("NON EU") ||
		headers.includes("NON-EU") ||
		headers.includes("SPECIFIC");

	if (isColumnBasedCountryFile) {
		return buildCountryMasterRowsFromColumnFile(rows);
	}

	return rows.map(normalizeCountryMasterRow).filter(Boolean);
};

export const uploadCountryMaster = async (req, res) => {
	const file = req.files?.file?.[0] || req.file;

	if (!file) {
		return res.status(400).json({
			success: false,
			message: "Country master file is required",
		});
	}

	try {
		/*
		 * IMPORTANT:
		 *
		 * Multer now uses diskStorage,
		 * therefore use file.path.
		 *
		 * DO NOT use file.buffer here.
		 */
		const rows = parseWorkbookRows(file.path);

		const cleanRows = buildCountryMasterRows(rows).filter(
			(row) => row.transactionCountryName && row.feeCountryCode,
		);

		if (!cleanRows.length) {
			return res.status(400).json({
				success: false,

				message: "No valid country rows found",

				debug: {
					totalRows: rows.length,

					headers: rows[0] ? Object.keys(rows[0]) : [],
				},
			});
		}

		const operations = cleanRows.map((row) => ({
			updateOne: {
				filter: {
					transactionCountryName: row.transactionCountryName,
				},

				update: {
					$set: {
						feeCountryCode: row.feeCountryCode,

						countryCategory: row.countryCategory,

						status: "active",

						updatedBy: req.user._id,
					},

					$setOnInsert: {
						createdBy: req.user._id,
					},
				},

				upsert: true,
			},
		}));

		await CountryMaster.bulkWrite(operations, {
			ordered: false,
		});

		const uniqueCountryNames = [
			...new Set(cleanRows.map((row) => row.transactionCountryName)),
		];

		return res.status(201).json({
			success: true,

			message: "Country master uploaded successfully",

			data: {
				excelRows: rows.length,

				countryRecordsProcessed: cleanRows.length,

				uniqueCountriesStored: uniqueCountryNames.length,

				euColumnRows: cleanRows.filter((row) => row.sourceColumn === "EU")
					.length,

				nonEuColumnRows: cleanRows.filter((row) => row.sourceColumn === "NonEU")
					.length,

				specificColumnRows: cleanRows.filter(
					(row) => row.sourceColumn === "Specific",
				).length,

				totalEuCountries: cleanRows.filter(
					(row) => row.countryCategory === "EU",
				).length,

				totalNonEuCountries: cleanRows.filter(
					(row) => row.countryCategory === "NONEU",
				).length,
			},
		});
	} finally {
		/*
		 * ALWAYS remove the temporary
		 * Multer disk file.
		 *
		 * Even this:
		 *
		 * return res.status(400)...
		 *
		 * still executes finally.
		 */
		await safeDeleteTempFile(file.path);
	}
};

export const createCountryMaster = async (req, res) => {
	const row = normalizeCountryMasterRow(req.body);

	if (!row.transactionCountryName || !row.feeCountryCode) {
		return res.status(400).json({
			success: false,
			message: "transactionCountryName and feeCountryCode are required",
		});
	}

	const data = await CountryMaster.create({
		...row,
		status: req.body.status || "active",
		createdBy: req.user._id,
		updatedBy: req.user._id,
	});

	return res.status(201).json({
		success: true,
		message: "Country master created successfully",
		data,
	});
};

export const listCountryMaster = async (req, res) => {
	const { search, status = "active", page = 1, limit = 100 } = req.query;

	const pageNumber = Math.max(Number(page) || 1, 1);
	const limitNumber = Math.min(Math.max(Number(limit) || 100, 1), 500);
	const skip = (pageNumber - 1) * limitNumber;

	const query = {};

	if (status !== "all") {
		query.status = status;
	}

	if (search) {
		const regex = new RegExp(String(search).trim(), "i");

		query.$or = [
			{ transactionCountryName: regex },
			{ feeCountryCode: regex },
			{ countryCategory: regex },
		];
	}

	const [data, total] = await Promise.all([
		CountryMaster.find(query)
			.sort({ transactionCountryName: 1 })
			.skip(skip)
			.limit(limitNumber)
			.lean(),
		CountryMaster.countDocuments(query),
	]);

	return res.json({
		success: true,
		meta: {
			total,
			page: pageNumber,
			limit: limitNumber,
			totalPages: Math.ceil(total / limitNumber),
		},
		data,
	});
};

export const getCountryMaster = async (req, res) => {
	const data = await CountryMaster.findById(req.params.id).lean();

	if (!data) {
		return res.status(404).json({
			success: false,
			message: "Country master row not found",
		});
	}

	return res.json({
		success: true,
		data,
	});
};

export const updateCountryMaster = async (req, res) => {
	const row = normalizeCountryMasterRow(req.body);

	const update = {
		updatedBy: req.user._id,
	};

	if (row?.transactionCountryName) {
		update.transactionCountryName = row.transactionCountryName;
	}

	if (row?.feeCountryCode) {
		update.feeCountryCode = row.feeCountryCode;
	}

	if (row?.countryCategory) {
		update.countryCategory = row.countryCategory;
	}

	if (req.body.status) {
		update.status = req.body.status;
	}

	const data = await CountryMaster.findByIdAndUpdate(
		req.params.id,
		{
			$set: update,
		},
		{
			new: true,
			runValidators: true,
		},
	);

	if (!data) {
		return res.status(404).json({
			success: false,
			message: "Country master row not found",
		});
	}

	return res.json({
		success: true,
		message: "Country master updated successfully",
		data,
	});
};

export const deleteCountryMaster = async (req, res) => {
	const data = await CountryMaster.findByIdAndUpdate(
		req.params.id,
		{
			$set: {
				status: "inactive",
				updatedBy: req.user._id,
			},
		},
		{ new: true },
	);

	if (!data) {
		return res.status(404).json({
			success: false,
			message: "Country master row not found",
		});
	}

	return res.json({
		success: true,
		message: "Country master row deleted successfully",
		data,
	});
};
