import mongoose from "mongoose";

const trustedDeviceSchema = new mongoose.Schema(
  {
    credentialID: { type: String, required: true },
    deviceName: { type: String, required: true },
    publicKey: { type: String, required: true },
    counter: { type: Number, default: 0 },
    transports: [{ type: String }],
    webauthnUserId: String,
    lastUsed: Date
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, index: true },
    merchantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Merchant",
      default: null
    },
    role: {
      type: String,
      enum: ["admin", "finance", "settlement", "viewer"],
      required: true
    },
    isActive: { type: Boolean, default: true },
    biometricEnabled: { type: Boolean, default: false },
    trustedDevices: [trustedDeviceSchema],
    lastLoginAt: Date
  },
  { timestamps: true }
);

export const User = mongoose.model("User", userSchema);
