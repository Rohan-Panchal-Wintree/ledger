import mongoose from "mongoose";

const merchantFeeConfigSchema = new mongoose.Schema(
	{
		merchantName: {
			type: String,
			required: true,
			trim: true,
			index: true,
		},

		memberId: {
			type: String,
			required: true,
			trim: true,
			index: true,
		},

		partnerName: {
			type: String,
			trim: true,
			index: true,
		},

		accountIds: {
			type: [String],
			default: [],
			index: true,
		},

		country: {
			type: String,
			trim: true,
		},

		countryRuleRaw: {
			type: String,
			trim: true,
		},

		countryScope: {
			type: String,
			enum: ["ALL", "EU", "NONEU", "COUNTRY"],
			default: "ALL",
			index: true,
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

		gatewayName: {
			type: String,
			trim: true,
			uppercase: true,
			default: "ALL",
			index: true,
		},

		currency: {
			type: String,
			required: true,
			trim: true,
			uppercase: true,
			index: true,
		},

		brand: {
			type: String,
			required: true,
			trim: true,
			uppercase: true,
			index: true,
		},

		mdrPercent: { type: Number, default: 0 },
		approvalFee: { type: Number, default: 0 },
		declineFee: { type: Number, default: 0 },
		reversalFee: { type: Number, default: 0 },
		chargebackFee: { type: Number, default: 0 },
		rollingReservePercent: { type: Number, default: 0 },
		settlementExpensePercent: { type: Number, default: 0 },

		status: {
			type: String,
			enum: ["active", "inactive"],
			default: "active",
			index: true,
		},

		createdBy: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
		},

		updatedBy: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
		},

		type: {
			type: String,
			trim: true,
		},
	},
	{ timestamps: true },
);

merchantFeeConfigSchema.index({
	memberId: 1,
	currency: 1,
	brand: 1,
	countryScope: 1,
	countryCode: 1,
	gatewayName: 1,
	status: 1,
});

export const MerchantFeeConfig = mongoose.model(
	"MerchantFeeConfig",
	merchantFeeConfigSchema,
);
