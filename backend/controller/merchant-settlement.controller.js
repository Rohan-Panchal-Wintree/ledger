import mongoose from "mongoose";
import xlsx from "xlsx";
import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { MerchantFeeConfig } from "../models/merchant-fee-config.model.js";
import { MerchantTransactionUpload } from "../models/merchant-transaction-upload.model.js";
import { MerchantTransaction } from "../models/merchant-transaction.model.js";
import { MerchantSettlementReport } from "../models/merchant-settlement-report.model.js";

const roundMoney = (value) =>
	Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const normalizeText = (value) =>
	String(value || "")
		.replace(/\s+/g, " ")
		.trim();

const normalizeUpper = (value) => normalizeText(value).toUpperCase();

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

const parseAccountIds = (value) =>
	String(value || "")
		.split(",")
		.map((item) => item.trim())
		.filter(Boolean);

const normalizeHeader = (key) =>
	String(key || "")
		.replace(/\s+/g, " ")
		.trim()
		.toUpperCase();

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
				normalizedRow[normalizeHeader(key)] = value;
			}

			rows.push(normalizedRow);
		}
	}

	return rows;
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

const getPagination = (query) => {
	const page = Math.max(Number(query.page) || 1, 1);
	const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
	const skip = (page - 1) * limit;

	return { page, limit, skip };
};

const isSuccessStatus = (status) => {
	const value = normalizeUpper(status);

	return [
		"SETTLED",
		"CAPTURE SUCCESSFUL",
		"CAPTURED",
		"SUCCESS",
		"APPROVED",
	].some((item) => value.includes(item));
};

