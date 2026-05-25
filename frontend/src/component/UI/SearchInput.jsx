import { Search } from "lucide-react";

export default function SearchInput({
  value,
  onChange,
  placeholder = "Search...",
  className = "",
  inputClassName = "",
}) {
  return (
    <div className={`relative ${className}`}>
      <Search
        className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant"
        size={16}
      />

      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        className={`w-full rounded-full border-none bg-surface-container-low py-2 pl-10 pr-4 text-sm text-on-surface outline-none transition-all focus:ring-2 focus:ring-primary/20 ${inputClassName}`}
      />
    </div>
  );
}
