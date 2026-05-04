import xlsx from "xlsx";
import mongoose from "mongoose";

import { Acquirer } from "../models/acquirer.model.js";
import { Wiresheet } from "../models/wiresheet.model.js";
import { MerchantAccount } from "../models/merchant-account.model.js";
import { WiresheetTransaction } from "../models/wiresheet-transaction.model.js";
import { Payment } from "../models/payment.model.js";
import { UnmatchedPayment } from "../models/unmatchedPayment.model.js";

import {
	derivePaymentMethod,
	deriveSettlementStatus,
	roundMoney,
} from "../utils/currencyUtils.js";

import { parseSheetDate, startOfDay, endOfDay } from "../utils/dateUtils.js";
import {
	canonicalizeBankName,
	isSameBankName,
} from "../utils/bankNameUtils.js";

const MATCH_TIME_TOLERANCE_MS = 6 * 60 * 60 * 1000;

const parseSheetNumber = (value) => {
	if (value === null || value === undefined) return 0;

	const normalized = String(value)
		.replace(/,/g, "")
		.replace(/[^0-9.-]/g, "")
		.trim();

	if (
		!normalized ||
		normalized === "-" ||
		normalized === "." ||
		normalized === "-."
	) {
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

const normalizeMerchantName = (value) =>
	String(value || "")
		.replace(/\s+/g, " ")
		.trim()
		.toUpperCase();

const isMerchantMatch = (left, right) => {
	const a = normalizeMerchantName(left);
	const b = normalizeMerchantName(right);

	return a === b;
};

const normalizeHeader = (key) =>
	String(key || "")
		.replace(/\s+/g, " ")
		.trim()
		.toUpperCase();

const normalizeDateTime = (date) => {
	if (!date) return "";
	return new Date(date).toISOString();
};

const isSameMoment = (left, right) => {
	if (!left || !right) return false;

	return new Date(left).getTime() === new Date(right).getTime();
};

const extractPaymentDateFromFileName = (fileName = "") => {
	const nameWithoutExt = fileName.replace(/\.[^/.]+$/, "");

	const match = nameWithoutExt.match(
		/(\d{1,2})[.\-_/](\d{1,2})(?:[.\-_/](\d{2,4}))?/,
	);

	if (!match) return null;

	const [, day, month, year] = match;

	const fullYear = year
		? year.length === 2
			? 2000 + Number(year)
			: Number(year)
		: new Date().getUTCFullYear();

	const parsedDate = new Date(
		Date.UTC(fullYear, Number(month) - 1, Number(day)),
	);

	return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
};

const formatPaymentSheetDateLabel = (date) => {
	if (!date) return "";

	const parsedDate = new Date(date);

	if (Number.isNaN(parsedDate.getTime())) return "";

	return `${String(parsedDate.getUTCDate()).padStart(2, "0")}.${String(
		parsedDate.getUTCMonth() + 1,
	).padStart(2, "0")}`;
};

const getValue = (row, keys) => {
	for (const key of keys) {
		if (row[key] !== undefined && row[key] !== null && row[key] !== "") {
			return row[key];
		}
	}

	return "";
};

const parseWorkbookSheets = (buffer) => {
	const workbook = xlsx.read(buffer, {
		type: "buffer",
		cellDates: true,
	});

	return workbook.SheetNames.map((sheetName) => {
		const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], {
			defval: "",
			raw: false,
		});

		return {
			sheetName,
			rows: rows.map((row) => {
				const normalizedRow = {};

				for (const [key, value] of Object.entries(row)) {
					normalizedRow[normalizeHeader(key)] = value;
				}

				return normalizedRow;
			}),
		};
	});
};

