import { Merchant } from "./merchant.model.js";
import { ApiError } from "../../utils/ApiError.js";

export const listMerchants = async (_req, res) => {
  const merchants = await Merchant.find().sort({ merchantName: 1 }).lean();
  res.json({ success: true, data: merchants });
};

export const getMerchant = async (req, res) => {
  const merchant = await Merchant.findById(req.params.id).lean();
  if (!merchant) throw new ApiError(404, "Merchant not found");
  res.json({ success: true, data: merchant });
};

export const createMerchant = async (req, res) => {
  const merchant = await Merchant.create(req.body);
  res.status(201).json({ success: true, data: merchant });
};

export const updateMerchant = async (req, res) => {
  const merchant = await Merchant.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });
  if (!merchant) throw new ApiError(404, "Merchant not found");
  res.json({ success: true, data: merchant });
};
