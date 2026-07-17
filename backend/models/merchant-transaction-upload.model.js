import mongoose from "mongoose";

const merchantTransactionUploadSchema = new mongoose.Schema(
	{
		settlementBatchId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "MerchantSettlementBatch",
			required: true,
			index: true,
		},

		fileName: {
			type: String,
			required: true,
			trim: true,
		},

		sourceFileType: {
			type: String,
			enum: ["datestamp", "timestamp"],
			required: true,
			index: true,
		},

		totalRows: { type: Number, default: 0 },
		validRows: { type: Number, default: 0 },
		matchedRows: { type: Number, default: 0 },
		unmatchedFeeRows: { type: Number, default: 0 },
		skippedRows: { type: Number, default: 0 },

		uploadedBy: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
		},
	},
	{ timestamps: true },
);

export const MerchantTransactionUpload = mongoose.model(
	"MerchantTransactionUpload",
	merchantTransactionUploadSchema,
);
