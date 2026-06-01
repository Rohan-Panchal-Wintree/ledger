import { getSession } from "../utils/session.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

const getRequestSessionId = (req) => {
  return (
    req.headers["x-session-id"] ||
    req.headers["x-sessionid"] ||
    req.body?.sessionId ||
    null
  );
};

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

  if (!session || csrfToken !== session.csrfToken) {
    return res.status(403).json({
      success: false,
      message: "Invalid CSRF token",
    });
  }

  req.session = session;

  return next();
};
