import jwt from "jsonwebtoken";

export const createAccessToken = ({ user, sessionId }) =>
	jwt.sign(
		{
			role: user.role,
			email: user.email,
			sid: sessionId,
			type: "access",
		},
		process.env.JWT_ACCESS_SECRET,
		{
			subject: user._id.toString(),
			expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
		},
	);

export const createRefreshToken = ({ user, sessionId }) =>
	jwt.sign(
		{
			sid: sessionId,
			type: "refresh",
		},
		process.env.JWT_REFRESH_SECRET,
		{
			subject: user._id.toString(),
			expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
		},
	);

export const verifyAccessToken = (token) =>
	jwt.verify(token, process.env.JWT_ACCESS_SECRET);

export const verifyRefreshToken = (token) =>
	jwt.verify(token, process.env.JWT_REFRESH_SECRET);
