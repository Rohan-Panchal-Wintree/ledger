import { Calendar, X } from "lucide-react";

function hasRangeValue(value) {
  return Boolean(value?.startDate || value?.endDate);
}

export default function DatePicker({
  mode = "single",
  value,
  onChange,
  onApply,
  onClear,
  onModeChange,
  allowModeSwitch = false,
  max,
  min,
  disabled = false,
  applyDisabled = false,
  showApply = true,
  showClear = true,
  className = "",
}) {
  const isRangeMode = mode === "range";

  const singleValue = isRangeMode ? "" : value || "";
  const startDate = isRangeMode ? value?.startDate || "" : "";
  const endDate = isRangeMode ? value?.endDate || "" : "";

  const hasValue = isRangeMode ? hasRangeValue(value) : Boolean(singleValue);

  const handleModeChange = (event) => {
    const nextMode = event.target.value;

    onModeChange?.(nextMode);
  };

  const handleRangeChange = (field, nextValue) => {
    onChange?.({
      startDate,
      endDate,
      [field]: nextValue,
    });
  };

  return (
    <div
      className={`flex flex-wrap items-center gap-2 rounded-full bg-surface-container-low px-3 py-2 ${className}`}
    >
      {allowModeSwitch ? (
        <select
          value={mode}
          disabled={disabled}
          onChange={handleModeChange}
          className="rounded-full bg-surface-container-lowest px-2 py-1 text-xs font-bold text-on-surface-variant outline-none disabled:cursor-not-allowed disabled:opacity-60"
        >
          <option value="single">Single</option>
          <option value="range">Range</option>
        </select>
      ) : null}

      <Calendar size={16} className="text-on-surface-variant" />

      {isRangeMode ? (
        <>
          <input
            type="date"
            value={startDate}
            min={min}
            max={endDate || max}
            disabled={disabled}
            aria-label="Start date"
            onChange={(event) =>
              handleRangeChange("startDate", event.target.value)
            }
            className="w-35 bg-transparent text-sm font-semibold text-on-surface-variant outline-none disabled:cursor-not-allowed disabled:opacity-60"
          />

          <span className="text-xs font-bold text-on-surface-variant bg-surface-container-lowest p-2 rounded-md">
            to
          </span>

          <input
            type="date"
            value={endDate}
            min={startDate || min}
            max={max}
            disabled={disabled}
            aria-label="End date"
            onChange={(event) =>
              handleRangeChange("endDate", event.target.value)
            }
            className="w-35 bg-transparent text-sm font-semibold text-on-surface-variant outline-none disabled:cursor-not-allowed disabled:opacity-60"
          />
        </>
      ) : (
        <input
          type="date"
          value={singleValue}
          min={min}
          max={max}
          disabled={disabled}
          onChange={(event) => onChange?.(event.target.value)}
          className="w-35 bg-transparent text-sm font-semibold text-on-surface-variant outline-none disabled:cursor-not-allowed disabled:opacity-60"
        />
      )}

      {showApply ? (
        <button
          type="button"
          onClick={onApply}
          disabled={applyDisabled || disabled}
          className="rounded-full bg-primary px-3 py-1 text-xs font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
        >
          Get
        </button>
      ) : null}

      {showClear && hasValue ? (
        <button
          type="button"
          onClick={onClear}
          disabled={disabled}
          className="flex h-6 w-6 items-center justify-center rounded-full text-on-surface-variant transition hover:bg-primary/5 hover:text-on-surface disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Clear date filter"
        >
          <X size={14} />
        </button>
      ) : null}
    </div>
  );
}
