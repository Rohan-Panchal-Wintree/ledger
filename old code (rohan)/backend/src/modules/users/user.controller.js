import { User } from "./user.model.js";
import { Merchant } from "../merchants/merchant.model.js";
import { ApiError } from "../../utils/ApiError.js";

export const listUsers = async (_req, res) => {
  const users = await User.find().sort({ createdAt: -1 }).lean();
  res.json({ success: true, data: users });
};

export const createUser = async (req, res) => {
  const existing = await User.findOne({ email: req.body.email.toLowerCase() });
  if (existing) throw new ApiError(409, "User already exists");

  if (req.body.merchantId) {
    const merchant = await Merchant.findById(req.body.merchantId).lean();
    if (!merchant) throw new ApiError(404, "Merchant not found");
  }

  const user = await User.create({ ...req.body, email: req.body.email.toLowerCase() });
  res.status(201).json({ success: true, data: user });
};

export const updateUser = async (req, res) => {
  const user = await User.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });

  if (!user) throw new ApiError(404, "User not found");
  res.json({ success: true, data: user });
};
