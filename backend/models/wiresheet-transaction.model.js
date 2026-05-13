import mongoose from "mongoose";

const wiresheetTransactionSchema = new mongoose.Schema(
	{
		wiresheetId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Wiresheet",
			required: true,
		},
		merchantId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Merchant",
			required: true,
		},
		merchantMappingId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "MerchantAccount",
			required: true,
		},
		merchantName: {
			type: String,
			required: true,
			trim: true,
		},
		merchantTag: {
			type: String,
			trim: true,
		},
		mid: {
			type: String,
			required: true,
			trim: true,
		},
		startDate: {
			type: Date,
			required: true,
		},
		endDate: {
			type: Date,
			required: true,
		},
		processingCurrency: {
			type: String,
			required: true,
			trim: true,
			uppercase: true,
		},
		processingAmount: {
			type: Number,
			required: true,
		},
		rate: {
			type: Number,
			default: 0,
		},
		settlementCurrency: {
			type: String,
			required: true,
			trim: true,
			uppercase: true,
		},
		payable: {
			type: Number,
			required: true,
		},
		paid: {
			type: Number,
			default: 0,
		},
		balance: {
			type: Number,
			required: true,
		},
		status: {
			type: String,
			enum: ["pending", "partially_paid", "settled"],
			default: "pending",
		},
	},
	{ timestamps: true },
);

wiresheetTransactionSchema.index({
	mid: 1,
	settlementCurrency: 1,
	startDate: 1,
	endDate: 1,
});

export const WiresheetTransaction = mongoose.model(
	"WiresheetTransaction",
	wiresheetTransactionSchema,
);
