import mongoose from "mongoose";

const unmatchedPaymentSchema = new mongoose.Schema(
	{
		rowIdentityKey: {
			type: String,
			required: true,
			unique: true,
			index: true,
		},

		status: {
			type: String,
			enum: ["invalid", "unmatched", "reconciled"],
			default: "unmatched",
			index: true,
		},

		failureReason: { type: String, trim: true },

		paymentBank: { type: String, trim: true },
		merchantName: { type: String, trim: true },
		sourceMid: { type: String, trim: true },

		sourceStartDate: Date,
		sourceEndDate: Date,
		sourceProcessingCurrency: { type: String, trim: true, uppercase: true },

		amountPaid: { type: Number, default: 0 },
		paymentRate: { type: Number, default: 0 },
		settlementCurrency: { type: String, trim: true, uppercase: true },
		settlementAmount: { type: Number, default: 0 },

		paymentMethod: {
			type: String,
			enum: ["CRYPTO", "WIRE", "UNKNOWN"],
			default: "UNKNOWN",
		},

		paymentDate: Date,
		paidToMerchantDate: Date,

		hashPayment: { type: String, trim: true },
		referenceNo: { type: String, trim: true },

		sheetName: { type: String, trim: true },
		originalFilename: { type: String, trim: true },

		wiresheetTransactionId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "WiresheetTransaction",
		},

		merchantMappingId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "MerchantAccount",
		},

		createdBy: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
		},

		reconciledBy: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
		},

		reconciledAt: Date,
		rawRow: {
			type: Object,
			default: null,
		},

		normalizedRow: {
			type: Object,
			default: null,
		},

		missingFields: {
			type: [String],
			default: [],
		},

		retryCount: {
			type: Number,
			default: 0,
		},

		lastReconciledAt: Date,
	},
	{ timestamps: true },
);

unmatchedPaymentSchema.index({
	status: 1,
	createdAt: -1,
});

export const UnmatchedPayment = mongoose.model(
	"UnmatchedPayment",
	unmatchedPaymentSchema,
);
