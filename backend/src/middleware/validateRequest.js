import { ApiError } from "../utils/ApiError.js";

export const validateRequest =
	(schema, source = "body") =>
	(req, _res, next) => {
		const result = schema.safeParse(req[source]);

		if (!result.success) {
			return next(
				new ApiError(400, "Validation failed", result.error.flatten()),
			);
		}

		if (source === "query" || source === "params") {
			Object.keys(req[source]).forEach((key) => {
				delete req[source][key];
			});
			Object.assign(req[source], result.data);
		} else {
			req[source] = result.data;
		}

		next();
	};
