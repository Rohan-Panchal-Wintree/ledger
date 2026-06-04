import { DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import s3 from "../utils/s3Client.js";

import { SettlementUpload } from "../models/settlement-upload.model.js";

const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME;

const startOfDate = (value) => {
	const date = new Date(value);

	date.setUTCHours(0, 0, 0, 0);

	return date;
};

const endOfDate = (value) => {
	const date = new Date(value);

	date.setUTCHours(23, 59, 59, 999);

	return date;
};

const getPagination = (query) => {
	const page = Math.max(Number(query.page) || 1, 1);

	const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);

	const skip = (page - 1) * limit;

	return { page, limit, skip };
};

const buildUploadQuery = ({ type, fromDate, toDate }) => {
	const query = {
		type,
	};

	if (fromDate || toDate) {
		query.createdAt = {};

		if (fromDate) {
			query.createdAt.$gte = startOfDate(fromDate);
		}

		if (toDate) {
			query.createdAt.$lte = endOfDate(toDate);
		}
	}

	return query;
};

/*
|--------------------------------------------------------------------------
| Upload Settlement Files
|--------------------------------------------------------------------------
*/

export const uploadSettlementFiles = async (req, res) => {
	const files = req.files || [];

	if (!files.length) {
		return res.status(400).json({
			success: false,
			message: "At least one file is required",
		});
	}

	const docs = await SettlementUpload.insertMany(
		files.map((file) => ({
			type: req.uploadType,

			fileName: file.originalname,

			s3Key: file.key,

			fileUrl: file.location,

			mimeType: file.mimetype,

			size: file.size,

			uploadedBy: req.user._id,
		})),
	);

	return res.status(201).json({
		success: true,

		message: "Settlement files uploaded successfully",

		data: docs,
	});
};

/*
|--------------------------------------------------------------------------
| List Settlement Uploads
|--------------------------------------------------------------------------
*/

export const listSettlementUploads = async (req, res) => {
	const { fromDate, toDate } = req.query;

	const { page, limit, skip } = getPagination(req.query);

	const query = buildUploadQuery({
		type: req.uploadType,
		fromDate,
		toDate,
	});

	const [data, total] = await Promise.all([
		SettlementUpload.find(query)
			.populate("uploadedBy", "name email")
			.sort({ createdAt: -1 })
			.skip(skip)
			.limit(limit)
			.lean(),

		SettlementUpload.countDocuments(query),
	]);

	return res.json({
		success: true,

		data: data.map((item) => ({
			id: item._id,

			type: item.type,

			fileName: item.fileName,

			fileUrl: item.fileUrl,

			s3Key: item.s3Key,

			mimeType: item.mimeType,

			size: item.size,

			uploadedAt: item.createdAt,

			uploadedBy: item.uploadedBy
				? {
						id: item.uploadedBy._id,
						name: item.uploadedBy.name,
						email: item.uploadedBy.email,
					}
				: null,
		})),

		meta: {
			total,
			page,
			limit,
			totalPages: Math.ceil(total / limit),
		},
	});
};

/*
|--------------------------------------------------------------------------
| Generate Download Link
|--------------------------------------------------------------------------
*/

export const generateSettlementDownloadLink = async (req, res) => {
	const upload = await SettlementUpload.findById(req.params.id).lean();

	if (!upload) {
		return res.status(404).json({
			success: false,
			message: "Upload not found",
		});
	}

	const command = new GetObjectCommand({
		Bucket: S3_BUCKET_NAME,

		Key: upload.s3Key,

		ResponseContentDisposition: `attachment; filename="${upload.fileName}"`,
	});

	const downloadUrl = await getSignedUrl(s3, command, {
		expiresIn: 60,
	});

	return res.json({
		success: true,

		data: {
			downloadUrl,
		},
	});
};

/*
|--------------------------------------------------------------------------
| Delete Settlement Upload
|--------------------------------------------------------------------------
*/

export const deleteSettlementUpload = async (req, res) => {
	const upload = await SettlementUpload.findById(req.params.id);

	if (!upload) {
		return res.status(404).json({
			success: false,
			message: "Upload not found",
		});
	}

	await s3.send(
		new DeleteObjectCommand({
			Bucket: S3_BUCKET_NAME,

			Key: upload.s3Key,
		}),
	);

	await SettlementUpload.deleteOne({
		_id: upload._id,
	});

	return res.json({
		success: true,

		message: "Settlement upload deleted successfully",
	});
};
