import "dotenv/config";
import mongoose from "mongoose";

import { consumeSettlementEmailJobs } from "../utils/rabbitmq.js";
import { MerchantSettlementReport } from "../models/merchant-settlement-report.model.js";

import {
	buildSettlementExcelBuffer,
	buildSettlementPdfBuffer,
	sendMailWithAttachments,
} from "../controller/merchant-settlement.controller.js";

const cleanText = (value) =>
	String(value || "")
		.replace(/^'+/g, "")
		.replace(/\s+/g, " ")
		.trim();

const slugify = (value) =>
	cleanText(value)
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");

const connectMongoIfNeeded = async () => {
	if (mongoose.connection.readyState === 1) return;

	await mongoose.connect(process.env.MONGO_URI);

	console.log("Settlement email worker MongoDB connected");
};

const processSettlementEmailJob = async ({ reportId }) => {
	await connectMongoIfNeeded();

	const report = await MerchantSettlementReport.findById(reportId);

	if (!report || report.emailStatus === "sent") return;

	report.emailStatus = "sending";
	report.emailError = "";
	await report.save();

	try {
		const reportObject = report.toObject();

		const recipients = report.emailRecipients || [];

		const to =
			recipients.length > 0
				? recipients.map((item) => item.email).filter(Boolean)
				: String(report.emailTo || "")
						.split(",")
						.map((item) => item.trim())
						.filter(Boolean);

		if (!to.length) {
			report.emailStatus = "failed";
			report.emailError = "No merchant email recipients found";
			await report.save();
			return;
		}

		const [excelBuffer, pdfBuffer] = await Promise.all([
			buildSettlementExcelBuffer(reportObject),
			buildSettlementPdfBuffer(reportObject),
		]);

		const baseFileName = `${slugify(report.merchantName)}-${report.memberId}-settlement`;

		await sendMailWithAttachments({
			to,
			subject: `Settlement Report - ${report.merchantName} - ${report.memberId}`,
			html: `
				<p>Dear Merchant,</p>
				<p>Please find attached your settlement report.</p>
				<p>Attached files:</p>
				<ul>
					<li>Settlement PDF Summary</li>
					<li>Settlement Excel Transaction List</li>
				</ul>
				<p>Regards,<br/>Settlement Team</p>
			`,
			attachments: [
				{
					filename: `${baseFileName}.pdf`,
					content: pdfBuffer,
					contentType: "application/pdf",
				},
				{
					filename: `${baseFileName}.xlsx`,
					content: excelBuffer,
					contentType:
						"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
				},
			],
		});

		report.emailStatus = "sent";
		report.emailSentAt = new Date();
		report.emailTo = to.join(",");
		report.emailError = "";

		await report.save();

		console.log(`Settlement email sent for report ${reportId}`);
	} catch (error) {
		report.emailStatus = "failed";
		report.emailError = error.message;
		await report.save();

		throw error;
	}
};

await connectMongoIfNeeded();
await consumeSettlementEmailJobs(processSettlementEmailJob);
