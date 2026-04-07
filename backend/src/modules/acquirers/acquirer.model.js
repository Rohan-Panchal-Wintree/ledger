import mongoose from "mongoose";

const acquirerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true }
  },
  { timestamps: true }
);

export const Acquirer = mongoose.model("Acquirer", acquirerSchema);