const calculateFees = ({ row, fee }) => {
	const isSuccess = isSuccessStatus(row.status);

	const capturedAmount = isSuccess ? row.authAmount : 0;

	const mdrFee = roundMoney(capturedAmount * (fee.mdrPercent / 100));
	const settlementExpense = roundMoney(
		capturedAmount * (fee.settlementExpensePercent / 100),
	);
	const rollingReserveAmount = roundMoney(
		capturedAmount * (fee.rollingReservePercent / 100),
	);

	const approvalFee = isSuccess ? roundMoney(fee.approvalFee) : 0;
	const declineFee = !isSuccess ? roundMoney(fee.declineFee) : 0;

	const reversalFee = 0;
	const chargebackFee = 0;

	const totalFees = roundMoney(
		mdrFee +
			approvalFee +
			declineFee +
			reversalFee +
			chargebackFee +
			settlementExpense,
	);

	const netSettlement = roundMoney(
		capturedAmount - totalFees - rollingReserveAmount,
	);

	return {
		capturedAmount,
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

const escapeRegex = (value) =>
	String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getFeeIdentityKey = ({
	memberId,
	merchantName,
	accountIds,
	currency,
	brand,
}) =>
	[
		normalizeUpper(memberId),
		normalizeUpper(merchantName),
		(accountIds || [])
			.map((id) => normalizeText(id))
			.sort()
			.join("|"),
		normalizeUpper(currency),
		normalizeUpper(brand),
	].join("__");

export const uploadMerchantFees = async (req, res) => {
	const file = req.files?.file?.[0];

	if (!file) {
		return res.status(400).json({
			success: false,
			message: "Fee file is required",
		});
	}

	const rows = parseWorkbookRows(file.buffer);

	const operations = [];
	let skippedRows = [];

	for (const row of rows) {
		const merchantName =
			normalizeText(getValue(row, ["MerchantName", "Merchant Name"])) || "NA";

		const memberId =
			normalizeText(getValue(row, ["Member ID", "Merchant ID"])) || "NA";

		let accountIds = parseAccountIds(
			getValue(row, ["Bank Account ID", "Account ID"]),
		);

		if (!accountIds.length) {
			accountIds = ["NA"];
		}

		const currency = normalizeUpper(getValue(row, ["Currency"])) || "NA";

		const brand =
			normalizeUpper(getValue(row, ["Payment Brand", "Brand"])) || "NA";

		const partnerName = normalizeText(
			getValue(row, ["Partner", "Partner Name"]),
		);

		const country = normalizeText(getValue(row, ["Country"]));
		const type = normalizeText(getValue(row, ["Type"]));

		if (!merchantName || merchantName === "NA") {
			skippedRows.push({
				merchantName,
				memberId,
				accountIds,
				currency,
				brand,
				row,
			});

			continue;
		}

		if (
			!merchantName ||
			!memberId ||
			!accountIds.length ||
			!currency ||
			!brand
		) {
			continue;
		}

		const feeIdentityKey = getFeeIdentityKey({
			memberId,
			merchantName,
			accountIds,
			currency,
			brand,
		});

		operations.push({
			updateOne: {
				filter: {
					feeIdentityKey,
				},
				update: {
					$set: {
						feeIdentityKey,
						merchantName,
						memberId,
						partnerName,
						accountIds,
						country,
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
						updatedBy: req.user._id,
					},
					$setOnInsert: {
						createdBy: req.user._id,
					},
				},
				upsert: true,
			},
		});
	}

	if (operations.length) {
		await MerchantFeeConfig.bulkWrite(operations, { ordered: false });
	}

	return res.status(201).json({
		success: true,
		message: "Merchant fee file uploaded successfully",
		data: {
			totalRows: rows.length,
			importedRows: operations.length,
			skippedRows: skippedRows.length,
		},
	});
};

/*
|--------------------------------------------------------------------------
| Fee CRUD
|--------------------------------------------------------------------------
*/

export const createMerchantFee = async (req, res) => {
	const accountIds = Array.isArray(req.body.accountIds)
		? req.body.accountIds
		: parseAccountIds(req.body.accountIds);

	const merchantName = normalizeText(req.body.merchantName);
	const memberId = normalizeText(req.body.memberId);
	const currency = normalizeUpper(req.body.currency);
	const brand = normalizeUpper(req.body.brand);

	const feeIdentityKey = getFeeIdentityKey({
		memberId,
		merchantName,
		accountIds,
		currency,
		brand,
	});

	const doc = await MerchantFeeConfig.create({
		...req.body,
		feeIdentityKey,
		merchantName,
		memberId,
		accountIds,
		currency,
		brand,
		createdBy: req.user._id,
	});

	return res.status(201).json({
		success: true,
		message: "Merchant fee created successfully",
		data: doc,
	});
};

export const listMerchantFees = async (req, res) => {
	const { search, status, currency, brand } = req.query;
	const { page, limit, skip } = getPagination(req.query);

	const query = {};

	if (status) query.status = status;
	if (currency) query.currency = normalizeUpper(currency);
	if (brand) query.brand = normalizeUpper(brand);

	if (search) {
		query.$or = [
			{ merchantName: new RegExp(search, "i") },
			{ memberId: new RegExp(search, "i") },
			{ partnerName: new RegExp(search, "i") },
			{ accountIds: new RegExp(search, "i") },
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

	if (payload.accountIds !== undefined) {
		payload.accountIds = Array.isArray(payload.accountIds)
			? payload.accountIds
			: parseAccountIds(payload.accountIds);
	}

	if (payload.merchantName)
		payload.merchantName = normalizeText(payload.merchantName);
	if (payload.memberId) payload.memberId = normalizeText(payload.memberId);
	if (payload.currency) payload.currency = normalizeUpper(payload.currency);
	if (payload.brand) payload.brand = normalizeUpper(payload.brand);

	const finalMerchantName = payload.merchantName || existing.merchantName;
	const finalMemberId = payload.memberId || existing.memberId;
	const finalAccountIds = payload.accountIds || existing.accountIds;
	const finalCurrency = payload.currency || existing.currency;
	const finalBrand = payload.brand || existing.brand;

	payload.feeIdentityKey = getFeeIdentityKey({
		memberId: finalMemberId,
		merchantName: finalMerchantName,
		accountIds: finalAccountIds,
		currency: finalCurrency,
		brand: finalBrand,
	});

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
	});
};

/*
|--------------------------------------------------------------------------
| Transaction Upload
|--------------------------------------------------------------------------
*/

const cleanCell = (value) => normalizeText(value).replace(/^'+/, "");

const normalizeTransactionRow = (row) => ({
	transactionDate: parseDate(
		getValue(row, ["Transaction Date(MM/DD/YYYY)", "Transaction Date"]),
	),

	memberId: cleanCell(getValue(row, ["Member ID"])),

	merchantCompanyName: cleanCell(getValue(row, ["Merchant Company Name"])),

	partnerName: cleanCell(getValue(row, ["Partner Name"])),

	bankAccountId: cleanCell(getValue(row, ["Bank Account ID"])),

	paymentBrand: normalizeUpper(getValue(row, ["Payment Brand"])),

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

const normalizeNA = (value) => {
	const cleaned = cleanCell(value);

	if (!cleaned || cleaned === "-") {
		return "NA";
	}

	return cleaned;
};

const normalizeTransactionForMatching = (row) => ({
	...row,
	memberId: normalizeNA(row.memberId),
	merchantCompanyName: normalizeNA(row.merchantCompanyName),
	bankAccountId: normalizeNA(row.bankAccountId),
	paymentBrand: normalizeUpper(normalizeNA(row.paymentBrand)),
	currency: normalizeUpper(normalizeNA(row.currency)),
});

const isMissingRequiredTransactionField = (row) =>
	!row.memberId ||
	row.memberId === "NA" ||
	!row.merchantCompanyName ||
	row.merchantCompanyName === "NA" ||
	!row.currency ||
	row.currency === "NA";

const feeExactKey = ({ memberId, merchantName, accountId, currency, brand }) =>
	[
		normalizeUpper(memberId),
		normalizeUpper(merchantName),
		normalizeText(accountId),
		normalizeUpper(currency),
		normalizeUpper(brand),
	].join("__");

const feeFallbackKey = ({ memberId, merchantName, currency, brand }) =>
	[
		normalizeUpper(memberId),
		normalizeUpper(merchantName),
		normalizeUpper(currency),
		normalizeUpper(brand),
	].join("__");

const buildFeeIndexes = async () => {
	const fees = await MerchantFeeConfig.find({ status: "active" }).lean();

	const exactFeeMap = new Map();
	const fallbackFeeMap = new Map();

	for (const fee of fees) {
		const accountIds = Array.isArray(fee.accountIds) ? fee.accountIds : [];

		for (const accountId of accountIds) {
			const key = feeExactKey({
				memberId: fee.memberId,
				merchantName: fee.merchantName,
				accountId,
				currency: fee.currency,
				brand: fee.brand,
			});

			exactFeeMap.set(key, fee);
		}

		// Fallback is used only when there is no exact account match.
		// If more than one config exists for same merchant/currency/brand,
		// mark fallback as ambiguous to avoid applying a wrong rate.
		const fallbackKey = feeFallbackKey({
			memberId: fee.memberId,
			merchantName: fee.merchantName,
			currency: fee.currency,
			brand: fee.brand,
		});

		if (!fallbackFeeMap.has(fallbackKey)) {
			fallbackFeeMap.set(fallbackKey, fee);
		} else {
			fallbackFeeMap.set(fallbackKey, null);
		}
	}

	return { exactFeeMap, fallbackFeeMap };
};

const findFeeFromIndexes = (row, feeIndexes) => {
	const exactKey = feeExactKey({
		memberId: row.memberId,
		merchantName: row.merchantCompanyName,
		accountId: row.bankAccountId,
		currency: row.currency,
		brand: row.paymentBrand,
	});

	const exactFee = feeIndexes.exactFeeMap.get(exactKey);

	if (exactFee) {
		return {
			fee: exactFee,
			matchType: "account_exact",
		};
	}

	const fallbackKey = feeFallbackKey({
		memberId: row.memberId,
		merchantName: row.merchantCompanyName,
		currency: row.currency,
		brand: row.paymentBrand,
	});

	const fallbackFee = feeIndexes.fallbackFeeMap.get(fallbackKey);

	if (fallbackFee) {
		return {
			fee: fallbackFee,
			matchType: "merchant_fallback",
		};
	}

	return {
		fee: null,
		matchType: "unmatched",
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

export const uploadMerchantTransactions = async (req, res) => {
	// Optional but useful for large files.
	req.setTimeout?.(10 * 60 * 1000);
	res.setTimeout?.(10 * 60 * 1000);

	const files = [...(req.files?.file || []), ...(req.files?.files || [])];

	if (!files.length) {
		return res.status(400).json({
			success: false,
			message: "Transaction file is required",
		});
	}

	const feeIndexes = await buildFeeIndexes();

	const results = [];

	for (const file of files) {
		const isCsv = file.originalname.toLowerCase().endsWith(".csv");

		const rows = isCsv
			? parseCsvTransactionRows(file.buffer)
			: parseWorkbookRows(file.buffer);

		const upload = await MerchantTransactionUpload.create({
			fileName: file.originalname,
			totalRows: rows.length,
			validRows: 0,
			unmatchedFeeRows: 0,
			uploadedBy: req.user._id,
		});

		let matchedCount = 0;
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

			if (isMissingRequiredTransactionField(row)) {
				skippedRows += 1;
				continue;
			}

			const { fee, matchType } = findFeeFromIndexes(row, feeIndexes);

			if (!fee) {
				unmatchedFeeRows += 1;

				batch.push({
					uploadId: upload._id,
					...row,
					matchStatus: "unmatched_fee",
				});
			} else {
				const feeAmounts = calculateFees({ row, fee });

				matchedCount += 1;

				batch.push({
					uploadId: upload._id,
					...row,

					feeConfigId: fee._id,
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
					unmatchedFeeRows,
				},
			},
		);

		results.push({
			fileName: file.originalname,
			totalRows: rows.length,
			insertedRows,
			matchedCount,
			unmatchedFeeRows,
			skippedRows,
			uploadId: upload._id,
		});
	}

	return res.status(201).json({
		success: true,
		message: "Merchant transaction file uploaded successfully",
		data: results,
	});
};

const parseCsvTransactionRows = (buffer) => {
	const content = buffer.toString("utf8");
	const lines = content.split(/\r?\n/);

	const headerIndex = lines.findIndex((line) =>
		line.toUpperCase().includes("TRANSACTION DATE"),
	);

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
			normalized[normalizeHeader(key)] = value;
		}

		return normalized;
	});
};

export const listMerchantTransactions = async (req, res) => {
	const { search, matchStatus, fromDate, toDate } = req.query;
	const { page, limit, skip } = getPagination(req.query);

	const query = {};

	if (matchStatus) query.matchStatus = matchStatus;

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
		];
	}

	const [data, total] = await Promise.all([
		MerchantTransaction.find(query)
			.populate("feeConfigId")
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

/*
|--------------------------------------------------------------------------
| Reports
|--------------------------------------------------------------------------
*/

const addToGroup = (obj, key, amount = 1) => {
	const finalKey = key || "UNKNOWN";
	obj[finalKey] = roundMoney((obj[finalKey] || 0) + amount);
};

const generateReportsForUpload = async ({ uploadId, userId }) => {
	const groups = await MerchantTransaction.aggregate([
		{ $match: { uploadId: new mongoose.Types.ObjectId(uploadId) } },
		{
			$group: {
				_id: {
					memberId: "$memberId",
					date: {
						$dateToString: {
							format: "%Y-%m-%d",
							date: "$transactionDate",
						},
					},
				},
			},
		},
	]);

	const reports = [];

	for (const group of groups) {
		const reportData = await buildMerchantReportData({
			memberId: group._id.memberId,
			reportDate: group._id.date,
		});

		if (!reportData.memberId || reportData.summary.totalTransactions === 0) {
			continue;
		}

		const report = await MerchantSettlementReport.create({
			merchantName: reportData.merchantName,
			memberId: reportData.memberId,
			partnerName: reportData.partnerName,
			reportDate: reportData.reportDate,
			fromDate: reportData.fromDate,
			toDate: reportData.toDate,
			summary: reportData.summary,
			currencySummary: reportData.currencySummary,
			statusSummary: reportData.statusSummary,
			brandSummary: reportData.brandSummary,
			modeSummary: reportData.modeSummary,
			reportData,
			emailStatus: "draft",
			createdBy: userId,
		});

		reports.push(report._id);
	}

	return reports;
};

const buildMerchantReportData = async ({
	memberId,
	reportDate,
	fromDate,
	toDate,
}) => {
	const query = {};

	if (memberId) query.memberId = memberId;

	if (reportDate) {
		query.transactionDate = getDateRange(reportDate);
	} else if (fromDate || toDate) {
		query.transactionDate = {};
		if (fromDate) query.transactionDate.$gte = startOfDate(fromDate);
		if (toDate) query.transactionDate.$lte = endOfDate(toDate);
	}

	const transactions = await MerchantTransaction.find(query)
		.sort({ transactionDate: 1 })
		.lean();

	const first = transactions[0];

	const summary = {
		totalTransactions: transactions.length,
		successfulTransactions: 0,
		failedTransactions: 0,
		grossAuthAmount: 0,
		capturedAmount: 0,
		totalFees: 0,
		rollingReserveAmount: 0,
		netSettlement: 0,
	};

	const currencySummary = {};
	const statusSummary = {};
	const brandSummary = {};
	const modeSummary = {};
	const daySummary = {};

	for (const txn of transactions) {
		const success = isSuccessStatus(txn.status);

		if (success) summary.successfulTransactions += 1;
		else summary.failedTransactions += 1;

		summary.grossAuthAmount += txn.authAmount || 0;
		summary.capturedAmount += txn.capturedAmount || 0;
		summary.totalFees += txn.totalFees || 0;
		summary.rollingReserveAmount += txn.rollingReserveAmount || 0;
		summary.netSettlement += txn.netSettlement || 0;

		addToGroup(statusSummary, txn.status);
		addToGroup(brandSummary, txn.paymentBrand);
		addToGroup(modeSummary, txn.transactionMode);

		if (!currencySummary[txn.currency]) {
			currencySummary[txn.currency] = {
				txns: 0,
				grossAuthAmount: 0,
				capturedAmount: 0,
				totalFees: 0,
				rollingReserveAmount: 0,
				netSettlement: 0,
			};
		}

		currencySummary[txn.currency].txns += 1;
		currencySummary[txn.currency].grossAuthAmount = roundMoney(
			currencySummary[txn.currency].grossAuthAmount + txn.authAmount,
		);
		currencySummary[txn.currency].capturedAmount = roundMoney(
			currencySummary[txn.currency].capturedAmount + txn.capturedAmount,
		);
		currencySummary[txn.currency].totalFees = roundMoney(
			currencySummary[txn.currency].totalFees + txn.totalFees,
		);
		currencySummary[txn.currency].rollingReserveAmount = roundMoney(
			currencySummary[txn.currency].rollingReserveAmount +
				txn.rollingReserveAmount,
		);
		currencySummary[txn.currency].netSettlement = roundMoney(
			currencySummary[txn.currency].netSettlement + txn.netSettlement,
		);

		const day = txn.transactionDate
			? new Date(txn.transactionDate).toISOString().slice(0, 10)
			: "UNKNOWN";

		const dayKey = `${day}_${txn.currency}`;

		if (!daySummary[dayKey]) {
			daySummary[dayKey] = {
				date: day,
				currency: txn.currency,
				txns: 0,
				capturedAmount: 0,
				totalFees: 0,
				rollingReserveAmount: 0,
				netSettlement: 0,
			};
		}

		daySummary[dayKey].txns += 1;
		daySummary[dayKey].capturedAmount = roundMoney(
			daySummary[dayKey].capturedAmount + txn.capturedAmount,
		);
		daySummary[dayKey].totalFees = roundMoney(
			daySummary[dayKey].totalFees + txn.totalFees,
		);
		daySummary[dayKey].rollingReserveAmount = roundMoney(
			daySummary[dayKey].rollingReserveAmount + txn.rollingReserveAmount,
		);
		daySummary[dayKey].netSettlement = roundMoney(
			daySummary[dayKey].netSettlement + txn.netSettlement,
		);
	}

	Object.keys(summary).forEach((key) => {
		if (typeof summary[key] === "number") {
			summary[key] = roundMoney(summary[key]);
		}
	});

	return {
		merchantName: first?.merchantCompanyName || "Unknown Merchant",
		memberId: first?.memberId || memberId,
		partnerName: first?.partnerName || "",
		reportDate: reportDate || fromDate || new Date(),
		fromDate: fromDate || reportDate || null,
		toDate: toDate || reportDate || null,
		summary,
		currencySummary,
		statusSummary,
		brandSummary,
		modeSummary,
		daySummary: Object.values(daySummary),
	};
};

export const generateMerchantSettlementReport = async (req, res) => {
	const { memberId, reportDate, fromDate, toDate } = req.body;

	const reportData = await buildMerchantReportData({
		memberId,
		reportDate,
		fromDate,
		toDate,
	});

	const report = await MerchantSettlementReport.create({
		merchantName: reportData.merchantName,
		memberId: reportData.memberId,
		partnerName: reportData.partnerName,
		reportDate: reportData.reportDate,
		fromDate: reportData.fromDate,
		toDate: reportData.toDate,
		summary: reportData.summary,
		currencySummary: reportData.currencySummary,
		statusSummary: reportData.statusSummary,
		brandSummary: reportData.brandSummary,
		modeSummary: reportData.modeSummary,
		reportData,
		createdBy: req.user._id,
	});

	return res.status(201).json({
		success: true,
		message: "Merchant settlement report generated successfully",
		data: report,
	});
};

export const listMerchantSettlementReports = async (req, res) => {
	const { search } = req.query;
	const { page, limit, skip } = getPagination(req.query);

	const query = {};

	if (search) {
		query.$or = [
			{ merchantName: new RegExp(search, "i") },
			{ memberId: new RegExp(search, "i") },
		];
	}

	const [data, total] = await Promise.all([
		MerchantSettlementReport.find(query)
			.sort({ createdAt: -1 })
			.skip(skip)
			.limit(limit)
			.lean(),

		MerchantSettlementReport.countDocuments(query),
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

export const downloadMerchantSettlementPdf = async (req, res) => {
	const report = await MerchantSettlementReport.findById(req.params.id).lean();

	if (!report) {
		return res.status(404).json({
			success: false,
			message: "Report not found",
		});
	}

	const PRIMARY = "#1234bc";
	const PRIMARY_DARK = "#0b2485";
	const TEXT = "#111827";
	const MUTED = "#6b7280";
	const BORDER = "#e5e7eb";
	const SOFT_BG = "#f8fafc";
	const WHITE = "#ffffff";
	const SUCCESS = "#16a34a";
	const DANGER = "#dc2626";
	const WARNING = "#f59e0b";

	const MARGIN = 32;

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

	const formatDateTime = (value) => {
		if (!value) return "-";
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) return "-";

		return date.toISOString().replace("T", " ").slice(0, 19);
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

	const fitText = (doc, value, width) => {
		let text = cleanText(value);
		if (!text) return "-";

		while (doc.widthOfString(text) > width && text.length > 4) {
			text = `${text.slice(0, -4)}...`;
		}

		return text;
	};

	const getInitials = (value) => {
		const words = cleanText(value).split(" ").filter(Boolean);
		if (!words.length) return "M";

		return words
			.slice(0, 2)
			.map((word) => word[0])
			.join("")
			.toUpperCase();
	};

	const drawMerchantNameBadge = (x, y, w, h, dark = false) => {
		doc
			.save()
			.roundedRect(x, y, w, h, 10)
			.fill(dark ? PRIMARY : WHITE)
			.roundedRect(x, y, w, h, 10)
			.strokeColor(dark ? PRIMARY : BORDER)
			.lineWidth(0.8)
			.stroke();

		doc
			.fillColor(dark ? WHITE : PRIMARY)
			.font("Helvetica-Bold")
			.fontSize(8)
			.text("MERCHANT", x + 12, y + 9, {
				width: w - 24,
				align: "left",
			});

		doc
			.fillColor(dark ? WHITE : TEXT)
			.font("Helvetica-Bold")
			.fontSize(15)
			.text(merchantName, x + 12, y + 23, {
				width: w - 24,
				align: "left",
				ellipsis: true,
			});

		doc.restore();
	};

	const firstTxn = report.reportData?.transactions?.[0] || {};
	const merchantName = cleanText(
		report.merchantName || firstTxn.merchantCompanyName || "Unknown Merchant",
	);
	const partnerName = cleanText(
		report.partnerName ||
			report.reportData?.partnerName ||
			firstTxn.partnerName ||
			"TransactWorld",
	);
	const memberId = cleanText(report.memberId || firstTxn.memberId || "-");
	const transactions = report.reportData?.transactions || [];
	const summary = report.summary || {};
	const currencySummary = report.currencySummary || {};
	const statusSummary = report.statusSummary || {};
	const brandSummary = report.brandSummary || {};
	const modeSummary = report.modeSummary || {};
	const daySummary = report.reportData?.daySummary || [];
	const primaryCurrency =
		Object.keys(currencySummary || {})[0] || firstTxn.currency || "";

	const periodFrom = report.fromDate || report.reportDate;
	const periodTo = report.toDate || report.reportDate;

	const doc = new PDFDocument({
		margin: MARGIN,
		size: "A4",
		layout: "landscape",
		bufferPages: true,
		info: {
			Title: `Merchant Settlement Report - ${merchantName}`,
			Author: partnerName,
			Subject: `Settlement Report for ${merchantName}`,
		},
	});

	res.setHeader(
		"Content-Disposition",
		`attachment; filename=${slugify(merchantName)}-${memberId}-settlement-report.pdf`,
	);
	res.setHeader("Content-Type", "application/pdf");

	doc.pipe(res);

	let pageNo = 1;

	const drawMerchantLogo = (x, y, size, dark = false) => {
		if (logoPath) {
			doc.save().roundedRect(x, y, size, size, 8).fill(WHITE);

			try {
				doc.image(logoPath, x + 6, y + 6, {
					width: size - 12,
					height: size - 12,
					fit: [size - 12, size - 12],
					align: "center",
					valign: "center",
				});
			} catch {
				doc
					.fillColor(PRIMARY)
					.font("Helvetica-Bold")
					.fontSize(14)
					.text(getInitials(merchantName), x, y + size / 2 - 7, {
						width: size,
						align: "center",
					});
			}

			doc.restore();
			return;
		}

		doc
			.save()
			.roundedRect(x, y, size, size, 8)
			.fill(dark ? PRIMARY : WHITE)
			.fillColor(dark ? WHITE : PRIMARY)
			.font("Helvetica-Bold")
			.fontSize(15)
			.text(getInitials(merchantName), x, y + size / 2 - 8, {
				width: size,
				align: "center",
			})
			.restore();
	};

	const drawFooter = () => {
		const y = doc.page.height - 28;

		doc
			.save()
			.moveTo(MARGIN, y - 8)
			.lineTo(doc.page.width - MARGIN, y - 8)
			.strokeColor(BORDER)
			.lineWidth(0.7)
			.stroke();

		doc
			.fillColor(MUTED)
			.font("Helvetica")
			.fontSize(7.5)
			.text(`Generated by ${partnerName}`, MARGIN, y, {
				width: 260,
				align: "left",
			})
			.text(`Confidential Settlement Report`, 300, y, {
				width: 240,
				align: "center",
			})
			.text(`Page ${pageNo}`, doc.page.width - MARGIN - 100, y, {
				width: 100,
				align: "right",
			});

		doc.restore();
	};

	const drawPageHeader = () => {
		doc
			.save()
			.rect(0, 0, doc.page.width, 58)
			.fill(SOFT_BG)
			.rect(0, 0, 7, doc.page.height)
			.fill(PRIMARY);

		drawMerchantNameBadge(MARGIN, 13, 150, 34, true);

		doc
			.fillColor(TEXT)
			.font("Helvetica-Bold")
			.fontSize(11)
			.text("Merchant Settlement Report", MARGIN + 166, 15)

			.fillColor(MUTED)
			.font("Helvetica")
			.fontSize(8)
			.text(
				`${merchantName} | MID ${memberId} | ${formatDate(periodFrom)} to ${formatDate(periodTo)}`,
				MARGIN + 166,
				32,
			);

		doc
			.fillColor(PRIMARY)
			.font("Helvetica-Bold")
			.fontSize(8)
			.text(partnerName, doc.page.width - MARGIN - 180, 22, {
				width: 180,
				align: "right",
			});

		doc.restore();

		drawFooter();
		doc.y = 76;
	};

	const addBrandedPage = () => {
		doc.addPage();
		pageNo += 1;
		drawPageHeader();
	};

	const sectionTitle = (title, subtitle = "") => {
		if (doc.y + 34 > doc.page.height - 52) {
			addBrandedPage();
		}

		doc
			.fillColor(TEXT)
			.font("Helvetica-Bold")
			.fontSize(12)
			.text(title, MARGIN, doc.y);

		if (subtitle) {
			doc
				.moveDown(0.15)
				.fillColor(MUTED)
				.font("Helvetica")
				.fontSize(8)
				.text(subtitle, MARGIN, doc.y, {
					width: doc.page.width - MARGIN * 2,
				});
		}

		doc.moveDown(0.6);
	};

	const drawMetricCard = ({ x, y, w, h, label, value, accent = PRIMARY }) => {
		doc
			.save()
			.roundedRect(x, y, w, h, 10)
			.fill(WHITE)
			.roundedRect(x, y, w, h, 10)
			.strokeColor(BORDER)
			.lineWidth(0.8)
			.stroke();

		doc.rect(x, y, 5, h).fill(accent);

		doc
			.fillColor(MUTED)
			.font("Helvetica")
			.fontSize(7.5)
			.text(label.toUpperCase(), x + 14, y + 12, {
				width: w - 22,
			});

		doc
			.fillColor(TEXT)
			.font("Helvetica-Bold")
			.fontSize(15)
			.text(value, x + 14, y + 29, {
				width: w - 22,
			});

		doc.restore();
	};

	const drawInfoRow = (label, value, x, y, w) => {
		doc
			.fillColor(MUTED)
			.font("Helvetica")
			.fontSize(7.5)
			.text(label.toUpperCase(), x, y);

		doc
			.fillColor(TEXT)
			.font("Helvetica-Bold")
			.fontSize(9)
			.text(value || "-", x, y + 11, {
				width: w,
			});
	};

	const drawTable = ({
		columns,
		rows,
		rowHeight = 17,
		headerHeight = 20,
		fontSize = 7,
		zebra = true,
	}) => {
		const tableX = MARGIN;
		const tableW = doc.page.width - MARGIN * 2;
		const maxY = doc.page.height - 48;
		let y = doc.y;

		const drawHeader = () => {
			doc.roundedRect(tableX, y, tableW, headerHeight, 4).fill(PRIMARY);

			let x = tableX;

			for (const col of columns) {
				doc
					.fillColor(WHITE)
					.font("Helvetica-Bold")
					.fontSize(fontSize)
					.text(col.label, x + 4, y + 6, {
						width: col.width - 8,
						align: col.align || "left",
					});

				x += col.width;
			}

			y += headerHeight;
		};

		if (y + headerHeight + rowHeight > maxY) {
			addBrandedPage();
			y = doc.y;
		}

		drawHeader();

		rows.forEach((row, index) => {
			if (y + rowHeight > maxY) {
				addBrandedPage();
				y = doc.y;
				drawHeader();
			}

			if (zebra && index % 2 === 0) {
				doc.rect(tableX, y, tableW, rowHeight).fill("#f9fafb");
			}

			doc
				.rect(tableX, y, tableW, rowHeight)
				.strokeColor(BORDER)
				.lineWidth(0.4)
				.stroke();

			let x = tableX;

			for (const col of columns) {
				const rawValue =
					typeof col.value === "function"
						? col.value(row, index)
						: row[col.key];

				const value = fitText(doc, rawValue, col.width - 8);

				doc
					.fillColor(col.color ? col.color(row) : TEXT)
					.font(col.bold ? "Helvetica-Bold" : "Helvetica")
					.fontSize(fontSize)
					.text(value, x + 4, y + 5, {
						width: col.width - 8,
						align: col.align || "left",
					});

				x += col.width;
			}

			y += rowHeight;
		});

		doc.y = y + 10;
	};

	/*
  |--------------------------------------------------------------------------
  | Cover / Executive Page
  |--------------------------------------------------------------------------
  */

	doc.rect(0, 0, doc.page.width, doc.page.height).fill(SOFT_BG);

	doc.rect(0, 0, doc.page.width, 126).fill(PRIMARY);

	doc
		.fillColor(WHITE)
		.font("Helvetica-Bold")
		.fontSize(24)
		.text("Merchant Settlement Report", MARGIN, 34, {
			width: 430,
		});

	doc
		.fillColor("#dbe4ff")
		.font("Helvetica")
		.fontSize(10)
		.text(
			"Premium settlement summary, fee breakdown and transaction ledger",
			MARGIN,
			68,
			{
				width: 430,
			},
		);

	drawMerchantNameBadge(doc.page.width - MARGIN - 210, 28, 178, 58, false);

	doc
		.roundedRect(MARGIN, 104, doc.page.width - MARGIN * 2, 108, 12)
		.fill(WHITE)
		.roundedRect(MARGIN, 104, doc.page.width - MARGIN * 2, 108, 12)
		.strokeColor(BORDER)
		.lineWidth(0.8)
		.stroke();

	const infoY = 126;
	const colW = (doc.page.width - MARGIN * 2 - 48) / 4;

	drawInfoRow("Merchant", merchantName, MARGIN + 22, infoY, colW);
	drawInfoRow("Member ID", memberId, MARGIN + 22 + colW + 16, infoY, colW);
	drawInfoRow(
		"Partner Name",
		partnerName,
		MARGIN + 22 + (colW + 16) * 2,
		infoY,
		colW,
	);
	drawInfoRow(
		"Report Period",
		`${formatDate(periodFrom)} - ${formatDate(periodTo)}`,
		MARGIN + 22 + (colW + 16) * 3,
		infoY,
		colW,
	);

	drawInfoRow(
		"Generated On",
		formatDate(report.createdAt || new Date()),
		MARGIN + 22,
		infoY + 42,
		colW,
	);
	drawInfoRow(
		"Currency",
		primaryCurrency || "-",
		MARGIN + 22 + colW + 16,
		infoY + 42,
		colW,
	);
	drawInfoRow(
		"Transactions",
		formatInt(summary.totalTransactions || transactions.length),
		MARGIN + 22 + (colW + 16) * 2,
		infoY + 42,
		colW,
	);
	drawInfoRow(
		"Report Status",
		"Final",
		MARGIN + 22 + (colW + 16) * 3,
		infoY + 42,
		colW,
	);

	const cardY = 240;
	const cardGap = 14;
	const cardW = (doc.page.width - MARGIN * 2 - cardGap * 3) / 4;

	drawMetricCard({
		x: MARGIN,
		y: cardY,
		w: cardW,
		h: 74,
		label: "Total Transactions",
		value: formatInt(summary.totalTransactions || transactions.length),
		accent: PRIMARY,
	});

	drawMetricCard({
		x: MARGIN + cardW + cardGap,
		y: cardY,
		w: cardW,
		h: 74,
		label: "Captured Amount",
		value: formatMoney(summary.capturedAmount || 0, primaryCurrency),
		accent: SUCCESS,
	});

	drawMetricCard({
		x: MARGIN + (cardW + cardGap) * 2,
		y: cardY,
		w: cardW,
		h: 74,
		label: "Total Fees",
		value: formatMoney(summary.totalFees || 0, primaryCurrency),
		accent: WARNING,
	});

	drawMetricCard({
		x: MARGIN + (cardW + cardGap) * 3,
		y: cardY,
		w: cardW,
		h: 74,
		label: "Net Settlement",
		value: formatMoney(summary.netSettlement || 0, primaryCurrency),
		accent: PRIMARY_DARK,
	});

	doc.y = 344;

	sectionTitle(
		"Settlement Overview",
		"High-level transaction and settlement performance for this report period.",
	);

	drawTable({
		columns: [
			{ label: "Metric", key: "metric", width: 240, bold: true },
			{ label: "Value", key: "value", width: 160, align: "right", bold: true },
			{
				label: "Description",
				key: "description",
				width: doc.page.width - MARGIN * 2 - 400,
			},
		],
		rows: [
			{
				metric: "Successful Transactions",
				value: formatInt(summary.successfulTransactions || 0),
				description:
					"Transactions counted as settled, captured, successful or approved.",
			},
			{
				metric: "Failed Transactions",
				value: formatInt(summary.failedTransactions || 0),
				description: "Transactions that did not settle successfully.",
			},
			{
				metric: "Gross Auth Amount",
				value: formatMoney(summary.grossAuthAmount || 0, primaryCurrency),
				description: "Total authorized value before settlement calculations.",
			},
			{
				metric: "Rolling Reserve",
				value: formatMoney(summary.rollingReserveAmount || 0, primaryCurrency),
				description:
					"Reserve amount retained as per merchant fee configuration.",
			},
		],
		rowHeight: 24,
		fontSize: 8,
	});

	drawFooter();

	/*
  |--------------------------------------------------------------------------
  | Summary Pages
  |--------------------------------------------------------------------------
  */

	addBrandedPage();

	sectionTitle(
		"Currency Settlement Summary",
		"Settlement totals grouped by currency.",
	);

	drawTable({
		columns: [
			{ label: "Currency", key: "currency", width: 80, bold: true },
			{ label: "Txns", key: "txns", width: 70, align: "right" },
			{
				label: "Gross Auth",
				key: "grossAuthAmount",
				width: 105,
				align: "right",
			},
			{ label: "Captured", key: "capturedAmount", width: 105, align: "right" },
			{ label: "Total Fees", key: "totalFees", width: 105, align: "right" },
			{
				label: "Rolling Reserve",
				key: "rollingReserveAmount",
				width: 120,
				align: "right",
			},
			{
				label: "Net Settlement",
				key: "netSettlement",
				width: 125,
				align: "right",
				bold: true,
			},
		],
		rows: Object.entries(currencySummary).map(([currency, item]) => ({
			currency,
			txns: formatInt(item.txns),
			grossAuthAmount: formatNumber(item.grossAuthAmount),
			capturedAmount: formatNumber(item.capturedAmount),
			totalFees: formatNumber(item.totalFees),
			rollingReserveAmount: formatNumber(item.rollingReserveAmount),
			netSettlement: formatNumber(item.netSettlement),
		})),
		rowHeight: 22,
		fontSize: 8,
	});

	sectionTitle("Status, Brand and Mode Summary");

	const compactRows = [
		...Object.entries(statusSummary).map(([key, value]) => ({
			group: "Status",
			name: key,
			count: formatInt(value),
		})),
		...Object.entries(brandSummary).map(([key, value]) => ({
			group: "Payment Brand",
			name: key,
			count: formatInt(value),
		})),
		...Object.entries(modeSummary).map(([key, value]) => ({
			group: "Transaction Mode",
			name: key,
			count: formatInt(value),
		})),
	];

	drawTable({
		columns: [
			{ label: "Group", key: "group", width: 160, bold: true },
			{ label: "Name", key: "name", width: 220 },
			{ label: "Count", key: "count", width: 120, align: "right", bold: true },
			{
				label: "Remarks",
				value: () => "Included in report calculation",
				width: 260,
			},
		],
		rows: compactRows,
		rowHeight: 20,
		fontSize: 8,
	});

	sectionTitle(
		"Day-wise Settlement Summary",
		"Daily settlement movement for the selected report period.",
	);

	drawTable({
		columns: [
			{ label: "Date", key: "date", width: 100, bold: true },
			{ label: "Currency", key: "currency", width: 80 },
			{ label: "Txns", key: "txns", width: 70, align: "right" },
			{ label: "Captured", key: "capturedAmount", width: 120, align: "right" },
			{ label: "Fees", key: "totalFees", width: 110, align: "right" },
			{
				label: "Rolling Reserve",
				key: "rollingReserveAmount",
				width: 130,
				align: "right",
			},
			{
				label: "Net Settlement",
				key: "netSettlement",
				width: 130,
				align: "right",
				bold: true,
			},
		],
		rows: daySummary.map((item) => ({
			date: item.date,
			currency: item.currency,
			txns: formatInt(item.txns),
			capturedAmount: formatNumber(item.capturedAmount),
			totalFees: formatNumber(item.totalFees),
			rollingReserveAmount: formatNumber(item.rollingReserveAmount),
			netSettlement: formatNumber(item.netSettlement),
		})),
		rowHeight: 20,
		fontSize: 8,
	});

	/*
  |--------------------------------------------------------------------------
  | Transaction Detail Pages
  |--------------------------------------------------------------------------
  */

	addBrandedPage();

	sectionTitle(
		"Transaction Detail",
		"Complete transaction-level ledger. Failed transactions keep captured amount and fee values as zero where applicable.",
	);

	drawTable({
		columns: [
			{
				label: "Date",
				value: (txn) => formatDateTime(txn.transactionDate).slice(0, 10),
				width: 66,
			},
			{
				label: "Tracking ID",
				value: (txn) => cleanText(txn.trackingId),
				width: 72,
				bold: true,
			},
			{
				label: "Status",
				value: (txn) => cleanText(txn.status),
				width: 92,
				color: (txn) => {
					const status = cleanText(txn.status).toUpperCase();
					if (
						status.includes("SETTLED") ||
						status.includes("SUCCESS") ||
						status.includes("CAPTURED")
					) {
						return SUCCESS;
					}
					if (status.includes("FAILED") || status.includes("DECLINED")) {
						return DANGER;
					}
					return TEXT;
				},
			},
			{
				label: "Cur",
				value: (txn) => cleanText(txn.currency),
				width: 34,
			},
			{
				label: "Brand",
				value: (txn) => cleanText(txn.paymentBrand),
				width: 42,
			},
			{
				label: "Mode",
				value: (txn) => cleanText(txn.transactionMode),
				width: 48,
			},
			{
				label: "Auth",
				value: (txn) => formatNumber(txn.authAmount),
				width: 62,
				align: "right",
			},
			{
				label: "Captured",
				value: (txn) => formatNumber(txn.capturedAmount),
				width: 68,
				align: "right",
			},
			{
				label: "Fees",
				value: (txn) => formatNumber(txn.totalFees),
				width: 58,
				align: "right",
			},
			{
				label: "RR",
				value: (txn) => formatNumber(txn.rollingReserveAmount),
				width: 54,
				align: "right",
			},
			{
				label: "Net",
				value: (txn) => formatNumber(txn.netSettlement),
				width: 66,
				align: "right",
				bold: true,
			},
			{
				label: "Match",
				value: (txn) =>
					txn.matchType === "account_exact"
						? "Account"
						: txn.matchType === "merchant_fallback"
							? "Fallback"
							: cleanText(txn.matchStatus || "-"),
				width: 70,
			},
		],
		rows: transactions,
		rowHeight: 15,
		headerHeight: 19,
		fontSize: 6.8,
	});

	/*
  |--------------------------------------------------------------------------
  | Finalize with accurate page count
  |--------------------------------------------------------------------------
  */

	const range = doc.bufferedPageRange();

	for (let i = range.start; i < range.start + range.count; i += 1) {
		doc.switchToPage(i);

		doc
			.fillColor(MUTED)
			.font("Helvetica")
			.fontSize(7.5)
			.text(
				`Page ${i + 1} of ${range.count}`,
				doc.page.width - MARGIN - 100,
				doc.page.height - 28,
				{
					width: 100,
					align: "right",
				},
			);
	}

	doc.end();
};

export const downloadMerchantSettlementExcel = async (req, res) => {
	const report = await MerchantSettlementReport.findById(req.params.id).lean();

	if (!report) {
		return res.status(404).json({
			success: false,
			message: "Report not found",
		});
	}

	const transactions = report.reportData?.transactions || [];

	const rows = transactions.map((txn) => ({
		"Transaction Date": txn.transactionDate,
		"Member ID": txn.memberId,
		Merchant: txn.merchantCompanyName,
		"Tracking ID": txn.trackingId,
		"Payment ID": txn.paymentId,
		"Order ID": txn.orderId,
		"Account ID": txn.bankAccountId,
		Brand: txn.paymentBrand,
		Mode: txn.transactionMode,
		Currency: txn.currency,
		"Auth Amount": txn.authAmount,
		"Captured Amount": txn.capturedAmount,
		"MDR Fee": txn.mdrFee,
		"Approval Fee": txn.approvalFee,
		"Decline Fee": txn.declineFee,
		"Settlement Expense": txn.settlementExpense,
		RR: txn.rollingReserveAmount,
		"Total Fees": txn.totalFees,
		"Net Settlement": txn.netSettlement,
		Status: txn.status,
		"Match Status": txn.matchStatus,
	}));

	const worksheet = xlsx.utils.json_to_sheet(rows);
	const workbook = xlsx.utils.book_new();

	xlsx.utils.book_append_sheet(workbook, worksheet, "Merchant Settlement");

	const buffer = xlsx.write(workbook, {
		type: "buffer",
		bookType: "xlsx",
	});

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

export const sendMerchantSettlementEmail = async (req, res) => {
	const report = await MerchantSettlementReport.findById(req.params.id);

	if (!report) {
		return res.status(404).json({
			success: false,
			message: "Report not found",
		});
	}

	// TODO: connect your email service here.
	// For now, we just mark sent after frontend/backend email integration.

	report.emailStatus = "sent";
	report.emailSentAt = new Date();
	report.emailTo = req.body.emailTo;

	await report.save();

	return res.json({
		success: true,
		message: "Merchant settlement email marked as sent",
		data: report,
	});
};
