import { User } from "../models/user.model.js";

// GET ALL USER
export const listUsers = async (_req, res) => {
	const users = await User.find().sort({ createdAt: -1 }).lean();

	return res.status(200).json({
		success: true,
		data: users,
	});
};

// CREATE SINGLE USER
export const createUser = async (req, res) => {
	const { name, email, role, isActive } = req.body;

	const normalizedEmail = email.toLowerCase();

	const existingUser = await User.findOne({ email: normalizedEmail }).lean();

	if (existingUser) {
		return res.status(409).json({
			success: false,
			message: "User already exists",
		});
	}

	const user = await User.create({
		name,
		email: normalizedEmail,
		role,
		isActive,
	});

	return res.status(201).json({
		success: true,
		message: "User created successfully",
		data: user,
	});
};

// UPDATE SINGLE USER
export const updateUser = async (req, res) => {
	const { id } = req.params;
	const updateData = { ...req.body };

	if (updateData.email) {
		updateData.email = updateData.email.toLowerCase();
	}

	const user = await User.findByIdAndUpdate(id, updateData, {
		new: true,
		runValidators: true,
	});

	if (!user) {
		return res.status(404).json({
			success: false,
			message: "User not found",
		});
	}

	return res.status(200).json({
		success: true,
		message: "User updated successfully",
		data: user,
	});
};

// DELETE SINGLE USER
export const deleteUser = async (req, res) => {
	const { id } = req.params;

	const user = await User.findByIdAndDelete(id);

	if (!user) {
		return res.status(404).json({
			success: false,
			message: "User not found",
		});
	}

	return res.status(200).json({
		success: true,
		message: "User deleted successfully",
	});
};