const normalizePaymentRow = ({
	row,
	sheetName,
	paymentDate,
	paymentSheetDateLabel,
	originalFilename,
}) => {
	const lowerSheetName = sheetName.toLowerCase();

	const isCryptoSheet = lowerSheetName.includes("crypto");
	const isWireSheet = lowerSheetName.includes("wire");

	const bank = String(getValue(row, ["BANK"])).trim();

	const merchantName = String(getValue(row, ["MERCHANT NAME"])).trim();

	const mid = String(getValue(row, ["MID", "MID NO"])).trim();

	const startDate = parseSheetDate(getValue(row, ["START DATE", "FIRST DATE"]));

	const endDate = parseSheetDate(getValue(row, ["END DATE"]));

	const processingCurrency = String(
		getValue(row, ["PROCESSING CURRENCY", "CURRENCY"]),
	)
		.trim()
		.toUpperCase();

	const amountPaid = parseSheetNumber(getValue(row, ["AMOUNT", "PAID AMOUNT"]));

	const paymentRate = parseSheetNumber(getValue(row, ["RATE"]));

	const settlementCurrency = String(getValue(row, ["SETTLEMENT CURRENCY"]))
		.trim()
		.toUpperCase();

	const wireSettlementAmount = parseSheetNumber(
		getValue(row, ["AMOUNT IN EURO", "AMOUNT IN EUR"]),
	);

	const cryptoSettlementAmount = parseSheetNumber(getValue(row, ["USDT"]));

	const settlementAmount = isCryptoSheet
		? cryptoSettlementAmount
		: isWireSheet
			? wireSettlementAmount
			: wireSettlementAmount || cryptoSettlementAmount;

	const reference = String(
		getValue(row, [
			"HASH PAYMENT / WIRE REFERENCE",
			"HASH PAYMENT",
			"WIRE REFERENCE",
			"REFERENCE",
			"REFERENCE NO",
		]),
	).trim();

	const paymentMethod = settlementCurrency
		? derivePaymentMethod(settlementCurrency)
		: isCryptoSheet
			? "CRYPTO"
			: isWireSheet
				? "WIRE"
				: "UNKNOWN";

	return {
		bank,
		merchantName,
		mid,
		startDate,
		endDate,
		processingCurrency,
		amountPaid,
		paymentRate,
		settlementCurrency,
		settlementAmount,
		paymentMethod,
		paymentDate,
		paidToMerchantDate: paymentDate,
		paymentSheetDateLabel,
		hashPayment: paymentMethod === "CRYPTO" ? reference : "",
		referenceNo: paymentMethod === "WIRE" ? reference : "",
		reference,
		sheetName,
		originalFilename,
	};
};

const normalizePaymentUploadRows = ({
	fileBuffer,
	paymentDate,
	originalFilename,
}) => {
	const sheets = parseWorkbookSheets(fileBuffer);

	return sheets.flatMap(({ sheetName, rows }) => {
		const finalPaymentDate =
			paymentDate ||
			extractPaymentDateFromFileName(originalFilename) ||
			new Date();

		const paymentSheetDateLabel = formatPaymentSheetDateLabel(finalPaymentDate);

		return rows
			.map((row) =>
				normalizePaymentRow({
					row,
					sheetName,
					paymentDate: parseSheetDate(finalPaymentDate),
					paymentSheetDateLabel,
					originalFilename,
				}),
			)
			.filter(
				(row) =>
					row.bank &&
					row.merchantName &&
					row.mid &&
					row.startDate &&
					row.endDate &&
					row.processingCurrency &&
					row.amountPaid !== 0,
			);
	});
};

const buildPaymentIdentityKey = ({
	wiresheetTransactionId,
	paymentBank,
	paidToMerchantDate,
	sourceStartDate,
	sourceEndDate,
	sourceProcessingCurrency,
	paymentCurrency,
}) =>
	[
		wiresheetTransactionId,
		canonicalizeBankName(paymentBank),
		normalizeDateTime(paidToMerchantDate),
		normalizeDateTime(sourceStartDate),
		normalizeDateTime(sourceEndDate),
		String(sourceProcessingCurrency || "")
			.trim()
			.toUpperCase(),
		String(paymentCurrency || "")
			.trim()
			.toUpperCase(),
	].join("|");

