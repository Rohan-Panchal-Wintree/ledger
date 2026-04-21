import { getLedgerEntries } from "../../services/ledger.service.js";

export const getLedger = async (req, res) => {
	const data = await getLedgerEntries(req.query);
	res.json({ success: true, data });
};
