import mongoose from "mongoose";

const rateSnapshotSchema = new mongoose.Schema(
	{
		mdrPercent: Number,
		approvalFee: Number,
		declineFee: Number,
		reversalFee: Number,
		chargebackFee: Number,
		rollingReservePercent: Number,
		settlementExpensePercent: Number,
		type: String,
	},
	{ _id: false },
);

const merchantFeeChangeRequestSchema = new mongoose.Schema(
	{
		feeConfigId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "MerchantFeeConfig",
			default: null,
		},

		action: {
			type: String,
			enum: ["CREATE", "UPDATE", "DEACTIVATE"],
			required: true,
		},

		status: {
			type: String,
			enum: ["PENDING_APPROVAL", "APPROVED", "REJECTED", "CANCELLED"],
			default: "PENDING_APPROVAL",
		},

		memberId: String,
		merchantName: String,
		partnerName: String,
		accountIds: [String],

		brand: String,
		currency: String,

		country: String,
		countryRuleRaw: String,
		countryScope: String,
		countryCode: String,
		countryCategory: String,
		gatewayName: String,

		oldRates: rateSnapshotSchema,
		newRates: rateSnapshotSchema,
		changedFields: [String],

		changeReason: {
			type: String,
			required: true,
		},

		requestedByName: {
			type: String,
			default: "",
		},

		requestedByEmail: {
			type: String,
			default: "",
		},

		makerId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
		},

		makerName: String,
		makerEmail: String,

		checkerId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			default: null,
		},

		checkerName: String,
		checkerEmail: String,

		checkerComment: {
			type: String,
			default: "",
		},

		approvedAt: Date,
		rejectedAt: Date,

		source: {
			type: String,
			enum: ["manual", "excel_upload"],
			default: "manual",
		},

		uploadedFileName: {
			type: String,
			default: "",
		},
	},
	{
		timestamps: true,
	},
);

export const MerchantFeeChangeRequest = mongoose.model(
	"MerchantFeeChangeRequest",
	merchantFeeChangeRequestSchema,
);
