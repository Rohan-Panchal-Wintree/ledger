import { ZodError } from "zod";
import { ApiError } from "../utils/ApiError.js";
import { logger } from "../utils/logger.js";

export const notFoundHandler = (req, _res, next) => {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
};

export const errorHandler = (error, _req, res, _next) => {
  logger.error({ error }, error.message);

  if (error instanceof ZodError) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      details: error.flatten()
    });
  }

  if (error instanceof ApiError) {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message,
      details: error.details
    });
  }

  return res.status(500).json({
    success: false,
    message: "Internal server error"
  });
};
