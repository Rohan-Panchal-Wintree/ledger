import multer from "multer";
import "dotenv/config";

const storage = multer.memoryStorage();

const fileFilter = (_req, file, cb) => {
	const filename = file.originalname.toLowerCase();

	const allowed =
		file.mimetype.includes("sheet") ||
		file.mimetype.includes("excel") ||
		file.mimetype.includes("csv") ||
		filename.endsWith(".xlsx") ||
		filename.endsWith(".xls") ||
		filename.endsWith(".csv");

	if (!allowed) {
		return cb(new Error("Only Excel and CSV files are allowed"), false);
	}

	cb(null, true);
};

export const uploadMiddleware = multer({
	storage,
	fileFilter,
	limits: {
		fileSize: Number(process.env.MAX_FILE_SIZE_MB || 5) * 1024 * 1024,
	},
});