const buildUnmatchedPaymentIdentityKey = ({
	paymentBank,
	merchantName,
	paidToMerchantDate,
	sourceMid,
	sourceStartDate,
	sourceEndDate,
	sourceProcessingCurrency,
	paymentCurrency,
	amountPaid,
	settlementAmount,
}) =>
	[
		canonicalizeBankName(paymentBank),
		normalizeMerchantName(merchantName),
		String(sourceMid || "").trim(),
		normalizeDateTime(paidToMerchantDate),
		normalizeDateTime(sourceStartDate),
		normalizeDateTime(sourceEndDate),
		String(sourceProcessingCurrency || "")
			.trim()
			.toUpperCase(),
		String(paymentCurrency || "")
			.trim()
			.toUpperCase(),
		roundMoney(amountPaid),
		roundMoney(settlementAmount),
	].join("|");

const getRowIdentityKey = (row) =>
	row.rowIdentityKey ||
	buildUnmatchedPaymentIdentityKey({
		paymentBank: row.bank,
		merchantName: row.merchantName,
		paidToMerchantDate: row.paymentDate,
		sourceMid: row.mid,
		sourceStartDate: row.startDate,
		sourceEndDate: row.endDate,
		sourceProcessingCurrency: row.processingCurrency,
		paymentCurrency: row.settlementCurrency,
		amountPaid: row.amountPaid,
		settlementAmount: row.settlementAmount,
	});

const buildBankAcquirerMap = async (rows) => {
	const banks = [
		...new Set(
			rows.map((row) => canonicalizeBankName(row.bank)).filter(Boolean),
		),
	];

	const acquirers = await Acquirer.find({}, { _id: 1, name: 1 }).lean();

	const bankAcquirerMap = new Map();

	for (const bank of banks) {
		const matchedAcquirerIds = acquirers
			.filter((acquirer) => isSameBankName(acquirer.name, bank))
			.map((acquirer) => acquirer._id.toString());

		bankAcquirerMap.set(bank, matchedAcquirerIds);
	}

	return bankAcquirerMap;
};

const buildMerchantAccountLookup = async ({ rows, bankAcquirerMap }) => {
	const mids = [...new Set(rows.map((row) => row.mid).filter(Boolean))];

	const acquirerIds = [...new Set([...bankAcquirerMap.values()].flat())];

	if (!mids.length || !acquirerIds.length) {
		return {
			accountIdsByRowKey: new Map(),
			allAccountIds: [],
		};
	}

	const merchantAccounts = await MerchantAccount.find(
		{
			mid: { $in: mids },
			acquirerId: { $in: acquirerIds },
		},
		{
			_id: 1,
			mid: 1,
			acquirerId: 1,
		},
	).lean();

	const accountsByMidAcquirer = new Map(
		merchantAccounts.map((account) => [
			`${account.mid}:${account.acquirerId.toString()}`,
			account._id.toString(),
		]),
	);

	const accountIdsByRowKey = new Map();

	for (const row of rows) {
		const bankKey = canonicalizeBankName(row.bank);
		const acquirerIdsForBank = bankAcquirerMap.get(bankKey) || [];

		accountIdsByRowKey.set(
			`${bankKey}:${row.mid}`,
			acquirerIdsForBank
				.map((acquirerId) =>
					accountsByMidAcquirer.get(`${row.mid}:${acquirerId}`),
				)
				.filter(Boolean),
		);
	}

	return {
		accountIdsByRowKey,
		allAccountIds: [
			...new Set(merchantAccounts.map((account) => account._id.toString())),
		],
	};
};

