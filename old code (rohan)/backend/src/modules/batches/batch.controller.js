import { SettlementBatch } from "./batch.model.js";
import { ApiError } from "../../utils/ApiError.js";

export const listBatches = async (_req, res) => {
	const data = await SettlementBatch.find()
		.populate("acquirerId", "name")
		.sort({ createdAt: -1 })
		.lean();
	res.json({ success: true, data });
};

export const getBatch = async (req, res) => {
	const data = await SettlementBatch.findById(req.params.id)
		.populate("acquirerId", "name")
		.lean();
	if (!data) throw new ApiError(404, "Batch not found");
	res.json({ success: true, data });
};
