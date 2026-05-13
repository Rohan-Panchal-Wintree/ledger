import { MerchantAccount } from "../models/merchant-account.model.js";

// 📥 GET all merchant accounts (for UI / reports)
export const listMerchantAccounts = async (_req, res) => {
	const data = await MerchantAccount.find()
		.populate("merchantId", "merchantName")
		.populate("acquirerId", "name")
		.sort({ createdAt: -1 })
		.lean();

	res.json({
		success: true,
		data,
	});
};

// ❌ OPTIONAL DELETE (only if you want manual cleanup)
export const deleteMerchantAccount = async (req, res) => {
	const data = await MerchantAccount.findByIdAndDelete(req.params.id);

	if (!data) {
		return res.status(404).json({
			success: false,
			message: "Merchant account not found",
		});
	}

	res.json({
		success: true,
		message: "Merchant account deleted",
	});
};
