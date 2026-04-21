import mongoose from "mongoose";
import { derivePaymentMethod } from "../../utils/currencyUtils.js";

const merchantAccountSchema = new mongoose.Schema(
	{
		merchantId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Merchant",
			required: true,
		},
		mid: { type: String, required: true, trim: true },
		acquirerId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Acquirer",
			required: true,
		},
		processingCurrency: { type: String, required: true, uppercase: true },
		settlementCurrency: { type: String, required: true, uppercase: true },
		paymentMethod: {
			type: String,
			enum: ["CRYPTO", "WIRE", "UNKNOWN"],
			required: true,
		},
		status: { type: String, enum: ["active", "inactive"], default: "active" },
	},
	{ timestamps: true },
);

merchantAccountSchema.index({ mid: 1, acquirerId: 1 }, { unique: true });

merchantAccountSchema.pre("validate", function populatePaymentMethod(next) {
	this.paymentMethod = derivePaymentMethod(this.settlementCurrency);
	next();
});

export const MerchantAccount = mongoose.model(
	"MerchantAccount",
	merchantAccountSchema,
);
