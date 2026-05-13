export const allowedOrigins = [
	"http://localhost:5174",
	"http://localhost:5173",
	"https://crm.wintreetech.com",
	"http://crm.wintreetech.com",
];

// SINGLE VARIABLE MIDDLEWARES
export const asyncHandler = (fn) => {
	return (req, res, next) => {
		Promise.resolve(fn(req, res, next)).catch(next);
	};
};

export const validateRequest =
	(schema, source = "body") =>
	(req, res, next) => {
		const data = req[source] ?? {};

		const result = schema.safeParse(data);

		if (!result.success) {
			return res.status(400).json({
				success: false,
				message: "Validation failed",
				errors: result.error.flatten(),
			});
		}

		req[source] = result.data;
		next();
	};

export const extractBankNameFromFileName = (fileName = "") => {
	const nameWithoutExt = fileName.replace(/\.[^/.]+$/, "").trim();

	const beforeAutomation = nameWithoutExt.split(/automation/i)[0]?.trim();

	return beforeAutomation || nameWithoutExt;
};
