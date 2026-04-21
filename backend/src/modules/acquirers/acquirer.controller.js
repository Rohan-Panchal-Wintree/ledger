import { Acquirer } from "./acquirer.model.js";
import { ApiError } from "../../utils/ApiError.js";

export const listAcquirers = async (_req, res) => {
  const data = await Acquirer.find().sort({ name: 1 }).lean();
  res.json({ success: true, data });
};

export const createAcquirer = async (req, res) => {
  const acquirer = await Acquirer.create(req.body);
  res.status(201).json({ success: true, data: acquirer });
};

export const getAcquirer = async (req, res) => {
  const acquirer = await Acquirer.findById(req.params.id).lean();
  if (!acquirer) throw new ApiError(404, "Acquirer not found");

  res.json({ success: true, data: acquirer });
};

export const updateAcquirer = async (req, res) => {
  const acquirer = await Acquirer.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });
  if (!acquirer) throw new ApiError(404, "Acquirer not found");
  res.json({ success: true, data: acquirer });
};

export const deleteAcquirer = async (req, res) => {
  const acquirer = await Acquirer.findByIdAndDelete(req.params.id);
  if (!acquirer) throw new ApiError(404, "Acquirer not found");

  res.json({
    success: true,
    message: "Acquirer deleted successfully"
  });
};
