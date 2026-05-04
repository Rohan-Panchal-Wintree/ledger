import mongoose from "mongoose";
import { derivePaymentMethod } from "../utils/currencyUtils.js";

const miscellaneousPaymentSchema = new mongoose.Schema(
	{
		entryType: {
			type: String,
			enum: [
				"repayment",
				"bank_rr",
				"rr",
				"agent",
				"overcapped_rr_refund",
				"chb_refund",
				"adjustment",
				"other",
			],
			required: true,
		},

		paymentSheetDate: {
			type: Date,
			required: true,
		},

		paymentSheetDateLabel: {
			type: String,
			required: true,
			trim: true,
		},

		bankLabel: {
			type: String,
			required: true,
			trim: true,
		},

		merchantId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Merchant",
			required: true,
		},

		merchantName: {
			type: String,
			required: true,
			trim: true,
		},

		merchantMappingId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "MerchantAccount",
			default: null,
		},

		mid: {
			type: String,
			trim: true,
		},

		startDate: Date,
		endDate: Date,

		processingCurrency: {
			type: String,
			trim: true,
			uppercase: true,
		},

		amountPaid: {
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

		settlementAmount: {
			type: Number,
			default: 0,
		},

		paymentMethod: {
			type: String,
			enum: ["CRYPTO", "WIRE", "UNKNOWN"],
			default: "UNKNOWN",
		},

		notes: {
			type: String,
			trim: true,
		},

		createdBy: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
		},
	},
	{ timestamps: true },
);

miscellaneousPaymentSchema.index({
	paymentSheetDate: 1,
	merchantId: 1,
	merchantMappingId: 1,
	entryType: 1,
});

miscellaneousPaymentSchema.pre("validate", function (next) {
	this.paymentMethod = derivePaymentMethod(this.settlementCurrency);
	next();
});

export const MiscellaneousPayment = mongoose.model(
	"MiscellaneousPayment",
	miscellaneousPaymentSchema,
);
