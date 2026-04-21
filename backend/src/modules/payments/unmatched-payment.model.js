import mongoose from "mongoose";

const unmatchedPaymentSchema = new mongoose.Schema(
  {
    rowIdentityKey: { type: String, required: true, unique: true, index: true },
    status: {
      type: String,
      enum: ["pending_reconciliation", "reconciled", "manual_review", "ignored"],
      default: "pending_reconciliation",
      index: true
    },
    failureReason: { type: String, trim: true },
    paymentBank: { type: String, trim: true },
    merchantName: { type: String, trim: true },
    sourceMid: { type: String, trim: true },
    sourceStartDate: { type: Date },
    sourceEndDate: { type: Date },
    sourceProcessingCurrency: { type: String, trim: true, uppercase: true },
    amountPaid: { type: Number, required: true },
    settlementAmount: { type: Number, default: 0 },
    paymentCurrency: { type: String, trim: true, uppercase: true },
    paymentMethod: { type: String, enum: ["CRYPTO", "WIRE", "UNKNOWN"], default: "UNKNOWN" },
    paymentDate: { type: Date },
    paidToMerchantDate: { type: Date },
    paymentRate: { type: Number, default: 0 },
    sheetName: { type: String, trim: true },
    originalFilename: { type: String, trim: true },
    reference: { type: String, trim: true },
    retryCount: { type: Number, default: 0 },
    lastReconciledAt: { type: Date },
    reconciledAt: { type: Date },
    settlementTransactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SettlementTransaction"
    },
    merchantAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MerchantAccount"
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    reconciledBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  },
  { timestamps: true }
);

unmatchedPaymentSchema.index({
  status: 1,
  sourceMid: 1,
  sourceStartDate: 1,
  sourceEndDate: 1
});

export const UnmatchedPayment = mongoose.model(
  "UnmatchedPayment",
  unmatchedPaymentSchema
);
