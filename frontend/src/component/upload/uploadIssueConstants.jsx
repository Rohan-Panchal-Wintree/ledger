export const uploadIssueColumns = [
  { key: "status", label: "Status" },
  { key: "issue", label: "Issue" },
  { key: "bank", label: "Bank" },
  { key: "merchant", label: "Merchant" },
  { key: "mid", label: "MID" },
  { key: "period", label: "Period" },
  { key: "paymentDate", label: "Payment Date" },
  { key: "currency", label: "Currency" },
  { key: "amount", label: "Amount", align: "right" },
  { key: "settlement", label: "Settlement", align: "right" },
  { key: "actions", label: "Actions", align: "right" },
];

export function getIssueReason(row = {}) {
  if (row.failureReason) return row.failureReason.replaceAll("_", " ");
  if (row.issueReason) return row.issueReason;
  if (row.errorMessage) return row.errorMessage;
  if (row.validationError) return row.validationError;
  if (row.invalidReason) return row.invalidReason;

  if (!row.merchantName) return "Merchant name missing";
  if (!row.sourceMid) return "MID missing";
  if (!row.paymentBank) return "Bank missing";
  if (!row.sourceProcessingCurrency) return "Processing currency missing";
  if (!row.settlementCurrency) return "Settlement currency missing";

  return "Needs review";
}

export function getStatus(row = {}) {
  return row.status || "unknown";
}

export function getBank(row = {}) {
  return row.paymentBank || "-";
}

export function getMerchantName(row = {}) {
  return row.merchantName || "-";
}

export function getMid(row = {}) {
  return row.sourceMid || "-";
}

export function getSourcePeriod(row = {}) {
  return {
    startDate: row.sourceStartDate || null,
    endDate: row.sourceEndDate || null,
  };
}

export function getPaymentDate(row = {}) {
  return row.paymentDate || row.paidToMerchantDate || null;
}

export function getCurrency(row = {}) {
  return row.sourceProcessingCurrency || "-";
}

export function getAmount(row = {}) {
  return row.amountPaid || 0;
}

export function getSettlement(row = {}) {
  return {
    currency: row.settlementCurrency || "-",
    amount: row.settlementAmount || 0,
  };
}

export function canEditIssueRow(row = {}) {
  return row.status === "invalid";
}
