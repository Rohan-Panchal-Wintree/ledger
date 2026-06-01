import { useMemo, useState } from "react";
import toast from "react-hot-toast";

import Button from "../UI/Button";
import DatePicker from "../UI/DatePicker";

import { useReportDates } from "../../queries/reportQueries";

import { getErrorMessage } from "../../utils/appUtils";

function getValidRecentReportDates(dates = [], maxDate) {
  return dates
    .filter((date) => {
      const parsedDate = new Date(date);

      return !Number.isNaN(parsedDate.getTime()) && date <= maxDate;
    })
    .sort((a, b) => new Date(b) - new Date(a))
    .slice(0, 5);
}

export default function ReportDateSelector({
  appliedDate,
  isFetching = false,
  onApplyDate,
}) {
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedQuickDate, setSelectedQuickDate] = useState("");

  const today = new Date().toISOString().slice(0, 10);

  const reportDatesQuery = useReportDates();

  const reportDateButtons = useMemo(
    () => getValidRecentReportDates(reportDatesQuery.data || [], today),
    [reportDatesQuery.data, today],
  );

  const handleReportDateClick = (date) => {
    if (selectedQuickDate === date) {
      setSelectedQuickDate("");
      onApplyDate?.("");
      return;
    }

    setSelectedQuickDate(date);
    setSelectedDate("");
    onApplyDate?.(date);
  };

  const handleGetReport = () => {
    if (!selectedDate) return;

    setSelectedQuickDate("");
    onApplyDate?.(selectedDate);
  };

  const handleClearDate = () => {
    setSelectedDate("");
    setSelectedQuickDate("");
    onApplyDate?.("");
  };

  if (reportDatesQuery.error) {
    toast.error(
      getErrorMessage(reportDatesQuery.error, "Failed to load report dates."),
    );
  }

  return (
    <div className="rounded-2xl bg-surface-lowest px-5 py-5">
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-on-surface">
            Select Report Date
          </h2>

          <p className="mt-1 text-sm text-surface-variant">
            Choose a date or use one of the quick report date buttons.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <DatePicker
            value={selectedDate}
            max={today}
            onChange={setSelectedDate}
            onApply={handleGetReport}
            onClear={handleClearDate}
            applyDisabled={!selectedDate || isFetching}
            showClear={Boolean(selectedDate || appliedDate)}
          />

          <div className="flex flex-wrap gap-2">
            {reportDateButtons.map((date) => (
              <Button
                key={date}
                type="button"
                onClick={() => handleReportDateClick(date)}
                variant={
                  selectedQuickDate === date || selectedDate === date
                    ? "primary"
                    : "secondary"
                }
                size="sm"
              >
                {date}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
