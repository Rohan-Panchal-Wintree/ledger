import mongoose from "mongoose";

const settlementUploadSchema = new mongoose.Schema(
	{
		type: {
			type: String,
			enum: ["wiresheet", "payment_sheet"],
			required: true,
			index: true,
		},

		fileName: {
			type: String,
			required: true,
			trim: true,
		},

		s3Key: {
			type: String,
			required: true,
		},

		fileUrl: {
			type: String,
			required: true,
		},

		mimeType: String,
		size: Number,

		uploadedBy: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
		},
	},
	{ timestamps: true },
);

settlementUploadSchema.index({
	type: 1,
	createdAt: -1,
});

export const SettlementUpload = mongoose.model(
	"SettlementUpload",
	settlementUploadSchema,
);
