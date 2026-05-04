import jwt from "jsonwebtoken";

export const createAccessToken = (user) =>
	jwt.sign(
		{
			role: user.role,
			email: user.email,
		},
		process.env.JWT_ACCESS_SECRET,
		{
			subject: user._id.toString(),
			expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
		},
	);

export const createRefreshToken = (user) =>
	jwt.sign(
		{
			type: "refresh",
		},
		process.env.JWT_REFRESH_SECRET,
		{
			subject: user._id.toString(),
			expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
		},
	);

export const rotateRefreshToken = async (refreshToken) => {
	const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
	return payload.sub;
};

export const revokeRefreshToken = async () => {};
