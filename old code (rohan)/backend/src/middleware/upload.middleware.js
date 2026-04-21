import multer from "multer";
import { env } from "../config/env.js";
import { ApiError } from "../utils/ApiError.js";

const storage = multer.memoryStorage();

const fileFilter = (_req, file, cb) => {
  const allowed =
    file.mimetype.includes("sheet") ||
    file.mimetype.includes("excel") ||
    file.originalname.endsWith(".xlsx") ||
    file.originalname.endsWith(".xls");

  if (!allowed) {
    cb(new ApiError(400, "Only Excel files are allowed"));
    return;
  }

  cb(null, true);
};

export const uploadMiddleware = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: env.MAX_FILE_SIZE_MB * 1024 * 1024
  }
});
