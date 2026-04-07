import { SettlementTransaction } from "../modules/settlements/settlement-transaction.model.js";
import { startOfDay, endOfDay } from "../utils/dateUtils.js";

export const getLedgerEntries = async (filters) => {
	const match = {};

	if (filters.mid) match.mid = filters.mid;
	if (filters.settlementCurrency)
		match.settlementCurrency = filters.settlementCurrency;
	if (filters.status) match.status = filters.status;
	if (filters.startDate || filters.endDate) {
		match.startDate = {};
		if (filters.startDate) match.startDate.$gte = startOfDay(filters.startDate);
		if (filters.endDate) match.startDate.$lte = endOfDay(filters.endDate);
	}

	const pipeline = [
		{ $match: match },
		{
			$lookup: {
				from: "merchants",
				localField: "merchantId",
				foreignField: "_id",
				as: "merchant",
			},
		},
		{ $unwind: "$merchant" },
		{
			$lookup: {
				from: "merchantaccounts",
				localField: "merchantAccountId",
				foreignField: "_id",
				as: "merchantAccount",
			},
		},
		{ $unwind: "$merchantAccount" },
		{
			$lookup: {
				from: "acquirers",
				localField: "merchantAccount.acquirerId",
				foreignField: "_id",
				as: "acquirer",
			},
		},
		{ $unwind: "$acquirer" },
		{
			$lookup: {
				from: "payments",
				localField: "_id",
				foreignField: "settlementTransactionId",
				as: "payments",
			},
		},
		{
			$project: {
				merchantName: "$merchant.merchantName",
				mid: 1,
				acquirer: "$acquirer.name",
				processingCurrency: 1,
				settlementCurrency: 1,
				payable: 1,
				paid: 1,
				balance: 1,
				paymentMethod: "$merchantAccount.paymentMethod",
				status: 1,
				startDate: 1,
				endDate: 1,
				lastPaidToMerchantDate: { $max: "$payments.paidToMerchantDate" },
				lastPaymentRate: { $arrayElemAt: ["$payments.paymentRate", -1] },
				lastPaymentBank: { $arrayElemAt: ["$payments.paymentBank", -1] },
			},
		},
	];

	const data = await SettlementTransaction.aggregate(pipeline);

	return data.filter((entry) => {
		if (
			filters.merchantName &&
			!entry.merchantName
				?.toLowerCase()
				.includes(filters.merchantName.toLowerCase())
		)
			return false;
		if (filters.acquirer && entry.acquirer !== filters.acquirer) return false;
		if (filters.paymentMethod && entry.paymentMethod !== filters.paymentMethod)
			return false;
		return true;
	});
};
