import { User } from "../models/user.model.js";
import { getSession, touchSession, validateSession } from "../utils/session.js";
import { verifyAccessToken } from "../utils/token.js";

export const authMiddleware = async (req, res, next) => {
	try {
		const bearerToken = req.headers.authorization?.startsWith("Bearer ")
			? req.headers.authorization.split(" ")[1]
			: null;

		const token = req.cookies?.accessToken || bearerToken;

		if (!token) {
			return res.status(401).json({
				success: false,
				message: "Authentication required",
			});
		}

		const payload = verifyAccessToken(token);

		if (payload.type !== "access") {
			return res.status(401).json({
				success: false,
				message: "Invalid access token type",
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

		const user = await User.findById(payload.sub).lean();

		if (!user || !user.isActive) {
			return res.status(401).json({
				success: false,
				message: "User is inactive or missing",
			});
		}

		await touchSession(payload.sid);

		req.user = user;
		req.session = session;
		req.tokenPayload = payload;

		next();
	} catch (error) {
		return res.status(401).json({
			success: false,
			message: "Invalid access token",
		});
	}
};
