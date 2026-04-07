import { Merchant } from "../modules/merchants/merchant.model.js";
import { MerchantAccount } from "../modules/merchantAccounts/merchant-account.model.js";
import { SettlementBatch } from "../modules/batches/batch.model.js";
import { SettlementTransaction } from "../modules/settlements/settlement-transaction.model.js";
import { Acquirer } from "../modules/acquirers/acquirer.model.js";
import { extractWorkbookBankName, parseExcelFile } from "../utils/excelParser.js";
import { ApiError } from "../utils/ApiError.js";
import {
	derivePaymentMethod,
	deriveSettlementStatus,
	roundMoney,
} from "../utils/currencyUtils.js";
import { parseSheetDate } from "../utils/dateUtils.js";

const DREAMZPAY_KEYWORDS = [
	"DRIFT CLOUD LIMITED (DP)",
	"CABBAGINO PAYMENTS (DP) (DP)",
	"CABBAGINO PAYMENTS (DP)",
];

const PORTFOLIO_DEFAULT_MERCHANTS = {
	DIMOCO: "Transactworld Merchant",
	TRANSACTPAY: "Transactworld Merchant",
};

const parseSheetNumber = (value) => {
	if (value === null || value === undefined) return 0;
	const normalized = String(value)
		.replace(/,/g, "")
		.replace(/[^0-9.-]/g, "")
		.trim();
	if (!normalized || normalized === "-" || normalized === "." || normalized === "-.") {
		return 0;
	}

	const parsed = Number(normalized);
	return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeText = (value) =>
	String(value || "")
		.replace(/\s+/g, " ")
		.trim()
		.toUpperCase();

const resolvePortfolioMerchantName = ({ merchantName, acquirerName }) => {
	const normalizedMerchantName = normalizeText(merchantName);
	const normalizedAcquirerName = normalizeText(acquirerName);

	if (
		DREAMZPAY_KEYWORDS.some((keyword) =>
			normalizedMerchantName.includes(keyword),
		)
	) {
		return "Dreamzpay Merchant";
	}

	return (
		PORTFOLIO_DEFAULT_MERCHANTS[normalizedAcquirerName] || merchantName
	);
};

const buildBatchName = ({ acquirerName, startDate, endDate }) =>
	`${acquirerName.toUpperCase()}_${startDate.toISOString().slice(0, 10)}_TO_${endDate
		.toISOString()
		.slice(0, 10)}`;

const getSheetRange = (rows) => {
	const startDate = rows.reduce(
		(min, row) => (!min || row.startDate < min ? row.startDate : min),
		null,
	);
	const endDate = rows.reduce(
		(max, row) => (!max || row.endDate > max ? row.endDate : max),
		null,
	);

	if (!startDate || !endDate) {
		throw new ApiError(400, "Sheet must include valid start and end dates");
	}

	return { startDate, endDate };
};

const normalizeAcquirerName = (value) =>
	normalizeText(value).replace(/[^A-Z0-9]/g, "");

const buildAcquirerResolver = async ({ acquirerId }) => {
	if (acquirerId) {
		const acquirer = await Acquirer.findById(acquirerId).lean();
		if (!acquirer) {
			throw new ApiError(404, "Acquirer not found");
		}

		return () => acquirer;
	}

	const acquirers = await Acquirer.find({}, { name: 1 }).lean();
	const acquirerMap = new Map();

	for (const acquirer of acquirers) {
		acquirerMap.set(normalizeAcquirerName(acquirer.name), acquirer);
	}

	return (fileBuffer) => {
		const workbookBankName = extractWorkbookBankName(fileBuffer);
		const normalizedBankName = normalizeAcquirerName(workbookBankName);
		const exactMatch = acquirerMap.get(normalizedBankName);

		if (exactMatch) {
			return exactMatch;
		}

		const partialMatch = acquirers.find((acquirer) => {
			const normalizedAcquirer = normalizeAcquirerName(acquirer.name);
			return (
				normalizedBankName.includes(normalizedAcquirer) ||
				normalizedAcquirer.includes(normalizedBankName)
			);
		});

		if (!partialMatch) {
			throw new ApiError(
				404,
				`Acquirer not found for workbook bank name "${workbookBankName || "Unknown"}"`,
			);
		}

		return partialMatch;
	};
};

const prepareUploadContext = ({ fileBuffer, originalName, acquirer }) => {
	const rows = parseExcelFile(fileBuffer)
		.map(normalizeRow)
		.filter((row) => row.mid && row.merchantName);

	if (!rows.length) {
		throw new ApiError(400, "No valid settlement rows found");
	}

	const { startDate, endDate } = getSheetRange(rows);
	const batchName = buildBatchName({
		acquirerName: acquirer.name,
		startDate,
		endDate,
	});

	return {
		originalName,
		acquirer,
		rows,
		startDate,
		endDate,
		batchName,
	};
};

const ensureMerchants = async (rows, acquirerName) => {
	const merchantNames = [
		...new Set(
			rows.map((row) =>
				resolvePortfolioMerchantName({
					merchantName: row.merchantName,
					acquirerName,
				}),
			),
		),
	];

	const existingMerchants = await Merchant.find(
		{ merchantName: { $in: merchantNames } },
		{ merchantName: 1 },
	).lean();
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
				status: "active",
			})),
			{ ordered: false },
		).catch((error) => {
			if (error.code !== 11000) {
				throw error;
			}
		});

		const refreshedMerchants = await Merchant.find(
			{ merchantName: { $in: merchantNames } },
			{ merchantName: 1 },
		).lean();

		return new Map(
			refreshedMerchants.map((merchant) => [merchant.merchantName, merchant]),
		);
	}

	return merchantMap;
};

