import mongoose from "mongoose";
import { DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import s3 from "../utils/s3Client.js";
import { Payment } from "../models/payment.model.js";
import { UnmatchedPayment } from "../models/unmatchedPayment.model.js";
import { Wiresheet } from "../models/wiresheet.model.js";
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

const toDateKey = (value) => {
	if (!value) return null;

	const date = new Date(value);

	if (Number.isNaN(date.getTime())) return null;

	return date.toISOString().slice(0, 10);
};

const addUtcDay = (date) => {
	const nextDate = new Date(date);

	nextDate.setUTCDate(nextDate.getUTCDate() + 1);

	return nextDate;
};

const buildDateFilter = ({ fromDate, toDate }) => {
	if (!fromDate && !toDate) return {};

	const filter = {};

	if (fromDate) {
		filter.$gte = startOfDate(fromDate);
	}

	if (toDate) {
		filter.$lte = endOfDate(toDate);
	}

	return filter;
};

const buildWiresheetPeriodFilter = ({ fromDate, toDate }) => {
	if (!fromDate && !toDate) return {};

	const filter = {};

	if (fromDate && toDate) {
		filter.startDate = { $lte: endOfDate(toDate) };
		filter.endDate = { $gte: startOfDate(fromDate) };

		return filter;
	}

	if (fromDate) {
		filter.endDate = { $gte: startOfDate(fromDate) };
	}

	if (toDate) {
		filter.startDate = { $lte: endOfDate(toDate) };
	}

	return filter;
};

const getMatchedWiresheetPeriod = ({ item, fromDate, toDate }) => {
	const itemStartDate = item.startDate ? startOfDate(item.startDate) : null;
	const itemEndDate = item.endDate ? endOfDate(item.endDate) : null;

	if (!itemStartDate || !itemEndDate) {
		return {
			matchedStartDate: null,
			matchedEndDate: null,
			matchedDates: [],
		};
	}

	const filterStartDate = fromDate ? startOfDate(fromDate) : itemStartDate;
	const filterEndDate = toDate ? endOfDate(toDate) : itemEndDate;

	const matchedStartDate =
		itemStartDate > filterStartDate ? itemStartDate : filterStartDate;

	const matchedEndDate =
		itemEndDate < filterEndDate ? itemEndDate : filterEndDate;

	if (matchedStartDate > matchedEndDate) {
		return {
			matchedStartDate: null,
			matchedEndDate: null,
			matchedDates: [],
		};
	}

	const matchedDates = [];

	for (
		let currentDate = startOfDate(matchedStartDate);
		currentDate <= matchedEndDate;
		currentDate = addUtcDay(currentDate)
	) {
		matchedDates.push(toDateKey(currentDate));
	}

	return {
		matchedStartDate: toDateKey(matchedStartDate),
		matchedEndDate: toDateKey(matchedEndDate),
		matchedDates,
	};
};

const getPagination = (query) => {
	const page = Math.max(Number(query.page) || 1, 1);
	const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
	const skip = (page - 1) * limit;

	return { page, limit, skip };
};

/*
|--------------------------------------------------------------------------
| WIRESHEET UPLOAD HISTORY
|--------------------------------------------------------------------------
*/

export const listWiresheetUploads = async (req, res) => {
	const { fromDate, toDate } = req.query;
	const { page, limit, skip } = getPagination(req.query);

	const uploadQuery = { type: "wiresheet" };

	const createdAtFilter = buildDateFilter({ fromDate, toDate });

	if (Object.keys(createdAtFilter).length) {
		uploadQuery.createdAt = createdAtFilter;
	}

	const [uploads, total] = await Promise.all([
		SettlementUpload.find(uploadQuery)
			.populate("uploadedBy", "name email")
			.populate({
				path: "wiresheetId",
				populate: {
					path: "acquirerId",
					select: "name",
				},
			})
			.sort({ createdAt: -1 })
			.skip(skip)
			.limit(limit)
			.lean(),

		SettlementUpload.countDocuments(uploadQuery),
	]);

	return res.json({
		success: true,

		data: uploads.map((upload) => {
			const matchedWiresheet = upload.wiresheetId || null;

			const matchedPeriod = matchedWiresheet
				? getMatchedWiresheetPeriod({
						item: matchedWiresheet,
						fromDate,
						toDate,
					})
				: {
						matchedStartDate: null,
						matchedEndDate: null,
						matchedDates: [],
					};

			return {
				id: upload._id,
				wiresheetUploadId: upload._id,

				type: upload.type,
				fileName: upload.fileName,
				s3Key: upload.s3Key,
				mimeType: upload.mimeType,
				size: upload.size,

				uploadedAt: upload.createdAt,
				uploadedBy: upload.uploadedBy
					? {
							id: upload.uploadedBy._id,
							name: upload.uploadedBy.name,
							email: upload.uploadedBy.email,
						}
					: null,

				wiresheetId: matchedWiresheet?._id || null,
				wiresheetName: matchedWiresheet?.wiresheetName || upload.fileName,
				acquirerName: matchedWiresheet?.acquirerId?.name || "",

				startDate: matchedWiresheet?.startDate || null,
				endDate: matchedWiresheet?.endDate || null,

				matchedStartDate: matchedPeriod.matchedStartDate,
				matchedEndDate: matchedPeriod.matchedEndDate,
				matchedDates: matchedPeriod.matchedDates,

				totalPayable: matchedWiresheet?.totalPayable || 0,
				totalPaid: matchedWiresheet?.totalPaid || 0,
				totalBalance: matchedWiresheet?.totalBalance || 0,
				status: matchedWiresheet?.status || "uploaded",
			};
		}),

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
| PAYMENT SHEET UPLOAD HISTORY
|--------------------------------------------------------------------------
*/

export const listPaymentSheetUploads = async (req, res) => {
	const { fromDate, toDate } = req.query;
	const { page, limit, skip } = getPagination(req.query);

	const uploadQuery = { type: "payment_sheet" };

	const createdAtFilter = buildDateFilter({ fromDate, toDate });

	if (Object.keys(createdAtFilter).length) {
		uploadQuery.createdAt = createdAtFilter;
	}

	const [uploads, total] = await Promise.all([
		SettlementUpload.find(uploadQuery)
			.populate("uploadedBy", "name email")
			.sort({ createdAt: -1 })
			.skip(skip)
			.limit(limit)
			.lean(),

		SettlementUpload.countDocuments(uploadQuery),
	]);

	const fileNames = uploads.map((item) => item.fileName);

	const paymentUploads = await Payment.aggregate([
		{
			$match: {
				sourceOriginalFilename: { $in: fileNames },
			},
		},
		{
			$group: {
				_id: "$sourceOriginalFilename",
				uploadedAt: { $max: "$createdAt" },
				successfulPayments: { $sum: 1 },
				totalPaid: { $sum: "$amountPaid" },
				totalSettlement: { $sum: "$settlementAmount" },
				paymentDates: {
					$addToSet: {
						$dateToString: {
							format: "%Y-%m-%d",
							date: "$paidToMerchantDate",
						},
					},
				},
			},
		},
	]);

	const unmatchedUploads = await UnmatchedPayment.aggregate([
		{
			$match: {
				originalFilename: { $in: fileNames },
			},
		},
		{
			$group: {
				_id: "$originalFilename",
				uploadedAt: { $max: "$createdAt" },
				invalidCount: {
					$sum: {
						$cond: [{ $eq: ["$status", "invalid"] }, 1, 0],
					},
				},
				unmatchedCount: {
					$sum: {
						$cond: [{ $eq: ["$status", "unmatched"] }, 1, 0],
					},
				},
				paymentDates: {
					$addToSet: {
						$dateToString: {
							format: "%Y-%m-%d",
							date: "$paidToMerchantDate",
						},
					},
				},
			},
		},
	]);

	const paymentMap = new Map(paymentUploads.map((item) => [item._id, item]));

	const unmatchedMap = new Map(
		unmatchedUploads.map((item) => [item._id, item]),
	);

	return res.json({
		success: true,

		data: uploads.map((upload) => {
			const paymentData = paymentMap.get(upload.fileName);
			const unmatchedData = unmatchedMap.get(upload.fileName);

			const successfulPayments = paymentData?.successfulPayments || 0;
			const invalidCount = unmatchedData?.invalidCount || 0;
			const unmatchedCount = unmatchedData?.unmatchedCount || 0;

			const paymentDates = [
				...(paymentData?.paymentDates || []),
				...(unmatchedData?.paymentDates || []),
			].filter(Boolean);

			return {
				id: upload._id,
				paymentsheetId: upload._id,

				type: upload.type,
				fileName: upload.fileName,
				s3Key: upload.s3Key,
				mimeType: upload.mimeType,
				size: upload.size,

				uploadedAt: upload.createdAt,
				uploadedBy: upload.uploadedBy
					? {
							id: upload.uploadedBy._id,
							name: upload.uploadedBy.name,
							email: upload.uploadedBy.email,
						}
					: null,

				paymentDate: paymentDates[0] || null,
				paymentDates: [...new Set(paymentDates)],

				successfulPayments,
				invalidCount,
				unmatchedCount,
				totalRows: successfulPayments + invalidCount + unmatchedCount,

				totalPaid: paymentData?.totalPaid || 0,
				totalSettlement: paymentData?.totalSettlement || 0,
			};
		}),

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
			message: "Upload file not found",
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
			fileName: upload.fileName,
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
			message: "Upload file not found",
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
		message: "Uploaded file deleted successfully",
	});
};
