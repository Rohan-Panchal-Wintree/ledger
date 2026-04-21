export const roundMoney = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.round((parsed + Number.EPSILON) * 100) / 100;
};

export const derivePaymentMethod = (settlementCurrency) => {
  if (settlementCurrency === "USD") return "CRYPTO";
  if (settlementCurrency === "EUR") return "WIRE";
  return "UNKNOWN";
};

export const deriveSettlementStatus = ({ payable, paid }) => {
  const normalizedPayable = Number(payable) || 0;
  const normalizedPaid = Number(paid) || 0;

  if (normalizedPaid === 0) return "pending";

  if (normalizedPayable < 0) {
    if (normalizedPaid > 0) return "partially_paid";
    if (Math.abs(normalizedPaid) < Math.abs(normalizedPayable)) {
      return "partially_paid";
    }
    return "settled";
  }

  if (normalizedPaid < normalizedPayable) return "partially_paid";
  return "settled";
};