const buildTransactionIndex = async ({ rows, allAccountIds }) => {
	if (!allAccountIds.length) return new Map();

	const mids = [...new Set(rows.map((row) => row.mid).filter(Boolean))];

	const parsedStartDates = rows.map((row) => row.startDate).filter(Boolean);
	const parsedEndDates = rows.map((row) => row.endDate).filter(Boolean);

	const query = {
		merchantMappingId: {
			$in: allAccountIds.map((id) => new mongoose.Types.ObjectId(id)),
		},
		mid: { $in: mids },
	};

	if (parsedStartDates.length && parsedEndDates.length) {
		const minStartDate = new Date(
			Math.min(...parsedStartDates.map((date) => date.getTime())),
		);

		const maxEndDate = new Date(
			Math.max(...parsedEndDates.map((date) => date.getTime())),
		);

		query.startDate = { $lte: endOfDay(maxEndDate) };
		query.endDate = { $gte: startOfDay(minStartDate) };
	}

	const transactions = await WiresheetTransaction.find(query).lean();

	const transactionsByMid = new Map();

	for (const transaction of transactions) {
		const key = transaction.mid;

		if (!transactionsByMid.has(key)) {
			transactionsByMid.set(key, []);
		}

		transactionsByMid.get(key).push({
			...transaction,
			_id: transaction._id.toString(),
			merchantMappingId: transaction.merchantMappingId.toString(),
			wiresheetId: transaction.wiresheetId.toString(),
		});
	}

	return transactionsByMid;
};

const scoreTransactionMatch = (transaction, row) => {
	let score = 0;

	if (transaction.processingCurrency === row.processingCurrency) {
		score += 100;
	}

	if (isMerchantMatch(transaction.merchantName, row.merchantName)) {
		score += 75;
	} else {
		return -1000;
	}

	console.log({
		dbMerchant: transaction.merchantName,
		rowMerchant: row.merchantName,
	});

	const amountDiff = Math.abs(
		roundMoney(transaction.processingAmount) - roundMoney(row.amountPaid),
	);

	if (amountDiff === 0) {
		score += 50;
	} else {
		score -= Math.min(50, Math.floor(amountDiff));
	}

	const startDiff = Math.abs(
		new Date(transaction.startDate).getTime() - row.startDate.getTime(),
	);

	const endDiff = Math.abs(
		new Date(transaction.endDate).getTime() - row.endDate.getTime(),
	);

	score -= Math.floor(startDiff / (1000 * 60 * 60));
	score -= Math.floor(endDiff / (1000 * 60 * 60));

	return score;
};

const findMatchingWiresheetTransaction = ({
	row,
	candidateTransactions,
	candidateAccountIds,
}) => {
	if (!candidateTransactions?.length || !candidateAccountIds?.length) {
		return null;
	}

	const matches = candidateTransactions.filter((transaction) => {
		if (!candidateAccountIds.includes(transaction.merchantMappingId)) {
			return false;
		}

		// if (transaction.mid !== row.mid) {
		// 	return false;
		// }

		// if (!isMerchantMatch(transaction.merchantName, row.merchantName)) {
		// 	return false;
		// }

		// if (transaction.processingCurrency !== row.processingCurrency) {
		// 	return false;
		// }

		// if (row.startDate && !isSameMoment(transaction.startDate, row.startDate)) {
		// 	return false;
		// }

		// if (row.endDate && !isSameMoment(transaction.endDate, row.endDate)) {
		// 	return false;
		// }

		if (transaction.mid !== row.mid) return false;
		if (
			normalizeMerchantName(transaction.merchantName) !==
			normalizeMerchantName(row.merchantName)
		)
			return false;
		if (transaction.processingCurrency !== row.processingCurrency) return false;
		if (
			new Date(transaction.startDate).getTime() !==
			new Date(row.startDate).getTime()
		)
			return false;
		if (
			new Date(transaction.endDate).getTime() !==
			new Date(row.endDate).getTime()
		)
			return false;

		return true;
	});

	if (!matches.length) return null;

	matches.sort(
		(left, right) =>
			scoreTransactionMatch(right, row) - scoreTransactionMatch(left, row),
	);

	return matches[0];
};

