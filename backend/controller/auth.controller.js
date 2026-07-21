import { User } from "../models/user.model.js";
import { createOtp, verifyOtp } from "../utils/otp.js";
import {
  createAccessToken,
  createRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from "../utils/token.js";
import {
  createSession,
  getSession,
  touchSession,
  // deleteSession,
  validateSession,
  attachSessionToUser,
  // removeSessionFromUser,
  deleteUserSession,
} from "../utils/session.js";
import { sendOtpEmail } from "../utils/SendEmail.js";
import { deriveSessionResponseKey } from "../utils/encryption.js";

const isProduction = process.env.NODE_ENV === "production";

const cookieBase = {
  httpOnly: true,
  secure: process.env.COOKIE_SECURE === "true" || isProduction,
  sameSite: process.env.COOKIE_SAME_SITE || (isProduction ? "none" : "lax"),
  path: "/",
};

// const accessCookieOptions = {
//   ...cookieBase,
//   maxAge: 15 * 60 * 1000,
// };

// const refreshCookieOptions = {
//   ...cookieBase,
//   maxAge: 7 * 24 * 60 * 60 * 1000,
// };

const accessCookieOptions = {
  ...cookieBase,
  maxAge: 24 * 60 * 60 * 1000,
};

const refreshCookieOptions = {
  ...cookieBase,
  maxAge: 30 * 24 * 60 * 60 * 1000,
};

const getUserByEmail = async (email) => {
  const user = await User.findOne({ email: email.toLowerCase() });

  if (!user || !user.isActive) {
    return null;
  }

  return user;
};

const serializeUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  isActive: user.isActive,
});

const setAuthCookies = (res, accessToken, refreshToken) => {
  res.cookie("accessToken", accessToken, accessCookieOptions);
  res.cookie("refreshToken", refreshToken, refreshCookieOptions);
};

const clearAuthCookies = (res) => {
  res.clearCookie("accessToken", cookieBase);
  res.clearCookie("refreshToken", cookieBase);
};

export const registerUser = async (req, res) => {
  const email = req.body.email.toLowerCase();

  const existingUser = await User.findOne({ email }).lean();

  if (existingUser) {
    return res.status(409).json({
      success: false,
      message: "User already exists",
    });
  }

  const user = await User.create({
    name: req.body.name,
    email,
    role: req.body.role,
    isActive: req.body.isActive ?? true,
  });

  return res.status(201).json({
    success: true,
    message: "User registered successfully",
    data: serializeUser(user),
  });
};

export const requestOtp = async (req, res) => {
  const user = await getUserByEmail(req.body.email);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found or inactive",
    });
  }

  const otp = await createOtp(user.email);
  await sendOtpEmail(user.email, otp);

  console.log("OTP is", otp);

  const response = {
    success: true,
    message: "OTP sent successfully",
  };

  if (!isProduction) {
    response.otp = otp;
  }

  return res.json(response);
};

export const verifyOtpLogin = async (req, res) => {
  const user = await getUserByEmail(req.body.email);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found or inactive",
    });
  }

  const isValid = await verifyOtp(user.email, req.body.otp);

  if (!isValid) {
    return res.status(400).json({
      success: false,
      message: "Invalid or expired OTP",
    });
  }

  const session = await createSession(user, req);
  await attachSessionToUser(user._id.toString(), session.sessionId);

  const accessToken = createAccessToken({
    user,
    sessionId: session.sessionId,
  });

  const refreshToken = createRefreshToken({
    user,
    sessionId: session.sessionId,
  });

  setAuthCookies(res, accessToken, refreshToken);
  const responseKey = deriveSessionResponseKey(session.sessionId).toString(
    "hex",
  );

  return res.json({
    success: true,
    user: serializeUser(user),
    sessionId: session.sessionId,
    csrfToken: session.csrfToken,
    responseKey,
  });
};

export const refreshToken = async (req, res) => {
  const refreshTokenValue = req.cookies?.refreshToken;

  if (!refreshTokenValue) {
    return res.status(401).json({
      success: false,
      message: "Refresh token missing",
    });
  }

  const payload = verifyRefreshToken(refreshTokenValue);

  if (payload.type !== "refresh") {
    return res.status(401).json({
      success: false,
      message: "Invalid refresh token type",
    });
  }

  const session = await getSession(payload.sid);

  if (
    !session ||
    session.userId !== payload.sub ||
    !validateSession(session, req)
  ) {
    return res.status(401).json({
      success: false,
      message: "Session expired or invalid",
    });
  }

  const user = await User.findById(payload.sub);

  if (!user || !user.isActive) {
    return res.status(401).json({
      success: false,
      message: "User not found or inactive",
    });
  }

  await touchSession(payload.sid);

  const nextAccessToken = createAccessToken({
    user,
    sessionId: payload.sid,
  });

  const nextRefreshToken = createRefreshToken({
    user,
    sessionId: payload.sid,
  });

  setAuthCookies(res, nextAccessToken, nextRefreshToken);
  const responseKey = deriveSessionResponseKey(session.sessionId).toString(
    "hex",
  );

  return res.json({
    success: true,
    user: serializeUser(user),
    sessionId: session.sessionId,
    csrfToken: session.csrfToken,
    responseKey,
  });
};

const getRequestSessionId = (req) => {
  return (
    req.body?.sessionId ||
    req.headers["x-session-id"] ||
    req.headers["x-sessionid"] ||
    null
  );
};

const getLogoutSessionTarget = async (req) => {
  const requestedSessionId = getRequestSessionId(req);

  if (requestedSessionId) {
    const session = await getSession(requestedSessionId);

    if (session?.userId) {
      return {
        userId: session.userId,
        sessionId: requestedSessionId,
      };
    }
  }

  if (req.user?._id && req.session?.sessionId) {
    return {
      userId: req.user._id.toString(),
      sessionId: req.session.sessionId,
    };
  }

  const refreshTokenValue = req.cookies?.refreshToken;

  if (refreshTokenValue) {
    try {
      const payload = verifyRefreshToken(refreshTokenValue);

      if (payload?.sub && payload?.sid) {
        return {
          userId: payload.sub,
          sessionId: payload.sid,
        };
      }
    } catch (error) {
      console.error("Logout refresh token verification failed:", error.message);
    }
  }

  const accessTokenValue = req.cookies?.accessToken;

  if (accessTokenValue) {
    try {
      const payload = verifyAccessToken(accessTokenValue);

      if (payload?.sub && payload?.sid) {
        return {
          userId: payload.sub,
          sessionId: payload.sid,
        };
      }
    } catch (error) {
      console.error("Logout access token verification failed:", error.message);
    }
  }

  return null;
};

export const logout = async (req, res) => {
  let deletedSessionId = null;

  try {
    const sessionTarget = await getLogoutSessionTarget(req);

    if (sessionTarget?.userId && sessionTarget?.sessionId) {
      await deleteUserSession(
        sessionTarget.userId,
        sessionTarget.sessionId,
        "logout",
      );

      deletedSessionId = sessionTarget.sessionId;
    } else {
      console.warn("Logout completed without a session target.");
    }
  } catch (error) {
    console.error("Failed to delete logout session:", error);
  } finally {
    clearAuthCookies(res);
  }

  return res.json({
    success: true,
    message: "Logged out successfully",
    deletedSessionId,
  });
};
