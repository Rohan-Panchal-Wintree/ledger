import mongoose from "mongoose";

const merchantSchema = new mongoose.Schema(
	{
		merchantName: {
			type: String,
			required: true,
			trim: true,
		},
		merchantTag: {
			type: String,
			trim: true,
		},
		status: {
			type: String,
			enum: ["active", "inactive"],
			default: "active",
		},
	},
	{ timestamps: true },
);

merchantSchema.index({ merchantName: 1 }, { unique: true });

export const Merchant = mongoose.model("Merchant", merchantSchema);
