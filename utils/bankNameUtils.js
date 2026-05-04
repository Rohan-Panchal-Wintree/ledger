const BANK_NAME_ALIASES = new Map([
  ["NEWPAYTENTLY", "PAYTENTLY"],
  ["PAYTENTLY", "PAYTENTLY"],
]);

const normalizeBaseBankName = (value) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

export const canonicalizeBankName = (value) => {
  const normalized = normalizeBaseBankName(value);
  return BANK_NAME_ALIASES.get(normalized) || normalized;
};

export const isSameBankName = (left, right) =>
  canonicalizeBankName(left) === canonicalizeBankName(right);