const matchRowsToTransactions = async ({ rows }) => {
	const bankAcquirerMap = await buildBankAcquirerMap(rows);

	const { accountIdsByRowKey, allAccountIds } =
		await buildMerchantAccountLookup({
			rows,
			bankAcquirerMap,
		});

	const transactionsByMid = await buildTransactionIndex({
		rows,
		allAccountIds,
	});

	const matchedRows = [];
	const skippedRows = [];

	for (const row of rows) {
		const rowBankKey = canonicalizeBankName(row.bank);

		const candidateAccountIds =
			accountIdsByRowKey.get(`${rowBankKey}:${row.mid}`) || [];

		const transaction = findMatchingWiresheetTransaction({
			row,
			candidateTransactions: transactionsByMid.get(row.mid) || [],
			candidateAccountIds,
		});

		if (!transaction) {
			skippedRows.push({
				row,
				reason: "wiresheet_transaction_not_found",
			});
			continue;
		}

		matchedRows.push({
			row,
			transaction,
		});
	}

	return {
		matchedRows,
		skippedRows,
	};
};

const updateWiresheetTotals = async (transactionUpdates) => {
	const wiresheetIds = [
		...new Set(transactionUpdates.map((item) => item.wiresheetId)),
	];

	if (!wiresheetIds.length) return 0;

	const totals = await WiresheetTransaction.aggregate([
		{
			$match: {
				wiresheetId: {
					$in: wiresheetIds.map((id) => new mongoose.Types.ObjectId(id)),
				},
			},
		},
		{
			$group: {
				_id: "$wiresheetId",
				totalPayable: { $sum: "$payable" },
				totalPaid: { $sum: "$paid" },
				totalBalance: { $sum: "$balance" },
			},
		},
	]);

	if (totals.length) {
		await Wiresheet.bulkWrite(
			totals.map((item) => {
				const totalPayable = roundMoney(item.totalPayable);
				const totalPaid = roundMoney(item.totalPaid);
				const totalBalance = roundMoney(item.totalBalance);

				return {
					updateOne: {
						filter: { _id: item._id },
						update: {
							$set: {
								totalPayable,
								totalPaid,
								totalBalance,
								status:
									totalPaid <= 0
										? "pending"
										: totalBalance > 0
											? "partially_paid"
											: "settled",
							},
						},
					},
				};
			}),
		);
	}

	return wiresheetIds.length;
};

