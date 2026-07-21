import { formatNumber } from "./appUtils";

export const today = new Date().toISOString().slice(0, 10);

export const DASHBOARD_FILTERS_STORAGE_KEY = "dashboard-filters";

export const DEFAULT_VISIBLE_COLUMNS = [
  "acquirer",
  "merchantName",
  "startDate",
  "endDate",
  "processingCurrency",
  "receivedAmount",
  "paidAmount",
  "settlementPaidAmount",
  "settlementCurrency",
  "rate",
  "balance",
  "status",
];

export const FILTERABLE_COLUMNS = [
  { key: "acquirer", label: "Bank (Acquirer)" },
  { key: "merchantName", label: "Merchant" },
  { key: "startDate", label: "Start Date" },
  { key: "endDate", label: "End Date" },
  { key: "processingCurrency", label: "Proc. Currency" },
  { key: "receivedAmount", label: "Received" },
  { key: "paidAmount", label: "Paid In Amount" },
  { key: "settlementPaidAmount", label: "Actual Paid" },
  { key: "settlementCurrency", label: "Settle Currency" },
  { key: "rate", label: "Rate" },
  { key: "balance", label: "Balance" },
  { key: "status", label: "Status" },
];

export const miscellaneousTableColumns = [
  { key: "type", label: "Type" },
  { key: "merchant", label: "Merchant" },
  { key: "bank", label: "Bank" },
  { key: "mid", label: "MID" },
  { key: "currency", label: "Currency" },
  { key: "amountPaid", label: "Amount Paid", align: "right" },
  { key: "settlement", label: "Settlement", align: "right" },
  { key: "notes", label: "Notes" },
];

export function createDefaultFilters() {
  return {
    startDate: "",
    endDate: "",
    merchants: [],
    acquirers: [],
    processingCurrencies: [],
    settlementCurrencies: [],
    partners: [],
    statuses: [],
    visibleColumns: DEFAULT_VISIBLE_COLUMNS,
  };
}

export function readSavedFilters() {
  if (typeof window === "undefined") return createDefaultFilters();

  try {
    const savedFilters = window.localStorage.getItem(
      DASHBOARD_FILTERS_STORAGE_KEY,
    );

    if (!savedFilters) return createDefaultFilters();

    return {
      ...createDefaultFilters(),
      ...JSON.parse(savedFilters),
    };
  } catch {
    return createDefaultFilters();
  }
}

export function getPartnerValue(merchantTag) {
  const normalizedTag = String(merchantTag || "").toLowerCase();

  if (normalizedTag.includes("transactworld")) return "transactworld";
  if (normalizedTag.includes("dreamz")) return "dreamzpay";

  return "";
}

export function hasActiveDataFilters(filters) {
  return Boolean(
    filters.startDate ||
    filters.endDate ||
    filters.merchants.length ||
    filters.acquirers.length ||
    filters.processingCurrencies.length ||
    filters.settlementCurrencies.length ||
    filters.partners.length ||
    filters.statuses.length,
  );
}

export function getSearchableDateParts(value) {
  if (!value) return [];

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return [String(value)];
  }

  return [
    date.toISOString(),
    date.toISOString().slice(0, 10),
    date.toLocaleDateString("en-GB"),
    date.toLocaleDateString("en-US"),
  ];
}

export function getSearchableTransactionValues(transaction) {
  return [
    transaction.acquirer,
    transaction.bank,
    transaction.balance,
    transaction.endDate,
    transaction.lastPaidToMerchantDate,
    transaction.lastPaymentBank,
    transaction.lastPaymentRate,
    transaction.lastSettlementAmount,
    transaction.merchant,
    transaction.merchantName,
    transaction.merchantTag,
    transaction.mid,
    transaction.paid,
    transaction.amountPaid,
    transaction.payable,
    transaction.amount,
    transaction.paymentMethod,
    transaction.processingCurrency,
    transaction.settlementCurrency,
    transaction.startDate,
    transaction.status,
    ...getSearchableDateParts(transaction.startDate),
    ...getSearchableDateParts(transaction.endDate),
    ...getSearchableDateParts(transaction.lastPaidToMerchantDate),
  ]
    .filter((value) => value !== undefined && value !== null && value !== "")
    .map((value) => String(value).toLowerCase());
}

