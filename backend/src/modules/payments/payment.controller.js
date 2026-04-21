import { ApiError } from "../../utils/ApiError.js";
import {
  getUnmatchedPaymentSummary,
  processPaymentUpload,
  reconcileUnmatchedPayments
} from "../../services/payment.service.js";

export const uploadPayments = async (req, res) => {
  if (!req.file) throw new ApiError(400, "Payment file is required");

  const result = await processPaymentUpload({
    fileBuffer: req.file.buffer,
    batchId: req.body.batchId,
    userId: req.user._id,
    paymentDate: req.body.paymentDate,
    originalFilename: req.file.originalname
  });

  res.status(201).json({
    success: true,
    message: "Payments uploaded successfully",
    data: result
  });
};

export const getUnmatchedPaymentsSummary = async (_req, res) => {
  const result = await getUnmatchedPaymentSummary();

  res.json({
    success: true,
    data: result
  });
};

export const reconcilePendingPayments = async (req, res) => {
  const result = await reconcileUnmatchedPayments({
    userId: req.user._id,
    batchId: req.body?.batchId
  });

  res.json({
    success: true,
    message: "Pending unmatched payments reconciled successfully",
    data: result
  });
};
