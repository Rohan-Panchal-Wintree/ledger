import multer from "multer";
import multerS3 from "multer-s3";
import s3 from "../utils/s3Client.js";

const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME;

const getFolderByType = (type) => {
	if (type === "wiresheet") return "wiresheets";
	if (type === "payment_sheet") return "payment-sheets";

	return "others";
};

const settlementUpload = multer({
	storage: multerS3({
		s3,
		bucket: S3_BUCKET_NAME,
		contentType: multerS3.AUTO_CONTENT_TYPE,
		acl: "private",

		key: (req, file, cb) => {
			try {
				const type = req.uploadType;
				const folder = getFolderByType(type);

				const safeFileName = file.originalname.replace(/\s+/g, "_");

				const uniqueName = `${Date.now()}-${safeFileName}`;

				const keyPath = `settlement-uploads/${folder}/${uniqueName}`;

				cb(null, keyPath);
			} catch (error) {
				cb(error);
			}
		},
	}),

	limits: {
		fileSize: 100 * 1024 * 1024,
		files: 10,
	},
});

export default settlementUpload;
