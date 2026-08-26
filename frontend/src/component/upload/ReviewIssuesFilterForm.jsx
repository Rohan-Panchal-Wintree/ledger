import { useEffect, useMemo, useState } from "react";

import Button from "../UI/Button";
import DatePicker from "../UI/DatePicker";
import FormField from "../UI/FormField";
import SearchableDropdown from "../UI/SearchableDropdown";

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
  filterOptions = {
    banks: [],
    merchants: [],
    currencies: [],
  },
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

  const bankOptions = useMemo(
    () => [
      { label: "All Banks", value: "" },
      ...(filterOptions?.banks || []).map((bank) => ({
        label: bank,
        value: bank,
      })),
    ],
    [filterOptions?.banks],
  );

  const merchantOptions = useMemo(
    () => [
      { label: "All Merchants", value: "" },
      ...(filterOptions?.merchants || []).map((merchant) => ({
        label: merchant,
        value: merchant,
      })),
    ],
    [filterOptions?.merchants],
  );

  const currencyOptions = useMemo(
    () => [
      { label: "All Currencies", value: "" },
      ...(filterOptions?.currencies || []).map((currency) => ({
        label: currency,
        value: currency,
      })),
    ],
    [filterOptions?.currencies],
  );

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

      <div className="inline-block">
        <FormField label="Payment Date">
          <DatePicker
            mode={dateMode}
            allowModeSwitch
            value={datePickerValue}
            onModeChange={handleDateModeChange}
            onChange={handleDateChange}
            onClear={handleClearDate}
            showApply={false}
            showClear
          />
        </FormField>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <FormField label="Bank">
          <SearchableDropdown
            value={filters?.bank || ""}
            options={bankOptions}
            placeholder="All Banks"
            searchPlaceholder="Search banks..."
            onChange={(value) => onChange?.("bank", value)}
          />
        </FormField>

        <FormField label="Merchant Name">
          <SearchableDropdown
            value={filters?.merchantName || ""}
            options={merchantOptions}
            placeholder="All Merchants"
            searchPlaceholder="Search merchants..."
            onChange={(value) => onChange?.("merchantName", value)}
          />
        </FormField>

        <FormField label="Currency">
          <SearchableDropdown
            value={filters?.currency || ""}
            options={currencyOptions}
            placeholder="All Currencies"
            searchPlaceholder="Search currencies..."
            onChange={(value) => onChange?.("currency", value)}
          />
        </FormField>
      </div>
    </form>
  );
}
