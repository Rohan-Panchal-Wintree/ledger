import mongoose from "mongoose";

const merchantSchema = new mongoose.Schema(
	{
		merchantName: { type: String, required: true, trim: true, index: true },
		status: { type: String, enum: ["active", "inactive"], default: "active" },
	},
	{ timestamps: true },
);

export const Merchant = mongoose.model("Merchant", merchantSchema);
