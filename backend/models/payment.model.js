import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
	{
		wiresheetTransactionId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "WiresheetTransaction",
			required: true,
		},
		merchantMappingId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "MerchantAccount",
			required: true,
		},

		paymentBank: { type: String, trim: true }, // Bank = Acquirer from payment sheet
		merchantName: { type: String, trim: true },
		sourceMid: { type: String, trim: true },

		sourceStartDate: Date,
		sourceEndDate: Date,
		sourceProcessingCurrency: { type: String, trim: true, uppercase: true },

		amountPaid: { type: Number, required: true },
		paymentRate: { type: Number, default: 0 },
		settlementCurrency: { type: String, trim: true, uppercase: true },
		settlementAmount: { type: Number, default: 0 },

		paymentMethod: {
			type: String,
			enum: ["CRYPTO", "WIRE", "UNKNOWN"],
			required: true,
		},

		paymentDate: { type: Date, required: true },
		paidToMerchantDate: { type: Date, required: true },

		hashPayment: { type: String, trim: true }, // from crypto hash column
		referenceNo: { type: String, trim: true }, // from wire reference column

		sourceSheetName: { type: String, trim: true },
		sourceOriginalFilename: { type: String, trim: true },

		createdBy: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
		},
	},
	{ timestamps: true },
);

paymentSchema.index(
	{
		wiresheetTransactionId: 1,
		paymentBank: 1,
		sourceMid: 1,
		sourceStartDate: 1,
		sourceEndDate: 1,
		sourceProcessingCurrency: 1,
		settlementCurrency: 1,
		paymentDate: 1,
		amountPaid: 1,
		settlementAmount: 1,
		hashPayment: 1,
		referenceNo: 1,
	},
	{ unique: true },
);

export const Payment = mongoose.model("Payment", paymentSchema);
