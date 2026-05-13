// MODELS
import { Merchant } from "../models/merchant.model.js";
import { MerchantAccount } from "../models/merchant-account.model.js";
import { Acquirer } from "../models/acquirer.model.js";
import { Wiresheet } from "../models/wiresheet.model.js";
import { WiresheetTransaction } from "../models/wiresheet-transaction.model.js";

// EXCEL & DATE
import {
	parseExcelFile,
	extractWorkbookBankName,
} from "../utils/excelParser.js";
import { parseFlexibleSheetDate } from "../utils/dateUtils.js";

// CURRENCY
import {
	derivePaymentMethod,
	deriveSettlementStatus,
	roundMoney,
} from "../utils/currencyUtils.js";

// FILE READ FROM EXCEL FILE
import { extractBankNameFromFileName } from "../utils/ManagedVariables.js";

// Clean text → remove extra spaces + make uppercase
const normalizeText = (value) =>
	String(value || "")
		.replace(/\s+/g, " ")
		.trim()
		.toUpperCase();

// Decide merchant tag based on name
const resolveMerchantTag = (merchantName) =>
	normalizeText(merchantName).includes("(DP)")
		? "Dreamzpay Merchant"
		: "Transactworld Merchant";

// Convert Excel values → clean number
const parseSheetNumber = (value) => {
	if (value === null || value === undefined) return 0;

	const normalized = String(value)
		.replace(/,/g, "")
		.replace(/[^0-9.-]/g, "")
		.trim();

	if (!normalized || normalized === "-" || normalized === ".") return 0;

	const parsed = Number(normalized);
	return Number.isFinite(parsed) ? parsed : 0;
};

// Converts raw Excel row → clean structured object
const normalizeRow = (row) => ({
	merchantName: String(row["MERCHANT NAME"] || row.merchantName || "").trim(),
	mid: String(row.MID || row.mid || "").trim(),
	startDate: parseFlexibleSheetDate(row["START DATE"] || row.startDate),
	endDate: parseFlexibleSheetDate(row["END DATE"] || row.endDate),
	processingCurrency: String(
		row["PROCESSING CURRENCY"] || row.processingCurrency || "",
	)
		.trim()
		.toUpperCase(),
	processingAmount: parseSheetNumber(row.AMOUNT || row.processingAmount || 0),
	rate: 0,
	settlementCurrency: String(
		row["PROCESSING CURRENCY"] || row.processingCurrency || "",
	)
		.trim()
		.toUpperCase(),
	payable: parseSheetNumber(row.AMOUNT || row.processingAmount || 0),
});

// Create wiresheet name
const buildWiresheetName = ({ acquirerName, startDate, endDate }) =>
	`${acquirerName.toUpperCase()}_${startDate
		.toISOString()
		.slice(0, 10)}_TO_${endDate.toISOString().slice(0, 10)}`;

// Find date range from rows
const getSheetRange = (rows) => {
	const startDate = rows.reduce(
		(min, row) => (!min || row.startDate < min ? row.startDate : min),
		null,
	);

	const endDate = rows.reduce(
		(max, row) => (!max || row.endDate > max ? row.endDate : max),
		null,
	);

	return { startDate, endDate };
};

const getAcquirer = async ({ acquirerId, fileBuffer, originalName }) => {
	if (acquirerId) {
		return Acquirer.findById(acquirerId).lean();
	}

	const workbookBankName = extractWorkbookBankName(fileBuffer);

	if (!workbookBankName) return null;

	return Acquirer.findOne({
		name: new RegExp(`^${workbookBankName}$`, "i"),
	}).lean();
};
// Check if merchants exist -> Create missing ones

const ensureMerchants = async (rows) => {
	const merchantNames = [...new Set(rows.map((row) => row.merchantName))];

	const existingMerchants = await Merchant.find({
		merchantName: { $in: merchantNames },
	}).lean();

	const merchantMap = new Map(
		existingMerchants.map((merchant) => [merchant.merchantName, merchant]),
	);

	const missingMerchantNames = merchantNames.filter(
		(merchantName) => !merchantMap.has(merchantName),
	);

	if (missingMerchantNames.length) {
		await Merchant.insertMany(
			missingMerchantNames.map((merchantName) => ({
				merchantName,
				merchantTag: resolveMerchantTag(merchantName),
				status: "active",
			})),
			{ ordered: false },
		).catch((error) => {
			if (error.code !== 11000) throw error;
		});
	}

	const merchants = await Merchant.find({
		merchantName: { $in: merchantNames },
	}).lean();

	return new Map(
		merchants.map((merchant) => [merchant.merchantName, merchant]),
	);
};

// Ensures: MID + Acquirer mapping exists
const ensureMerchantMappings = async ({ rows, acquirerId, merchantMap }) => {
	const cleanRows = rows.map((row) => ({
		...row,
		mid: String(row.mid).trim(),
		merchantName: String(row.merchantName).trim(),
	}));

	const mids = [...new Set(cleanRows.map((row) => row.mid))];

	const operations = [];

	for (const row of cleanRows) {
		const merchant = merchantMap.get(row.merchantName);

		if (!merchant) {
			throw new Error(`Merchant not found for "${row.merchantName}"`);
		}

		operations.push({
			updateOne: {
				filter: {
					acquirerId,
					mid: row.mid,
				},
				update: {
					$setOnInsert: {
						merchantId: merchant._id,
						acquirerId,
						mid: row.mid,
						processingCurrency: row.processingCurrency,
						settlementCurrency: row.settlementCurrency,
						status: "active",
					},
				},
				upsert: true,
			},
		});
	}

	if (operations.length) {
		await MerchantAccount.bulkWrite(operations, { ordered: false });
	}

	const mappings = await MerchantAccount.find({
		acquirerId,
		mid: { $in: mids },
	}).lean();

	const mappingMap = new Map(
		mappings.map((mapping) => [
			`${String(mapping.acquirerId)}:${String(mapping.mid).trim()}`,
			mapping,
		]),
	);

	return mappingMap;
};

