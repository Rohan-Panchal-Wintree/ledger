// Amounts in cents multiplied by rates in basis points need six decimal places.
// Keep that precision until the final currency payable is rounded for payment.
export const moneyUnits = (value) => {
	const amount = Number(value ?? 0);
	const units = Math.round(amount * 1_000_000);
	if (!Number.isFinite(amount) || !Number.isSafeInteger(units)) {
		throw new Error("Invalid or excessive settlement amount.");
	}
	return units;
};

export const preciseMoney = (value) => moneyUnits(value) / 1_000_000;

const fromUnits = (units) => {
	if (units > BigInt(Number.MAX_SAFE_INTEGER) || units < BigInt(Number.MIN_SAFE_INTEGER)) {
		throw new Error("Settlement amount is too large.");
	}
	return Number(units) / 1_000_000;
};

export const sumMoney = (values) => {
	const units = values.reduce((total, value) => total + BigInt(moneyUnits(value)), 0n);
	return fromUnits(units);
};

export const calculateMdr = (amount, percent) => {
	const amountCents = Math.round(Number(amount) * 100);
	const basisPoints = Math.round(Number(percent) * 100);
	if (!Number.isSafeInteger(amountCents) || !Number.isSafeInteger(basisPoints) || basisPoints < 0) {
		throw new Error("Invalid MDR amount or rate.");
	}
	return fromUnits(BigInt(amountCents) * BigInt(basisPoints));
};

export const settlementExpenseAmount = (base, percent) => {
	if (base <= 0) return 0;
	const basisPoints = Math.round(Number(percent || 0) * 100);
	if (!Number.isSafeInteger(basisPoints) || basisPoints < 0) throw new Error("Invalid settlement expense rate.");
	// Preserve the existing truncation policy, using the precise expense base.
	return Number(BigInt(moneyUnits(base)) * BigInt(basisPoints) / 100_000_000n) / 100;
};
