import mongoose from "mongoose";

const invalidPaymentRowSchema = new mongoose.Schema(
	{
		rowIdentityKey: {
			type: String,
			required: true,
			unique: true,
			index: true,
		},

		sourceOriginalFilename: {
			type: String,
			required: true,
			trim: true,
		},

		sourceSheetName: {
			type: String,
			required: true,
			trim: true,
		},

		excelRowNumber: {
			type: Number,
			required: true,
		},

		rawRow: {
			type: Object,
			required: true,
		},

		normalizedRow: {
			type: Object,
			default: null,
		},

		fixedData: {
			type: Object,
			default: null,
		},

		missingFields: {
			type: [String],
			default: [],
		},

		failureReason: {
			type: String,
			trim: true,
		},

		paymentSheetDate: {
			type: Date,
		},

		paymentSheetDateLabel: {
			type: String,
			trim: true,
		},

		status: {
			type: String,
			enum: ["pending_fix", "fixed", "reconciled", "moved_to_unmatched"],
			default: "pending_fix",
			index: true,
		},

		paymentId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Payment",
			default: null,
		},

		unmatchedPaymentId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "UnmatchedPayment",
			default: null,
		},

		reconciledAt: Date,

		fixedBy: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			default: null,
		},

		reconciledBy: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			default: null,
		},

		createdBy: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
		},
	},
	{ timestamps: true },
);

export const InvalidPaymentRow = mongoose.model(
	"InvalidPaymentRow",
	invalidPaymentRowSchema,
);
