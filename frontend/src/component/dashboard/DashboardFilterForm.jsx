import { useEffect, useMemo, useState } from "react";
import { Building2, Calendar, Coins, Sparkles } from "lucide-react";

import FormField from "../UI/FormField";
import SearchInput from "../UI/SearchInput";
import Button from "../UI/Button";

import { createDefaultFilters } from "../../utils/dashboardUtils";

const statusOptions = [
  { label: "Completed", value: "settled" },
  { label: "Partially Paid", value: "partially_paid" },
  { label: "Pending", value: "pending" },
];

function MultiSelectField({
  icon,
  placeholder,
  options = [],
  selectedValues = [],
  onToggle,
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const Icon = icon;

  const selectedOptions = useMemo(() => {
    return options.filter((option) => selectedValues.includes(option.value));
  }, [options, selectedValues]);

  const filteredOptions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) return options;

    return options.filter((option) =>
      String(option.label || "")
        .toLowerCase()
        .includes(query),
    );
  }, [options, searchQuery]);

  return (
    <div className="dropdown w-full">
      <button
        type="button"
        tabIndex={0}
        className="flex w-full items-center rounded-xl border border-outline-variant/20 bg-surface-container-low px-3 py-2.5 text-sm text-on-surface transition hover:border-primary/40"
      >
        <Icon className="mr-3 h-4 w-4 text-on-surface-variant" />

        <span className="min-w-0 flex-1 truncate text-left">
          {selectedOptions.length > 0
            ? `${selectedOptions.length} selected`
            : placeholder}
        </span>
      </button>

      <div
        tabIndex={0}
        className="dropdown-content z-9999 mt-2 max-h-72 w-full overflow-y-auto rounded-lg border border-outline-variant/10 bg-surface-container-lowest p-2 shadow-xl"
      >
        <SearchInput
          value={searchQuery}
          placeholder="Search options..."
          className="mb-2"
          inputClassName="rounded-xl"
          onChange={(event) => setSearchQuery(event.target.value)}
        />

        <div className="space-y-1">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option) => {
              const isSelected = selectedValues.includes(option.value);

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onToggle(option.value)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition ${
                    isSelected
                      ? "bg-primary/10 font-semibold text-primary"
                      : "text-on-surface hover:bg-surface-container-low"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    readOnly
                    className="checkbox checkbox-sm"
                  />

                  <span className="min-w-0 flex-1 truncate">
                    {option.label}
                  </span>
                </button>
              );
            })
          ) : (
            <div className="px-3 py-3 text-sm text-on-surface-variant">
              No options available.
            </div>
          )}
        </div>
      </div>

      {selectedOptions.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {selectedOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onToggle(option.value)}
              className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary"
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function DashboardFilterForm({
  formId = "dashboard-filter-form",
  filters,
  onApply,
  options = {},
  isAdmin,
}) {
  const [draftFilters, setDraftFilters] = useState(
    filters || createDefaultFilters(),
  );

  useEffect(() => {
    setDraftFilters(filters || createDefaultFilters());
  }, [filters]);

  const merchantOptions = options.merchants || [];
  const acquirerOptions = options.acquirers || [];
  const partnerOptions = options.partners || [];
  const processingCurrencyOptions = options.processingCurrencies || [];
  const settlementCurrencyOptions = options.settlementCurrencies || [];
  const columnOptions = options.columns || [];

  const toggleMultiSelect = (key, value) => {
    setDraftFilters((prev) => {
      const currentValues = prev[key] || [];

      return {
        ...prev,
        [key]: currentValues.includes(value)
          ? currentValues.filter((item) => item !== value)
          : [...currentValues, value],
      };
    });
  };

  const toggleColumn = (columnKey) => {
    setDraftFilters((prev) => ({
      ...prev,
      visibleColumns: prev.visibleColumns.includes(columnKey)
        ? prev.visibleColumns.filter((item) => item !== columnKey)
        : [...prev.visibleColumns, columnKey],
    }));
  };

  const handleChange = (key, value) => {
    setDraftFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    onApply(draftFilters);
  };

  return (
    <form id={formId} onSubmit={handleSubmit} className="space-y-8">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-on-surface-variant">
            Date Range
          </p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField label="Start Date">
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />

                <input
                  type="date"
                  value={draftFilters.startDate}
                  onChange={(event) =>
                    handleChange("startDate", event.target.value)
                  }
                  className="form-input pl-10"
                />
              </div>
            </FormField>

            <FormField label="End Date">
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />

                <input
                  type="date"
                  value={draftFilters.endDate}
                  onChange={(event) =>
                    handleChange("endDate", event.target.value)
                  }
                  className="form-input pl-10"
                />
              </div>
            </FormField>
          </div>
        </div>

        <FormField label="Merchants">
          <MultiSelectField
            icon={Building2}
            placeholder="Select merchants"
            options={merchantOptions}
            selectedValues={draftFilters.merchants}
            onToggle={(value) => toggleMultiSelect("merchants", value)}
          />
        </FormField>

        <FormField label="Acquirers">
          <MultiSelectField
            icon={Building2}
            placeholder="Select acquirers"
            options={acquirerOptions}
            selectedValues={draftFilters.acquirers}
            onToggle={(value) => toggleMultiSelect("acquirers", value)}
          />
        </FormField>

        {isAdmin ? (
          <FormField label="Partners">
            <MultiSelectField
              icon={Sparkles}
              placeholder="Select partners"
              options={partnerOptions}
              selectedValues={draftFilters.partners}
              onToggle={(value) => toggleMultiSelect("partners", value)}
            />
          </FormField>
        ) : null}

        <FormField label="Processing Currency">
          <MultiSelectField
            icon={Coins}
            placeholder="Select processing currencies"
            options={processingCurrencyOptions}
            selectedValues={draftFilters.processingCurrencies}
            onToggle={(value) =>
              toggleMultiSelect("processingCurrencies", value)
            }
          />
        </FormField>

        <FormField label="Settlement Currency">
          <MultiSelectField
            icon={Coins}
            placeholder="Select settlement currencies"
            options={settlementCurrencyOptions}
            selectedValues={draftFilters.settlementCurrencies}
            onToggle={(value) =>
              toggleMultiSelect("settlementCurrencies", value)
            }
          />
        </FormField>

        <div>
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-on-surface-variant">
            Transaction Status
          </p>

          <div className="flex flex-wrap gap-2">
            {statusOptions.map((status) => {
              const isActive = draftFilters.statuses.includes(status.value);

              return (
                <Button
                  key={status.value}
                  type="button"
                  variant={isActive ? "primary" : "secondary"}
                  size="sm"
                  rounded="full"
                  onClick={() => toggleMultiSelect("statuses", status.value)}
                >
                  {status.label}
                </Button>
              );
            })}
          </div>
        </div>
      </div>

      <div>
        <div className="mb-3 flex items-center gap-2">
          <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
            Visible Columns
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {columnOptions.map((column) => {
            const isChecked = draftFilters.visibleColumns.includes(column.key);

            return (
              <label
                key={column.key}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition ${
                  isChecked
                    ? "border-primary/30 bg-primary/8 text-on-surface"
                    : "border-outline-variant/20 bg-surface-container-low text-on-surface-variant hover:border-primary/30 hover:text-on-surface"
                }`}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggleColumn(column.key)}
                  className="checkbox checkbox-sm"
                />

                <span>{column.label}</span>
              </label>
            );
          })}
        </div>
      </div>
    </form>
  );
}
