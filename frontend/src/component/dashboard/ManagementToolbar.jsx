import { Plus, Search } from "lucide-react";

export default function ManagementToolbar({
  title,
  description,
  searchValue,
  onSearchChange,
  searchPlaceholder,
  actionLabel,
  onAction,
  actionDisabled = false,
  children,
}) {
  return (
    <div className="flex flex-col gap-5 border-b border-outline-variant/10 px-5 py-5 md:px-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <h2 className="text-2xl font-extrabold tracking-tight text-on-surface">
            {title}
          </h2>
          <p className="mt-2 text-sm text-on-surface-variant">{description}</p>
        </div>

        <button
          type="button"
          onClick={onAction}
          disabled={actionDisabled}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white transition-all hover:bg-primary-container disabled:cursor-not-allowed disabled:bg-outline-variant"
        >
          <Plus size={16} />
          {actionLabel}
        </button>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:max-w-md">
          <Search
            size={16}
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant"
          />
          <input
            type="text"
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={searchPlaceholder}
            className="w-full rounded-full border border-outline-variant/20 bg-surface-container-low px-11 py-3 text-sm text-on-surface outline-none transition-all focus:border-primary/30 focus:ring-2 focus:ring-primary/10"
          />
        </div>

        {children ? <div className="flex items-center gap-3">{children}</div> : null}
      </div>
    </div>
  );
}
