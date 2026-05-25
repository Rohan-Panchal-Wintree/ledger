import mongoose from "mongoose";
import { Wiresheet } from "../models/wiresheet.model.js";
import { Payment } from "../models/payment.model.js";
import { UnmatchedPayment } from "../models/unmatchedPayment.model.js";

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

const buildDateFilter = ({ fromDate, toDate }) => {
  if (!fromDate && !toDate) return {};

  const filter = {};

  if (fromDate) filter.$gte = startOfDate(fromDate);
  if (toDate) filter.$lte = endOfDate(toDate);

  return filter;
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

  const createdAtFilter = buildDateFilter({ fromDate, toDate });

  const query = {};

  if (Object.keys(createdAtFilter).length) {
    query.createdAt = createdAtFilter;
  }

  const [data, total] = await Promise.all([
    Wiresheet.find(query)
      .populate("acquirerId", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),

    Wiresheet.countDocuments(query),
  ]);

  return res.json({
    success: true,
    data: data.map((item) => ({
      wiresheetId: item._id,
      wiresheetName: item.wiresheetName,
      acquirerName: item.acquirerId?.name || "",
      startDate: item.startDate,
      endDate: item.endDate,
      totalPayable: item.totalPayable,
      totalPaid: item.totalPaid,
      totalBalance: item.totalBalance,
      status: item.status,
      uploadedAt: item.createdAt,
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
| PAYMENT SHEET UPLOAD HISTORY
|--------------------------------------------------------------------------
*/

export const listPaymentSheetUploads = async (req, res) => {
  const { fromDate, toDate } = req.query;
  const { page, limit, skip } = getPagination(req.query);

  const createdAtFilter = buildDateFilter({ fromDate, toDate });

  const match = {};

  if (Object.keys(createdAtFilter).length) {
    match.createdAt = createdAtFilter;
  }

  const paymentUploads = await Payment.aggregate([
    { $match: match },

    {
      $group: {
        _id: {
          fileName: "$sourceOriginalFilename",
          paymentDate: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$paidToMerchantDate",
            },
          },
          createdBy: "$createdBy",
        },
        uploadedAt: { $max: "$createdAt" },
        successfulPayments: { $sum: 1 },
        totalPaid: { $sum: "$amountPaid" },
        totalSettlement: { $sum: "$settlementAmount" },
      },
    },
  ]);

  const unmatchedUploads = await UnmatchedPayment.aggregate([
    { $match: match },

    {
      $group: {
        _id: {
          fileName: "$originalFilename",
          paymentDate: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$paidToMerchantDate",
            },
          },
          createdBy: "$createdBy",
        },
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
      },
    },
  ]);

  const uploadMap = new Map();

  for (const item of paymentUploads) {
    const key = `${item._id.fileName}|${item._id.paymentDate}|${item._id.createdBy}`;

    uploadMap.set(key, {
      fileName: item._id.fileName || "Unknown file",
      paymentDate: item._id.paymentDate,
      createdBy: item._id.createdBy,
      uploadedAt: item.uploadedAt,
      successfulPayments: item.successfulPayments,
      invalidCount: 0,
      unmatchedCount: 0,
      totalPaid: item.totalPaid,
      totalSettlement: item.totalSettlement,
    });
  }

  for (const item of unmatchedUploads) {
    const key = `${item._id.fileName}|${item._id.paymentDate}|${item._id.createdBy}`;

    const existing = uploadMap.get(key) || {
      fileName: item._id.fileName || "Unknown file",
      paymentDate: item._id.paymentDate,
      createdBy: item._id.createdBy,
      uploadedAt: item.uploadedAt,
      successfulPayments: 0,
      invalidCount: 0,
      unmatchedCount: 0,
      totalPaid: 0,
      totalSettlement: 0,
    };

    existing.invalidCount += item.invalidCount;
    existing.unmatchedCount += item.unmatchedCount;
    existing.uploadedAt =
      new Date(item.uploadedAt) > new Date(existing.uploadedAt)
        ? item.uploadedAt
        : existing.uploadedAt;

    uploadMap.set(key, existing);
  }

  const allRows = [...uploadMap.values()].sort(
    (a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt),
  );

  const paginatedRows = allRows.slice(skip, skip + limit);

  const userIds = [
    ...new Set(
      paginatedRows
        .map((item) => item.createdBy)
        .filter(Boolean)
        .map((id) => id.toString()),
    ),
  ];

  const users = await mongoose
    .model("User")
    .find({ _id: { $in: userIds } }, { name: 1, email: 1 })
    .lean();

  const userMap = new Map(users.map((user) => [user._id.toString(), user]));

  return res.json({
    success: true,
    data: paginatedRows.map((item) => {
      const user = item.createdBy
        ? userMap.get(item.createdBy.toString())
        : null;

      return {
        fileName: item.fileName,
        paymentDate: item.paymentDate,
        uploadedAt: item.uploadedAt,

        successfulPayments: item.successfulPayments,
        invalidCount: item.invalidCount,
        unmatchedCount: item.unmatchedCount,
        totalRows:
          item.successfulPayments + item.invalidCount + item.unmatchedCount,

        totalPaid: item.totalPaid,
        totalSettlement: item.totalSettlement,

        uploadedBy: user
          ? {
              id: user._id,
              name: user.name,
              email: user.email,
            }
          : null,
      };
    }),

    meta: {
      total: allRows.length,
      page,
      limit,
      totalPages: Math.ceil(allRows.length / limit),
    },
  });
};
