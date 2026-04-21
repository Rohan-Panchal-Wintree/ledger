import { MerchantAccount } from "./merchant-account.model.js";
import { ApiError } from "../../utils/ApiError.js";

export const listMerchantAccounts = async (_req, res) => {
	const data = await MerchantAccount.find()
		.populate("merchantId", "merchantName")
		.populate("acquirerId", "name")
		.sort({ createdAt: -1 })
		.lean();

	res.json({ success: true, data });
};

export const createMerchantAccount = async (req, res) => {
	const data = await MerchantAccount.create(req.body);
	res.status(201).json({ success: true, data });
};

export const updateMerchantAccount = async (req, res) => {
	const data = await MerchantAccount.findByIdAndUpdate(
		req.params.id,
		req.body,
		{
			new: true,
			runValidators: true,
		},
	);

	if (!data) throw new ApiError(404, "Merchant account not found");
	res.json({ success: true, data });
};
