import mongoose from "mongoose";

const wiresheetSchema = new mongoose.Schema(
	{
		wiresheetName: {
			type: String,
			required: true,
			unique: true,
			trim: true,
		},
		acquirerId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Acquirer",
			required: true,
		},
		startDate: {
			type: Date,
			required: true,
		},
		endDate: {
			type: Date,
			required: true,
		},
		totalPayable: {
			type: Number,
			default: 0,
		},
		totalPaid: {
			type: Number,
			default: 0,
		},
		totalBalance: {
			type: Number,
			default: 0,
		},
		status: {
			type: String,
			enum: ["pending", "partially_paid", "settled"],
			default: "pending",
		},
	},
	{ timestamps: true },
);

export const Wiresheet = mongoose.model("Wiresheet", wiresheetSchema);
