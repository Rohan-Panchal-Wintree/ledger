import mongoose from "mongoose";

const merchantTransactionSchema = new mongoose.Schema(
	{
		settlementBatchId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "MerchantSettlementBatch",
			required: true,
			index: true,
		},

		uploadId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "MerchantTransactionUpload",
			required: true,
			index: true,
		},

		reportId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "MerchantSettlementReport",
			default: null,
			index: true,
		},

		sourceFileType: {
			type: String,
			enum: ["datestamp", "timestamp"],
			required: true,
			index: true,
		},

		transactionDate: Date,

		memberId: { type: String, trim: true, index: true },
		merchantCompanyName: { type: String, trim: true, index: true },
		partnerName: { type: String, trim: true },

		trackingId: { type: String, trim: true },
		paymentId: { type: String, trim: true },
		orderId: { type: String, trim: true },

		bankAccountId: { type: String, trim: true, index: true },

		paymentBrand: { type: String, trim: true, uppercase: true, index: true },
		transactionMode: { type: String, trim: true },
		currency: { type: String, trim: true, uppercase: true, index: true },

		isoCountry: {
			type: String,
			trim: true,
			uppercase: true,
			index: true,
		},

		countryName: {
			type: String,
			trim: true,
			uppercase: true,
		},

		countryCode: {
			type: String,
			trim: true,
			uppercase: true,
			index: true,
		},

		countryCategory: {
			type: String,
			enum: ["EU", "NONEU", "ALL"],
			default: "ALL",
			index: true,
		},

		authAmount: { type: Number, default: 0 },
		capturedAmountFromFile: { type: Number, default: 0 },
		refundAmount: { type: Number, default: 0 },
		chargebackAmount: { type: Number, default: 0 },

		capturedAmount: { type: Number, default: 0 },
		reversalAmount: { type: Number, default: 0 },
		chargebackAmountValue: { type: Number, default: 0 },

		status: { type: String, trim: true, index: true },
		reason: { type: String, trim: true },

		feeConfigId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "MerchantFeeConfig",
			default: null,
		},

		mdrFee: { type: Number, default: 0 },
		approvalFee: { type: Number, default: 0 },
		declineFee: { type: Number, default: 0 },
		reversalFee: { type: Number, default: 0 },
		chargebackFee: { type: Number, default: 0 },
		rollingReserveAmount: { type: Number, default: 0 },
		settlementExpense: { type: Number, default: 0 },

		totalFees: { type: Number, default: 0 },
		netSettlement: { type: Number, default: 0 },

		matchStatus: {
			type: String,
			enum: ["matched", "unmatched_fee"],
			default: "unmatched_fee",
			index: true,
		},

		matchType: {
			type: String,
			enum: ["country_exact", "category_exact", "all_fallback", "unmatched"],
			default: "unmatched",
			index: true,
		},
	},
	{ timestamps: true },
);

merchantTransactionSchema.index({
	settlementBatchId: 1,
	memberId: 1,
	currency: 1,
	paymentBrand: 1,
	countryCode: 1,
	countryCategory: 1,
	status: 1,
});

merchantTransactionSchema.index({
	reportId: 1,
	memberId: 1,
	status: 1,
});

export const MerchantTransaction = mongoose.model(
	"MerchantTransaction",
	merchantTransactionSchema,
);
