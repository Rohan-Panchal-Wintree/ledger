import { ChevronDown } from "lucide-react";
import { useMemo, useState } from "react";

import SearchInput from "./SearchInput.jsx";

export default function SearchableDropdown({
  value,
  options = [],
  placeholder = "Select option",
  searchPlaceholder = "Search...",
  disabled = false,
  onChange,
}) {
  const [searchValue, setSearchValue] = useState("");

  const selectedOption = options.find((option) => option.value === value);

  const selectedLabel = selectedOption?.label || value;

  const filteredOptions = useMemo(() => {
    const query = searchValue.trim().toLowerCase();

    if (!query) return options;

    return options.filter((option) =>
      String(option.label || option.value || "")
        .toLowerCase()
        .includes(query),
    );
  }, [options, searchValue]);

  return (
    <div className="dropdown w-full">
      <button
        type="button"
        tabIndex={0}
        disabled={disabled}
        className="select select-bordered flex w-full items-center justify-between rounded-xl border-outline-variant/20 bg-surface-container-low text-sm text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span
          className={
            value ? "truncate text-on-surface" : "truncate text-outline"
          }
        >
          {selectedLabel || placeholder}
        </span>
      </button>

      <div
        tabIndex={0}
        className="dropdown-content z-50 mt-2 w-full rounded-lg border border-outline-variant/10 bg-surface-container-lowest p-2 shadow-xl"
      >
        <SearchInput
          value={searchValue}
          placeholder={searchPlaceholder}
          className="mb-2"
          inputClassName="h-9 rounded-lg bg-surface-container-low py-0"
          onChange={(event) => setSearchValue(event.target.value)}
        />

        <ul className="flex max-h-56 flex-col gap-1 overflow-y-auto p-0">
          {filteredOptions.length ? (
            filteredOptions.map((option) => (
              <li key={option.value} className="w-full">
                <button
                  type="button"
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
                    option.value === value
                      ? "bg-primary/10 text-primary"
                      : "text-on-surface hover:bg-surface-container-low"
                  }`}
                  onClick={() => {
                    onChange?.(option.value);
                    setSearchValue("");

                    if (document.activeElement instanceof HTMLElement) {
                      document.activeElement.blur();
                    }
                  }}
                >
                  {option.label}
                </button>
              </li>
            ))
          ) : (
            <li className="w-full px-3 py-2 text-sm text-on-surface-variant">
              No options found
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
