import mongoose from "mongoose";

const merchantTransactionSchema = new mongoose.Schema(
	{
		uploadId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "MerchantTransactionUpload",
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

		authAmount: { type: Number, default: 0 },
		capturedAmount: { type: Number, default: 0 },

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
			enum: ["account_exact", "merchant_fallback", "unmatched"],
			default: "unmatched",
			index: true,
		},
	},
	{ timestamps: true },
);

merchantTransactionSchema.index({
	memberId: 1,
	bankAccountId: 1,
	currency: 1,
	paymentBrand: 1,
});

export const MerchantTransaction = mongoose.model(
	"MerchantTransaction",
	merchantTransactionSchema,
);
