import { ApiError } from "../../utils/ApiError.js";
import { processPaymentUpload } from "../../services/payment.service.js";

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
