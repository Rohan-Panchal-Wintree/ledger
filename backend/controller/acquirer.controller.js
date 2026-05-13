import { Acquirer } from "../models/acquirer.model.js";

// LIST
export const listAcquirers = async (req, res) => {
	const { page = 1, limit = 10, search = "" } = req.query;

	const query = search ? { name: { $regex: search, $options: "i" } } : {};

	const skip = (page - 1) * limit;

	const [data, total] = await Promise.all([
		Acquirer.find(query)
			.sort({ createdAt: -1 })
			.skip(skip)
			.limit(Number(limit))
			.lean(),
		Acquirer.countDocuments(query),
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
export const createAcquirer = async (req, res) => {
	const name = req.body.name.trim();

	const existing = await Acquirer.findOne({ name });

	if (existing) {
		return res.status(409).json({
			success: false,
			message: "Acquirer already exists",
		});
	}

	const acquirer = await Acquirer.create({ name });

	res.status(201).json({
		success: true,
		data: acquirer,
	});
};

// UPDATE
export const updateAcquirer = async (req, res) => {
	const acquirer = await Acquirer.findByIdAndUpdate(req.params.id, req.body, {
		new: true,
		runValidators: true,
	});

	if (!acquirer) {
		return res.status(404).json({
			success: false,
			message: "Acquirer not found",
		});
	}

	res.json({
		success: true,
		data: acquirer,
	});
};

// DELETE
export const deleteAcquirer = async (req, res) => {
	const acquirer = await Acquirer.findByIdAndDelete(req.params.id);

	if (!acquirer) {
		return res.status(404).json({
			success: false,
			message: "Acquirer not found",
		});
	}

	res.json({
		success: true,
		message: "Acquirer deleted",
	});
};
