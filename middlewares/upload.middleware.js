import multer from "multer";
const storage = multer.memoryStorage();
import dotenv from "dotenv";
dotenv.config();

const fileFilter = (_req, file, cb) => {
	const allowed =
		file.mimetype.includes("sheet") ||
		file.mimetype.includes("excel") ||
		file.originalname.endsWith(".xlsx") ||
		file.originalname.endsWith(".xls");

	if (!allowed) {
		return cb(new Error("Only Excel files are allowed"), false);
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
