import mongoose from "mongoose";

const settlementTransactionSchema = new mongoose.Schema(
  {
    batchId: { type: mongoose.Schema.Types.ObjectId, ref: "SettlementBatch", required: true },
    merchantId: { type: mongoose.Schema.Types.ObjectId, ref: "Merchant", required: true },
    merchantAccountId: { type: mongoose.Schema.Types.ObjectId, ref: "MerchantAccount", required: true },
    mid: { type: String, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    processingCurrency: { type: String, required: true },
    processingAmount: { type: Number, required: true },
    rate: { type: Number, required: true },
    settlementCurrency: { type: String, required: true },
    payable: { type: Number, required: true },
    paid: { type: Number, default: 0 },
    balance: { type: Number, required: true },
    status: {
      type: String,
      enum: ["pending", "partially_paid", "settled"],
      default: "pending"
    }
  },
  { timestamps: true }
);

settlementTransactionSchema.index({ mid: 1, settlementCurrency: 1, startDate: 1, endDate: 1 });

export const SettlementTransaction = mongoose.model("SettlementTransaction", settlementTransactionSchema);
