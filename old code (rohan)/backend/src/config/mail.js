import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

export const mailTransporter = nodemailer.createTransport({
	host: process.env.SMTP_HOST,
	port: Number(process.env.SMTP_PORT),
	secure: true,
	auth: {
		user: process.env.SMTP_USER,
		pass: process.env.SMTP_PASS,
	},
	tls: {
		rejectUnauthorized: false,
	},
});

export const sendEmail = async (to, subject, html) => {
	try {
		const info = await transporter.sendMail({
			from: `"WintreeTech Support" <${process.env.SMTP_USER}>`,
			to: to,
			subject: subject,
			html: html,
		});

		console.log("Email sent:", info.response);
	} catch (error) {
		console.error("Email error:", error);
		throw error; // important so caller knows it failed
	}
};
