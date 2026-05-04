export const roundMoney = (value) => {
	const parsed = Number(value);
	if (!Number.isFinite(parsed)) return 0;
	return Math.round((parsed + Number.EPSILON) * 100) / 100;
};

export const derivePaymentMethod = (currency = "") => {
	const c = currency.toUpperCase();

	if (c === "USD") return "CRYPTO";
	if (c === "EUR") return "WIRE";

	throw new Error(`Unsupported currency: ${currency}`);
};

export const deriveSettlementStatus = ({ payable, paid }) => {
	const normalizedPayable = Number(payable) || 0;
	const normalizedPaid = Number(paid) || 0;

	if (normalizedPaid === 0) return "pending";

	if (normalizedPaid < normalizedPayable) return "partially_paid";

	return "settled";
};
