import { SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { toast } from "react-hot-toast";

import {
  useDashboardByPeriod,
  useDashboardLatest,
} from "../queries/dashboardQueries";
import { useMiscellaneousPayments } from "../queries/miscellaneousQueries";
import { selectCurrentUser } from "../store/slices/Auth.slice";

import Button from "../component/UI/Button";
import DataTable, { readStoredRowsPerPage } from "../component/UI/DataTable";
import DatePicker from "../component/UI/DatePicker";
import SearchInput from "../component/UI/SearchInput";
import Spinner from "../component/UI/Spinner";
import Tabs from "../component/UI/Tabs";

import Modal from "../component/UI/Modal";
import DashboardFilterForm from "../component/dashboard/DashboardFilterForm";
import GroupedMerchantView from "../component/dashboard/GroupedMerchantView";
import DashboardTransactionRow from "../component/dashboard/DashboardTransactionRow";
import DashboardMiscellaneousRow from "../component/dashboard/DashboardMiscellaneousRow";
import DashboardSummarySection from "../component/dashboard/DashboardSummarySection";

import { formatNumber, formatDate, getErrorMessage } from "../utils/appUtils";
import {
  DASHBOARD_FILTERS_STORAGE_KEY,
  DEFAULT_VISIBLE_COLUMNS,
  FILTERABLE_COLUMNS,
  createDefaultFilters,
  formatDashboardAmount,
  getPartnerValue,
  getSearchableTransactionValues,
  hasActiveDataFilters,
  miscellaneousTableColumns,
  readSavedFilters,
  today,
} from "../utils/dashboardUtils";

const DASHBOARD_FILTER_FORM_ID = "dashboard-filter-form";

export default function Dashboard() {
  const currentUser = useSelector(selectCurrentUser);

  // UI state
  const [activeView, setActiveView] = useState("table");
  const [searchQuery, setSearchQuery] = useState("");
  const [rowsPerPage, setRowsPerPage] = useState(readStoredRowsPerPage);
  const [currentPage, setCurrentPage] = useState(1);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

  // Filter/date state
  const [filters, setFilters] = useState(readSavedFilters);

  const [reportDateMode, setReportDateMode] = useState("single");
  const [selectedReportPeriod, setSelectedReportPeriod] = useState({
    paymentDate: "",
    startDate: "",
    endDate: "",
  });
  const [appliedReportPeriod, setAppliedReportPeriod] = useState({
    paymentDate: "",
    fromDate: "",
    toDate: "",
  });

  const hasSelectedSingleDate = Boolean(selectedReportPeriod.paymentDate);

  const hasSelectedRange = Boolean(
    selectedReportPeriod.startDate && selectedReportPeriod.endDate,
  );

  const hasAppliedReportPeriod = Boolean(
    appliedReportPeriod.paymentDate ||
    (appliedReportPeriod.fromDate && appliedReportPeriod.toDate),
  );

  const isMiscellaneousEnabled = Boolean(appliedReportPeriod.paymentDate);

  // Dashboard queries
  const latestDashboardQuery = useDashboardLatest({
    enabled: !hasAppliedReportPeriod,
  });

  const periodDashboardQuery = useDashboardByPeriod({
    ...appliedReportPeriod,
    enabled: hasAppliedReportPeriod,
  });

  const activeDashboardQuery = hasAppliedReportPeriod
    ? periodDashboardQuery
    : latestDashboardQuery;

  const dashboardData = activeDashboardQuery.data || {};
  const transactions = dashboardData.transactions || [];
  const dashboardSummary = dashboardData.summary || {};
  const displayedPaymentDate = dashboardData.paymentDate
    ? formatDate(dashboardData.paymentDate)
    : null;

  // Miscellaneous query
  const miscellaneousQuery = useMiscellaneousPayments(
    {
      paymentSheetDate: appliedReportPeriod.paymentDate,
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

  const processingCurrencyOptions = useMemo(() => {
    return [
      ...new Set(
        transactions
          .map((item) => item.processingCurrency || item.receivedCurrency)
          .filter(Boolean),
      ),
    ]
      .sort((left, right) => left.localeCompare(right))
      .map((currency) => ({
        label: currency,
        value: currency,
      }));
  }, [transactions]);

  const settlementCurrencyOptions = useMemo(() => {
    return [
      ...new Set(
        transactions
          .map(
            (item) => item.settlementDisplayCurrency || item.settlementCurrency,
          )
          .filter(Boolean),
      ),
    ]
      .sort((left, right) => left.localeCompare(right))
      .map((currency) => ({
        label: currency,
        value: currency,
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
      const merchantName =
        transaction.merchantName || transaction.merchant || "";
      const acquirerName = transaction.acquirer || transaction.bank || "";
      const processingCurrency =
        transaction.processingCurrency || transaction.receivedCurrency || "";
      const settlementCurrency =
        transaction.settlementDisplayCurrency ||
        transaction.settlementCurrency ||
        "";
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
        !filters.processingCurrencies.includes(processingCurrency)
      ) {
        return false;
      }

      if (
        filters.settlementCurrencies.length > 0 &&
        !filters.settlementCurrencies.includes(settlementCurrency)
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
    if (reportDateMode === "single") {
      if (!selectedReportPeriod.paymentDate) return;

      setAppliedReportPeriod({
        paymentDate: selectedReportPeriod.paymentDate,
        fromDate: "",
        toDate: "",
      });
    } else {
      if (!selectedReportPeriod.startDate || !selectedReportPeriod.endDate) {
        return;
      }

      setAppliedReportPeriod({
        paymentDate: "",
        fromDate: selectedReportPeriod.startDate,
        toDate: selectedReportPeriod.endDate,
      });

      setActiveView("table");
    }

    setCurrentPage(1);
  };

  const handleClearReportDate = () => {
    setSelectedReportPeriod({
      paymentDate: "",
      startDate: "",
      endDate: "",
    });

    setAppliedReportPeriod({
      paymentDate: "",
      fromDate: "",
      toDate: "",
    });

    setCurrentPage(1);
    setActiveView("table");
  };

  const handleReportDateModeChange = (nextMode) => {
    setReportDateMode(nextMode);

    setSelectedReportPeriod({
      paymentDate: "",
      startDate: "",
      endDate: "",
    });
  };

  const handleReportDateChange = (nextValue) => {
    if (reportDateMode === "single") {
      setSelectedReportPeriod((prev) => ({
        ...prev,
        paymentDate: nextValue,
      }));

      return;
    }

    setSelectedReportPeriod((prev) => ({
      ...prev,
      startDate: nextValue.startDate || "",
      endDate: nextValue.endDate || "",
    }));
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

  const isReportApplyDisabled =
    isFetching ||
    (reportDateMode === "single" ? !hasSelectedSingleDate : !hasSelectedRange);

  const datePickerValue =
    reportDateMode === "single"
      ? selectedReportPeriod.paymentDate
      : {
          startDate: selectedReportPeriod.startDate,
          endDate: selectedReportPeriod.endDate,
        };

  const showDateClear = Boolean(
    selectedReportPeriod.paymentDate ||
    selectedReportPeriod.startDate ||
    selectedReportPeriod.endDate ||
    hasAppliedReportPeriod,
  );

  if (loading) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center p-8 text-on-surface">
        <Spinner type="xl" />
      </div>
    );
  }

  return (
    <div className="w-full bg-background text-on-background">
      <DashboardSummarySection summary={dashboardSummary} />

      <div className="flex justify-between">
        {displayedPaymentDate ? (
          <div className="mb-4 flex justify-end">
            <div className="rounded-full bg-surface-container-low px-4 py-2 text-sm font-semibold text-on-surface-variant">
              Payment sheet data :{" "}
              <span className="font-bold text-on-surface">
                {displayedPaymentDate}
              </span>
            </div>
          </div>
        ) : null}

        <DatePicker
          mode={reportDateMode}
          allowModeSwitch
          value={datePickerValue}
          max={today}
          onModeChange={handleReportDateModeChange}
          onChange={handleReportDateChange}
          onApply={handleGetReport}
          onClear={handleClearReportDate}
          applyDisabled={isReportApplyDisabled}
          showClear={showDateClear}
          className="w-full justify-start sm:w-fit"
        />
      </div>

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
            variant={hasAppliedFilters ? "primary" : "secondary"}
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
            console.log("value from the dashboard.jsx", value);
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
            />
          ))}
        </DataTable>
      ) : activeView === "group" ? (
        <GroupedMerchantView
          transactions={filteredTransactions}
          formatAmount={formatDashboardAmount}
          formatDate={formatDate}
          formatPlainNumber={formatNumber}
        />
      ) : (
        <DataTable
          title="Miscellaneous Payments"
          description={`Showing miscellaneous entries for ${appliedReportPeriod.paymentDate}`}
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

      <Modal
        open={isFilterModalOpen}
        title="Filter Transactions"
        description="Refine the dashboard dataset according to your preference."
        size="xl"
        onClose={() => setIsFilterModalOpen(false)}
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={handleResetFilters}
            >
              Reset
            </Button>

            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsFilterModalOpen(false)}
            >
              Cancel
            </Button>

            <Button type="submit" form={DASHBOARD_FILTER_FORM_ID}>
              Apply Filters
            </Button>
          </>
        }
      >
        <DashboardFilterForm
          formId={DASHBOARD_FILTER_FORM_ID}
          filters={filters}
          onApply={handleApplyFilters}
          options={{
            merchants: merchantOptions,
            acquirers: acquirerOptions,
            partners: partnerOptions,
            processingCurrencies: processingCurrencyOptions,
            settlementCurrencies: settlementCurrencyOptions,
            columns: FILTERABLE_COLUMNS,
          }}
          isAdmin={currentUser?.role === "admin"}
        />
      </Modal>
    </div>
  );
}
