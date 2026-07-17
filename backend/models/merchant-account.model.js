import mongoose from "mongoose";
import { derivePaymentMethod } from "../utils/currencyUtils.js";

const merchantAccountSchema = new mongoose.Schema(
	{
		merchantId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Merchant",
			required: true,
		},

		mid: {
			type: String,
			required: true,
			trim: true,
		},

		memberId: {
			type: String,
			trim: true,
			index: true,
		},

		acquirerId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Acquirer",
			required: true,
		},

		processingCurrency: {
			type: String,
			required: true,
			trim: true,
			uppercase: true,
		},

		settlementCurrency: {
			type: String,
			required: true,
			trim: true,
			uppercase: true,
		},

		paymentMethod: {
			type: String,
			enum: ["CRYPTO", "WIRE", "UNKNOWN"],
			default: "UNKNOWN",
		},

		status: {
			type: String,
			enum: ["active", "inactive"],
			default: "active",
		},
	},
	{ timestamps: true },
);

merchantAccountSchema.index({ mid: 1, acquirerId: 1 }, { unique: true });
merchantAccountSchema.index({ memberId: 1, status: 1 });

merchantAccountSchema.pre("validate", function (next) {
	if (!this.memberId && this.mid) {
		this.memberId = this.mid;
	}

	this.paymentMethod = derivePaymentMethod(this.settlementCurrency);
	next();
});

export const MerchantAccount = mongoose.model(
	"MerchantAccount",
	merchantAccountSchema,
);
