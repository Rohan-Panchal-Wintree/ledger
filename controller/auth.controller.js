import { User } from "../models/user.model.js";
import { createOtp, verifyOtp } from "../utils/otp.js";
import {
	createAccessToken,
	createRefreshToken,
	revokeRefreshToken,
	rotateRefreshToken,
} from "../utils/token.js";

const getUserByEmail = async (email) => {
	const user = await User.findOne({ email: email.toLowerCase() });

	if (!user || !user.isActive) {
		return null;
	}

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
			isActive: user.isActive,
		},
	};
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
		data: {
			id: user._id,
			name: user.name,
			email: user.email,
			role: user.role,
			isActive: user.isActive,
		},
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

	// TODO: send email later
	// await sendOtpEmail(user.email, otp);

	return res.json({
		success: true,
		message: "OTP sent successfully",
		otp, // remove this in production
	});
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

	const auth = await buildAuthResponse(user);

	return res.json({
		success: true,
		...auth,
	});
};

export const refreshToken = async (req, res) => {
	const userId = await rotateRefreshToken(req.body.refreshToken);

	const user = await User.findById(userId);

	if (!user) {
		return res.status(401).json({
			success: false,
			message: "User not found",
		});
	}

	const auth = await buildAuthResponse(user);

	return res.json({
		success: true,
		...auth,
	});
};

export const logout = async (req, res) => {
	await revokeRefreshToken(req.body.refreshToken);

	return res.json({
		success: true,
		message: "Logged out successfully",
	});
};
