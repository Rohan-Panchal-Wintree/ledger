import { useState } from "react";

import EmptyState from "./EmptyState";
import Spinner from "./Spinner";

const TABLE_ROWS_STORAGE_KEY = "global-table-rows-per-page";
const DEFAULT_ROWS_PER_PAGE = 50;
const ROWS_PER_PAGE_OPTIONS = [25, 50, 100];

export function readStoredRowsPerPage() {
  if (typeof window === "undefined") return DEFAULT_ROWS_PER_PAGE;

  const storedValue = Number(
    window.localStorage.getItem(TABLE_ROWS_STORAGE_KEY),
  );

  return ROWS_PER_PAGE_OPTIONS.includes(storedValue)
    ? storedValue
    : DEFAULT_ROWS_PER_PAGE;
}

export default function DataTable({
  title,
  description,
  columns = [],
  children,
  isLoading = false,
  isFetching = false,
  isEmpty = false,
  emptyTitle = "No data found.",
  emptyDescription = "",
  emptyIcon,
  page = 1,
  pageSize,
  totalItems = 0,
  onPageChange,
  onRowsPerPageChange,
  showFooter = true,
  itemLabel = "records",
  className = "",
}) {
  const [internalRowsPerPage, setInternalRowsPerPage] = useState(
    readStoredRowsPerPage,
  );

  const rowsPerPage = pageSize || internalRowsPerPage;

  const totalPages = Math.max(1, Math.ceil(totalItems / rowsPerPage));
  const safePage = Math.min(page, totalPages);

  const showingFrom = totalItems > 0 ? (safePage - 1) * rowsPerPage + 1 : 0;
  const showingTo = Math.min(safePage * rowsPerPage, totalItems);

  const hasMultiplePages = totalPages > 1;
  const isPreviousDisabled = !hasMultiplePages || safePage <= 1;
  const isNextDisabled = !hasMultiplePages || safePage >= totalPages;

  const handleRowsPerPageChange = (value) => {
    setInternalRowsPerPage(value);

    if (typeof window !== "undefined") {
      window.localStorage.setItem(TABLE_ROWS_STORAGE_KEY, String(value));
    }

    onRowsPerPageChange?.(value);
    onPageChange?.(1);
  };

  return (
    <section
      className={`overflow-hidden rounded-lg border border-outline-variant/10 bg-surface-container-lowest ${className}`}
    >
      {title || description ? (
        <div className="flex items-center justify-between border-b border-outline-variant/5 px-8 py-6">
          <div>
            {title ? (
              <h3 className="text-xl font-bold tracking-tight text-on-surface">
                {title}
              </h3>
            ) : null}

            {description ? (
              <p className="mt-1 text-sm text-on-surface-variant">
                {description}
              </p>
            ) : null}
          </div>

          {isFetching && !isLoading ? <Spinner type="sm" /> : null}
        </div>
      ) : null}

      <div className="overflow-x-auto scrollbar-hide">
        <table className="w-full border-collapse text-left">
          <thead className="bg-surface-container-low/50">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key || column.label}
                  className={`whitespace-nowrap px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant ${
                    column.align === "center"
                      ? "text-center"
                      : column.align === "right"
                        ? "text-right"
                        : ""
                  }`}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-outline-variant/5">
            {isLoading ? (
              <tr>
                <td colSpan={columns.length} className="px-8 py-12 text-center">
                  <Spinner type="md" />
                </td>
              </tr>
            ) : isEmpty ? (
              <tr>
                <td colSpan={columns.length} className="px-8 py-12">
                  <EmptyState
                    title={emptyTitle}
                    description={emptyDescription}
                    icon={emptyIcon}
                    compact
                  />
                </td>
              </tr>
            ) : (
              children
            )}
          </tbody>
        </table>
      </div>

      {showFooter ? (
        <div className="flex flex-col gap-4 bg-surface-container-low/30 px-8 py-4 text-xs font-bold uppercase tracking-widest text-on-surface-variant lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <div>
              Showing {showingFrom > 0 ? `${showingFrom}-${showingTo}` : "0"} of{" "}
              {totalItems} {itemLabel}
            </div>

            <label className="flex items-center gap-2">
              <span>Rows</span>

              <select
                value={rowsPerPage}
                onChange={(event) =>
                  handleRowsPerPageChange(Number(event.target.value))
                }
                className="rounded-full bg-surface-container px-3 py-2 text-xs font-bold text-on-surface outline-none"
              >
                {ROWS_PER_PAGE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex items-center gap-2">
            <span>
              Page {showingFrom === 0 ? 0 : safePage} of{" "}
              {totalItems === 0 ? 0 : totalPages}
            </span>

            <button
              type="button"
              onClick={() => onPageChange?.(Math.max(1, safePage - 1))}
              disabled={isPreviousDisabled}
              className="rounded-full px-4 py-2 transition-colors hover:bg-surface-container disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>

            <button
              type="button"
              onClick={() => onPageChange?.(Math.min(totalPages, safePage + 1))}
              disabled={isNextDisabled}
              className="rounded-full bg-primary px-4 py-2 text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