export function formatDashboardAmount(amount, currency = "EUR") {
  const num = Number(amount);

  if (Number.isNaN(num)) return "0.00";

  if (currency === "USDT") {
    return `USDT ${num.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  const currencyLocaleMap = {
    INR: "en-IN",
    USD: "en-US",
    EUR: "en-US",
    GBP: "en-GB",
    CAD: "en-CA",
    AUD: "en-AU",
    JPY: "ja-JP",
  };

  return num.toLocaleString(currencyLocaleMap[currency] || "en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function getMerchantShortName(name) {
  if (!name) return "-";
  if (name.includes("Transactworld")) return "TW";
  if (name.includes("Dreamzpay")) return "DP";

  return name;
}

export function getDashboardStatusVariant(status) {
  if (status === "settled") return "DP";
  if (status === "partially_paid") return "secondary";
  if (status === "pending") return "outline";

  return "secondary";
}

export function getDashboardAmountSummarySections(summary = {}) {
  return [
    {
      title: "Received",
      totalLabel: "Wiresheet Rec'd",
      totalValue: summary.totalReceived || 0,
      values: summary.received || {},
    },
    {
      title: "Paid Against Processing",
      totalLabel: "Total Paid",
      totalValue: summary.totalPaidAgainstProcessing || 0,
      values: summary.paidAgainstProcessing || {},
    },
    {
      title: "Settlement",
      totalLabel: "Total Settlement",
      totalValue: summary.totalSettlementAmount || 0,
      values: summary.settlement || {},
    },
  ];
}

export function getDashboardStatusBreakdownItems(summary = {}) {
  return [
    {
      label: "Completed",
      value: summary.settledCount || 0,
      dotClassName: "bg-green-500",
    },
    {
      label: "Partially Paid",
      value: summary.partiallyPaidCount || 0,
      dotClassName: "bg-orange-400",
    },
    {
      label: "Pending",
      value: summary.pendingCount || 0,
      dotClassName: "bg-yellow-400",
    },
  ];
}

export function formatDashboardPlainNumber(value) {
  return formatNumber(value || 0);
}

export function getDashboardSafeNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

export function getDashboardMerchantKey(transaction = {}) {
  return transaction.merchantName || transaction.merchant || "Unknown Merchant";
}

export function formatDashboardDateRangeLabel(startDate, endDate, formatDate) {
  const start = startDate ? formatDate(startDate) : "-";
  const end = endDate ? formatDate(endDate) : "-";

  return `${start} → ${end}`;
}

export function buildDashboardCurrencySummary(items) {
  return [...items.entries()]
    .map(([currency, amount]) => ({
      currency,
      amount,
    }))
    .sort(
      (left, right) =>
        right.amount - left.amount ||
        left.currency.localeCompare(right.currency),
    );
}

export function buildGroupedMerchantDashboardData(transactions = []) {
  const merchantMap = new Map();

  transactions.forEach((transaction) => {
    const merchantName =
      transaction.merchantName || transaction.merchant || "Unknown Merchant";

    const merchantKey = getDashboardMerchantKey(transaction);
    const mid = transaction.mid || "NO-MID";
    const acquirer = transaction.acquirer || transaction.bank || "Unknown";

    const receivedCurrency =
      transaction.processingCurrency ||
      transaction.receivedCurrency ||
      "UNKNOWN";

    const paidCurrency =
      transaction.settlementDisplayCurrency ||
      transaction.settlementCurrency ||
      "UNKNOWN";

    const receivedAmount = getDashboardSafeNumber(
      transaction.receivedAmount ?? transaction.payable,
    );
    const paidInAmount = getDashboardSafeNumber(transaction.paidAmount);
    const actualPaidAmount = getDashboardSafeNumber(
      transaction.settlementPaidAmount,
    );
    const balanceAmount = getDashboardSafeNumber(transaction.balance);

    if (!merchantMap.has(merchantKey)) {
      merchantMap.set(merchantKey, {
        merchantKey,
        merchantName,
        totalReceived: 0,
        totalPaidIn: 0,
        totalActualPaid: 0,
        totalBalance: 0,
        earliestStartDate: null,
        latestEndDate: null,
        mids: new Map(),
      });
    }

    const merchantEntry = merchantMap.get(merchantKey);

    merchantEntry.totalReceived += receivedAmount;
    merchantEntry.totalPaidIn += paidInAmount;
    merchantEntry.totalActualPaid += actualPaidAmount;
    merchantEntry.totalBalance += balanceAmount;

    updateDateRange(merchantEntry, transaction.startDate, transaction.endDate);

    if (!merchantEntry.mids.has(mid)) {
      merchantEntry.mids.set(mid, {
        mid,
        totalReceived: 0,
        totalPaidIn: 0,
        totalActualPaid: 0,
        totalBalance: 0,
        earliestStartDate: null,
        latestEndDate: null,
        acquirers: new Map(),
      });
    }

    const midEntry = merchantEntry.mids.get(mid);

    midEntry.totalReceived += receivedAmount;
    midEntry.totalPaidIn += paidInAmount;
    midEntry.totalActualPaid += actualPaidAmount;
    midEntry.totalBalance += balanceAmount;

    updateDateRange(midEntry, transaction.startDate, transaction.endDate);

    if (!midEntry.acquirers.has(acquirer)) {
      midEntry.acquirers.set(acquirer, {
        acquirer,
        totalReceived: 0,
        totalPaidIn: 0,
        totalActualPaid: 0,
        totalBalance: 0,
        earliestStartDate: null,
        latestEndDate: null,
        receivedCurrencies: new Map(),
        paidCurrencies: new Map(),
        statusCounts: {
          settled: 0,
          partially_paid: 0,
          pending: 0,
        },
      });
    }

    const acquirerEntry = midEntry.acquirers.get(acquirer);

    acquirerEntry.totalReceived += receivedAmount;
    acquirerEntry.totalPaidIn += paidInAmount;
    acquirerEntry.totalActualPaid += actualPaidAmount;
    acquirerEntry.totalBalance += balanceAmount;

    acquirerEntry.receivedCurrencies.set(
      receivedCurrency,
      (acquirerEntry.receivedCurrencies.get(receivedCurrency) || 0) +
        receivedAmount,
    );

    acquirerEntry.paidCurrencies.set(
      paidCurrency,
      (acquirerEntry.paidCurrencies.get(paidCurrency) || 0) + actualPaidAmount,
    );

    if (
      transaction.status &&
      acquirerEntry.statusCounts[transaction.status] !== undefined
    ) {
      acquirerEntry.statusCounts[transaction.status] += 1;
    }

    updateDateRange(acquirerEntry, transaction.startDate, transaction.endDate);
  });

  return [...merchantMap.values()]
    .map((merchant) => ({
      ...merchant,
      midCount: merchant.mids.size,
      midTabs: [...merchant.mids.values()]
        .map((midEntry) => ({
          ...midEntry,
          acquirerCount: midEntry.acquirers.size,
          acquirerTabs: [...midEntry.acquirers.values()]
            .map((acquirerEntry) => ({
              ...acquirerEntry,
              receivedCurrencies: buildDashboardCurrencySummary(
                acquirerEntry.receivedCurrencies,
              ),
              paidCurrencies: buildDashboardCurrencySummary(
                acquirerEntry.paidCurrencies,
              ),
            }))
            .sort(
              (left, right) =>
                right.totalReceived - left.totalReceived ||
                left.acquirer.localeCompare(right.acquirer),
            ),
        }))
        .sort(
          (left, right) =>
            right.totalReceived - left.totalReceived ||
            left.mid.localeCompare(right.mid),
        ),
    }))
    .sort(
      (left, right) =>
        right.totalReceived - left.totalReceived ||
        left.merchantName.localeCompare(right.merchantName),
    );
}

function updateDateRange(entry, startDate, endDate) {
  if (startDate) {
    const start = new Date(startDate);

    if (!Number.isNaN(start.getTime())) {
      if (!entry.earliestStartDate || start < entry.earliestStartDate) {
        entry.earliestStartDate = start;
      }
    }
  }

  if (endDate) {
    const end = new Date(endDate);

    if (!Number.isNaN(end.getTime())) {
      if (!entry.latestEndDate || end > entry.latestEndDate) {
        entry.latestEndDate = end;
      }
    }
  }
}
