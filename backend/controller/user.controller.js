import { User } from "../models/user.model.js";
import { MerchantAccount } from "../models/merchant-account.model.js";

const normalizeEmail = (email) => email.toLowerCase().trim();

// Gets the merchant-account from the MID
const resolveMerchantIdFromMid = async (merchantMid) => {
  if (!merchantMid) return null;

  const merchantAccount = await MerchantAccount.findOne({
    mid: merchantMid.trim(),
  })
    .select("_id merchantId mid")
    .lean();

  if (!merchantAccount) return null;

  return merchantAccount;
};

const formatUser = async (user) => {
  const formattedUser = {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    merchantId: user.merchantId || null,
    merchantAccountId: user.merchantAccountId || null,
    merchantMid: "",
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };

  if (user.merchantAccountId) {
    const merchantAccount = await MerchantAccount.findById(
      user.merchantAccountId,
    )
      .select("mid")
      .lean();

    formattedUser.merchantMid = merchantAccount?.mid || "";
  }

  return formattedUser;
};

// GET ALL USERS
export const listUsers = async (_req, res) => {
  const users = await User.find().sort({ createdAt: -1 }).lean();

  const formattedUsers = await Promise.all(users.map(formatUser));

  return res.status(200).json({
    success: true,
    data: formattedUsers,
  });
};

// CREATE SINGLE USER
export const createUser = async (req, res) => {
  const { name, email, role, isActive, merchantMid } = req.body;

  const normalizedEmail = normalizeEmail(email);

  const existingUser = await User.findOne({ email: normalizedEmail }).lean();

  if (existingUser) {
    return res.status(409).json({
      success: false,
      message: "User already exists",
    });
  }

  let merchantId = null;
  let merchantAccountId = null;

  if (role === "merchant") {
    const merchantAccount = await resolveMerchantIdFromMid(merchantMid);

    if (!merchantAccount) {
      return res.status(404).json({
        success: false,
        message: "Merchant MID not found",
      });
    }

    merchantId = merchantAccount.merchantId;
    merchantAccountId = merchantAccount._id;
  }

  const user = await User.create({
    name,
    email: normalizedEmail,
    role,
    isActive: isActive ?? true,
    merchantId,
    merchantAccountId,
  });

  const formattedUser = await formatUser(user.toObject());

  return res.status(201).json({
    success: true,
    message: "User created successfully",
    data: formattedUser,
  });
};

// UPDATE SINGLE USER
export const updateUser = async (req, res) => {
  const { id } = req.params;
  const { name, email, role, isActive, merchantMid } = req.body;

  const updateData = {};

  if (name !== undefined) {
    updateData.name = name;
  }

  if (email !== undefined) {
    updateData.email = normalizeEmail(email);
  }

  if (role !== undefined) {
    updateData.role = role;
  }

  if (isActive !== undefined) {
    updateData.isActive = isActive;
  }

  if (role === "merchant") {
    const merchantAccount = await resolveMerchantIdFromMid(merchantMid);

    if (!merchantAccount) {
      return res.status(404).json({
        success: false,
        message: "Merchant MID not found",
      });
    }

    updateData.merchantId = merchantAccount.merchantId;
    updateData.merchantAccountId = merchantAccount._id;
  }

  if (role && role !== "merchant") {
    updateData.merchantId = null;
    updateData.merchantAccountId = null;
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

  const formattedUser = await formatUser(user.toObject());

  return res.status(200).json({
    success: true,
    message: "User updated successfully",
    data: formattedUser,
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
