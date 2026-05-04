import jwt from "jsonwebtoken";
import { User } from "../models/user.model.js";

export const authMiddleware = async (req, res, next) => {
	try {
		const header = req.headers.authorization;

		if (!header?.startsWith("Bearer ")) {
			return res.status(401).json({
				success: false,
				message: "Authentication required",
			});
		}

		const token = header.split(" ")[1];

		const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

		const user = await User.findById(payload.sub).lean();

		if (!user || !user.isActive) {
			return res.status(401).json({
				success: false,
				message: "User is inactive or missing",
			});
		}

		req.user = user;
		next();
	} catch (error) {
		return res.status(401).json({
			success: false,
			message: "Invalid access token",
		});
	}
};
