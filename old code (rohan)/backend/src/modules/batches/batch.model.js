import mongoose from "mongoose";

const batchSchema = new mongoose.Schema(
  {
    batchName: { type: String, required: true, unique: true },
    acquirerId: { type: mongoose.Schema.Types.ObjectId, ref: "Acquirer", required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    totalPayable: { type: Number, default: 0 },
    totalPaid: { type: Number, default: 0 },
    totalBalance: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["pending", "partially_paid", "settled"],
      default: "pending"
    }
  },
  { timestamps: true }
);

export const SettlementBatch = mongoose.model("SettlementBatch", batchSchema);
