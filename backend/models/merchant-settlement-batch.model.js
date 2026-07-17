import mongoose from "mongoose";

const merchantSettlementBatchSchema = new mongoose.Schema(
	{
		batchName: {
			type: String,
			trim: true,
		},

		reportDate: {
			type: Date,
			index: true,
		},

		fromDate: Date,
		toDate: Date,

		datestampFileName: String,
		timestampFileName: String,

		totalRows: { type: Number, default: 0 },
		validRows: { type: Number, default: 0 },
		matchedRows: { type: Number, default: 0 },
		unmatchedFeeRows: { type: Number, default: 0 },
		skippedRows: { type: Number, default: 0 },

		status: {
			type: String,
			enum: ["uploaded", "processing", "completed", "failed"],
			default: "uploaded",
			index: true,
		},

		errorMessage: String,

		generatedReportIds: [
			{
				type: mongoose.Schema.Types.ObjectId,
				ref: "MerchantSettlementReport",
			},
		],

		uploadedBy: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
		},
	},
	{ timestamps: true },
);

export const MerchantSettlementBatch = mongoose.model(
	"MerchantSettlementBatch",
	merchantSettlementBatchSchema,
);
