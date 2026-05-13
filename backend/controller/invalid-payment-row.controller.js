import { InvalidPaymentRow } from "../models/invalid-payment-row.model.js";
import { derivePaymentMethod, roundMoney } from "../utils/currencyUtils.js";

export const listInvalidPaymentRows = async (req, res) => {
  const {
    // status = "pending_fix",
    status,
    paymentSheetDate,
    fileName,
    page = 1,
    limit = 20,
  } = req.query;

  const query = {};

  if (status) {
    query.status = status;
  } else {
    query.status = { $in: ["pending_fix", "fixed"] };
  }
  if (fileName) query.sourceOriginalFilename = fileName;

  if (paymentSheetDate) {
    const start = new Date(paymentSheetDate);
    start.setUTCHours(0, 0, 0, 0);

    const end = new Date(paymentSheetDate);
    end.setUTCHours(23, 59, 59, 999);

    query.paymentSheetDate = { $gte: start, $lte: end };
  }

  const skip = (Number(page) - 1) * Number(limit);

  const [data, total] = await Promise.all([
    InvalidPaymentRow.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    InvalidPaymentRow.countDocuments(query),
  ]);

  return res.json({
    success: true,
    data,
    meta: {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)),
    },
  });
};

export const getInvalidPaymentRow = async (req, res) => {
  const data = await InvalidPaymentRow.findById(req.params.id).lean();

  if (!data) {
    return res.status(404).json({
      success: false,
      message: "Invalid payment row not found",
    });
  }

  return res.json({
    success: true,
    data,
  });
};

export const updateInvalidPaymentRow = async (req, res) => {
  const row = await InvalidPaymentRow.findById(req.params.id);

  if (!row) {
    return res.status(404).json({
      success: false,
      message: "Invalid payment row not found",
    });
  }

  row.fixedData = {
    ...(row.fixedData || {}),
    ...req.body,
  };

  row.status = "fixed";
  row.fixedBy = req.user._id;

  await row.save();

  return res.json({
    success: true,
    data: row,
  });
};

export const deleteInvalidPaymentRow = async (req, res) => {
  const data = await InvalidPaymentRow.findByIdAndDelete(req.params.id);

  if (!data) {
    return res.status(404).json({
      success: false,
      message: "Invalid payment row not found",
    });
  }

  return res.json({
    success: true,
    message: "Invalid payment row deleted",
  });
};
