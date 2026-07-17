import mongoose from "mongoose";
import xlsx from "xlsx";
import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";
import { mailTransporter } from "../utils/SendEmail.js";

import { MerchantFeeConfig } from "../models/merchant-fee-config.model.js";
import { MerchantTransactionUpload } from "../models/merchant-transaction-upload.model.js";
import { MerchantTransaction } from "../models/merchant-transaction.model.js";
import { MerchantSettlementReport } from "../models/merchant-settlement-report.model.js";
import { MerchantSettlementBatch } from "../models/merchant-settlement-batch.model.js";
import { CountryMaster } from "../models/country-master.model.js";
import { User } from "../models/user.model.js";
import { publishSettlementEmailJob } from "../utils/rabbitmq.js";
import { MerchantAccount } from "../models/merchant-account.model.js";

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

const parseDate = (value) => {
	if (!value) return null;

	const date = new Date(value);

	if (Number.isNaN(date.getTime())) return null;

	return date;
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

const parseWorkbookRows = (buffer) => {
	const workbook = xlsx.read(buffer, {
		type: "buffer",
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

const parseCsvTransactionRows = (buffer) => {
	const content = buffer.toString("utf8");
	const lines = content.split(/\r?\n/);

	const headerIndex = lines.findIndex((line) => {
		const upper = line.toUpperCase();

		return (
			upper.includes("TRANSACTION DATE") ||
			upper.includes("DATESTAMP") ||
			upper.includes("TIME STAMP") ||
			upper.includes("TIMESTAMP")
		);
	});

	if (headerIndex === -1) return [];

	const csvContent = lines.slice(headerIndex).join("\n");

	const workbook = xlsx.read(csvContent, {
		type: "string",
		raw: false,
	});

	const sheet = workbook.Sheets[workbook.SheetNames[0]];

	const rows = xlsx.utils.sheet_to_json(sheet, {
		defval: "",
		raw: false,
	});

	return rows.map((row) => {
		const normalized = {};

		for (const [key, value] of Object.entries(row)) {
			assignNormalizedValue(normalized, key, value);
		}

		return normalized;
	});
};

const parseAnyRows = (file) => {
	const isCsv = file.originalname.toLowerCase().endsWith(".csv");

	return isCsv
		? parseCsvTransactionRows(file.buffer)
		: parseWorkbookRows(file.buffer);
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
	bucket._cents = bucket._cents || {};
	bucket._cents[field] = addCents(bucket._cents[field], value);
	bucket[field] = fromCents(bucket._cents[field]);
};

const removeInternalCents = (map) => {
	for (const item of Object.values(map || {})) {
		delete item._cents;
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
*/

const DATESTAMP_ALLOWED_STATUSES = new Set([
	"SETTLED",
	"CAPTURE SUCCESSFUL",
	"CAPTURED",
	"RR SETTLE",
	"AUTH FAILED",
]);

const TIMESTAMP_ALLOWED_STATUSES = new Set(["REVERSED", "CHARGEBACK"]);

const SUCCESS_STATUSES = new Set([
	"SETTLED",
	"CAPTURE SUCCESSFUL",
	"CAPTURED",
	"RR SETTLE",
]);

const DECLINE_STATUSES = new Set(["AUTH FAILED"]);
const REVERSAL_STATUSES = new Set(["REVERSED"]);
const CHARGEBACK_STATUSES = new Set(["CHARGEBACK"]);

const isAllowedStatusForSource = (status, sourceFileType) => {
	const value = normalizeUpper(status);

	if (sourceFileType === "timestamp") {
		return TIMESTAMP_ALLOWED_STATUSES.has(value);
	}

	return DATESTAMP_ALLOWED_STATUSES.has(value);
};

const isSuccessStatus = (status) =>
	SUCCESS_STATUSES.has(normalizeUpper(status));
const isDeclineStatus = (status) =>
	DECLINE_STATUSES.has(normalizeUpper(status));
const isReversalStatus = (status) =>
	REVERSAL_STATUSES.has(normalizeUpper(status));
const isChargebackStatus = (status) =>
	CHARGEBACK_STATUSES.has(normalizeUpper(status));

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

	const rows = parseWorkbookRows(file.buffer);

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

		if (!accountIds.length) accountIds = [];

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
		await MerchantFeeConfig.insertMany(docs, { ordered: false });
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

	const doc = await MerchantFeeConfig.create(payload);

	return res.status(201).json({
		success: true,
		message: "Merchant fee created successfully",
		data: doc,
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

	Object.assign(existing, payload);

	await existing.save();

	return res.json({
		success: true,
		message: "Merchant fee updated successfully",
		data: existing,
	});
};

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
		query.$or = [
			{ merchantName: new RegExp(search, "i") },
			{ memberId: new RegExp(search, "i") },
			{ partnerName: new RegExp(search, "i") },
			{ accountIds: new RegExp(search, "i") },
			{ country: new RegExp(search, "i") },
			{ countryCode: new RegExp(search, "i") },
		];
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
	transactionDate: parseDate(
		getValue(row, [
			"Datestamp",
			"Date Stamp",
			"Timestamp",
			"Time Stamp",
			"Transaction Date(MM/DD/YYYY)",
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

const calculateFees = ({ row, fee }) => {
	const status = normalizeUpper(row.status);

	const isSuccess = isSuccessStatus(status);
	const isDecline = isDeclineStatus(status);
	const isReversal = isReversalStatus(status);
	const isChargeback = isChargebackStatus(status);

	const salesAmount = isSuccess
		? Number(row.capturedAmountFromFile || row.authAmount || 0)
		: 0;

	const reversalAmount = isReversal
		? Number(
				row.refundAmount || row.capturedAmountFromFile || row.authAmount || 0,
			)
		: 0;

	const chargebackAmountValue = isChargeback
		? Number(
				row.chargebackAmount ||
					row.capturedAmountFromFile ||
					row.authAmount ||
					0,
			)
		: 0;

	/*
	Business rule:
	Successful settled activity includes sales + reversals + chargebacks.
	Therefore MDR and approval are applied to all three.
*/
	const isSettledActivity = isSuccess || isReversal || isChargeback;

	const capturedAmount = isSuccess
		? salesAmount
		: isReversal
			? reversalAmount
			: isChargeback
				? chargebackAmountValue
				: 0;

	const capturedCents = toCents(capturedAmount);

	const mdrFee = isSettledActivity
		? fromCents(percentFeeCents(capturedCents, fee.mdrPercent))
		: 0;

	const rollingReserveAmount = isSettledActivity
		? fromCents(percentFeeCents(capturedCents, fee.rollingReservePercent))
		: 0;

	const approvalFee = isSettledActivity ? roundMoney(fee.approvalFee) : 0;
	const declineFee = isDecline ? roundMoney(fee.declineFee) : 0;
	const reversalFee = isReversal ? roundMoney(fee.reversalFee) : 0;
	const chargebackFee = isChargeback ? roundMoney(fee.chargebackFee) : 0;

	/*
		Settlement expense is intentionally 0 here.
		It must be calculated later at report level after all base deductions.
	*/
	const settlementExpense = 0;

	const totalFees = roundMoney(
		mdrFee +
			approvalFee +
			declineFee +
			reversalFee +
			chargebackFee +
			rollingReserveAmount +
			reversalAmount +
			chargebackAmountValue,
	);

	const netSettlement = roundMoney(capturedAmount - totalFees);

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

const processTransactionFile = async ({
	file,
	sourceFileType,
	settlementBatchId,
	userId,
	feeIndexes,
	countryMap,
}) => {
	const rows = parseAnyRows(file);

	const upload = await MerchantTransactionUpload.create({
		settlementBatchId,
		fileName: file.originalname,
		sourceFileType,
		totalRows: rows.length,
		validRows: 0,
		matchedRows: 0,
		unmatchedFeeRows: 0,
		skippedRows: 0,
		uploadedBy: userId,
	});

	let matchedRows = 0;
	let unmatchedFeeRows = 0;
	let skippedRows = 0;
	let insertedRows = 0;

	const batch = [];
	const BATCH_SIZE = 1000;

	const flushBatch = async () => {
		if (!batch.length) return;

		const toInsert = batch.splice(0, batch.length);
		insertedRows += await insertTransactionsInChunks(toInsert, BATCH_SIZE);
	};

	for (const rawRow of rows) {
		let row = normalizeTransactionRow(rawRow);

		row = normalizeTransactionForMatching(row);

		if (!isAllowedStatusForSource(row.status, sourceFileType)) {
			skippedRows += 1;
			continue;
		}

		if (isMissingRequiredTransactionField(row)) {
			skippedRows += 1;
			continue;
		}

		const country = resolveTransactionCountry(row.isoCountry, countryMap);

		row.countryName = country.countryName;
		row.countryCode = country.countryCode;
		row.countryCategory = country.countryCategory;

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
			const feeAmounts = calculateFees({ row, fee });

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

		if (batch.length >= BATCH_SIZE) {
			await flushBatch();
		}
	}

	await flushBatch();

	await MerchantTransactionUpload.updateOne(
		{ _id: upload._id },
		{
			$set: {
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
		totalRows: rows.length,
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

export const uploadSettlementBatchTransactions = async (req, res) => {
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

	if (!datestampFile && !timestampFile) {
		return res.status(400).json({
			success: false,
			message: "Datestamp file or timestamp file is required",
		});
	}

	const settlementBatch = await MerchantSettlementBatch.create({
		batchName:
			req.body.batchName || `Settlement Batch ${new Date().toISOString()}`,
		reportDate: req.body.reportDate ? parseDate(req.body.reportDate) : null,
		fromDate: req.body.fromDate ? parseDate(req.body.fromDate) : null,
		toDate: req.body.toDate ? parseDate(req.body.toDate) : null,
		datestampFileName: datestampFile?.originalname || "",
		timestampFileName: timestampFile?.originalname || "",
		status: "processing",
		uploadedBy: req.user._id,
	});

	try {
		const feeIndexes = await buildFeeIndexes();
		const countryMap = await buildCountryMasterMap();

		const fileResults = [];

		if (datestampFile) {
			fileResults.push(
				await processTransactionFile({
					file: datestampFile,
					sourceFileType: "datestamp",
					settlementBatchId: settlementBatch._id,
					userId: req.user._id,
					feeIndexes,
					countryMap,
				}),
			);
		}

		if (timestampFile) {
			fileResults.push(
				await processTransactionFile({
					file: timestampFile,
					sourceFileType: "timestamp",
					settlementBatchId: settlementBatch._id,
					userId: req.user._id,
					feeIndexes,
					countryMap,
				}),
			);
		}

		const generatedReportIds = await generateReportsForBatch({
			settlementBatchId: settlementBatch._id,
			userId: req.user._id,
		});

		const totals = fileResults.reduce(
			(acc, item) => {
				acc.totalRows += item.totalRows;
				acc.validRows += item.insertedRows;
				acc.matchedRows += item.matchedRows;
				acc.unmatchedFeeRows += item.unmatchedFeeRows;
				acc.skippedRows += item.skippedRows;
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
			{ _id: settlementBatch._id },
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

		return res.status(500).json({
			success: false,
			message: "Settlement batch upload failed. All partial data was removed.",
			error: error.message,
		});
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

const buildMerchantReportData = async ({
	settlementBatchId,
	memberId,
	reportDate,
	fromDate,
	toDate,
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

	const transactions = await MerchantTransaction.find(query)
		.populate("feeConfigId")
		.sort({ transactionDate: 1 })
		.lean();

	const first = transactions[0];

	const transactionDates = transactions
		.map((txn) => (txn.transactionDate ? new Date(txn.transactionDate) : null))
		.filter((date) => date && !Number.isNaN(date.getTime()))
		.sort((a, b) => a.getTime() - b.getTime());

	const transactionFromDate = transactionDates[0] || null;
	const transactionToDate =
		transactionDates[transactionDates.length - 1] || transactionFromDate;

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
		mdrFee: 0,
		approvalFee: 0,
		declineFee: 0,
		reversalFee: 0,
		chargebackFee: 0,
		rollingReserveAmount: 0,
		totalFees: 0,
		netSettlement: 0,
	};

	for (const txn of transactions) {
		const status = normalizeUpper(txn.status);
		const currency = txn.currency || "UNKNOWN";
		const brandGroup = getPaymentBrandGroup(txn.paymentBrand);
		const fee = txn.feeConfigId || {};
		const isSuccessTxn = isSuccessStatus(status);
		const isDeclineTxn = isDeclineStatus(status);
		const isAdjustmentTxn =
			isReversalStatus(status) || isChargebackStatus(status);
		const day = txn.transactionDate
			? new Date(txn.transactionDate).toISOString().slice(0, 10)
			: "UNKNOWN";

		const isSettledActivityTxn =
			isSuccessStatus(status) ||
			isReversalStatus(status) ||
			isChargebackStatus(status);

		if (isSettledActivityTxn) summary.successTransactions += 1;
		if (isDeclineStatus(status)) summary.declinedTransactions += 1;
		if (isReversalStatus(status)) summary.reversalTransactions += 1;
		if (isChargebackStatus(status)) summary.chargebackTransactions += 1;

		if (status === "SETTLED") summary.settledTransactions += 1;
		if (status === "CAPTURE SUCCESSFUL" || status === "CAPTURED") {
			summary.captureSuccessfulTransactions += 1;
		}
		if (status === "RR SETTLE") summary.rrSettleTransactions += 1;
		if (status === "AUTH FAILED") summary.authFailedTransactions += 1;

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

		summaryCents.mdrFee = addCents(summaryCents.mdrFee, txn.mdrFee);
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
		summaryCents.totalFees = addCents(summaryCents.totalFees, txn.totalFees);
		summaryCents.netSettlement = addCents(
			summaryCents.netSettlement,
			txn.netSettlement,
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
				isReversalStatus(status) &&
				!Number(bucket.reversalFeeRate || 0) &&
				Number(fee.reversalFee || 0)
			) {
				bucket.reversalFeeRate = Number(fee.reversalFee);
			}

			if (
				isChargebackStatus(status) &&
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

			bucket.totalDeduction = fromCents(
				(bucket._cents?.reversalAmount || 0) +
					(bucket._cents?.reversalFee || 0) +
					(bucket._cents?.chargebackAmount || 0) +
					(bucket._cents?.chargebackFee || 0),
			);

			addMoneyToBucket(bucket, "netSettlement", txn.netSettlement);
		}

		if (txn.transactionMode) {
			modeSummary[txn.transactionMode] = modeSummary[txn.transactionMode] || {
				mode: txn.transactionMode,
				txns: 0,
			};
			modeSummary[txn.transactionMode].txns += 1;
		}

		if (
			(isSuccessTxn || isAdjustmentTxn) &&
			Number(txn.capturedAmount || 0) > 0
		) {
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
				capturedAmount: 0,
				totalFees: 0,
				netSettlement: 0,
			};

			const bucket = daySummaryMap[dayKey];

			bucket.totalTxns += 1;

			if (isSuccessTxn || isAdjustmentTxn) {
				bucket.successTxns += 1;
			}

			if (isDeclineTxn) {
				bucket.failedTxns += 1;
			}

			addMoneyToBucket(bucket, "capturedAmount", txn.capturedAmount);
			addMoneyToBucket(bucket, "totalFees", txn.totalFees);
			addMoneyToBucket(bucket, "netSettlement", txn.netSettlement);
		}
	}

	setMoneyFromCents(summary, summaryCents, Object.keys(summaryCents));

	const finalSummaryCents = {
		feesBeforeSettlementExpense: 0,
		settlementExpenseBase: 0,
		settlementExpense: 0,
		totalFees: 0,
		netSettlement: 0,
	};

	for (const currencyRow of Object.values(currencySummary)) {
		const feesBeforeSettlementExpenseCents =
			toCents(currencyRow.mdrFee) +
			toCents(currencyRow.approvalFee) +
			toCents(currencyRow.declineFee) +
			toCents(currencyRow.reversalFee) +
			toCents(currencyRow.chargebackFee) +
			toCents(currencyRow.rollingReserveAmount) +
			toCents(currencyRow.reversalAmount) +
			toCents(currencyRow.chargebackAmount);

		const settlementExpenseBaseCents =
			toCents(currencyRow.capturedAmount) - feesBeforeSettlementExpenseCents;

		const settlementExpensePercent = currencyRow.settlementExpensePercent || 0;

		const settlementExpenseCents =
			settlementExpenseBaseCents > 0
				? percentFeeCents(settlementExpenseBaseCents, settlementExpensePercent)
				: 0;

		const totalFeesCents =
			feesBeforeSettlementExpenseCents + settlementExpenseCents;

		const netSettlementCents =
			toCents(currencyRow.capturedAmount) - totalFeesCents;

		currencyRow.feesBeforeSettlementExpense = fromCents(
			feesBeforeSettlementExpenseCents,
		);

		currencyRow.settlementExpenseBase = fromCents(settlementExpenseBaseCents);

		currencyRow.settlementExpense = fromCents(settlementExpenseCents);
		currencyRow.totalFees = fromCents(totalFeesCents);
		currencyRow.netSettlement = fromCents(netSettlementCents);

		finalSummaryCents.feesBeforeSettlementExpense +=
			feesBeforeSettlementExpenseCents;
		finalSummaryCents.settlementExpenseBase += settlementExpenseBaseCents;
		finalSummaryCents.settlementExpense += settlementExpenseCents;
		finalSummaryCents.totalFees += totalFeesCents;
		finalSummaryCents.netSettlement += netSettlementCents;
	}

	summary.feesBeforeSettlementExpense = fromCents(
		finalSummaryCents.feesBeforeSettlementExpense,
	);
	summary.settlementExpenseBase = fromCents(
		finalSummaryCents.settlementExpenseBase,
	);
	summary.settlementExpense = fromCents(finalSummaryCents.settlementExpense);
	summary.totalFees = fromCents(finalSummaryCents.totalFees);
	summary.netSettlement = fromCents(finalSummaryCents.netSettlement);

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
		merchantName: first?.merchantCompanyName || "Unknown Merchant",
		memberId: first?.memberId || memberId,
		partnerName: first?.partnerName || "",
		reportDate: reportDate || toDate || transactionToDate || new Date(),
		fromDate: fromDate || reportDate || transactionFromDate || null,
		toDate: toDate || reportDate || transactionToDate || null,

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

const formatDate = (value) => {
	if (!value) return "-";

	const date = new Date(value);

	if (Number.isNaN(date.getTime())) return "-";

	return date.toLocaleDateString("en-GB", {
		day: "2-digit",
		month: "short",
		year: "numeric",
	});
};

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
	if (report.fromDate || report.toDate) {
		const query = {};

		if (report.fromDate) {
			query.$gte = startOfDate(report.fromDate);
		}

		if (report.toDate) {
			query.$lte = endOfDate(report.toDate);
		}

		return query;
	}

	return getDateRange(report.reportDate);
};

const getReportTransactionQuery = (report, matchStatus = "matched") => {
	const query = {
		memberId: report.memberId,
		matchStatus,
	};

	if (report.settlementBatchId) {
		query.settlementBatchId = report.settlementBatchId;
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

export const listMerchantSettlementReports = async (req, res) => {
	const { search, settlementBatchId, emailStatus } = req.query;

	const query = {};

	if (settlementBatchId) query.settlementBatchId = settlementBatchId;
	if (emailStatus) query.emailStatus = emailStatus;

	if (search) {
		query.$or = [
			{ merchantName: new RegExp(search, "i") },
			{ memberId: new RegExp(search, "i") },
			{ emailTo: new RegExp(search, "i") },
		];
	}

	const data = await MerchantSettlementReport.find(query)
		.sort({ createdAt: -1 })
		.lean();

	return res.json({
		success: true,
		data,
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
		data: report,
	});
};

const drawPdfTable = ({
	doc,
	FONT,
	title,
	columns,
	rows,
	fontSize = 7,
	minRowHeight = 24,
	headerHeight = 24,
	rowPaddingY = 7,
}) => {
	if (!rows || !rows.length) return;

	const pageWidth = doc.page.width;
	const margin = doc.page.margins?.left || 30;
	const usableWidth = pageWidth - margin * 2;
	const totalColumnWidth = columns.reduce(
		(total, column) => total + Number(column.width || 0),
		0,
	);

	if (totalColumnWidth > usableWidth + 1) {
		const percent = ((totalColumnWidth / usableWidth) * 100).toFixed(2);

		throw new Error(
			`PDF table "${title}" is too wide. ` +
				`Columns: ${totalColumnWidth.toFixed(2)}, ` +
				`available: ${usableWidth.toFixed(2)}, ` +
				`used: ${percent}%`,
		);
	}
	const bottomLimit = doc.page.height - 58;
	const titleHeight = 30;

	const hasSpace = (height) => doc.y + height <= bottomLimit;

	const addSafePage = () => {
		doc.addPage();
		doc.y = 42;
	};

	const getCellValue = (row, col) =>
		typeof col.value === "function" ? col.value(row) : row[col.key];

	const getRowHeight = (row) => {
		let maxHeight = minRowHeight;

		for (const col of columns) {
			const value = String(getCellValue(row, col) ?? "-");

			doc
				.font(
					row._bold || col.bold
						? FONT?.semiBold || "Helvetica-Bold"
						: FONT?.regular || "Helvetica",
				)
				.fontSize(fontSize);

			const textHeight = doc.heightOfString(value, {
				width: col.width - 8,
				align: col.align || "left",
				lineGap: 1,
			});

			maxHeight = Math.max(maxHeight, textHeight + rowPaddingY * 2);
		}

		return Math.ceil(maxHeight);
	};

	const drawHeader = () => {
		const y = doc.y;
		let x = margin;

		doc.rect(margin, y, usableWidth, headerHeight).fill("#1234bc");

		for (const col of columns) {
			doc
				.fillColor("#ffffff")
				.font(FONT?.semiBold || "Helvetica-Bold")
				.fontSize(fontSize)
				.text(col.label, x + 4, y + 7, {
					width: col.width - 8,
					align: col.align || "left",
					lineBreak: false,
				});

			x += col.width;
		}

		doc.y = y + headerHeight;
	};

	if (!hasSpace(titleHeight + headerHeight + minRowHeight)) {
		addSafePage();
	}

	doc.moveDown(0.35);

	doc
		.font(FONT?.semiBold || "Helvetica-Bold")
		.fontSize(12)
		.fillColor("#111827")
		.text(title, margin, doc.y, {
			width: usableWidth,
			lineBreak: true,
		});

	doc.moveDown(0.25);
	drawHeader();

	for (const row of rows) {
		const rowHeight = getRowHeight(row);

		if (!hasSpace(rowHeight)) {
			addSafePage();

			doc
				.font(FONT?.semiBold || "Helvetica-Bold")
				.fontSize(10)
				.fillColor("#111827")
				.text(`${title} continued`, margin, doc.y, {
					width: usableWidth,
					lineBreak: true,
				});

			doc.moveDown(0.35);
			drawHeader();
		}

		const y = doc.y;
		let x = margin;

		doc
			.rect(margin, y, usableWidth, rowHeight)
			.fill(row._highlight ? "#f8fafc" : "#ffffff")
			.strokeColor("#e5e7eb")
			.stroke();

		for (const col of columns) {
			const value = String(getCellValue(row, col) ?? "-");

			doc
				.fillColor("#111827")
				.font(
					row._bold || col.bold
						? FONT?.semiBold || "Helvetica-Bold"
						: FONT?.regular || "Helvetica",
				)
				.fontSize(fontSize)
				.text(value, x + 4, y + rowPaddingY, {
					width: col.width - 8,
					align: col.align || "left",
					lineBreak: true,
					lineGap: 1,
				});

			x += col.width;
		}

		doc.y = y + rowHeight;
	}

	doc.moveDown(0.5);
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

					delete row._cents;

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
					delete row._cents;

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

const getFinalSettlementRows = (currencySummary = {}) =>
	Object.values(currencySummary || {})
		.map((row) => {
			const settledActivity = row.capturedAmount || 0;

			const adjustmentAmount = fromCents(
				toCents(row.reversalAmount || 0) + toCents(row.chargebackAmount || 0),
			);

			const paymentFees = fromCents(
				toCents(row.mdrFee || 0) +
					toCents(row.approvalFee || 0) +
					toCents(row.rollingReserveAmount || 0),
			);

			const otherFees = fromCents(
				toCents(row.declineFee || 0) +
					toCents(row.reversalFee || 0) +
					toCents(row.chargebackFee || 0),
			);

			const feesCharged = fromCents(toCents(paymentFees) + toCents(otherFees));

			return {
				currency: row.currency,

				settledActivity,
				adjustmentAmount,
				paymentFees,
				otherFees,
				feesCharged,

				settlementExpense: row.settlementExpense || 0,
				settlementExpenseRate: row.settlementExpensePercent || 0,
				settlementExpenseBase: row.settlementExpenseBase || 0,

				totalDeductions: row.totalFees || 0,
				netPayable: row.netSettlement || 0,

				mdrFee: row.mdrFee || 0,
				approvalFee: row.approvalFee || 0,
				rollingReserveAmount: row.rollingReserveAmount || 0,
				declineFee: row.declineFee || 0,
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
export const buildSettlementPdfBuffer = async (report) =>
	new Promise((resolve, reject) => {
		const doc = new PDFDocument({
			margin: 36,
			size: "A4",
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

		const summary = report.summary || {};
		const reportData = report.reportData || {};
		const currencySummary = report.currencySummary || {};
		const statusSummary = report.statusSummary || {};
		const brandSummary = report.brandSummary || {};
		const declinedBrandSummary = reportData.declinedBrandSummary || {};
		const adjustmentSummary = reportData.adjustmentSummary || {};
		const feeRateSummary = reportData.feeRateSummary || {};
		const daySummary = reportData.daySummary || [];
		const primaryCurrency = getPrimaryCurrency(report);
		const currencies = Object.keys(currencySummary || {});
		const isMultiCurrency = currencies.length > 1;
		const displayCurrency = isMultiCurrency ? "" : primaryCurrency;

		const margin = doc.page.margins?.left || 30;
		const pageWidth = doc.page.width;
		const usableWidth = pageWidth - margin * 2;

		doc.rect(0, 0, pageWidth, 82).fill("#1234bc");

		doc
			.fillColor("#ffffff")
			.font(FONT.bold)
			.fontSize(20)
			.text("Merchant Settlement Statement", margin, 24);

		doc
			.fillColor("#dbe4ff")
			.font(FONT.regular)
			.fontSize(9)
			.text(
				"Settlement summary, charges, reversals, chargebacks and net settlement",
				margin,
				52,
			);

		doc.y = 105;

		const infoRows = [
			["Merchant", report.merchantName],
			["Member ID", report.memberId],
			["Currency", isMultiCurrency ? "Multi Currency" : primaryCurrency || "-"],

			[
				"Period",
				`${formatDate(report.fromDate || report.reportDate)} - ${formatDate(
					report.toDate || report.reportDate,
				)}`,
			],
			["Generated On", formatDate(new Date())],
			["Email Status", report.emailStatus || "draft"],
		];
		const infoBoxY = doc.y;
		const infoBoxHeight = 86;

		doc
			.roundedRect(margin, infoBoxY, usableWidth, infoBoxHeight, 8)
			.fill("#ffffff")
			.strokeColor("#e5e7eb")
			.stroke();

		let infoY = infoBoxY + 12;
		const colWidth = usableWidth / 3;

		infoRows.forEach(([label, value], index) => {
			const row = Math.floor(index / 3);
			const col = index % 3;
			const x = margin + col * colWidth + 12;
			const y = infoY + row * 32;

			doc
				.fillColor("#6b7280")
				.font(FONT.regular)
				.fontSize(7)
				.text(label.toUpperCase(), x, y, {
					width: colWidth - 20,
					lineBreak: false,
				});

			doc
				.fillColor("#111827")
				.font(FONT.bold)
				.fontSize(8.5)
				.text(String(value || "-"), x, y + 12, {
					width: colWidth - 20,
					lineBreak: false,
				});
		});

		doc.y = infoBoxY + infoBoxHeight + 18;

		const cardGap = 10;
		const cardWidth = (usableWidth - cardGap * 3) / 4;
		const cardHeight = 66;
		const cardY = doc.y;

		const adjustmentCount =
			Number(summary.reversalTransactions || 0) +
			Number(summary.chargebackTransactions || 0);

		const cards = [
			["Total Txns", formatInt(summary.totalTransactions || 0), "#1234bc"],
			["Successful", formatInt(summary.successTransactions || 0), "#16a34a"],
			["Failed", formatInt(summary.declinedTransactions || 0), "#dc2626"],
			["Adjustments", formatInt(adjustmentCount), "#f59e0b"],
		];
		cards.forEach(([label, value, color], index) => {
			const x = margin + index * (cardWidth + cardGap);

			doc
				.roundedRect(x, cardY, cardWidth, cardHeight, 8)
				.fill("#ffffff")
				.strokeColor("#e5e7eb")
				.stroke();

			doc.rect(x, cardY, 5, cardHeight).fill(color);

			doc
				.fillColor("#6b7280")
				.font(FONT.regular)
				.fontSize(7)
				.text(label.toUpperCase(), x + 14, cardY + 14);

			doc
				.fillColor("#111827")
				.font(FONT.bold)
				.fontSize(10)
				.text(value, x + 14, cardY + 34, {
					width: cardWidth - 24,
				});
		});

		doc.y = cardY + cardHeight + 22;

		const detailedBrandSections = buildDetailedBrandSections({
			feeRateSummary,
			declinedBrandSummary,
		});

		/*drawPdfTable({
			doc,
			FONT,
			title: "Currency-wise Payable Summary",
			columns: [
				{
					label: "Currency",
					key: "currency",
					width: usableWidth * 0.13,
					bold: true,
				},
				{
					label: "Success Amount",
					value: (row) => formatMoney(row.successAmount, row.currency),
					width: usableWidth * 0.22,
					align: "right",
				},
				{
					label: "Total Deductions",
					value: (row) => formatMoney(row.totalDeductions, row.currency),
					width: usableWidth * 0.22,
					align: "right",
					bold: true,
				},
				{
					label: "Settlement Expense",
					key: "settlementExpenseText",
					width: usableWidth * 0.22,
					align: "right",
				},
				{
					label: "Net Payable",
					value: (row) => formatMoney(row.netSettlement, row.currency),
					width: usableWidth * 0.21,
					align: "right",
					bold: true,
				},
			],
			rows: getCurrencyStatementRows(currencySummary),
			fontSize: 7,
			minRowHeight: 30,
		});

		drawPdfTable({
			doc,
			FONT,
			title: "Currency-wise Fee Breakdown",
			columns: [
				{
					label: "Currency",
					key: "currency",
					width: usableWidth * 0.12,
					bold: true,
				},
				{
					label: "MDR",
					value: (row) => formatMoney(row.mdrFee, row.currency),
					width: usableWidth * 0.16,
					align: "right",
				},
				{
					label: "Approval",
					value: (row) => formatMoney(row.approvalFee, row.currency),
					width: usableWidth * 0.16,
					align: "right",
				},
				{
					label: "RR",
					value: (row) => formatMoney(row.rollingReserveAmount, row.currency),
					width: usableWidth * 0.14,
					align: "right",
				},
				{
					label: "Decline",
					value: (row) => formatMoney(row.declineFee, row.currency),
					width: usableWidth * 0.14,
					align: "right",
				},
				{
					label: "Adjustments",
					value: (row) => formatMoney(row.adjustments, row.currency),
					width: usableWidth * 0.14,
					align: "right",
				},
				{
					label: "Total Deduct",
					value: (row) => formatMoney(row.totalDeductions, row.currency),
					width: usableWidth * 0.14,
					align: "right",
					bold: true,
				},
			],
			rows: getCurrencyStatementRows(currencySummary),
			fontSize: 7,
			minRowHeight: 30,
		}); */

		drawPdfTable({
			doc,
			FONT,
			title: "Final Settlement by Currency",
			columns: [
				{
					label: "Currency",
					key: "currency",
					width: usableWidth * 0.09,
					bold: true,
				},
				{
					label: "Settled Activity",
					value: (row) => formatMoney(row.settledActivity, row.currency),
					width: usableWidth * 0.15,
					align: "right",
				},
				{
					label: "Payment Charges",
					value: (row) => formatMoney(row.paymentCharges, row.currency),
					width: usableWidth * 0.15,
					align: "right",
				},
				{
					label: "Other Charges",
					value: (row) => formatMoney(row.otherCharges, row.currency),
					width: usableWidth * 0.14,
					align: "right",
				},
				{
					label: "Settlement Exp.",
					value: (row) =>
						[
							formatMoney(row.settlementExpense, row.currency),
							`${formatNumber(row.settlementExpenseRate)}%`,
						].join("\n"),
					width: usableWidth * 0.15,
					align: "right",
				},
				{
					label: "Total Deduct.",
					value: (row) => formatMoney(row.totalDeductions, row.currency),
					width: usableWidth * 0.15,
					align: "right",
					bold: true,
				},
				{
					label: "Net Payable",
					value: (row) => formatMoney(row.netPayable, row.currency),
					width: usableWidth * 0.17,
					align: "right",
					bold: true,
				},
			],
			rows: getFinalSettlementRows(currencySummary),
			fontSize: 6.4,
			minRowHeight: 46,
			headerHeight: 30,
			rowPaddingY: 8,
		});

		drawPdfTable({
			doc,
			FONT,
			title: "Charges Explained by Currency",
			columns: [
				{
					label: "Currency",
					key: "currency",
					width: usableWidth * 0.09,
					bold: true,
				},
				{
					label: "Payment Charges",
					value: (row) =>
						[
							`MDR: ${formatMoney(row.mdrFee, row.currency)}`,
							`Approval: ${formatMoney(row.approvalFee, row.currency)}`,
							`RR: ${formatMoney(row.rollingReserveAmount, row.currency)}`,
						].join("\n"),
					width: usableWidth * 0.24,
					align: "right",
				},
				{
					label: "Other Charges",
					value: (row) =>
						[
							`Decline: ${formatMoney(row.declineFee, row.currency)}`,
							`Reversal: ${formatMoney(
								fromCents(
									toCents(row.reversalAmount) + toCents(row.reversalFee),
								),
								row.currency,
							)}`,
							`Chargeback: ${formatMoney(
								fromCents(
									toCents(row.chargebackAmount) + toCents(row.chargebackFee),
								),
								row.currency,
							)}`,
						].join("\n"),
					width: usableWidth * 0.24,
					align: "right",
				},
				{
					label: "Settlement Expense",
					value: (row) =>
						[
							`Base: ${formatMoney(row.settlementExpenseBase, row.currency)}`,
							`Rate: ${formatNumber(row.settlementExpenseRate)}%`,
							`Charged: ${formatMoney(row.settlementExpense, row.currency)}`,
						].join("\n"),
					width: usableWidth * 0.27,
					align: "right",
				},
				{
					label: "Net Payable",
					value: (row) => formatMoney(row.netPayable, row.currency),
					width: usableWidth * 0.16,
					align: "right",
					bold: true,
				},
			],
			rows: getFinalSettlementRows(currencySummary),
			fontSize: 6.4,
			minRowHeight: 64,
			headerHeight: 30,
			rowPaddingY: 8,
		});
		/*
		drawPdfTable({
			doc,
			FONT,
			title: "Settlement Expense by Currency",
			columns: [
				{
					label: "Currency",
					key: "currency",
					width: usableWidth * 0.16,
					bold: true,
				},
				{
					label: "Calculation Base",
					value: (row) =>
						formatMoney(row.settlementExpenseBase || 0, row.currency),
					width: usableWidth * 0.32,
					align: "right",
				},
				{
					label: "Applied Rate",
					value: (row) => `${formatNumber(row.settlementExpensePercent || 0)}%`,
					width: usableWidth * 0.2,
					align: "right",
				},
				{
					label: "Amount Charged",
					value: (row) => formatMoney(row.settlementExpense || 0, row.currency),
					width: usableWidth * 0.32,
					align: "right",
					bold: true,
				},
			],
			rows: Object.values(currencySummary || {}).sort((a, b) =>
				String(a.currency || "").localeCompare(String(b.currency || "")),
			),
			fontSize: 7,
			minRowHeight: 32,
			rowPaddingY: 8,
		});*/

		/*drawPdfTable({
			doc,
			FONT,
			title: "Your Applied Rates and Charges",
			columns: [
				{
					label: "Payment Method",
					key: "brand",
					width: usableWidth * 0.13,
					bold: true,
				},
				{
					label: "Currency / Region",
					value: (row) => `${row.currency}\n${row.region}`,
					width: usableWidth * 0.12,
				},
				{
					label: "Transactions",
					value: (row) =>
						[
							`${formatInt(row.txns)} successful`,
							formatMoney(row.volume, row.currency),
						].join("\n"),
					width: usableWidth * 0.15,
					align: "right",
				},
				{
					label: "MDR",
					value: (row) =>
						[
							`${formatNumber(row.mdrRate)}%`,
							formatMoney(row.mdrFee, row.currency),
						].join("\n"),
					width: usableWidth * 0.14,
					align: "right",
				},
				{
					label: "Approval Fee",
					value: (row) =>
						[
							`${formatMoney(row.approvalRate, row.currency)} / txn`,
							formatMoney(row.approvalFee, row.currency),
						].join("\n"),
					width: usableWidth * 0.16,
					align: "right",
				},
				{
					label: "Rolling Reserve",
					value: (row) =>
						[
							`${formatNumber(row.rrRate)}%`,
							formatMoney(row.rrAmount, row.currency),
						].join("\n"),
					width: usableWidth * 0.14,
					align: "right",
				},
				{
					label: "Total Charges",
					value: (row) => formatMoney(row.totalCharges, row.currency),
					width: usableWidth * 0.16,
					align: "right",
					bold: true,
				},
			],
			rows: getPaymentChargeRows(detailedBrandSections),
			fontSize: 6.5,
			minRowHeight: 52,
			rowPaddingY: 8,
		}); */

		for (const currencyGroup of getPaymentChargeRowsGroupedByCurrency(
			detailedBrandSections,
		)) {
			drawPdfTable({
				doc,
				FONT,
				title: `${currencyGroup.currency} Processing - Payment Methods and Rates`,
				columns: [
					{
						label: "Payment Method",
						value: (row) => shortPaymentMethod(row.brand),
						width: usableWidth * 0.14,
						bold: true,
					},
					{
						label: "Region",
						key: "region",
						width: usableWidth * 0.1,
					},
					{
						label: "Settled Activity",
						value: (row) =>
							[
								`${formatInt(row.txns)} txns`,
								formatMoney(row.volume, row.currency),
							].join("\n"),
						width: usableWidth * 0.18,
						align: "right",
					},
					{
						label: "Merchant Rates",
						value: (row) =>
							[
								`MDR ${formatNumber(row.mdrRate)}%`,
								`Approval ${formatMoney(row.approvalRate, row.currency)} / txn`,
								`RR ${formatNumber(row.rrRate)}%`,
							].join("\n"),
						width: usableWidth * 0.22,
						align: "right",
					},
					{
						label: "Charges",
						value: (row) =>
							[
								`MDR ${formatMoney(row.mdrFee, row.currency)}`,
								`Approval ${formatMoney(row.approvalFee, row.currency)}`,
								`RR ${formatMoney(row.rrAmount, row.currency)}`,
							].join("\n"),
						width: usableWidth * 0.22,
						align: "right",
					},
					{
						label: "Total",
						value: (row) => formatMoney(row.totalCharges, row.currency),
						width: usableWidth * 0.14,
						align: "right",
						bold: true,
					},
				],
				rows: currencyGroup.rows,
				fontSize: 6.5,
				minRowHeight: 56,
				headerHeight: 30,
				rowPaddingY: 8,
			});
		}

		/*
		drawPdfTable({
			doc,
			FONT,
			title: "Rate Coverage",
			columns: [
				{
					label: "Payment Method",
					key: "brand",
					width: usableWidth * 0.18,
					bold: true,
				},
				{
					label: "Currency",
					key: "currency",
					width: usableWidth * 0.11,
				},
				{
					label: "Region",
					key: "region",
					width: usableWidth * 0.13,
				},
				{
					label: "Countries Included",
					key: "countries",
					width: usableWidth * 0.34,
				},
				{
					label: "Applied Rates",
					value: (row) =>
						[
							`MDR: ${formatNumber(row.mdrRate)}%`,
							`Approval: ${formatMoney(row.approvalRate, row.currency)} / txn`,
							`RR: ${formatNumber(row.rrRate)}%`,
						].join("\n"),
					width: usableWidth * 0.24,
					align: "right",
				},
			],
			rows: getRateCoverageRows(detailedBrandSections),
			fontSize: 6.8,
			minRowHeight: 52,
			rowPaddingY: 8,
		});

		drawPdfTable({
			doc,
			FONT,
			title: "Decline Rates and Charges",
			columns: [
				{
					label: "Payment Method",
					key: "brand",
					width: usableWidth * 0.17,
					bold: true,
				},
				{
					label: "Currency / Region",
					value: (row) => `${row.currency}\n${row.region}`,
					width: usableWidth * 0.16,
				},
				{
					label: "Countries",
					key: "countries",
					width: usableWidth * 0.27,
				},
				{
					label: "Failed Txns",
					value: (row) => formatInt(row.failedTxns),
					width: usableWidth * 0.12,
					align: "right",
				},
				{
					label: "Rate / Failed Txn",
					value: (row) =>
						`${formatMoney(row.declineFeeRate, row.currency)} / txn`,
					width: usableWidth * 0.14,
					align: "right",
				},
				{
					label: "Amount Charged",
					value: (row) => formatMoney(row.declineFee, row.currency),
					width: usableWidth * 0.14,
					align: "right",
					bold: true,
				},
			],
			rows: getAllDeclineRateRows(detailedBrandSections),
			fontSize: 6.7,
			minRowHeight: 42,
			rowPaddingY: 8,
		});

		drawPdfTable({
			doc,
			FONT,
			title: "Reversal and Chargeback Details",
			columns: [
				{
					label: "Type",
					key: "status",
					width: usableWidth * 0.12,
					bold: true,
				},
				{
					label: "Currency",
					key: "currency",
					width: usableWidth * 0.09,
				},
				{
					label: "Txns",
					value: (row) => formatInt(row.txns),
					width: usableWidth * 0.07,
					align: "right",
				},
				{
					label: "Amount Reversed / ChargedBack",
					value: (row) =>
						formatMoney(
							Number(row.reversalAmount || 0) +
								Number(row.chargebackAmount || 0),
							row.currency,
						),
					width: usableWidth * 0.24,
					align: "right",
				},
				{
					label: "Fee Rate",
					value: (row) => {
						const isChargeback = normalizeUpper(row.status) === "CHARGEBACK";

						const configuredRate = isChargeback
							? Number(row.chargebackFeeRate || 0)
							: Number(row.reversalFeeRate || 0);

						const totalFixedFee = isChargeback
							? Number(row.chargebackFee || 0)
							: Number(row.reversalFee || 0);

						const txns = Number(row.txns || 0);

						const effectiveRate =
							configuredRate ||
							(txns > 0 ? roundMoney(totalFixedFee / txns) : 0);

						return isChargeback
							? `${formatMoney(effectiveRate, row.currency)} per chargeback`
							: `${formatMoney(effectiveRate, row.currency)} per reversal`;
					},
					width: usableWidth * 0.16,
					align: "right",
				},
				{
					label: "Fixed Fee Charged",
					value: (row) =>
						formatMoney(
							Number(row.reversalFee || 0) + Number(row.chargebackFee || 0),
							row.currency,
						),
					width: usableWidth * 0.14,
					align: "right",
				},
				{
					label: "Total Deduction",
					value: (row) =>
						formatMoney(
							Number(row.reversalAmount || 0) +
								Number(row.chargebackAmount || 0) +
								Number(row.reversalFee || 0) +
								Number(row.chargebackFee || 0),
							row.currency,
						),
					width: usableWidth * 0.16,
					align: "right",
					bold: true,
				},
			],
			rows: Object.values(adjustmentSummary || {}),
			fontSize: 6.6,
			minRowHeight: 38,
			rowPaddingY: 8,
		});

		drawPdfTable({
			doc,
			FONT,
			title: "Settlement Expense Calculation",
			columns: [
				{
					label: "Currency",
					key: "currency",
					width: usableWidth * 0.15,
					bold: true,
				},
				{
					label: "Calculation Base",
					value: (row) => formatMoney(row.calculationBase, row.currency),
					width: usableWidth * 0.3,
					align: "right",
				},
				{
					label: "Applied Rate",
					value: (row) => `${formatNumber(row.rate)}%`,
					width: usableWidth * 0.2,
					align: "right",
				},
				{
					label: "Amount Charged",
					value: (row) => formatMoney(row.amount, row.currency),
					width: usableWidth * 0.35,
					align: "right",
					bold: true,
				},
			],
			rows: getSettlementExpenseRows(currencySummary),
			fontSize: 7,
			minRowHeight: 32,
		}); */

		drawPdfTable({
			doc,
			FONT,
			title: "Other Charges",
			columns: [
				{
					label: "Charge Type",
					key: "type",
					width: usableWidth * 0.2,
					bold: true,
				},
				{
					label: "Method",
					key: "method",
					width: usableWidth * 0.12,
				},
				{
					label: "Currency",
					key: "currency",
					width: usableWidth * 0.1,
				},
				{
					label: "Basis",
					key: "basis",
					width: usableWidth * 0.28,
					align: "right",
				},
				{
					label: "Rate",
					key: "rate",
					width: usableWidth * 0.15,
					align: "right",
				},
				{
					label: "Amount",
					value: (row) => formatMoney(row.amount, row.currency),
					width: usableWidth * 0.15,
					align: "right",
					bold: true,
				},
			],
			rows: getOtherChargeRows({
				sections: detailedBrandSections,
				adjustmentSummary,
				currencySummary,
			}),
			fontSize: 6.7,
			minRowHeight: 40,
			rowPaddingY: 8,
		});

		if (!isMultiCurrency) {
			const currencyRow = Object.values(currencySummary || {})[0];

			if (currencyRow) {
				drawInfoBox({
					doc,
					FONT,
					title: "Final Settlement Calculation",
					lines: [
						"Single-currency report: final settlement calculation is shown below.",
						"Net Payable = Success Amount - MDR - Approval Fee - Rolling Reserve - Decline Fee - Adjustments - Settlement Expense.",
					],
					color: "#f8fafc",
				});

				drawChargeBreakdownCard({
					doc,
					FONT,
					title: `${currencyRow.currency} - Final Settlement Calculation`,
					subtitle: "Single-currency payable calculation",
					accent: "#16a34a",
					stats: [
						{
							label: "Success Amount",
							value: formatMoney(
								currencyRow.capturedAmount,
								currencyRow.currency,
							),
							bold: true,
						},
						{
							label: "Total Deductions",
							value: formatMoney(currencyRow.totalFees, currencyRow.currency),
							bold: true,
						},
						{
							label: "Settlement Expense",
							value: formatMoney(
								currencyRow.settlementExpense || 0,
								currencyRow.currency,
							),
							bold: true,
						},
						{
							label: "Net Payable",
							value: formatMoney(
								currencyRow.netSettlement,
								currencyRow.currency,
							),
							bold: true,
						},
					],
					rates: [
						`Settlement Expense ${formatNumber(
							currencyRow.settlementExpensePercent || 0,
						)}%`,
					],
					charges: buildCurrencyFinalCharges(currencyRow),
				});
			}
		}

		drawPdfTable({
			doc,
			FONT,
			title: "Day-wise Summary",
			columns: [
				{
					label: "Date",
					key: "date",
					width: usableWidth * 0.16,
					bold: true,
				},
				{
					label: "Currency",
					key: "currency",
					width: usableWidth * 0.1,
				},
				{
					label: "Total",
					value: (row) => row.totalTxns ?? row.txns ?? 0,
					width: usableWidth * 0.09,
					align: "right",
				},
				{
					label: "Success",
					value: (row) => row.successTxns ?? 0,
					width: usableWidth * 0.1,
					align: "right",
				},
				{
					label: "Failed",
					value: (row) => row.failedTxns ?? 0,
					width: usableWidth * 0.1,
					align: "right",
				},
				{
					label: "Settled Activity",
					value: (row) => formatMoney(row.capturedAmount, row.currency),
					width: usableWidth * 0.18,
					align: "right",
				},
				{
					label: "Charges",
					value: (row) => formatMoney(row.totalFees, row.currency),
					width: usableWidth * 0.13,
					align: "right",
				},
				{
					label: "Net",
					value: (row) => formatMoney(row.netSettlement, row.currency),
					width: usableWidth * 0.14,
					align: "right",
					bold: true,
				},
			],
			rows: daySummary,
		});

		doc.end();
	});

export const downloadMerchantSettlementPdf = async (req, res) => {
	const report = await MerchantSettlementReport.findById(req.params.id).lean();

	if (!report) {
		return res.status(404).json({
			success: false,
			message: "Report not found",
		});
	}

	const buffer = await buildSettlementPdfBuffer(report);

	const fileName = `${slugify(report.merchantName)}-${report.memberId}-settlement.pdf`;

	res.setHeader("Content-Disposition", `attachment; filename=${fileName}`);
	res.setHeader("Content-Type", "application/pdf");

	return res.send(buffer);
};

/*
|--------------------------------------------------------------------------
| Excel generation
|--------------------------------------------------------------------------
*/

const transactionToExcelRow = (txn) => ({
	Date: txn.transactionDate,
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
	const matchedTransactions = await MerchantTransaction.find(
		getReportTransactionQuery(report, "matched"),
	)
		.populate("feeConfigId")
		.sort({ transactionDate: 1 })
		.lean();

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
		["Period From", formatDate(report.fromDate || report.reportDate)],
		["Period To", formatDate(report.toDate || report.reportDate)],
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
		.filter((txn) => isSuccessStatus(txn.status))
		.map(transactionToExcelRow);

	const declinedRows = matchedTransactions
		.filter((txn) => isDeclineStatus(txn.status))
		.map(transactionToExcelRow);

	const reversalRows = matchedTransactions
		.filter((txn) => isReversalStatus(txn.status))
		.map(transactionToExcelRow);

	const chargebackRows = matchedTransactions
		.filter((txn) => isChargebackStatus(txn.status))
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

export const downloadMerchantSettlementExcel = async (req, res) => {
	const report = await MerchantSettlementReport.findById(req.params.id).lean();

	if (!report) {
		return res.status(404).json({
			success: false,
			message: "Report not found",
		});
	}

	const buffer = await buildSettlementExcelBuffer(report);

	res.setHeader(
		"Content-Disposition",
		`attachment; filename=merchant-settlement-${report.memberId}.xlsx`,
	);

	res.setHeader(
		"Content-Type",
		"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	);

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
			buildSettlementPdfBuffer(reportObject),
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

	const rows = parseWorkbookRows(file.buffer);

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

	await CountryMaster.bulkWrite(operations, { ordered: false });

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
			euColumnRows: cleanRows.filter((row) => row.sourceColumn === "EU").length,
			nonEuColumnRows: cleanRows.filter((row) => row.sourceColumn === "NonEU")
				.length,
			specificColumnRows: cleanRows.filter(
				(row) => row.sourceColumn === "Specific",
			).length,
			totalEuCountries: cleanRows.filter((row) => row.countryCategory === "EU")
				.length,
			totalNonEuCountries: cleanRows.filter(
				(row) => row.countryCategory === "NONEU",
			).length,
		},
	});
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

	if (row.transactionCountryName) {
		update.transactionCountryName = row.transactionCountryName;
	}

	if (row.feeCountryCode) {
		update.feeCountryCode = row.feeCountryCode;
	}

	if (row.countryCategory) {
		update.countryCategory = row.countryCategory;
	}

	if (req.body.status) {
		update.status = req.body.status;
	}

	const data = await CountryMaster.findByIdAndUpdate(
		req.params.id,
		{ $set: update },
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
