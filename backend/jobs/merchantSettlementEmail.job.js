import cron from "node-cron";
import { MerchantSettlementReport } from "../models/merchant-settlement-report.model.js";

export const startMerchantSettlementEmailCron = () => {
	cron.schedule("30 18 * * *", async () => {
		const reports = await MerchantSettlementReport.find({
			emailStatus: "draft",
		}).lean();

		for (const report of reports) {
			// TODO: generate PDF buffer
			// TODO: send email to merchant email
			// TODO: attach PDF

			await MerchantSettlementReport.updateOne(
				{ _id: report._id },
				{
					$set: {
						emailStatus: "sent",
						emailSentAt: new Date(),
					},
				},
			);
		}
	});
};