const ensureMerchantAccounts = async ({ rows, acquirerId, acquirerName, merchantMap }) => {
	const mids = [...new Set(rows.map((row) => row.mid))];
	const existingAccounts = await MerchantAccount.find(
		{ acquirerId, mid: { $in: mids } },
		{
			_id: 1,
			mid: 1,
			acquirerId: 1,
			merchantId: 1,
			processingCurrency: 1,
			settlementCurrency: 1,
		},
	).lean();

	const accountMap = new Map(
		existingAccounts.map((account) => [
			`${String(account.acquirerId)}:${account.mid}`,
			account,
		]),
	);

	const missingAccountDocs = [];

	for (const row of rows) {
		const accountKey = `${String(acquirerId)}:${row.mid}`;
		if (accountMap.has(accountKey)) {
			continue;
		}

		const portfolioMerchantName = resolvePortfolioMerchantName({
			merchantName: row.merchantName,
			acquirerName,
		});
		const merchant = merchantMap.get(portfolioMerchantName);

		missingAccountDocs.push({
			merchantId: merchant._id,
			mid: row.mid,
			acquirerId,
			processingCurrency: row.processingCurrency,
			settlementCurrency: row.settlementCurrency,
			paymentMethod: derivePaymentMethod(row.settlementCurrency),
			status: "active",
		});

		accountMap.set(accountKey, {
			_id: null,
			mid: row.mid,
			acquirerId,
		});
	}

	if (missingAccountDocs.length) {
		await MerchantAccount.insertMany(missingAccountDocs, { ordered: false }).catch(
			(error) => {
				if (error.code !== 11000) {
					throw error;
				}
			},
		);

		const refreshedAccounts = await MerchantAccount.find(
			{ acquirerId, mid: { $in: mids } },
			{ _id: 1, mid: 1, acquirerId: 1 },
		).lean();

		return new Map(
			refreshedAccounts.map((account) => [
				`${String(account.acquirerId)}:${account.mid}`,
				account,
			]),
		);
	}

	return accountMap;
};

