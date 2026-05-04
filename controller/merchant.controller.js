import { Merchant } from "../models/merchant.model.js";

// LIST (with pagination + search)
export const listMerchants = async (req, res) => {
	const { page = 1, limit = 10, search = "" } = req.query;

	const query = search
		? { merchantName: { $regex: search, $options: "i" } }
		: {};

	const skip = (page - 1) * limit;

	const [data, total] = await Promise.all([
		Merchant.find(query)
			.sort({ createdAt: -1 })
			.skip(skip)
			.limit(Number(limit))
			.lean(),
		Merchant.countDocuments(query),
	]);

	res.json({
		success: true,
		data,
		meta: {
			total,
			page: Number(page),
			limit: Number(limit),
			totalPages: Math.ceil(total / limit),
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
