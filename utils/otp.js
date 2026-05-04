const otpStore = new Map();

const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

export const createOtp = async (email) => {
	const otp = String(Math.floor(100000 + Math.random() * 900000));

	otpStore.set(email.toLowerCase(), {
		otp,
		expiresAt: Date.now() + OTP_EXPIRY_MS,
	});

	return otp;
};

export const verifyOtp = async (email, otp) => {
	const key = email.toLowerCase();
	const record = otpStore.get(key);

	if (!record) return false;

	if (Date.now() > record.expiresAt) {
		otpStore.delete(key);
		return false;
	}

	if (record.otp !== otp) {
		return false;
	}

	otpStore.delete(key);
	return true;
};
