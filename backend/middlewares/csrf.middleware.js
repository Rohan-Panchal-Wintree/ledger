import { getSession } from "../utils/session.js";
import { allowedOrigins } from "../utils/ManagedVariables.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const TRUSTED_ORIGINS = new Set(allowedOrigins);

const getRequestSessionId = (req) => {
	return (
		req.headers["x-session-id"] ||
		req.headers["x-sessionid"] ||
		req.body?.sessionId ||
		null
	);
};

function extractRequestOrigin(req) {
	const origin = req.headers.origin;

	if (origin) {
		return origin;
	}

	const referer = req.headers.referer;

	if (!referer) {
		return null;
	}

	try {
		return new URL(referer).origin;
	} catch {
		return null;
	}
}

export const csrfMiddleware = async (req, res, next) => {
	if (SAFE_METHODS.has(req.method)) {
		return next();
	}

	const csrfToken = req.headers["x-csrf-token"];

	if (!csrfToken) {
		return res.status(403).json({
			success: false,
			message: "Invalid CSRF token",
		});
	}

	let session = req.session || null;

	if (!session) {
		const sessionId = getRequestSessionId(req);

		if (sessionId) {
			session = await getSession(sessionId);
		}
	}

	if (!session) {
		return res.status(401).json({
			success: false,
			message: "Authentication required",
		});
	}

	const requestOrigin = extractRequestOrigin(req);

	if (requestOrigin && !TRUSTED_ORIGINS.has(requestOrigin)) {
		return res.status(403).json({
			success: false,
			message: "Untrusted request origin",
		});
	}

	if (csrfToken !== session.csrfToken) {
		return res.status(403).json({
			success: false,
			message: "Invalid CSRF token",
		});
	}

	req.session = session;

	return next();
};
