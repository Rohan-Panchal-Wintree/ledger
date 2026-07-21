import mongoose from "mongoose";
import { DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import s3 from "../utils/s3Client.js";
import { Payment } from "../models/payment.model.js";
import { UnmatchedPayment } from "../models/unmatchedPayment.model.js";
import { Wiresheet } from "../models/wiresheet.model.js";
import { SettlementUpload } from "../models/settlement-upload.model.js";
import { User } from "../models/user.model.js";
import { Acquirer } from "../models/acquirer.model.js";

const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME;

const escapeRegex = (value = "") =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildSearchRegex = (value) => {
  const normalizedValue = String(value || "").trim();

  return normalizedValue ? new RegExp(escapeRegex(normalizedValue), "i") : null;
};

const parseSearchDate = (value) => {
  const normalizedValue = String(value || "").trim();

  if (!normalizedValue) return null;

  let dateValue = normalizedValue;

  const dayFirstMatch = normalizedValue.match(
    /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/,
  );

  if (dayFirstMatch) {
    const [, day, month, year] = dayFirstMatch;

    dateValue = `${year}-${String(month).padStart(2, "0")}-${String(
      day,
    ).padStart(2, "0")}`;
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return {
    $gte: startOfDate(date),
    $lte: endOfDate(date),
  };
};

const getWiresheetSearchUploadQuery = async (search) => {
  const searchRegex = buildSearchRegex(search);

  if (!searchRegex) {
    return [];
  }

  const [matchingAcquirers, matchingUploaders] = await Promise.all([
    Acquirer.find({
      name: searchRegex,
    })
      .select("_id")
      .lean(),

    User.find({
      $or: [{ name: searchRegex }, { email: searchRegex }],
    })
      .select("_id")
      .lean(),
  ]);

  const matchingAcquirerIds = matchingAcquirers.map((item) => item._id);
  const matchingUploaderIds = matchingUploaders.map((item) => item._id);

  const wiresheetSearchConditions = [
    { wiresheetName: searchRegex },
    { status: searchRegex },
  ];

  if (matchingAcquirerIds.length > 0) {
    wiresheetSearchConditions.push({
      acquirerId: {
        $in: matchingAcquirerIds,
      },
    });
  }

  const matchingWiresheets = await Wiresheet.find({
    $or: wiresheetSearchConditions,
  })
    .select("_id")
    .lean();

  const matchingWiresheetIds = matchingWiresheets.map((item) => item._id);

  const uploadConditions = [
    {
      fileName: searchRegex,
    },
  ];

  if (matchingWiresheetIds.length > 0) {
    uploadConditions.push({
      wiresheetId: {
        $in: matchingWiresheetIds,
      },
    });
  }

  if (matchingUploaderIds.length > 0) {
    uploadConditions.push({
      uploadedBy: {
        $in: matchingUploaderIds,
      },
    });
  }

  return uploadConditions;
};

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
  const { fromDate, toDate, search } = req.query;
  const { page, limit, skip } = getPagination(req.query);

  const uploadQuery = {
    type: "wiresheet",
  };

  if (fromDate || toDate) {
    let matchedWiresheetIds = [];

    if (fromDate && toDate) {
      const requestedStart = startOfDate(fromDate);
      const requestedEnd = endOfDate(toDate);

      // Prefer one exact period match.
      const exactWiresheet = await Wiresheet.findOne({
        startDate: requestedStart,
        endDate: requestedEnd,
      })
        .select("_id")
        .lean();

      if (exactWiresheet) {
        matchedWiresheetIds = [exactWiresheet._id];
      } else {
        // Otherwise return every wiresheet overlapping the requested period.
        const overlappingWiresheets = await Wiresheet.find(
          buildWiresheetPeriodFilter({
            fromDate,
            toDate,
          }),
        )
          .select("_id")
          .lean();

        matchedWiresheetIds = overlappingWiresheets.map((item) => item._id);
      }
    } else {
      const matchedWiresheets = await Wiresheet.find(
        buildWiresheetPeriodFilter({
          fromDate,
          toDate,
        }),
      )
        .select("_id")
        .lean();

      matchedWiresheetIds = matchedWiresheets.map((item) => item._id);
    }

    uploadQuery.wiresheetId = {
      $in: matchedWiresheetIds,
    };
  }

  const searchConditions = await getWiresheetSearchUploadQuery(search);

  if (searchConditions.length > 0) {
    uploadQuery.$or = searchConditions;
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

// Helper function
const getPaymentSheetSearchFileNames = async (search) => {
  const searchRegex = buildSearchRegex(search);

  if (!searchRegex) {
    return {
      matchingFileNames: [],
      matchingUploaderIds: [],
    };
  }

  const searchDateRange = parseSearchDate(search);

  const uploaderPromise = User.find({
    $or: [{ name: searchRegex }, { email: searchRegex }],
  })
    .select("_id")
    .lean();

  const paymentFilePromise = searchDateRange
    ? Payment.distinct("sourceOriginalFilename", {
        paidToMerchantDate: searchDateRange,
        sourceOriginalFilename: {
          $nin: [null, ""],
        },
      })
    : Promise.resolve([]);

  const unmatchedFilePromise = searchDateRange
    ? UnmatchedPayment.distinct("originalFilename", {
        paidToMerchantDate: searchDateRange,
        originalFilename: {
          $nin: [null, ""],
        },
      })
    : Promise.resolve([]);

  const [matchingUploaders, paymentFiles, unmatchedFiles] = await Promise.all([
    uploaderPromise,
    paymentFilePromise,
    unmatchedFilePromise,
  ]);

  return {
    matchingFileNames: [...new Set([...paymentFiles, ...unmatchedFiles])],
    matchingUploaderIds: matchingUploaders.map((item) => item._id),
  };
};

// PAYMENT SHEET UPLOAD HISTORY
export const listPaymentSheetUploads = async (req, res) => {
  const { fromDate, toDate, search } = req.query;
  const { page, limit, skip } = getPagination(req.query);

  const uploadQuery = {
    type: "payment_sheet",
  };

  let dateMatchedFileNames = null;

  const paymentDateFilter = buildDateFilter({
    fromDate,
    toDate,
  });

  if (Object.keys(paymentDateFilter).length) {
    const [matchedPaymentFiles, matchedUnmatchedFiles] = await Promise.all([
      Payment.distinct("sourceOriginalFilename", {
        paidToMerchantDate: paymentDateFilter,
        sourceOriginalFilename: {
          $nin: [null, ""],
        },
      }),

      UnmatchedPayment.distinct("originalFilename", {
        paidToMerchantDate: paymentDateFilter,
        originalFilename: {
          $nin: [null, ""],
        },
      }),
    ]);

    dateMatchedFileNames = [
      ...new Set([...matchedPaymentFiles, ...matchedUnmatchedFiles]),
    ];
  }

  const searchRegex = buildSearchRegex(search);

  if (searchRegex) {
    const { matchingFileNames, matchingUploaderIds } =
      await getPaymentSheetSearchFileNames(search);

    const searchConditions = [
      {
        fileName: searchRegex,
      },
    ];

    if (matchingFileNames.length > 0) {
      searchConditions.push({
        fileName: {
          $in: matchingFileNames,
        },
      });
    }

    if (matchingUploaderIds.length > 0) {
      searchConditions.push({
        uploadedBy: {
          $in: matchingUploaderIds,
        },
      });
    }

    uploadQuery.$or = searchConditions;
  }

  if (dateMatchedFileNames) {
    uploadQuery.fileName = {
      $in: dateMatchedFileNames,
    };
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
        sourceOriginalFilename: {
          $in: fileNames,
        },
      },
    },
    {
      $group: {
        _id: "$sourceOriginalFilename",
        uploadedAt: {
          $max: "$createdAt",
        },
        successfulPayments: {
          $sum: 1,
        },
        totalPaid: {
          $sum: "$amountPaid",
        },
        totalSettlement: {
          $sum: "$settlementAmount",
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

  const unmatchedUploads = await UnmatchedPayment.aggregate([
    {
      $match: {
        originalFilename: {
          $in: fileNames,
        },
      },
    },
    {
      $group: {
        _id: "$originalFilename",
        uploadedAt: {
          $max: "$createdAt",
        },
        invalidCount: {
          $sum: {
            $cond: [
              {
                $eq: ["$status", "invalid"],
              },
              1,
              0,
            ],
          },
        },
        unmatchedCount: {
          $sum: {
            $cond: [
              {
                $eq: ["$status", "unmatched"],
              },
              1,
              0,
            ],
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
      ]
        .filter(Boolean)
        .filter((value, index, values) => values.indexOf(value) === index)
        .sort();

      return {
        id: upload._id,
        paymentSheetId: upload._id,

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
        paymentDates,

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
