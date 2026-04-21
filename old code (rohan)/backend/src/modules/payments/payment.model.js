import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    settlementTransactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SettlementTransaction",
      required: true
    },
    merchantAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MerchantAccount",
      required: true
    },
    amountPaid: { type: Number, required: true },
    settlementAmount: { type: Number, default: 0 },
    paymentCurrency: { type: String, required: true },
    paymentMethod: { type: String, enum: ["CRYPTO", "WIRE", "UNKNOWN"], required: true },
    paymentDate: { type: Date, required: true },
    paidToMerchantDate: { type: Date, required: true },
    paymentRate: { type: Number, default: 0 },
    paymentBank: { type: String, trim: true },
    sourceMid: { type: String, trim: true },
    sourceStartDate: { type: Date },
    sourceEndDate: { type: Date },
    sourceProcessingCurrency: { type: String, trim: true, uppercase: true },
    hashPayment: String,
    referenceNo: String,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }
  },
  { timestamps: true }
);

paymentSchema.index({
  settlementTransactionId: 1,
  paymentBank: 1,
  paidToMerchantDate: 1,
  sourceStartDate: 1,
  sourceEndDate: 1,
  sourceProcessingCurrency: 1,
  paymentCurrency: 1
});

export const Payment = mongoose.model("Payment", paymentSchema);