const persistMatchedRows = async ({ matchedRows, userId }) => {
	if (!matchedRows.length) {
		return {
			createdPayments: 0,
			updatedWiresheets: 0,
			reconciledCount: 0,
		};
	}

	const transactionIds = [
		...new Set(matchedRows.map(({ transaction }) => transaction._id)),
	];

	const existingPayments = await Payment.find({
		wiresheetTransactionId: {
			$in: transactionIds.map((id) => new mongoose.Types.ObjectId(id)),
		},
	}).lean();

	const existingPaymentMap = new Map();

	for (const payment of existingPayments) {
		existingPaymentMap.set(
			buildPaymentIdentityKey({
				wiresheetTransactionId: payment.wiresheetTransactionId.toString(),
				paymentBank: payment.paymentBank,
				paidToMerchantDate: payment.paidToMerchantDate,
				sourceStartDate: payment.sourceStartDate,
				sourceEndDate: payment.sourceEndDate,
				sourceProcessingCurrency: payment.sourceProcessingCurrency,
				paymentCurrency: payment.paymentCurrency,
			}),
			{
				...payment,
				_id: payment._id.toString(),
				wiresheetTransactionId: payment.wiresheetTransactionId.toString(),
			},
		);
	}

	const paymentDocs = [];
	const paymentUpdates = [];
	const transactionStateMap = new Map();
	const unmatchedUpdates = [];
	const now = new Date();

	for (const { row, transaction } of matchedRows) {
		const paymentDateValue = row.paymentDate || new Date();

		const normalizedAmountPaid = roundMoney(row.amountPaid);
		const normalizedSettlementAmount = roundMoney(row.settlementAmount);

		const paymentDoc = {
			wiresheetTransactionId: transaction._id,
			merchantMappingId: transaction.merchantMappingId,

			amountPaid: normalizedAmountPaid,
			settlementAmount: normalizedSettlementAmount,

			paymentCurrency: row.settlementCurrency,
			settlementCurrency: row.settlementCurrency,

			paymentMethod: row.paymentMethod,
			paymentDate: paymentDateValue,
			paidToMerchantDate: paymentDateValue,
			paymentRate: row.paymentRate,

			paymentBank: row.bank,
			merchantName: row.merchantName,

			sourceMid: row.mid,
			sourceStartDate: row.startDate,
			sourceEndDate: row.endDate,
			sourceProcessingCurrency: row.processingCurrency,
			sourceSheetName: row.sheetName,
			sourceOriginalFilename: row.originalFilename,
			paymentSheetDateLabel: row.paymentSheetDateLabel,

			hashPayment: row.hashPayment,
			referenceNo: row.referenceNo,

			createdBy: userId,
		};

		const paymentIdentityKey = buildPaymentIdentityKey({
			wiresheetTransactionId: transaction._id,
			paymentBank: row.bank,
			paidToMerchantDate: paymentDateValue,
			sourceStartDate: row.startDate,
			sourceEndDate: row.endDate,
			sourceProcessingCurrency: row.processingCurrency,
			paymentCurrency: row.settlementCurrency,
		});

		const existingPayment = existingPaymentMap.get(paymentIdentityKey);

		const previousAmount = existingPayment
			? roundMoney(existingPayment.amountPaid)
			: 0;

		const paymentDelta = roundMoney(normalizedAmountPaid - previousAmount);

		const transactionId = transaction._id;

		const transactionState = transactionStateMap.get(transactionId) || {
			_id: transactionId,
			wiresheetId: transaction.wiresheetId,
			payable: roundMoney(transaction.payable),
			paid: roundMoney(transaction.paid || 0),
			balance: roundMoney(transaction.balance || transaction.payable),
		};

		transactionState.paid = roundMoney(transactionState.paid + paymentDelta);

		transactionState.balance = roundMoney(
			transactionState.payable - transactionState.paid,
		);

		transactionState.status = deriveSettlementStatus({
			payable: transactionState.payable,
			paid: transactionState.paid,
		});

		transactionStateMap.set(transactionId, transactionState);

		if (existingPayment) {
			paymentUpdates.push({
				updateOne: {
					filter: { _id: existingPayment._id },
					update: { $set: paymentDoc },
				},
			});
		} else {
			paymentDocs.push(paymentDoc);
		}

		unmatchedUpdates.push({
			updateOne: {
				filter: row.unmatchedPaymentId
					? { _id: row.unmatchedPaymentId }
					: { rowIdentityKey: getRowIdentityKey(row) },
				update: {
					$set: {
						status: "reconciled",
						failureReason: "",
						wiresheetTransactionId: transaction._id,
						merchantMappingId: transaction.merchantMappingId,
						reconciledAt: now,
						lastReconciledAt: now,
						reconciledBy: userId,
					},
					...(row.unmatchedPaymentId ? { $inc: { retryCount: 1 } } : {}),
				},
			},
		});
	}

	if (paymentDocs.length) {
		await Payment.insertMany(paymentDocs);
	}

	if (paymentUpdates.length) {
		await Payment.bulkWrite(paymentUpdates);
	}

	const transactionUpdates = [...transactionStateMap.values()];

	if (transactionUpdates.length) {
		await WiresheetTransaction.bulkWrite(
			transactionUpdates.map((transaction) => ({
				updateOne: {
					filter: { _id: transaction._id },
					update: {
						$set: {
							paid: transaction.paid,
							balance: transaction.balance,
							status: transaction.status,
						},
					},
				},
			})),
		);
	}

	if (unmatchedUpdates.length) {
		await UnmatchedPayment.bulkWrite(unmatchedUpdates);
	}

	const updatedWiresheets = await updateWiresheetTotals(transactionUpdates);

	return {
		createdPayments: paymentDocs.length + paymentUpdates.length,
		updatedWiresheets,
		reconciledCount: matchedRows.length,
	};
};

