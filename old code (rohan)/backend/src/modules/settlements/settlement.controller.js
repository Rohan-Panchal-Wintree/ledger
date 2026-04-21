import { processWiresheetUpload, processWiresheetUploads } from "../../services/settlement.service.js";
import { ApiError } from "../../utils/ApiError.js";

export const uploadWiresheet = async (req, res) => {
  const files = [
    ...(req.files?.file || []),
    ...(req.files?.files || [])
  ];

  if (!files.length) {
    throw new ApiError(400, "At least one wire sheet file is required");
  }

  if (files.length === 1) {
    const batch = await processWiresheetUpload({
      fileBuffer: files[0].buffer,
      acquirerId: req.body.acquirerId,
      originalName: files[0].originalname
    });

    return res.status(201).json({
      success: true,
      message: "Wire sheet processed successfully",
      data: batch
    });
  }

  const result = await processWiresheetUploads({
    files: files.map((file) => ({
      buffer: file.buffer,
      originalName: file.originalname
    })),
    acquirerId: req.body.acquirerId
  });

  const hasPartialFailures = result.failedCount > 0 || result.duplicateCount > 0;

  return res.status(hasPartialFailures ? 207 : 201).json({
    success: true,
    message: "Wire sheets processed successfully",
    data: result
  });
};
