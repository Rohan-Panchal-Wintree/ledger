import {
  SlidersHorizontal,
  Landmark,
  CircleUserRound,
  ArrowRightLeft,
  Banknote,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { toast } from "react-hot-toast";

import {
  useDashboardByPeriod,
  useDashboardLatest,
} from "../queries/dashboardQueries";
import { useMiscellaneousPayments } from "../queries/miscellaneousQueries";
import { selectCurrentUser } from "../store/slices/Auth.slice";

import Badge from "../component/UI/Badge";
import Button from "../component/UI/Button";
import DataTable from "../component/UI/DataTable";
import DatePicker from "../component/UI/DatePicker";
import SearchInput from "../component/UI/SearchInput";
import Spinner from "../component/UI/Spinner";
import StatCard from "../component/UI/StatCard";
import Tabs from "../component/UI/Tabs";

import FilterModal from "../component/FilterModal";
import GroupedMerchantView from "../component/dashboard/GroupedMerchantView";
import DashboardTransactionRow from "../component/dashboard/DashboardTransactionRow";
import DashboardMiscellaneousRow from "../component/dashboard/DashboardMiscellaneousRow";

import { formatNumber, formatDate, getErrorMessage } from "../utils/appUtils";

const today = new Date().toISOString().slice(0, 10);
const DASHBOARD_FILTERS_STORAGE_KEY = "dashboard-filters";

const statusClasses = {
  settled: "bg-green-500/10 text-green-600",
  pending: "bg-orange-400/10 text-orange-600",
  partially_paid: "bg-yellow-400/10 text-yellow-600",
};

const DEFAULT_VISIBLE_COLUMNS = [
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

const FILTERABLE_COLUMNS = [
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

const miscellaneousTableColumns = [
  { key: "type", label: "Type" },
  { key: "merchant", label: "Merchant" },
  { key: "bank", label: "Bank" },
  { key: "mid", label: "MID" },
  { key: "currency", label: "Currency" },
  { key: "amountPaid", label: "Amount Paid", align: "right" },
  { key: "settlement", label: "Settlement", align: "right" },
  { key: "notes", label: "Notes" },
];

function createDefaultFilters() {
  return {
    startDate: "",
    endDate: "",
    minAmount: "",
    maxAmount: "",
    merchants: [],
    acquirers: [],
    processingCurrencies: [],
    settlementCurrencies: [],
    partners: [],
    statuses: [],
    visibleColumns: DEFAULT_VISIBLE_COLUMNS,
  };
}

function readSavedFilters() {
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

function getPartnerValue(merchantTag) {
  const normalizedTag = String(merchantTag || "").toLowerCase();

  if (normalizedTag.includes("transactworld")) return "transactworld";
  if (normalizedTag.includes("dreamz")) return "dreamzpay";

  return "";
}

function hasActiveDataFilters(filters) {
  return Boolean(
    filters.startDate ||
    filters.endDate ||
    filters.minAmount ||
    filters.maxAmount ||
    filters.merchants.length ||
    filters.acquirers.length ||
    filters.processingCurrencies.length ||
    filters.settlementCurrencies.length ||
    filters.partners.length ||
    filters.statuses.length,
  );
}

function getSearchableDateParts(value) {
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

function getSearchableTransactionValues(transaction) {
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

function formatAmount(amount, currency = "EUR") {
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

function getMerchantShortName(name) {
  if (!name) return "-";
  if (name.includes("Transactworld")) return "TW";
  if (name.includes("Dreamzpay")) return "DP";

  return name;
}

export default function Dashboard() {
  const currentUser = useSelector(selectCurrentUser);

  // UI state
  const [activeView, setActiveView] = useState("table");
  const [searchQuery, setSearchQuery] = useState("");
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

  // Filter/date state
  const [filters, setFilters] = useState(readSavedFilters);
  const [selectedReportDate, setSelectedReportDate] = useState("");
  const [appliedReportDate, setAppliedReportDate] = useState("");

  const isMiscellaneousEnabled = Boolean(appliedReportDate);

  // Dashboard queries
  const latestDashboardQuery = useDashboardLatest({
    enabled: !appliedReportDate,
  });

  const periodDashboardQuery = useDashboardByPeriod(
    {
      paymentDate: appliedReportDate,
    },
    {
      enabled: Boolean(appliedReportDate),
    },
  );

  const activeDashboardQuery = appliedReportDate
    ? periodDashboardQuery
    : latestDashboardQuery;

  const dashboardData = activeDashboardQuery.data || {};
  const transactions = dashboardData.transactions || [];
  const dashboardSummary = dashboardData.summary || {};

  const amountSummarySections = [
    {
      title: "Received",
      totalLabel: "Wiresheet Received",
      totalValue: dashboardSummary.totalReceived || 0,
      values: dashboardSummary.received || {},
    },
    {
      title: "Paid Against Processing",
      totalLabel: "Total Paid",
      totalValue: dashboardSummary.totalPaidAgainstProcessing || 0,
      values: dashboardSummary.paidAgainstProcessing || {},
    },
    {
      title: "Settlement",
      totalLabel: "Total Settlement",
      totalValue: dashboardSummary.totalSettlementAmount || 0,
      values: dashboardSummary.settlement || {},
    },
  ];

  // Miscellaneous query
  const miscellaneousQuery = useMiscellaneousPayments(
    {
      paymentSheetDate: appliedReportDate,
    },
    {
      enabled: isMiscellaneousEnabled,
    },
  );

  const miscellaneousPayments = miscellaneousQuery.data?.items || [];
  const miscellaneousLoading =
    miscellaneousQuery.isLoading || miscellaneousQuery.isFetching;

  const loading = activeDashboardQuery.isLoading;
  const isFetching = activeDashboardQuery.isFetching;
  const dashboardError = activeDashboardQuery.error;

  // Filter options
  const merchantOptions = useMemo(() => {
    return [
      ...new Set(transactions.map((item) => item.merchantName).filter(Boolean)),
    ]
      .sort((left, right) => left.localeCompare(right))
      .map((merchant) => ({
        label: merchant,
        value: merchant,
      }));
  }, [transactions]);

  const acquirerOptions = useMemo(() => {
    return [
      ...new Set(transactions.map((item) => item.acquirer).filter(Boolean)),
    ]
      .sort((left, right) => left.localeCompare(right))
      .map((acquirer) => ({
        label: acquirer,
        value: acquirer,
      }));
  }, [transactions]);

  const partnerOptions = useMemo(
    () => [
      { label: "Transactworld", value: "transactworld" },
      { label: "Dreamz Pay", value: "dreamzpay" },
    ],
    [],
  );

  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const hasAppliedFilters = hasActiveDataFilters(filters);

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    const baseFilteredTransactions = transactions.filter((transaction) => {
      const transactionStartDate = transaction.startDate
        ? new Date(transaction.startDate)
        : null;

      const transactionEndDate = transaction.endDate
        ? new Date(transaction.endDate)
        : null;

      const payableAmount =
        Number(transaction.receivedAmount ?? transaction.payable) || 0;

      const merchantName =
        transaction.merchantName || transaction.merchant || "";

      const acquirerName = transaction.acquirer || transaction.bank || "";
      const partnerValue = getPartnerValue(transaction.merchantTag);

      if (
        filters.startDate &&
        (!transactionStartDate ||
          Number.isNaN(transactionStartDate.getTime()) ||
          transactionStartDate < new Date(filters.startDate))
      ) {
        return false;
      }

      if (filters.endDate) {
        const endDate = new Date(filters.endDate);
        endDate.setHours(23, 59, 59, 999);

        if (
          !transactionEndDate ||
          Number.isNaN(transactionEndDate.getTime()) ||
          transactionEndDate > endDate
        ) {
          return false;
        }
      }

      if (filters.minAmount && payableAmount < Number(filters.minAmount)) {
        return false;
      }

      if (filters.maxAmount && payableAmount > Number(filters.maxAmount)) {
        return false;
      }

      if (
        filters.merchants.length > 0 &&
        !filters.merchants.includes(merchantName)
      ) {
        return false;
      }

      if (
        filters.acquirers.length > 0 &&
        !filters.acquirers.includes(acquirerName)
      ) {
        return false;
      }

      if (
        filters.processingCurrencies.length > 0 &&
        !filters.processingCurrencies.includes(transaction.processingCurrency)
      ) {
        return false;
      }

      if (
        filters.settlementCurrencies.length > 0 &&
        !filters.settlementCurrencies.includes(
          transaction.settlementDisplayCurrency ||
            transaction.settlementCurrency,
        )
      ) {
        return false;
      }

      if (
        filters.partners.length > 0 &&
        !filters.partners.includes(partnerValue)
      ) {
        return false;
      }

      if (
        filters.statuses.length > 0 &&
        !filters.statuses.includes(transaction.status)
      ) {
        return false;
      }

      return true;
    });

    if (!normalizedSearchQuery) {
      return baseFilteredTransactions;
    }

    return baseFilteredTransactions.filter((transaction) =>
      getSearchableTransactionValues(transaction).some((value) =>
        value.includes(normalizedSearchQuery),
      ),
    );
  }, [filters, normalizedSearchQuery, transactions]);

  // Pagination
  const totalPages = Math.max(
    1,
    Math.ceil(filteredTransactions.length / rowsPerPage),
  );
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * rowsPerPage;

  const paginatedTransactions = useMemo(() => {
    return filteredTransactions.slice(startIndex, startIndex + rowsPerPage);
  }, [filteredTransactions, rowsPerPage, startIndex]);

  // Table columns
  const visibleColumnKeys =
    filters.visibleColumns.length > 0
      ? filters.visibleColumns
      : DEFAULT_VISIBLE_COLUMNS;

  const visibleColumns = useMemo(() => {
    return FILTERABLE_COLUMNS.filter((column) =>
      visibleColumnKeys.includes(column.key),
    );
  }, [visibleColumnKeys]);

  const transactionTableColumns = useMemo(() => {
    return visibleColumns.map((column) => ({
      ...column,
      align: [
        "processingCurrency",
        "settlementCurrency",
        "rate",
        "status",
      ].includes(column.key)
        ? "center"
        : [
              "receivedAmount",
              "paidAmount",
              "settlementPaidAmount",
              "balance",
            ].includes(column.key)
          ? "right"
          : "left",
    }));
  }, [visibleColumns]);

  // Summary data
  const statusBreakdownItems = useMemo(
    () => [
      {
        label: "Completed",
        value: dashboardSummary.settledCount || 0,
        dotClassName: "bg-green-500",
      },
      {
        label: "Partially Paid",
        value: dashboardSummary.partiallyPaidCount || 0,
        dotClassName: "bg-orange-400",
      },
      {
        label: "Pending",
        value: dashboardSummary.pendingCount || 0,
        dotClassName: "bg-yellow-400",
      },
    ],
    [dashboardSummary],
  );

  // Handlers
  const handleApplyFilters = (nextFilters) => {
    setFilters({
      ...createDefaultFilters(),
      ...nextFilters,
      visibleColumns:
        nextFilters.visibleColumns.length > 0
          ? nextFilters.visibleColumns
          : DEFAULT_VISIBLE_COLUMNS,
    });

    setCurrentPage(1);
    setIsFilterModalOpen(false);
  };

  const handleResetFilters = () => {
    setFilters(createDefaultFilters());
    setSearchQuery("");
    setCurrentPage(1);
  };

  const handleGetReport = () => {
    setAppliedReportDate(selectedReportDate);
    setCurrentPage(1);
  };

  const handleClearReportDate = () => {
    setSelectedReportDate("");
    setAppliedReportDate("");
    setCurrentPage(1);
    setActiveView("table");
  };

  const renderCellContent = (item, columnKey) => {
    switch (columnKey) {
      case "acquirer":
        return (
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/6 transition-transform duration-200 group-hover:scale-105">
              <Landmark className="text-primary" size={16} />
            </div>

            <div className="min-w-0">
              <span className="block truncate text-sm font-bold text-on-surface">
                {item.acquirer || "-"}
              </span>
            </div>
          </div>
        );

      case "merchantName":
        return (
          <div
            className="flex items-center justify-between gap-2 text-sm font-bold text-on-surface capitalize"
            title={item.merchantName}
          >
            <div className="min-w-0">
              <span className="block truncate max-w-37.5 font-semibold text-on-surface">
                {item.merchantName || "-"}
              </span>

              <span className="mt-1 block text-[11px] font-medium uppercase tracking-wide text-on-surface-variant/75">
                MID {item.mid || "-"}
              </span>
            </div>

            <Badge
              variant={getMerchantShortName(item.merchantTag)}
              className="ml-2 shrink-0"
            >
              {getMerchantShortName(item.merchantTag)}
            </Badge>
          </div>
        );

      case "startDate":
      case "endDate":
        return formatDate(item[columnKey]);

      case "processingCurrency":
        return (
          <span className="rounded-full bg-primary/8 px-3 py-1.5 font-bold tracking-wide text-primary">
            {item.processingCurrency || "-"}
          </span>
        );

      case "settlementCurrency":
        return (
          <span className="rounded-full bg-surface-container px-3 py-1.5 font-bold tracking-wide text-on-surface">
            {item.settlementDisplayCurrency || item.settlementCurrency || "-"}
          </span>
        );

      case "rate":
        return (
          <span className="rounded-full bg-primary/8 px-3 py-1.5 font-bold uppercase tracking-widest text-primary">
            {Number(item.lastPaymentRate || 0).toFixed(2)}
          </span>
        );

      case "receivedAmount":
        return formatAmount(
          item.receivedAmount || 0,
          item.receivedCurrency || item.processingCurrency || "EUR",
        );

      case "paidAmount":
        return formatAmount(
          item.paidAmount || 0,
          item.processingCurrency || item.receivedCurrency || "EUR",
        );

      case "settlementPaidAmount":
        return formatAmount(
          item.settlementPaidAmount || 0,
          item.settlementDisplayCurrency || item.settlementCurrency || "EUR",
        );

      case "balance":
        return formatAmount(
          item.balance || 0,
          item.processingCurrency || item.receivedCurrency || "EUR",
        );

      case "status":
        return (
          <span
            className={`rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest ${
              statusClasses[item.status] || statusClasses.pending
            }`}
          >
            {String(item.status || "pending").replace(/_/g, " ")}
          </span>
        );

      default:
        return item[columnKey] || "-";
    }
  };

  // Persist filters
  useEffect(() => {
    window.localStorage.setItem(
      DASHBOARD_FILTERS_STORAGE_KEY,
      JSON.stringify(filters),
    );
  }, [filters]);

  // Error feedback
  useEffect(() => {
    if (dashboardError) {
      toast.error(
        getErrorMessage(dashboardError, "Failed to load dashboard data."),
      );
    }
  }, [dashboardError]);

  if (loading) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center p-8 text-on-surface">
        <Spinner type="xl" />
      </div>
    );
  }

  return (
    <div className="w-full bg-background text-on-background">
      <section className="mb-12 grid grid-cols-1 gap-6 md:grid-cols-4">
        <div className="group md:col-span-2 flex flex-col justify-between rounded-lg bg-linear-to-br from-primary to-primary-container p-8 text-white transition-all duration-300">
          <div className="flex items-start justify-between">
            <span className="text-xs font-bold uppercase tracking-widest text-white/70">
              Total Amount Paid
            </span>

            <Banknote className="text-white/50" size={20} />
          </div>

          <div className="mt-8 rounded-2xl border border-white/12 bg-white/8 p-5 backdrop-blur-xs">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {amountSummarySections.map((section) => (
                <div key={section.title} className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/55">
                    {section.totalLabel}
                  </p>

                  <p className="mt-1 truncate text-xl font-extrabold tracking-tight text-white">
                    {formatNumber(section.totalValue)}
                  </p>
                </div>
              ))}
            </div>

            <div className="my-4 h-px bg-white/10" />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {amountSummarySections.map((section) => (
                <div
                  key={`${section.title}-breakdown`}
                  className="min-w-0 rounded-md bg-white/6 px-3 py-2"
                >
                  <div className="space-y-1.5">
                    {Object.entries(section.values || {}).length > 0 ? (
                      Object.entries(section.values || {}).map(
                        ([currency, amount]) => (
                          <div
                            key={`${section.title}-${currency}`}
                            className="flex items-center justify-between gap-3"
                          >
                            <span className="text-[10px] font-bold uppercase tracking-widest text-white/60">
                              {currency}
                            </span>

                            <span className="truncate text-right text-xs font-extrabold text-white">
                              {formatNumber(amount)}
                            </span>
                          </div>
                        ),
                      )
                    ) : (
                      <div className="text-xs font-semibold text-white/60">
                        -
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <StatCard
            label="Unmatched Count"
            value={dashboardSummary.unmatchedCount || 0}
            helper="Pending reconciliation rows"
            icon={CircleUserRound}
            className="p-8"
          />

          <StatCard
            label="Transaction count"
            value={dashboardSummary.totalTransactions || 0}
            icon={ArrowRightLeft}
            className="p-8"
          />
        </div>

        <div className="rounded-lg bg-surface-container-low p-4">
          <div className="flex flex-col gap-4">
            {statusBreakdownItems.map((item) => (
              <div
                key={item.label}
                className="flex flex-1 flex-col justify-center rounded-lg border border-outline-variant/10 bg-surface-container-lowest p-5 transition-colors"
              >
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                    {item.label}
                  </span>

                  <div
                    className={`h-2 w-2 rounded-full ${item.dotClassName}`}
                  />
                </div>

                <div className="text-3xl font-extrabold text-on-surface">
                  {item.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <Tabs
          activeTab={activeView}
          onChange={setActiveView}
          tabs={[
            { label: "Table View", value: "table" },
            { label: "Group View", value: "group" },
            {
              label: "Miscellaneous",
              value: "miscellaneous",
              visible: isMiscellaneousEnabled,
            },
          ]}
        />

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <DatePicker
            value={selectedReportDate}
            max={today}
            onChange={setSelectedReportDate}
            onApply={handleGetReport}
            onClear={handleClearReportDate}
            applyDisabled={!selectedReportDate || isFetching}
            showClear={Boolean(selectedReportDate || appliedReportDate)}
          />

          <SearchInput
            value={searchQuery}
            placeholder="Search transactions..."
            className="w-full sm:w-80"
            onChange={(event) => {
              setSearchQuery(event.target.value);
              setCurrentPage(1);
            }}
          />

          <Button
            variant="secondary"
            active={hasAppliedFilters}
            size="md"
            leftIcon={<SlidersHorizontal size={16} />}
            onClick={() => setIsFilterModalOpen(true)}
            className="rounded-full"
          >
            Filters
          </Button>
        </div>
      </div>

      {activeView === "table" ? (
        <DataTable
          title="Final Payment Report"
          columns={transactionTableColumns}
          page={safeCurrentPage}
          totalItems={filteredTransactions.length}
          itemLabel="transactions"
          isEmpty={paginatedTransactions.length === 0}
          emptyTitle="No transactions found."
          emptyDescription="Try adjusting your search or filters."
          onPageChange={setCurrentPage}
          onRowsPerPageChange={(value) => {
            setRowsPerPage(value);
            setCurrentPage(1);
          }}
        >
          {paginatedTransactions.map((item, index) => (
            <DashboardTransactionRow
              key={`${item.acquirer}-${item.merchant}-${startIndex + index}`}
              item={item}
              index={index}
              startIndex={startIndex}
              visibleColumns={visibleColumns}
              renderCellContent={renderCellContent}
            />
          ))}
        </DataTable>
      ) : activeView === "group" ? (
        <GroupedMerchantView
          transactions={filteredTransactions}
          formatAmount={formatAmount}
          formatDate={formatDate}
          formatPlainNumber={formatNumber}
        />
      ) : (
        <DataTable
          title="Miscellaneous Payments"
          description={`Showing miscellaneous entries for ${appliedReportDate}`}
          columns={miscellaneousTableColumns}
          isLoading={miscellaneousLoading}
          isEmpty={miscellaneousPayments.length === 0}
          emptyTitle="No miscellaneous payments found."
          emptyDescription="No miscellaneous payments are available for this selected date."
          showFooter={false}
        >
          {miscellaneousPayments.map((item) => (
            <DashboardMiscellaneousRow
              key={item._id}
              item={item}
              formatPlainNumber={formatNumber}
            />
          ))}
        </DataTable>
      )}

      <FilterModal
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        filters={filters}
        onApply={handleApplyFilters}
        onReset={handleResetFilters}
        options={{
          transactions,
          merchants: merchantOptions,
          acquirers: acquirerOptions,
          partners: partnerOptions,
          columns: FILTERABLE_COLUMNS,
        }}
        isAdmin={currentUser?.role === "admin"}
      />
    </div>
  );
}
