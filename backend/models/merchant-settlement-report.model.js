import mongoose from "mongoose";

const merchantSettlementReportSchema = new mongoose.Schema(
  {
    merchantName: { type: String, required: true, trim: true, index: true },
    memberId: { type: String, required: true, trim: true, index: true },

    reportDate: { type: Date, required: true, index: true },
    fromDate: Date,
    toDate: Date,

    summary: {
      type: Object,
      default: {},
    },

    currencySummary: {
      type: Object,
      default: {},
    },

    statusSummary: {
      type: Object,
      default: {},
    },

    brandSummary: {
      type: Object,
      default: {},
    },

    modeSummary: {
      type: Object,
      default: {},
    },
    merchantEmail: {
      type: String,
      trim: true,
    },

    reportData: {
      type: Object,
      default: {},
    },

    emailStatus: {
      type: String,
      enum: ["draft", "sent", "failed"],
      default: "draft",
    },

    emailSentAt: Date,
    emailTo: String,

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true },
);

export const MerchantSettlementReport = mongoose.model(
  "MerchantSettlementReport",
  merchantSettlementReportSchema,
);
