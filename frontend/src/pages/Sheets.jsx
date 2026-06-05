import { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import toast from "react-hot-toast";
import { CreditCard, Landmark } from "lucide-react";

import DataTable from "../component/UI/DataTable";
import DatePicker from "../component/UI/DatePicker";
import SearchInput from "../component/UI/SearchInput";
import Spinner from "../component/UI/Spinner";
import Tabs from "../component/UI/Tabs";
import PageHeader from "../component/UI/PageHeader";

import PaymentSheetRow from "../component/sheets/PaymentSheetRow";
import WiresheetRow from "../component/sheets/WiresheetRow";

import {
  downloadSheetUpload,
  usePaymentSheets,
  useWiresheets,
} from "../queries/sheetsQueries";

import { getErrorMessage } from "../utils/appUtils";
import {
  DEFAULT_SHEETS_META,
  EMPTY_DATE_RANGE,
  SHEET_TABS,
  filterPaymentSheetsBySearch,
  filterWiresheetsBySearch,
  getDefaultSheetsPageSize,
  getStatusVariant,
  paymentSheetColumns,
  toApiDate,
  wiresheetColumns,
} from "../utils/sheetsUtils";
import { selectCurrentUser } from "../store/slices/Auth.slice";

export default function Sheets() {
  const [activeTab, setActiveTab] = useState("wiresheet");
  const [searchTerm, setSearchTerm] = useState("");

  const [dateMode, setDateMode] = useState("single");

  const [dateDraft, setDateDraft] = useState("");
  const [dateRangeDraft, setDateRangeDraft] = useState(EMPTY_DATE_RANGE);

  const [appliedDate, setAppliedDate] = useState("");
  const [appliedDateRange, setAppliedDateRange] = useState(EMPTY_DATE_RANGE);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(getDefaultSheetsPageSize);

  const currentUser = useSelector(selectCurrentUser);

  const canDownloadSheets = currentUser?.role === "admin";
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

  const wiresheets = (wiresheetsQuery.data?.data || []).filter(
    (row) => row.type === "wiresheet",
  );
  const wiresheetMeta = wiresheetsQuery.data?.meta || DEFAULT_SHEETS_META;

  const paymentSheets = (paymentSheetsQuery.data?.data || []).filter(
    (row) => row.type === "payment_sheet",
  );
  const paymentSheetMeta = paymentSheetsQuery.data?.meta || DEFAULT_SHEETS_META;

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

  const activeColumns = useMemo(() => {
    const baseColumns = isWiresheetTab ? wiresheetColumns : paymentSheetColumns;

    if (!canDownloadSheets) return baseColumns;

    return [
      ...baseColumns,
      { key: "actions", label: "Actions", align: "right" },
    ];
  }, [canDownloadSheets, isWiresheetTab]);

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
  }, [
    activeTab,
    searchTerm,
    appliedDate,
    appliedDateRange.startDate,
    appliedDateRange.endDate,
    dateMode,
  ]);

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
    setLimit(Number(nextLimit));
    setPage(1);
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

  const handleDownloadSheet = async ({ id, fileName }) => {
    try {
      await downloadSheetUpload(id, fileName);
      toast.success("Download started.");
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to download sheet."));
    }
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
          key={row.id}
          row={row}
          getStatusVariant={getStatusVariant}
          canDownload={canDownloadSheets}
          onDownload={() =>
            handleDownloadSheet({
              id: row.id,
              fileName: row.wiresheetName,
            })
          }
        />
      ));
    }

    return activeRows.map((row, index) => (
      <PaymentSheetRow
        key={`${row.fileName}-${row.paymentDate}-${row.uploadedAt}-${index}`}
        row={row}
        canDownload={canDownloadSheets}
        onDownload={() =>
          handleDownloadSheet({
            id: row.id,
            fileName: row.fileName,
          })
        }
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
      <PageHeader
        title="Sheets"
        description="Review uploaded wiresheets and payment sheets with search, date filters, and pagination."
        className="mb-6"
      />

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
        onPageChange={setPage}
        onRowsPerPageChange={handlePageSizeChange}
        isFetching={activeQuery.isFetching}
      >
        {renderTableRows()}
      </DataTable>
    </div>
  );
}
