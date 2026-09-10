import mongoose from "mongoose";

const merchantFeeConfigHistorySchema = new mongoose.Schema(
  {
    feeConfigId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MerchantFeeConfig",
      default: null,
    },

    action: {
      type: String,
      enum: ["CREATED", "UPDATED", "DEACTIVATED", "BULK_UPLOAD_UPDATED"],
      required: true,
    },

    memberId: String,
    merchantName: String,
    partnerName: String,
    accountIds: [String],

    brand: String,
    currency: String,

    country: String,
    countryRuleRaw: String,
    countryScope: String,
    countryCode: String,
    countryCategory: String,
    gatewayName: String,

    oldRates: {
      mdrPercent: Number,
      approvalFee: Number,
      declineFee: Number,
      reversalFee: Number,
      chargebackFee: Number,
      rollingReservePercent: Number,
      settlementExpensePercent: Number,
      type: String,
    },

    newRates: {
      mdrPercent: Number,
      approvalFee: Number,
      declineFee: Number,
      reversalFee: Number,
      chargebackFee: Number,
      rollingReservePercent: Number,
      settlementExpensePercent: Number,
      type: String,
    },

    changedFields: [String],

    changeReason: {
      type: String,
      default: "",
    },

    requestedByName: {
      type: String,
      default: "",
    },

    requestedByEmail: {
      type: String,
      default: "",
    },

    approvedByName: {
      type: String,
      default: "",
    },

    approvedByEmail: {
      type: String,
      default: "",
    },

    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    changedByName: {
      type: String,
      default: "",
    },

    changedByEmail: {
      type: String,
      default: "",
    },

    source: {
      type: String,
      enum: ["manual", "excel_upload"],
      default: "manual",
    },

    uploadedFileName: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  },
);

export const MerchantFeeConfigHistory = mongoose.model(
  "MerchantFeeConfigHistory",
  merchantFeeConfigHistorySchema,
);
