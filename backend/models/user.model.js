import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
	{
		name: {
			type: String,
			required: true,
			trim: true,
		},
		email: {
			type: String,
			required: true,
			unique: true,
			lowercase: true,
			trim: true,
		},
		merchantId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Merchant",
			default: null,
		},
		merchantAccountId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "MerchantAccount",
			default: null,
		},
		role: {
			type: String,
			enum: ["admin", "finance", "settlement", "merchant", "support"],
			required: true,
		},
		isActive: {
			type: Boolean,
			default: true,
		},
		notificationPreferences: {
			pushNotifications: {
				type: Boolean,
				default: false,
			},
		},
	},
	{ timestamps: true },
);

export const User = mongoose.model("User", userSchema);
