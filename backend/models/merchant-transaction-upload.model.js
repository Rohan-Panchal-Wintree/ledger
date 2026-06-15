import mongoose from "mongoose";

const merchantTransactionUploadSchema = new mongoose.Schema(
	{
		fileName: {
			type: String,
			required: true,
			trim: true,
		},

		totalRows: { type: Number, default: 0 },
		validRows: { type: Number, default: 0 },
		unmatchedFeeRows: { type: Number, default: 0 },

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