const storeUnmatchedRows = async ({
	skippedRows,
	userId,
	originalFilename,
}) => {
	if (!skippedRows.length) {
		return {
			storedCount: 0,
			pendingCount: await UnmatchedPayment.countDocuments({
				status: "pending_reconciliation",
			}),
		};
	}

	const operations = skippedRows.map(({ row, reason }) => ({
		updateOne: {
			filter: { rowIdentityKey: getRowIdentityKey(row) },
			update: {
				$set: {
					status: "pending_reconciliation",
					failureReason: reason,

					paymentBank: row.bank,
					merchantName: row.merchantName,
					sourceMid: row.mid,
					sourceStartDate: row.startDate,
					sourceEndDate: row.endDate,
					sourceProcessingCurrency: row.processingCurrency,

					amountPaid: roundMoney(row.amountPaid),
					settlementAmount: roundMoney(row.settlementAmount),

					paymentCurrency: row.settlementCurrency,
					settlementCurrency: row.settlementCurrency,
					paymentMethod: row.paymentMethod,

					paymentDate: row.paymentDate,
					paidToMerchantDate: row.paidToMerchantDate,
					paymentRate: roundMoney(row.paymentRate),

					paymentSheetDateLabel: row.paymentSheetDateLabel,
					hashPayment: row.hashPayment,
					referenceNo: row.referenceNo,

					sheetName: row.sheetName,
					originalFilename,
					wiresheetTransactionId: null,
					merchantMappingId: null,
					reconciledAt: null,
					reconciledBy: null,
				},
				$setOnInsert: {
					createdBy: userId,
				},
			},
			upsert: true,
		},
	}));

	await UnmatchedPayment.bulkWrite(operations);

	return {
		storedCount: skippedRows.length,
		pendingCount: await UnmatchedPayment.countDocuments({
			status: "pending_reconciliation",
		}),
	};
};

const toSkippedRowPayload = ({ row, reason }) => ({
	reason,
	sheetName: row.sheetName,
	bank: row.bank,
	merchantName: row.merchantName,
	mid: row.mid,
	processingCurrency: row.processingCurrency,
	settlementCurrency: row.settlementCurrency,
	startDate: row.startDate,
	endDate: row.endDate,
	amountPaid: roundMoney(row.amountPaid),
	settlementAmount: roundMoney(row.settlementAmount),
});

const buildUnmatchedSummary = async () => {
	const [pendingCount, recentRows] = await Promise.all([
		UnmatchedPayment.countDocuments({ status: "pending_reconciliation" }),
		UnmatchedPayment.find({ status: "pending_reconciliation" })
			.sort({ createdAt: -1 })
			.limit(10)
			.lean(),
	]);

	return {
		pendingCount,
		recentRows,
	};
};

export const uploadPayments = async (req, res) => {
	const files = [...(req.files?.file || []), ...(req.files?.files || [])];

	if (!files.length) {
		return res.status(400).json({
			success: false,
			message: "At least one payment file is required",
		});
	}

	const results = [];

	for (const file of files) {
		try {
			const rows = normalizePaymentUploadRows({
				fileBuffer: file.buffer,
				paymentDate: req.body?.paymentDate,
				originalFilename: file.originalname,
			});

			if (!rows.length) {
				results.push({
					fileName: file.originalname,
					success: false,
					message: "No valid payment rows found",
				});
				continue;
			}

			const { matchedRows, skippedRows } = await matchRowsToTransactions({
				rows,
			});

			const matchedResult = await persistMatchedRows({
				matchedRows,
				userId: req.user._id,
			});

			const unmatchedResult = await storeUnmatchedRows({
				skippedRows,
				userId: req.user._id,
				originalFilename: file.originalname,
			});

			results.push({
				fileName: file.originalname,
				success: true,
				totalRows: rows.length,
				matchedCount: matchedRows.length,
				unmatchedCount: skippedRows.length,
				createdPayments: matchedResult.createdPayments,
				updatedWiresheets: matchedResult.updatedWiresheets,
				storedUnmatchedCount: unmatchedResult.storedCount,
				pendingUnmatchedCount: unmatchedResult.pendingCount,
				skippedRows: skippedRows.map(toSkippedRowPayload),
			});
		} catch (error) {
			results.push({
				fileName: file.originalname,
				success: false,
				message: error.message || "Payment file processing failed",
			});
		}
	}

	const failedCount = results.filter((item) => !item.success).length;
	const processedCount = results.filter((item) => item.success).length;

	return res.status(failedCount > 0 ? 207 : 201).json({
		success: true,
		message:
			failedCount > 0
				? "Payment files processed with some issues"
				: "Payment files processed successfully",
		data: {
			totalFiles: files.length,
			processedCount,
			failedCount,
			results,
		},
	});
};

