import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { CreditCard, Landmark } from "lucide-react";

import DataTable from "../component/UI/DataTable";
import DatePicker from "../component/UI/DatePicker";
import SearchInput from "../component/UI/SearchInput";
import Spinner from "../component/UI/Spinner";
import Tabs from "../component/UI/Tabs";

import PaymentSheetRow from "../component/sheets/PaymentSheetRow";
import WiresheetRow from "../component/sheets/WiresheetRow";

import { usePaymentSheets, useWiresheets } from "../queries/sheetsQueries";

import { formatDate, getErrorMessage } from "../utils/appUtils";

const DEFAULT_META = {
  total: 0,
  page: 1,
  limit: 20,
  totalPages: 0,
};

const EMPTY_DATE_RANGE = {
  startDate: "",
  endDate: "",
};

const SHEET_TABS = [
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

const wiresheetColumns = [
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

const paymentSheetColumns = [
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

const getDefaultPageSize = () => {
  if (typeof window === "undefined") return 20;

  const storedValue = Number(
    window.localStorage.getItem("global-table-rows-per-page"),
  );

  return [10, 20, 25, 50, 100].includes(storedValue) ? storedValue : 20;
};

const normalizeSearchText = (value) =>
  String(value || "")
    .toLowerCase()
    .trim();

const toApiDate = (value) => {
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

const filterWiresheetsBySearch = (items, searchTerm) => {
  const searchValue = normalizeSearchText(searchTerm);

  if (!searchValue) return items;

  return items.filter((item) => {
    const searchableValues = [
      item.wiresheetName,
      item.acquirerName,
      item.status,
      formatDate(item.startDate),
      formatDate(item.endDate),
      formatDate(item.uploadedAt),
      item.uploadedBy?.name,
      item.uploadedBy?.email,
    ];

    return searchableValues
      .map(normalizeSearchText)
      .some((value) => value.includes(searchValue));
  });
};

const filterPaymentSheetsBySearch = (items, searchTerm) => {
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

const getStatusVariant = (status) => {
  if (status === "settled") return "DP";
  if (status === "partially_paid") return "secondary";
  if (status === "pending") return "outline";

  return "default";
};

export default function Sheets() {
  const [activeTab, setActiveTab] = useState("wiresheet");
  const [searchTerm, setSearchTerm] = useState("");

  const [dateMode, setDateMode] = useState("single");

  const [dateDraft, setDateDraft] = useState("");
  const [dateRangeDraft, setDateRangeDraft] = useState(EMPTY_DATE_RANGE);

  const [appliedDate, setAppliedDate] = useState("");
  const [appliedDateRange, setAppliedDateRange] = useState(EMPTY_DATE_RANGE);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(getDefaultPageSize);

  const isWiresheetTab = activeTab === "wiresheet";

  const dateFilters = useMemo(() => {
    if (isWiresheetTab || dateMode === "range") {
      return {
        ...(appliedDateRange.startDate
          ? { fromDate: toApiDate(appliedDateRange.startDate) }
          : {}),
        ...(appliedDateRange.endDate
          ? { toDate: toApiDate(appliedDateRange.endDate) }
          : {}),
      };
    }

    const apiDate = toApiDate(appliedDate);

    if (!apiDate) return {};

    return {
      fromDate: apiDate,
      toDate: apiDate,
    };
  }, [appliedDate, appliedDateRange, dateMode, isWiresheetTab]);

  const queryFilters = useMemo(
    () => ({
      page,
      limit,
      ...dateFilters,
    }),
    [dateFilters, limit, page],
  );

  const wiresheetsQuery = useWiresheets(queryFilters);
  const paymentSheetsQuery = usePaymentSheets(queryFilters);

  const activeQuery = isWiresheetTab ? wiresheetsQuery : paymentSheetsQuery;

  const wiresheets = wiresheetsQuery.data?.data || [];
  const wiresheetMeta = wiresheetsQuery.data?.meta || DEFAULT_META;

  const paymentSheets = paymentSheetsQuery.data?.data || [];
  const paymentSheetMeta = paymentSheetsQuery.data?.meta || DEFAULT_META;

  const filteredWiresheets = useMemo(
    () => filterWiresheetsBySearch(wiresheets, searchTerm),
    [searchTerm, wiresheets],
  );

  const filteredPaymentSheets = useMemo(
    () => filterPaymentSheetsBySearch(paymentSheets, searchTerm),
    [paymentSheets, searchTerm],
  );

  const activeRows = isWiresheetTab
    ? filteredWiresheets
    : filteredPaymentSheets;

  const activeMeta = isWiresheetTab ? wiresheetMeta : paymentSheetMeta;

  const activeColumns = isWiresheetTab ? wiresheetColumns : paymentSheetColumns;

  const emptyState = isWiresheetTab
    ? {
        icon: Landmark,
        title: "No wiresheets found",
        description: "Uploaded wiresheets will appear here once available.",
      }
    : {
        icon: CreditCard,
        title: "No payment sheets found",
        description: "Uploaded payment sheets will appear here once available.",
      };

  const pageTitle = isWiresheetTab ? "Wiresheets" : "Payment Sheets";

  const searchPlaceholder = isWiresheetTab
    ? "Search by wiresheet name, acquirer, status, uploaded by..."
    : "Search by file name, payment date, uploaded by...";

  useEffect(() => {
    if (wiresheetsQuery.error) {
      toast.error(
        getErrorMessage(wiresheetsQuery.error, "Failed to load wiresheets."),
      );
    }
  }, [wiresheetsQuery.error]);

  useEffect(() => {
    if (paymentSheetsQuery.error) {
      toast.error(
        getErrorMessage(
          paymentSheetsQuery.error,
          "Failed to load payment sheets.",
        ),
      );
    }
  }, [paymentSheetsQuery.error]);

  useEffect(() => {
    setPage(1);
  }, [activeTab, searchTerm, appliedDate, appliedDateRange, dateMode, limit]);

  const handleTabChange = (nextTab) => {
    setActiveTab(nextTab);
    setSearchTerm("");

    setDateDraft("");
    setDateRangeDraft(EMPTY_DATE_RANGE);

    setAppliedDate("");
    setAppliedDateRange(EMPTY_DATE_RANGE);

    setDateMode("single");
    setPage(1);
  };

  const handlePageSizeChange = (nextLimit) => {
    const normalizedLimit = Number(nextLimit);

    setLimit(normalizedLimit);
    setPage(1);

    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        "global-table-rows-per-page",
        String(normalizedLimit),
      );
    }
  };

  const handleApplyDateFilter = () => {
    if (isWiresheetTab || dateMode === "range") {
      setAppliedDateRange({ ...dateRangeDraft });
    } else {
      setAppliedDate(dateDraft);
    }

    setPage(1);
  };

  const handleClearDateFilter = () => {
    setDateDraft("");
    setDateRangeDraft(EMPTY_DATE_RANGE);

    setAppliedDate("");
    setAppliedDateRange(EMPTY_DATE_RANGE);

    setPage(1);
  };

  const handleDateModeChange = (nextMode) => {
    setDateMode(nextMode);
    handleClearDateFilter();
  };

  const renderDatePicker = () => {
    const isRangeDatePicker = isWiresheetTab || dateMode === "range";

    const hasDateDraft = isRangeDatePicker
      ? Boolean(dateRangeDraft.startDate || dateRangeDraft.endDate)
      : Boolean(dateDraft);

    const hasAppliedDate = isRangeDatePicker
      ? Boolean(appliedDateRange.startDate || appliedDateRange.endDate)
      : Boolean(appliedDate);

    return (
      <DatePicker
        mode={isRangeDatePicker ? "range" : "single"}
        allowModeSwitch={!isWiresheetTab}
        value={isRangeDatePicker ? dateRangeDraft : dateDraft}
        onChange={isRangeDatePicker ? setDateRangeDraft : setDateDraft}
        onModeChange={handleDateModeChange}
        onApply={handleApplyDateFilter}
        onClear={handleClearDateFilter}
        applyDisabled={!hasDateDraft}
        showClear={hasDateDraft || hasAppliedDate}
      />
    );
  };

  const renderTableRows = () => {
    if (isWiresheetTab) {
      return activeRows.map((row) => (
        <WiresheetRow
          key={row.wiresheetId}
          row={row}
          getStatusVariant={getStatusVariant}
        />
      ));
    }

    return activeRows.map((row, index) => (
      <PaymentSheetRow
        key={`${row.fileName}-${row.paymentDate}-${row.uploadedAt}-${index}`}
        row={row}
        getStatusVariant={getStatusVariant}
      />
    ));
  };

  if (activeQuery.isLoading) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center bg-surface p-4">
        <Spinner type="xl" />
      </div>
    );
  }

  return (
    <div className="w-full bg-background text-on-background">
      <div className="mb-6 rounded-2xl bg-surface-lowest px-5 py-5">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-on-surface">
            Sheets
          </h1>

          <p className="mt-1 text-sm text-on-surface-variant">
            Review uploaded wiresheets and payment sheets with search, upload
            date filters, and pagination.
          </p>
        </div>
      </div>

      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <Tabs
          activeTab={activeTab}
          onChange={handleTabChange}
          tabs={SHEET_TABS}
        />

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {renderDatePicker()}

          <SearchInput
            value={searchTerm}
            placeholder={searchPlaceholder}
            className="w-full sm:w-80"
            onChange={(event) => {
              setSearchTerm(event.target.value);
              setPage(1);
            }}
          />
        </div>
      </div>

      <DataTable
        title={pageTitle}
        columns={activeColumns}
        totalItems={activeMeta.total}
        itemLabel={isWiresheetTab ? "wiresheets" : "payment sheets"}
        isEmpty={activeRows.length === 0}
        emptyTitle={emptyState.title}
        emptyDescription={emptyState.description}
        emptyIcon={emptyState.icon}
        page={page}
        meta={activeMeta}
        pageSize={limit}
        onPageChange={setPage}
        onRowsPerPageChange={handlePageSizeChange}
        isFetching={activeQuery.isFetching}
      >
        {renderTableRows()}
      </DataTable>
    </div>
  );
}
