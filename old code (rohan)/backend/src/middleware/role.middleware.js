import { ApiError } from "../utils/ApiError.js";

export const roleMiddleware =
	(roles = []) =>
	(req, _res, next) => {
		if (!req.user || !roles.includes(req.user.role)) {
			return next(new ApiError(403, "Insufficient permissions"));
		}

		next();
	};
