import mongoose from "mongoose";

const merchantSettlementReportSchema = new mongoose.Schema(
	{
		settlementBatchId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "MerchantSettlementBatch",
			index: true,
		},

		merchantId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Merchant",
			default: null,
			index: true,
		},

		merchantAccountId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "MerchantAccount",
			default: null,
			index: true,
		},

		merchantName: { type: String, required: true, trim: true, index: true },
		memberId: { type: String, required: true, trim: true, index: true },

		reportDate: { type: Date, required: true, index: true },
		fromDate: Date,
		toDate: Date,

		summary: {
			type: Object,
			default: {},
		},

		currencySummary: {
			type: Object,
			default: {},
		},

		statusSummary: {
			type: Object,
			default: {},
		},

		brandSummary: {
			type: Object,
			default: {},
		},

		modeSummary: {
			type: Object,
			default: {},
		},

		merchantEmail: {
			type: String,
			trim: true,
		},

		emailRecipients: [
			{
				userId: {
					type: mongoose.Schema.Types.ObjectId,
					ref: "User",
				},
				name: String,
				email: String,
			},
		],

		reportData: {
			type: Object,
			default: {},
		},

		excelFile: {
			fileName: String,
			filePath: String,
			generatedAt: Date,
		},

		emailStatus: {
			type: String,
			enum: ["draft", "sent", "failed"],
			default: "draft",
		},

		emailSentAt: Date,
		emailTo: String,
		emailError: String,

		createdBy: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
		},
	},
	{ timestamps: true },
);

export const MerchantSettlementReport = mongoose.model(
	"MerchantSettlementReport",
	merchantSettlementReportSchema,
);
