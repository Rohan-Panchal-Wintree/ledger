import { User } from "../users/user.model.js";
import { Merchant } from "../merchants/merchant.model.js";
import { ApiError } from "../../utils/ApiError.js";
import { createOtp, verifyOtp } from "../../services/otp.service.js";
import { sendOtpEmail } from "../../services/email.service.js";
import {
  createAccessToken,
  createRefreshToken,
  revokeRefreshToken,
  rotateRefreshToken
} from "../../services/token.service.js";
import {
  finishAuthentication,
  finishRegistration,
  startAuthentication,
  startRegistration
} from "./webauthn.service.js";

const getUserByEmail = async (email) => {
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user || !user.isActive) throw new ApiError(404, "User not found or inactive");
  return user;
};

const buildAuthResponse = async (user) => {
  user.lastLoginAt = new Date();
  await user.save();

  return {
    accessToken: createAccessToken(user),
    refreshToken: await createRefreshToken(user),
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      biometricEnabled: user.biometricEnabled
    }
  };
};

export const registerUser = async (req, res) => {
  const email = req.body.email.toLowerCase();
  const existingUser = await User.findOne({ email }).lean();
  if (existingUser) throw new ApiError(409, "User already exists");

  if (req.body.merchantId) {
    const merchant = await Merchant.findById(req.body.merchantId).lean();
    if (!merchant) throw new ApiError(404, "Merchant not found");
  }

  const user = await User.create({
    ...req.body,
    email
  });

  res.status(201).json({
    success: true,
    message: "User registered successfully",
    data: {
      id: user._id,
      name: user.name,
      email: user.email,
      merchantId: user.merchantId,
      role: user.role,
      isActive: user.isActive,
      biometricEnabled: user.biometricEnabled
    }
  });
};

export const requestOtp = async (req, res) => {
  const user = await getUserByEmail(req.body.email);
  const otp = await createOtp(user.email);
  await sendOtpEmail(user.email, otp);
  res.json({ success: true, message: "OTP sent successfully" });
};

export const verifyOtpLogin = async (req, res) => {
  const user = await getUserByEmail(req.body.email);
  await verifyOtp(user.email, req.body.otp);
  const auth = await buildAuthResponse(user);
  res.json({ success: true, ...auth });
};

export const refreshToken = async (req, res) => {
  const userId = await rotateRefreshToken(req.body.refreshToken);
  const user = await User.findById(userId);
  if (!user) throw new ApiError(401, "User not found");
  const auth = await buildAuthResponse(user);
  res.json({ success: true, ...auth });
};

export const logout = async (req, res) => {
  await revokeRefreshToken(req.body.refreshToken);
  res.json({ success: true, message: "Logged out successfully" });
};

export const startWebauthnRegistration = async (req, res) => {
  const user = await getUserByEmail(req.body.email);
  const options = await startRegistration(user);
  res.json({ success: true, options });
};

export const finishWebauthnRegistration = async (req, res) => {
  const user = await getUserByEmail(req.body.email);
  await finishRegistration(user, req.body.response, req.body.deviceName);
  res.json({ success: true, message: "Biometric login enabled" });
};

export const startWebauthnLogin = async (req, res) => {
  const user = await getUserByEmail(req.body.email);
  const options = await startAuthentication(user);
  res.json({ success: true, options });
};

export const finishWebauthnLogin = async (req, res) => {
  const user = await getUserByEmail(req.body.email);
  await finishAuthentication(user, req.body.response);
  const auth = await buildAuthResponse(user);
  res.json({ success: true, ...auth });
};
