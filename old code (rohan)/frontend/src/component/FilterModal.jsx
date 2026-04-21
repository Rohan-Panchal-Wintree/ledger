import React from "react";
import {
  X,
  Calendar,
  Building2,
  ChevronDown,
  Sparkles,
  Columns3,
  CircleDollarSign,
} from "lucide-react";

function MultiSelectField({
  icon,
  placeholder,
  options,
  selectedValues,
  onToggle,
}) {
  const TriggerIcon = icon;
  const selectedOptions = options.filter((option) =>
    selectedValues.includes(option.value),
  );

  return (
    <div>
      <details className="group relative">
        <summary className="flex w-full cursor-pointer list-none items-center rounded-lg border border-outline-variant/20 bg-surface-container-low px-3 py-2.5 text-sm text-on-surface transition hover:border-primary/40">
          <TriggerIcon className="mr-3 h-4 w-4 text-outline-variant" />
          <span className="min-w-0 flex-1 truncate">
            {selectedOptions.length > 0
              ? `${selectedOptions.length} selected`
              : placeholder}
          </span>
          <ChevronDown className="h-4 w-4 text-outline-variant transition group-open:rotate-180" />
        </summary>

        <div className="absolute z-20 mt-2 max-h-64 w-full overflow-y-auto rounded-lg border border-outline-variant/20 bg-surface-container-lowest p-2 shadow-lg">
          {options.length > 0 ? (
            options.map((option) => (
              <label
                key={option.value}
                className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm text-on-surface transition hover:bg-surface-container-low"
              >
                <input
                  type="checkbox"
                  checked={selectedValues.includes(option.value)}
                  onChange={() => onToggle(option.value)}
                  className="h-4 w-4 rounded border-outline-variant/30 text-primary focus:ring-primary"
                />
                <span>{option.label}</span>
              </label>
            ))
          ) : (
            <div className="px-3 py-2 text-sm text-on-surface-variant">
              No options available
            </div>
          )}
        </div>
      </details>

      {selectedOptions.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {selectedOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onToggle(option.value)}
              className="flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs text-primary"
            >
              {option.label}
              <X className="h-3 w-3" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function getPartnerValue(merchantTag) {
  const normalizedTag = String(merchantTag || "").toLowerCase();

  if (normalizedTag.includes("transactworld")) return "transactworld";
  if (normalizedTag.includes("dreamz")) return "dreamzpay";

  return "";
}

function matchesFilterContext(transaction, filters, excludedKeys = []) {
  const excludedSet = new Set(excludedKeys);
  const transactionStartDate = transaction.startDate
    ? new Date(transaction.startDate)
    : null;
  const transactionEndDate = transaction.endDate
    ? new Date(transaction.endDate)
    : null;
  const payableAmount = Number(transaction.payable) || 0;
  const merchantName = transaction.merchantName || transaction.merchant || "";
  const acquirerName = transaction.acquirer || transaction.bank || "";
  const partnerValue = getPartnerValue(transaction.merchantTag);

  if (
    !excludedSet.has("startDate") &&
    filters.startDate &&
    (!transactionStartDate ||
      Number.isNaN(transactionStartDate.getTime()) ||
      transactionStartDate < new Date(filters.startDate))
  ) {
    return false;
  }

  if (!excludedSet.has("endDate") && filters.endDate) {
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
    !excludedSet.has("minAmount") &&
    filters.minAmount &&
    payableAmount < Number(filters.minAmount)
  ) {
    return false;
  }

  if (
    !excludedSet.has("maxAmount") &&
    filters.maxAmount &&
    payableAmount > Number(filters.maxAmount)
  ) {
    return false;
  }

  if (
    !excludedSet.has("merchants") &&
    filters.merchants.length > 0 &&
    !filters.merchants.includes(merchantName)
  ) {
    return false;
  }

  if (
    !excludedSet.has("acquirers") &&
    filters.acquirers.length > 0 &&
    !filters.acquirers.includes(acquirerName)
  ) {
    return false;
  }

  if (
    !excludedSet.has("processingCurrencies") &&
    filters.processingCurrencies.length > 0 &&
    !filters.processingCurrencies.includes(transaction.processingCurrency)
  ) {
    return false;
  }

  if (
    !excludedSet.has("settlementCurrencies") &&
    filters.settlementCurrencies.length > 0 &&
    !filters.settlementCurrencies.includes(transaction.settlementCurrency)
  ) {
    return false;
  }

  if (
    !excludedSet.has("partners") &&
    filters.partners.length > 0 &&
    !filters.partners.includes(partnerValue)
  ) {
    return false;
  }

  if (
    !excludedSet.has("statuses") &&
    filters.statuses.length > 0 &&
    !filters.statuses.includes(transaction.status)
  ) {
    return false;
  }

  return true;
}

function buildCurrencyOptions(transactions, key) {
  return [...new Set(transactions.map((transaction) => transaction[key]).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right))
    .map((currency) => ({
      label: currency,
      value: currency,
    }));
}

export default function FilterModal({
  isOpen,
  onClose,
  filters,
  onApply,
  onReset,
  options,
  isAdmin,
}) {
  const [draftFilters, setDraftFilters] = React.useState(filters);

  React.useEffect(() => {
    setDraftFilters(filters);
  }, [filters, isOpen]);

  const availableProcessingCurrencyOptions = React.useMemo(() => {
    const filteredTransactions = (options.transactions || []).filter(
      (transaction) =>
        matchesFilterContext(transaction, draftFilters, ["processingCurrencies"]),
    );

    return buildCurrencyOptions(filteredTransactions, "processingCurrency");
  }, [draftFilters, options.transactions]);

  const availableSettlementCurrencyOptions = React.useMemo(() => {
    const filteredTransactions = (options.transactions || []).filter(
      (transaction) =>
        matchesFilterContext(transaction, draftFilters, ["settlementCurrencies"]),
    );

    return buildCurrencyOptions(filteredTransactions, "settlementCurrency");
  }, [draftFilters, options.transactions]);

  React.useEffect(() => {
    const allowedProcessingCurrencies = new Set(
      availableProcessingCurrencyOptions.map((option) => option.value),
    );
    const allowedSettlementCurrencies = new Set(
      availableSettlementCurrencyOptions.map((option) => option.value),
    );

    setDraftFilters((prev) => {
      const nextProcessingCurrencies = prev.processingCurrencies.filter((value) =>
        allowedProcessingCurrencies.has(value),
      );
      const nextSettlementCurrencies = prev.settlementCurrencies.filter((value) =>
        allowedSettlementCurrencies.has(value),
      );

      if (
        nextProcessingCurrencies.length === prev.processingCurrencies.length &&
        nextSettlementCurrencies.length === prev.settlementCurrencies.length
      ) {
        return prev;
      }

      return {
        ...prev,
        processingCurrencies: nextProcessingCurrencies,
        settlementCurrencies: nextSettlementCurrencies,
      };
    });
  }, [
    availableProcessingCurrencyOptions,
    availableSettlementCurrencyOptions,
  ]);

  if (!isOpen) return null;

  const toggleMultiSelect = (key, value) => {
    setDraftFilters((prev) => ({
      ...prev,
      [key]: prev[key].includes(value)
        ? prev[key].filter((item) => item !== value)
        : [...prev[key], value],
    }));
  };

  const toggleColumn = (columnKey) => {
    setDraftFilters((prev) => ({
      ...prev,
      visibleColumns: prev.visibleColumns.includes(columnKey)
        ? prev.visibleColumns.filter((item) => item !== columnKey)
        : [...prev.visibleColumns, columnKey],
    }));
  };

  const statusOptions = [
    { label: "Completed", value: "settled" },
    { label: "Partially Paid", value: "partially_paid" },
    { label: "Pending", value: "pending" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-on-surface/10 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-surface-container-lowest">
        <div className="border-b border-outline-variant/20 px-6 py-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-on-surface">
                Filter Transactions
              </h2>
              <p className="mt-1 text-sm text-on-surface-variant">
                Refine the dataset according to your preference.
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-2 transition hover:bg-surface-container"
            >
              <X className="h-5 w-5 text-on-surface-variant" />
            </button>
          </div>
        </div>

        <div className="space-y-8 overflow-y-auto px-6 py-6">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            <div>
              <p className="mb-3 text-xs font-semibold uppercase text-on-surface-variant">
                Date Range
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-outline-variant" />
                  <input
                    type="date"
                    value={draftFilters.startDate}
                    onChange={(e) =>
                      setDraftFilters((prev) => ({
                        ...prev,
                        startDate: e.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-outline-variant/20 bg-surface-container-low py-2.5 pl-10 pr-3 text-sm focus:border-primary focus:outline-none"
                  />
                </div>

                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-outline-variant" />
                  <input
                    type="date"
                    value={draftFilters.endDate}
                    onChange={(e) =>
                      setDraftFilters((prev) => ({
                        ...prev,
                        endDate: e.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-outline-variant/20 bg-surface-container-low py-2.5 pl-10 pr-3 text-sm focus:border-primary focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div>
              <p className="mb-3 text-xs font-semibold uppercase text-on-surface-variant">
                Amount Range
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="relative">
                  <CircleDollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-outline-variant" />
                  <input
                    type="number"
                    placeholder="Min"
                    value={draftFilters.minAmount}
                    onChange={(e) =>
                      setDraftFilters((prev) => ({
                        ...prev,
                        minAmount: e.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-outline-variant/20 bg-surface-container-low py-2.5 pl-10 pr-3 text-sm focus:border-primary focus:outline-none"
                  />
                </div>

                <div className="relative">
                  <CircleDollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-outline-variant" />
                  <input
                    type="number"
                    placeholder="Max"
                    value={draftFilters.maxAmount}
                    onChange={(e) =>
                      setDraftFilters((prev) => ({
                        ...prev,
                        maxAmount: e.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-outline-variant/20 bg-surface-container-low py-2.5 pl-10 pr-3 text-sm focus:border-primary focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div>
              <p className="mb-3 text-xs font-semibold uppercase text-on-surface-variant">
                Merchants
              </p>
              <MultiSelectField
                icon={Building2}
                placeholder="Select merchants"
                options={options.merchants}
                selectedValues={draftFilters.merchants}
                onToggle={(value) => toggleMultiSelect("merchants", value)}
              />
            </div>

            <div>
              <p className="mb-3 text-xs font-semibold uppercase text-on-surface-variant">
                Acquirers
              </p>
              <MultiSelectField
                icon={Building2}
                placeholder="Select acquirers"
                options={options.acquirers}
                selectedValues={draftFilters.acquirers}
                onToggle={(value) => toggleMultiSelect("acquirers", value)}
              />
            </div>

            <div>
              <p className="mb-3 text-xs font-semibold uppercase text-on-surface-variant">
                Processing Currency
              </p>
              <MultiSelectField
                icon={CircleDollarSign}
                placeholder="Select processing currencies"
                options={availableProcessingCurrencyOptions}
                selectedValues={draftFilters.processingCurrencies}
                onToggle={(value) =>
                  toggleMultiSelect("processingCurrencies", value)
                }
              />
            </div>

            <div>
              <p className="mb-3 text-xs font-semibold uppercase text-on-surface-variant">
                Settlement Currency
              </p>
              <MultiSelectField
                icon={CircleDollarSign}
                placeholder="Select settlement currencies"
                options={availableSettlementCurrencyOptions}
                selectedValues={draftFilters.settlementCurrencies}
                onToggle={(value) =>
                  toggleMultiSelect("settlementCurrencies", value)
                }
              />
            </div>

            {isAdmin && (
              <div>
                <p className="mb-3 text-xs font-semibold uppercase text-on-surface-variant">
                  Partners
                </p>
                <MultiSelectField
                  icon={Sparkles}
                  placeholder="Select partners"
                  options={options.partners}
                  selectedValues={draftFilters.partners}
                  onToggle={(value) => toggleMultiSelect("partners", value)}
                />
              </div>
            )}

            <div>
              <p className="mb-3 text-xs font-semibold uppercase text-on-surface-variant">
                Transaction Status
              </p>
              <div className="flex flex-wrap gap-2">
                {statusOptions.map((status) => {
                  const isChecked = draftFilters.statuses.includes(
                    status.value,
                  );

                  return (
                    <button
                      key={status.value}
                      type="button"
                      onClick={() =>
                        toggleMultiSelect("statuses", status.value)
                      }
                      className={`rounded-full border px-4 py-2 text-sm transition ${
                        isChecked
                          ? "border-primary bg-primary text-white"
                          : "border-outline-variant/30 text-on-surface-variant"
                      }`}
                    >
                      {status.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div>
            <div className="mb-3 flex items-center gap-2">
              <p className="text-xs font-semibold uppercase text-on-surface-variant">
                Visible Columns
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
              {options.columns.map((column) => (
                <label
                  key={column.key}
                  className="flex cursor-pointer items-center gap-3 rounded-xl border border-outline-variant/20 bg-surface-container-low px-4 py-3 text-sm text-on-surface transition hover:border-primary/30"
                >
                  <input
                    type="checkbox"
                    checked={draftFilters.visibleColumns.includes(column.key)}
                    onChange={() => toggleColumn(column.key)}
                    className="h-4 w-4 rounded border-outline-variant/30 text-primary focus:ring-primary"
                  />
                  <span>{column.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-primary/10 bg-primary/5 p-4">
            <p className="text-sm italic text-on-surface-variant">
              Applying filters will refine your transaction dataset and keep
              those preferences saved for the next visit.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-outline-variant/20 px-6 py-4">
          <button
            type="button"
            onClick={onReset}
            className="text-sm font-medium text-on-surface-variant transition hover:text-on-surface"
          >
            Reset
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-surface-container px-5 py-2.5 text-sm font-semibold text-on-surface-variant transition hover:bg-surface-container-high"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onApply(draftFilters)}
              className="rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-container"
            >
              Apply Filters
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
