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
  const isAgentEntry = form.entryType === "agent";

  const amountPaid = Number(form.amountPaid);
  const rate = Number(form.rate);
  const settlementAmount = Number(form.settlementAmount);

  const textOnlyPattern = /^[A-Za-z]+$/;

  if (!form.entryType) return "Please select entry type.";

  if (!form.paymentSheetDateLabel) {
    return "Please select payment sheet label.";
  }

  if (!form.paymentSheetDate) {
    return "Please select payment sheet date.";
  }

  if (!form.merchantName) {
    return isAgentEntry
      ? "Please enter agent name."
      : "Please select merchant.";
  }

  if (!isAgentEntry && !form.bankLabel) {
    return "Please select bank label.";
  }

  if (!isAgentEntry && form.mid && !/^\d+$/.test(form.mid)) {
    return "Connected MID should contain numbers only.";
  }

  if (!form.processingCurrency) {
    return "Please enter processing currency.";
  }

  if (!textOnlyPattern.test(form.processingCurrency)) {
    return "Processing currency should contain text only.";
  }

  if (!form.startDate) {
    return "Please select start date and time.";
  }

  if (!form.endDate) {
    return "Please select end date and time.";
  }

  if (new Date(form.startDate).getTime() > new Date(form.endDate).getTime()) {
    return "Start date cannot be after end date.";
  }

  if (!form.amountPaid || Number.isNaN(amountPaid) || amountPaid <= 0) {
    return "Processing amount must be a positive number.";
  }

  if (!form.rate || Number.isNaN(rate) || rate <= 0) {
    return "Rate must be a positive number.";
  }

  if (!form.settlementCurrency) {
    return "Please enter settlement currency.";
  }

  if (!textOnlyPattern.test(form.settlementCurrency)) {
    return "Settlement currency should contain text only.";
  }

  if (
    !form.settlementAmount ||
    Number.isNaN(settlementAmount) ||
    settlementAmount <= 0
  ) {
    return "Settlement amount must be a positive number.";
  }

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
