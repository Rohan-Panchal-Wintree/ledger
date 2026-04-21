import { mailTransporter } from "../config/mail.js";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";
import { ApiError } from "../utils/ApiError.js";

export const sendOtpEmail = async (email, otp) => {
	if (env.OTP_DELIVERY_MODE === "console") {
		logger.warn(
			{ email, otp },
			"OTP delivery mode is console. Use this OTP for local testing",
		);
		return;
	}

	try {
		await mailTransporter.sendMail({
			from: `"WintreeTech Support" <${process.env.SMTP_USER}>`,
			to: email,
			subject: "Your settlement portal login OTP",
			text: `Your OTP is ${otp}. It expires in 5 minutes.`,
			html: `<p>Your OTP is <strong>${otp}</strong>.</p><p>It expires in 5 minutes.</p>`,
		});
	} catch (error) {
		logger.error({ error, email }, "Failed to send OTP email");
		throw new ApiError(502, "OTP generated but email delivery failed");
	}
};
