export const roundMoney = (value) => {
	const parsed = Number(value);
	if (!Number.isFinite(parsed)) return 0;
	return Math.round((parsed + Number.EPSILON) * 100) / 100;
};

export const derivePaymentMethod = (currency = "") => {
	const c = String(currency || "")
		.trim()
		.toUpperCase();

	if (c === "USD" || c === "USDT") return "CRYPTO";
	if (c === "EUR") return "WIRE";

	return "UNKNOWN";
};

export const deriveSettlementStatus = ({ payable, paid }) => {
	const normalizedPayable = roundMoney(payable);
	const normalizedPaid = roundMoney(paid);

	if (normalizedPaid === 0) return "pending";

	if (normalizedPaid < normalizedPayable) return "partially_paid";

	return "settled";
};
