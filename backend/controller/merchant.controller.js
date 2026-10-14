import { Merchant } from "../models/merchant.model.js";
import { MerchantAccount } from "../models/merchant-account.model.js";

// LIST (with pagination + search)
export const listMerchants = async (req, res) => {
  const { page = 1, limit = 10, search = "", status = "all" } = req.query;

  const pageNumber = Math.max(1, Number.parseInt(page, 10) || 1);
  const limitNumber = Math.min(
    100,
    Math.max(1, Number.parseInt(limit, 10) || 10),
  );

  const skip = (pageNumber - 1) * limitNumber;

  const searchTerm = String(search).trim();
  const statusFilter = String(status).trim().toLowerCase();

  if (!["all", "active", "inactive"].includes(statusFilter)) {
    return res.status(400).json({
      success: false,
      message: "Invalid merchant status filter.",
    });
  }

  const query = {};

  // Filter the complete dataset by status.
  if (statusFilter !== "all") {
    query.status = statusFilter;
  }

  // Escape regex special characters for literal text search.
  if (searchTerm) {
    const escapedSearch = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const searchRegex = new RegExp(escapedSearch, "i");

    query.$or = [
      { merchantName: searchRegex },
      { merchantTag: searchRegex },
      { status: searchRegex },
    ];
  }

  const [
    data,
    total,
    totalMerchants,
    inactiveMerchantsCount,
    totalAccounts,
    missingAccountAgg,
  ] = await Promise.all([
    Merchant.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNumber)
      .lean(),

    // Total matching the current search and status filter.
    Merchant.countDocuments(query),

    // Global count for the Total Merchants stat card.
    Merchant.countDocuments({}),

    // Global count for the Inactive Merchants stat card.
    Merchant.countDocuments({ status: "inactive" }),

    MerchantAccount.countDocuments({ status: "active" }),

    Merchant.aggregate([
      { $match: query },
      {
        $lookup: {
          from: "merchantaccounts",
          localField: "_id",
          foreignField: "merchantId",
          as: "accounts",
        },
      },
      {
        $match: {
          accounts: { $size: 0 },
        },
      },
      {
        $count: "count",
      },
    ]),
  ]);

  const merchantIds = data.map((merchant) => merchant._id);

  const merchantAccounts = await MerchantAccount.find({
    merchantId: { $in: merchantIds },
  }).lean();

  const accountMap = {};

  merchantAccounts.forEach((account) => {
    const merchantId = account.merchantId.toString();

    if (!accountMap[merchantId]) {
      accountMap[merchantId] = [];
    }

    accountMap[merchantId].push(account);
  });

  const updatedData = data.map((merchant) => {
    const accounts = accountMap[merchant._id.toString()] || [];

    const mids = [
      ...new Set(accounts.map((account) => account.mid).filter(Boolean)),
    ];

    return {
      ...merchant,
      mid: mids.length ? mids.join(", ") : null,
      mids,
      accountCount: accounts.length,
    };
  });

  res.json({
    success: true,
    data: updatedData,
    meta: {
      total,
      page: pageNumber,
      limit: limitNumber,
      totalPages: Math.ceil(total / limitNumber),
      totalMerchants,
      inactiveMerchantsCount,
      totalAccounts,
      missingMidCount: missingAccountAgg[0]?.count || 0,
    },
  });
};

// CREATE
export const createMerchant = async (req, res) => {
  const merchantName = req.body.merchantName.trim();

  const existing = await Merchant.findOne({ merchantName });

  if (existing) {
    return res.status(409).json({
      success: false,
      message: "Merchant already exists",
    });
  }

  const merchant = await Merchant.create({
    merchantName,
    merchantTag: req.body.merchantTag,
    status: req.body.status || "active",
  });

  res.status(201).json({
    success: true,
    data: merchant,
  });
};

// UPDATE
export const updateMerchant = async (req, res) => {
  const merchant = await Merchant.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  if (!merchant) {
    return res.status(404).json({
      success: false,
      message: "Merchant not found",
    });
  }

  res.json({
    success: true,
    data: merchant,
  });
};

// DELETE
export const deleteMerchant = async (req, res) => {
  const merchant = await Merchant.findByIdAndDelete(req.params.id);

  if (!merchant) {
    return res.status(404).json({
      success: false,
      message: "Merchant not found",
    });
  }

  res.json({
    success: true,
    message: "Merchant deleted",
  });
};