const createSettlementBatch = async (context) => {
	const merchantMap = await ensureMerchants(context.rows, context.acquirer.name);
	const accountMap = await ensureMerchantAccounts({
		rows: context.rows,
		acquirerId: context.acquirer._id,
		acquirerName: context.acquirer.name,
		merchantMap,
	});

	let totalPayable = 0;

	const transactionDocs = context.rows.map((row) => {
		const portfolioMerchantName = resolvePortfolioMerchantName({
			merchantName: row.merchantName,
			acquirerName: context.acquirer.name,
		});
		const merchant = merchantMap.get(portfolioMerchantName);
		const merchantAccount = accountMap.get(
			`${String(context.acquirer._id)}:${row.mid}`,
		);
		const payable = roundMoney(row.payable);

		totalPayable += payable;

		return {
			merchantId: merchant._id,
			merchantAccountId: merchantAccount._id,
			mid: row.mid,
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
	const batch = await SettlementBatch.create({
		batchName: context.batchName,
		acquirerId: context.acquirer._id,
		startDate: context.startDate,
		endDate: context.endDate,
		totalPayable: roundedTotalPayable,
		totalPaid: 0,
		totalBalance: roundedTotalPayable,
		status: "pending",
	});

	try {
		await SettlementTransaction.insertMany(
			transactionDocs.map((transaction) => ({
				...transaction,
				batchId: batch._id,
			})),
		);
	} catch (error) {
		await SettlementBatch.deleteOne({ _id: batch._id });
		throw error;
	}

	return {
		batchId: batch._id,
		batchName: batch.batchName,
		acquirerId: context.acquirer._id,
		acquirerName: context.acquirer.name,
		startDate: context.startDate,
		endDate: context.endDate,
		totalPayable: batch.totalPayable,
		totalPaid: batch.totalPaid,
		totalBalance: batch.totalBalance,
		status: batch.status,
		rowCount: transactionDocs.length,
		fileName: context.originalName,
	};
};

const normalizeRow = (row) => ({
	merchantName: String(row["MERCHANT NAME"] || row.merchantName || "").trim(),
	mid: String(row.MID || row.mid || "").trim(),
	startDate: parseSheetDate(row["START DATE"] || row.startDate),
	endDate: parseSheetDate(row["END DATE"] || row.endDate),
	processingCurrency: String(
		row["PROCESSING CURRENCY"] || row.processingCurrency || "",
	)
		.trim()
		.toUpperCase(),
	processingAmount: parseSheetNumber(row.AMOUNT || row.processingAmount || 0),
	rate: parseSheetNumber(row.RATE || row.rate || 0),
	settlementCurrency: String(
		row["SETTLEMENT CURRENCY"] || row.settlementCurrency || "",
	)
		.trim()
		.toUpperCase(),
	payable: parseSheetNumber(row.AMOUNT || row.processingAmount || 0),
});

export const processWiresheetUploads = async ({ files, acquirerId }) => {
	const resolveAcquirer = await buildAcquirerResolver({ acquirerId });
	const preparedContexts = [];
	const failedFiles = [];

	for (const file of files) {
		try {
			const acquirer = resolveAcquirer(file.buffer);
			preparedContexts.push(
				prepareUploadContext({
					fileBuffer: file.buffer,
					originalName: file.originalName,
					acquirer,
				}),
			);
		} catch (error) {
			failedFiles.push({
				fileName: file.originalName,
				message: error.message || "Failed to process wire sheet",
				statusCode: error.statusCode || 500,
			});
		}
	}

	const batchNames = preparedContexts.map((context) => context.batchName);
	const existingBatches = batchNames.length
		? await SettlementBatch.find(
				{ batchName: { $in: batchNames } },
				{ batchName: 1 },
			).lean()
		: [];
	const existingBatchMap = new Map(
		existingBatches.map((batch) => [batch.batchName, batch]),
	);

	const processedFiles = [];
	const duplicateFiles = [];

	for (const context of preparedContexts) {
		const existingBatch = existingBatchMap.get(context.batchName);
		if (existingBatch) {
			duplicateFiles.push({
				fileName: context.originalName,
				batchId: existingBatch._id,
				batchName: existingBatch.batchName,
				acquirerName: context.acquirer.name,
				message: "Settlement batch already exists for this file range",
			});
			continue;
		}

		try {
			const batch = await createSettlementBatch(context);
			processedFiles.push(batch);
		} catch (error) {
			failedFiles.push({
				fileName: context.originalName,
				batchName: context.batchName,
				acquirerName: context.acquirer.name,
				message: error.message || "Failed to process wire sheet",
				statusCode: error.statusCode || 500,
			});
		}
	}

	return {
		totalFiles: files.length,
		processedCount: processedFiles.length,
		duplicateCount: duplicateFiles.length,
		failedCount: failedFiles.length,
		processedFiles,
		duplicateFiles,
		failedFiles,
	};
};

export const processWiresheetUpload = async ({
	fileBuffer,
	acquirerId,
	originalName = "wire-sheet.xlsx",
}) => {
	const resolveAcquirer = await buildAcquirerResolver({ acquirerId });
	const acquirer = resolveAcquirer(fileBuffer);
	const context = prepareUploadContext({
		fileBuffer,
		originalName,
		acquirer,
	});

	const existingBatch = await SettlementBatch.findOne({
		batchName: context.batchName,
	}).lean();
	if (existingBatch) {
		throw new ApiError(409, "Settlement batch already exists for this file range", {
			batchId: existingBatch._id,
			batchName: existingBatch.batchName,
		});
	}

	return createSettlementBatch(context);
};