// PROCESSING WIRESHEET
const processSingleWiresheet = async ({ file, acquirerId }) => {
	const acquirer = await getAcquirer({
		acquirerId,
		fileBuffer: file.buffer,
		originalName: file.originalname,
	});

	if (!acquirer) {
		return {
			success: false,
			fileName: file.originalname,
			message: "Acquirer not found",
		};
	}

	const rows = parseExcelFile(file.buffer)
		.map(normalizeRow)
		.filter((row) => row.mid && row.merchantName);

	if (!rows.length) {
		return {
			success: false,
			fileName: file.originalname,
			message: "No valid wiresheet rows found",
		};
	}

	const { startDate, endDate } = getSheetRange(rows);

	if (!startDate || !endDate) {
		return {
			success: false,
			fileName: file.originalname,
			message: "Sheet must include valid start and end dates",
		};
	}

	const wiresheetName = buildWiresheetName({
		acquirerName: acquirer.name,
		startDate,
		endDate,
	});

	const existingWiresheet = await Wiresheet.findOne({ wiresheetName }).lean();

	if (existingWiresheet) {
		return {
			success: false,
			duplicate: true,
			fileName: file.originalname,
			wiresheetId: existingWiresheet._id,
			wiresheetName,
			message: "Wiresheet already exists for this file range",
		};
	}

	const merchantMap = await ensureMerchants(rows);

	const mappingMap = await ensureMerchantMappings({
		rows,
		acquirerId: acquirer._id,
		merchantMap,
	});

	let totalPayable = 0;

	const transactionDocs = rows.map((row) => {
		const mid = String(row.mid).trim();
		const merchantName = String(row.merchantName).trim();

		const merchant = merchantMap.get(merchantName);

		if (!merchant) {
			throw new Error(`Merchant not found for "${merchantName}"`);
		}

		const merchantMapping = mappingMap.get(`${String(acquirer._id)}:${mid}`);

		if (!merchantMapping) {
			throw new Error(`Merchant mapping not found for MID "${mid}"`);
		}

		const payable = roundMoney(row.payable);
		totalPayable += payable;

		return {
			merchantId: merchant._id,
			merchantMappingId: merchantMapping._id,
			merchantName,
			merchantTag: resolveMerchantTag(merchantName),
			mid,
			startDate: row.startDate,
			endDate: row.endDate,
			processingCurrency: row.processingCurrency,
			processingAmount: roundMoney(row.processingAmount),
			rate: row.rate,
			settlementCurrency: row.settlementCurrency,
			payable,
			paid: 0,
			balance: payable,
			status: deriveSettlementStatus({ payable, paid: 0 }),
		};
	});
	const roundedTotalPayable = roundMoney(totalPayable);

	const wiresheet = await Wiresheet.create({
		wiresheetName,
		acquirerId: acquirer._id,
		startDate,
		endDate,
		totalPayable: roundedTotalPayable,
		totalPaid: 0,
		totalBalance: roundedTotalPayable,
		status: "pending",
	});

	try {
		await WiresheetTransaction.insertMany(
			transactionDocs.map((transaction) => ({
				...transaction,
				wiresheetId: wiresheet._id,
			})),
		);
	} catch (error) {
		await Wiresheet.deleteOne({ _id: wiresheet._id });
		throw error;
	}

	return {
		success: true,
		fileName: file.originalname,
		wiresheetId: wiresheet._id,
		wiresheetName: wiresheet.wiresheetName,
		acquirerId: acquirer._id,
		acquirerName: acquirer.name,
		startDate,
		endDate,
		totalPayable: wiresheet.totalPayable,
		totalPaid: wiresheet.totalPaid,
		totalBalance: wiresheet.totalBalance,
		status: wiresheet.status,
		rowCount: transactionDocs.length,
	};
};

// UPLOAD WIRESHEET
export const uploadWiresheet = async (req, res) => {
	const files = [...(req.files?.file || []), ...(req.files?.files || [])];

	if (!files.length) {
		return res.status(400).json({
			success: false,
			message: "At least one wiresheet file is required",
		});
	}

	const results = [];

	for (const file of files) {
		const result = await processSingleWiresheet({
			file,
			acquirerId: req.body.acquirerId,
		});

		results.push(result);
	}

	const processedFiles = results.filter((item) => item.success);
	const duplicateFiles = results.filter((item) => item.duplicate);
	const failedFiles = results.filter(
		(item) => !item.success && !item.duplicate,
	);

	const hasIssues = duplicateFiles.length > 0 || failedFiles.length > 0;

	return res.status(hasIssues ? 207 : 201).json({
		success: true,
		message: hasIssues
			? "Wiresheets processed with some issues"
			: "Wiresheets processed successfully",
		data: {
			totalFiles: files.length,
			processedCount: processedFiles.length,
			duplicateCount: duplicateFiles.length,
			failedCount: failedFiles.length,
			processedFiles,
			duplicateFiles,
			failedFiles,
		},
	});
};
