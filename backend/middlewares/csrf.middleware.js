const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export const csrfMiddleware = (req, res, next) => {
	if (SAFE_METHODS.has(req.method)) {
		return next();
	}

	const csrfToken = req.headers["x-csrf-token"];

	if (!req.session || !csrfToken || csrfToken !== req.session.csrfToken) {
		return res.status(403).json({
			success: false,
			message: "Invalid CSRF token",
		});
	}

	next();
};
