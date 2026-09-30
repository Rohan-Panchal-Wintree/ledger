import { Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export default function SearchInput({
  value = "",
  onChange,
  placeholder = "Search...",
  className = "",
  inputClassName = "",
  debounceMs = 400,
}) {
  const [draftValue, setDraftValue] = useState(value ?? "");

  const timeoutRef = useRef(null);

  useEffect(() => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    setDraftValue(value ?? "");
  }, [value]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const emitChange = (nextValue) => {
    onChange?.({
      target: {
        value: nextValue,
      },
    });
  };

  const handleChange = (event) => {
    const nextValue = event.target.value;

    setDraftValue(nextValue);

    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }

    if (debounceMs <= 0) {
      emitChange(nextValue);
      return;
    }

    timeoutRef.current = window.setTimeout(() => {
      emitChange(nextValue);
      timeoutRef.current = null;
    }, debounceMs);
  };

  return (
    <div className={`relative ${className}`}>
      <Search
        className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant"
        size={16}
      />

      <input
        type="text"
        placeholder={placeholder}
        value={draftValue}
        onChange={handleChange}
        className={`w-full rounded-full border-none bg-surface-container-low py-2 pl-10 pr-4 text-sm text-on-surface outline-none transition-all focus:ring-2 focus:ring-primary ${inputClassName}`}
      />
    </div>
  );
}
