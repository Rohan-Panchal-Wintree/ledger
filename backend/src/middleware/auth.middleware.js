import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../modules/users/user.model.js";

export const authMiddleware = async (req, _res, next) => {
	try {
		const header = req.headers.authorization;
		if (!header?.startsWith("Bearer ")) {
			throw new ApiError(401, "Authentication required");
		}

		const token = header.split(" ")[1];
		const payload = jwt.verify(token, env.JWT_ACCESS_SECRET);
		const user = await User.findById(payload.sub).lean();

		if (!user || !user.isActive) {
			throw new ApiError(401, "User is inactive or missing");
		}

		req.user = user;
		next();
	} catch (error) {
		next(
			error instanceof ApiError
				? error
				: new ApiError(401, "Invalid access token"),
		);
	}
};
