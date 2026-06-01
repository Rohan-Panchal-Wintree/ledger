import { CreditCard, Landmark } from "lucide-react";

import { formatDate } from "./appUtils";

export const DEFAULT_SHEETS_META = {
  total: 0,
  page: 1,
  limit: 20,
  totalPages: 0,
};

export const EMPTY_DATE_RANGE = {
  startDate: "",
  endDate: "",
};

export const SHEET_TABS = [
  {
    label: "Wiresheet",
    value: "wiresheet",
    icon: Landmark,
  },
  {
    label: "Payment Sheet",
    value: "payment-sheet",
    icon: CreditCard,
  },
];

export const wiresheetColumns = [
  { key: "wiresheetName", label: "Wiresheet Name" },
  { key: "acquirerName", label: "Acquirer" },
  { key: "period", label: "Period" },
  { key: "totalPayable", label: "Payable", align: "right" },
  { key: "totalPaid", label: "Paid", align: "right" },
  { key: "totalBalance", label: "Balance", align: "right" },
  { key: "status", label: "Status" },
  { key: "uploadedAt", label: "Uploaded At" },
  { key: "uploadedBy", label: "Uploaded By" },
];

export const paymentSheetColumns = [
  { key: "fileName", label: "File Name" },
  { key: "paymentDate", label: "Payment Date" },
  { key: "successfulPayments", label: "Successful", align: "right" },
  { key: "invalidCount", label: "Invalid", align: "right" },
  { key: "unmatchedCount", label: "Unmatched", align: "right" },
  { key: "totalRows", label: "Total Rows", align: "right" },
  { key: "totalPaid", label: "Total Paid", align: "right" },
  { key: "totalSettlement", label: "Settlement", align: "right" },
  { key: "uploadedAt", label: "Uploaded At" },
  { key: "uploadedBy", label: "Uploaded By" },
];

export const getDefaultSheetsPageSize = () => {
  if (typeof window === "undefined") return 20;

  const storedValue = Number(
    window.localStorage.getItem("global-table-rows-per-page"),
  );

  return [10, 20, 25, 50, 100].includes(storedValue) ? storedValue : 20;
};

export const normalizeSearchText = (value) =>
  String(value || "")
    .toLowerCase()
    .trim();

export const toApiDate = (value) => {
  if (!value) return undefined;

  if (typeof value === "string") {
    return value;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return date.toISOString().slice(0, 10);
};

export const filterWiresheetsBySearch = (items, searchTerm) => {
  const searchValue = normalizeSearchText(searchTerm);

  if (!searchValue) return items;

  return items.filter((item) => {
    const searchableValues = [
      item.wiresheetName,
      item.acquirerName,
      item.status,
      formatDate(item.startDate),
      formatDate(item.endDate),
      formatDate(item.matchedStartDate),
      formatDate(item.matchedEndDate),
      formatDate(item.uploadedAt),
      item.uploadedBy?.name,
      item.uploadedBy?.email,
    ];

    return searchableValues
      .map(normalizeSearchText)
      .some((value) => value.includes(searchValue));
  });
};

export const filterPaymentSheetsBySearch = (items, searchTerm) => {
  const searchValue = normalizeSearchText(searchTerm);

  if (!searchValue) return items;

  return items.filter((item) => {
    const searchableValues = [
      item.fileName,
      item.paymentDate,
      formatDate(item.paymentDate),
      formatDate(item.uploadedAt),
      item.uploadedBy?.name,
      item.uploadedBy?.email,
    ];

    return searchableValues
      .map(normalizeSearchText)
      .some((value) => value.includes(searchValue));
  });
};

export const getStatusVariant = (status) => {
  if (status === "settled") return "DP";
  if (status === "partially_paid") return "secondary";
  if (status === "pending") return "outline";

  return "default";
};