export const listPayments = async (_req, res) => {
	const data = await Payment.find()
		.populate("wiresheetTransactionId")
		.populate("merchantMappingId")
		.sort({ createdAt: -1 })
		.lean();

	return res.json({
		success: true,
		data,
	});
};

export const listUnmatchedPayments = async (_req, res) => {
	const data = await UnmatchedPayment.find().sort({ createdAt: -1 }).lean();

	return res.json({
		success: true,
		data,
	});
};

export const getUnmatchedPaymentsSummary = async (_req, res) => {
	const summary = await buildUnmatchedSummary();

	return res.json({
		success: true,
		data: summary,
	});
};

export const reconcilePendingPayments = async (req, res) => {
	const pendingRows = await UnmatchedPayment.find({
		status: "pending_reconciliation",
	})
		.sort({ createdAt: 1, _id: 1 })
		.lean();

	if (!pendingRows.length) {
		return res.json({
			success: true,
			message: "No pending unmatched payments found",
			data: {
				processedCount: 0,
				reconciledCount: 0,
				remainingCount: 0,
				updatedWiresheets: 0,
				summary: await buildUnmatchedSummary(),
			},
		});
	}

	const rows = pendingRows.map((row) => ({
		unmatchedPaymentId: row._id,
		rowIdentityKey: row.rowIdentityKey,
		bank: row.paymentBank,
		merchantName: row.merchantName,
		mid: row.sourceMid,
		startDate: row.sourceStartDate,
		endDate: row.sourceEndDate,
		processingCurrency: row.sourceProcessingCurrency,
		amountPaid: row.amountPaid,
		paymentRate: row.paymentRate,
		settlementCurrency: row.settlementCurrency || row.paymentCurrency,
		settlementAmount: row.settlementAmount,
		paymentMethod: row.paymentMethod,
		paymentDate: row.paymentDate || row.paidToMerchantDate,
		paidToMerchantDate: row.paidToMerchantDate || row.paymentDate,
		paymentSheetDateLabel: row.paymentSheetDateLabel,
		hashPayment: row.hashPayment,
		referenceNo: row.referenceNo,
		sheetName: row.sheetName,
		originalFilename: row.originalFilename,
	}));

	const { matchedRows, skippedRows } = await matchRowsToTransactions({
		rows,
	});

	const matchedResult = await persistMatchedRows({
		matchedRows,
		userId: req.user._id,
	});

	const now = new Date();

	const stillPendingUpdates = skippedRows
		.filter(({ row }) => row.unmatchedPaymentId)
		.map(({ row, reason }) => ({
			updateOne: {
				filter: { _id: row.unmatchedPaymentId },
				update: {
					$set: {
						status: "pending_reconciliation",
						failureReason: reason,
						lastReconciledAt: now,
					},
					$inc: { retryCount: 1 },
				},
			},
		}));

	if (stillPendingUpdates.length) {
		await UnmatchedPayment.bulkWrite(stillPendingUpdates);
	}

	const summary = await buildUnmatchedSummary();

	return res.json({
		success: true,
		message: "Pending payments reconciled successfully",
		data: {
			processedCount: pendingRows.length,
			reconciledCount: matchedResult.reconciledCount,
			remainingCount: summary.pendingCount,
			updatedWiresheets: matchedResult.updatedWiresheets,
			skippedCount: skippedRows.length,
			skippedRows: skippedRows.map(toSkippedRowPayload),
			summary,
		},
	});
};
