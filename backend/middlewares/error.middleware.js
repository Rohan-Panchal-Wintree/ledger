export const notFoundHandler = (req, res, _next) => {
	return res.status(404).json({
		success: false,
		message: `Route not found: ${req.method} ${req.originalUrl}`,
	});
};

export const errorHandler = (err, _req, res, _next) => {
	const statusCode = err.statusCode || err.status || 500;

	if (process.env.NODE_ENV !== "test") {
		console.error("ERROR:", {
			message: err.message,
			stack: err.stack,
		});
	}

	return res.status(statusCode).json({
		success: false,
		message:
			process.env.NODE_ENV === "production" && statusCode === 500
				? "Internal server error"
				: err.message || "Internal server error",
	});
};
