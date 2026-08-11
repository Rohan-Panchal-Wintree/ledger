import { useEffect, useState } from "react";

import Button from "../UI/Button";
import DatePicker from "../UI/DatePicker";
import FormField from "../UI/FormField";
import SearchInput from "../UI/SearchInput";

const STATUS_OPTIONS = [
  { label: "All Issues", value: "" },
  { label: "Invalid", value: "invalid" },
  { label: "Unmatched", value: "unmatched" },
];

function getInitialDateMode(filters) {
  return filters?.fromDate || filters?.toDate ? "range" : "single";
}

export default function ReviewIssuesFilterForm({
  formId = "review-issues-filter-form",
  filters,
  onChange,
  onApply,
}) {
  const [dateMode, setDateMode] = useState(() => getInitialDateMode(filters));

  useEffect(() => {
    setDateMode(getInitialDateMode(filters));
  }, [filters?.fromDate, filters?.toDate]);

  const handleSubmit = (event) => {
    event.preventDefault();
    onApply?.();
  };

  const handleDateModeChange = (nextMode) => {
    setDateMode(nextMode);

    onChange?.("paymentDate", "");
    onChange?.("fromDate", "");
    onChange?.("toDate", "");
  };

  const handleDateChange = (nextValue) => {
    if (dateMode === "single") {
      onChange?.("paymentDate", nextValue);
      return;
    }

    onChange?.("fromDate", nextValue?.startDate || "");
    onChange?.("toDate", nextValue?.endDate || "");
  };

  const handleClearDate = () => {
    onChange?.("paymentDate", "");
    onChange?.("fromDate", "");
    onChange?.("toDate", "");
  };

  const datePickerValue =
    dateMode === "single"
      ? filters?.paymentDate || ""
      : {
          startDate: filters?.fromDate || "",
          endDate: filters?.toDate || "",
        };

  return (
    <form id={formId} onSubmit={handleSubmit} className="space-y-8">
      <div>
        <p className="mb-3 text-xs font-bold uppercase tracking-widest text-on-surface-variant">
          Issue Status
        </p>

        <div className="flex flex-wrap gap-2">
          {STATUS_OPTIONS.map((option) => {
            const isActive = (filters?.status || "") === option.value;

            return (
              <Button
                key={option.value || "all"}
                type="button"
                variant={isActive ? "primary" : "secondary"}
                size="sm"
                rounded="full"
                onClick={() => onChange?.("status", option.value)}
              >
                {option.label}
              </Button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="mb-3 text-xs font-bold uppercase tracking-widest text-on-surface-variant">
          Payment Date
        </p>

        <DatePicker
          mode={dateMode}
          allowModeSwitch
          value={datePickerValue}
          onModeChange={handleDateModeChange}
          onChange={handleDateChange}
          onClear={handleClearDate}
          showApply={false}
          showClear
          className="w-full justify-start rounded-xl"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <FormField label="Bank">
          <SearchInput
            value={filters?.bank || ""}
            placeholder="Filter by bank name..."
            inputClassName="rounded-xl"
            onChange={(event) => onChange?.("bank", event.target.value)}
          />
        </FormField>

        <FormField label="Merchant Name">
          <SearchInput
            value={filters?.merchantName || ""}
            placeholder="Filter by merchant name..."
            inputClassName="rounded-xl"
            onChange={(event) => onChange?.("merchantName", event.target.value)}
          />
        </FormField>

        <FormField label="Currency">
          <SearchInput
            value={filters?.currency || ""}
            placeholder="Processing or settlement currency..."
            inputClassName="rounded-xl"
            onChange={(event) => onChange?.("currency", event.target.value)}
          />
        </FormField>
      </div>
    </form>
  );
}
