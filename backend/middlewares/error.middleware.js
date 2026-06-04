import { encryptResponse } from "../utils/encryption.js";

export const notFoundHandler = (req, res, _next) => {
	const payload = {
		success: false,
		message: `Route not found: ${req.method} ${req.originalUrl}`,
	};

	if (res.locals?.responseEncryptionKey) {
		return res
			.status(404)
			.json(encryptResponse(payload, res.locals.responseEncryptionKey));
	}

	return res.status(404).json(payload);
};

export const errorHandler = (err, _req, res, _next) => {
	const statusCode = err.statusCode || err.status || 500;

	if (process.env.NODE_ENV !== "test") {
		console.error("ERROR:", {
			message: err.message,
			stack: err.stack,
		});
	}

	const payload = {
		success: false,
		message:
			process.env.NODE_ENV === "production" && statusCode === 500
				? "Internal server error"
				: err.message || "Internal server error",
	};

	if (res.locals?.responseEncryptionKey) {
		return res
			.status(statusCode)
			.json(encryptResponse(payload, res.locals.responseEncryptionKey));
	}

	return res.status(statusCode).json(payload);
};
