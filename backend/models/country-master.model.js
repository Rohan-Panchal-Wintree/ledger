import mongoose from "mongoose";

const countryMasterSchema = new mongoose.Schema(
	{
		transactionCountryName: {
			type: String,
			required: true,
			trim: true,
			uppercase: true,
			index: true,
		},

		feeCountryCode: {
			type: String,
			required: true,
			trim: true,
			uppercase: true,
			index: true,
		},

		countryCategory: {
			type: String,
			enum: ["EU", "NONEU"],
			required: true,
			index: true,
		},

		aliases: {
			type: [String],
			default: [],
		},

		status: {
			type: String,
			enum: ["active", "inactive"],
			default: "active",
			index: true,
		},

		createdBy: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
		},

		updatedBy: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
		},
	},
	{ timestamps: true },
);

countryMasterSchema.index({
	transactionCountryName: 1,
	status: 1,
});

countryMasterSchema.index({
	feeCountryCode: 1,
	status: 1,
});

export const CountryMaster = mongoose.model(
	"CountryMaster",
	countryMasterSchema,
);
