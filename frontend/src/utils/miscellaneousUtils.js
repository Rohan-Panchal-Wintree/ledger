import { formatDate, safeNumber } from "./appUtils";

export const miscellaneousInitialForm = {
  entryType: "",
  paymentSheetDate: "",
  paymentSheetDateLabel: "",
  bankLabel: "",
  merchantName: "",
  merchantId: "",
  merchantMappingId: "",
  mid: "",
  startDate: "",
  endDate: "",
  processingCurrency: "",
  amountPaid: "",
  rate: "1",
  settlementCurrency: "USD",
  settlementAmount: "",
  notes: "",
};

export function validateMiscellaneousForm(form) {
  if (!form.entryType) return "Please select entry type.";
  if (!form.paymentSheetDate) return "Please select payment sheet date.";
  if (!form.merchantName && !form.merchantId) return "Please enter merchant.";
  if (!form.amountPaid) return "Please enter processing amount.";

  const rate = Number(form.rate);

  if (!form.rate || Number.isNaN(rate) || rate <= 0) {
    return "Rate must be a positive number.";
  }

  if (!form.settlementCurrency) return "Please enter settlement currency.";
  if (!form.settlementAmount) return "Please enter settlement amount.";

  return "";
}

export function buildMiscellaneousPayload(form) {
  return {
    entryType: form.entryType,
    paymentSheetDate: form.paymentSheetDate,
    paymentSheetDateLabel: form.paymentSheetDateLabel,
    bankLabel: form.bankLabel,
    merchantName: form.merchantName,
    merchantId: form.merchantId || undefined,
    merchantMappingId: form.merchantMappingId || undefined,
    mid: form.mid,
    startDate: form.startDate || undefined,
    endDate: form.endDate || undefined,
    processingCurrency: form.processingCurrency,
    amountPaid: safeNumber(form.amountPaid),
    rate: safeNumber(form.rate, 1),
    settlementCurrency: form.settlementCurrency,
    settlementAmount: safeNumber(form.settlementAmount),
    notes: form.notes,
  };
}

export function mapMiscellaneousEntryToForm(entry) {
  return {
    entryType: entry.entryType || "",
    paymentSheetDate: entry.paymentSheetDate
      ? formatDate(entry.paymentSheetDate)
      : "",
    paymentSheetDateLabel: entry.paymentSheetDateLabel || "",
    bankLabel: entry.bankLabel || "",
    merchantName: entry.merchantDisplayName || entry.merchantName || "",
    merchantId: entry.merchantId?._id || entry.merchantId || "",
    merchantMappingId:
      entry.merchantMappingId?._id || entry.merchantMappingId || "",
    mid: entry.linkedMid || entry.mid || "",
    startDate: entry.startDate
      ? new Date(entry.startDate).toISOString().slice(0, 16)
      : "",
    endDate: entry.endDate
      ? new Date(entry.endDate).toISOString().slice(0, 16)
      : "",
    processingCurrency: entry.processingCurrency || "",
    amountPaid: entry.amountPaid ?? "",
    rate: entry.rate ?? "1",
    settlementCurrency: entry.settlementCurrency || "USD",
    settlementAmount: entry.settlementAmount ?? "",
    notes: entry.notes || "",
  };
}

export function filterMiscellaneousEntries(entries, searchQuery) {
  const query = searchQuery.trim().toLowerCase();

  if (!query) return entries;

  return entries.filter((entry) => {
    const values = [
      entry.entryTypeLabel,
      entry.entryType,
      entry.merchantDisplayName,
      entry.merchantName,
      entry.bankLabel,
      entry.linkedMid,
      entry.mid,
      entry.processingCurrency,
      entry.settlementCurrency,
      entry.paymentSheetDateLabel,
      entry.notes,
    ]
      .filter(Boolean)
      .map((value) => String(value).toLowerCase());

    return values.some((value) => value.includes(query));
  });
}

export function getMiscellaneousSummary(entries) {
  return entries.reduce(
    (acc, entry) => {
      acc.totalEntries += 1;
      acc.totalAmountPaid += safeNumber(entry.amountPaid);
      acc.totalSettlementAmount += safeNumber(entry.settlementAmount);
      return acc;
    },
    {
      totalEntries: 0,
      totalAmountPaid: 0,
      totalSettlementAmount: 0,
    },
  );
}
