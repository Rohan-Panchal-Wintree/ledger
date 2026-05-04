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

export const sendOtpEmail = async (email, otp) => {
	try {
		await mailTransporter.sendMail({
			from: `"WintreeTech Support" <${process.env.SMTP_USER}>`,
			to: email,
			subject: "Your settlement portal login OTP",
			text: `Your OTP is ${otp}. It expires in 5 minutes.`,
			html: `<p>Your OTP is <strong>${otp}</strong>.</p><p>It expires in 5 minutes.</p>`,
		});
	} catch (error) {
		throw new ApiError(502, "OTP generated but email delivery failed");
	}
};
