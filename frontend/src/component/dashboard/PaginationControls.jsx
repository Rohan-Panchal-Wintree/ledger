export default function PaginationControls({
  totalItems,
  currentPage,
  pageSize,
  onPageChange,
  onPageSizeChange,
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const showingFrom = totalItems === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1;
  const showingTo = Math.min(safeCurrentPage * pageSize, totalItems);

  return (
    <div className="flex flex-col gap-4 border-t border-outline-variant/10 px-5 py-5 md:flex-row md:items-center md:justify-between md:px-6">
      <div className="flex flex-col gap-3 text-sm text-on-surface-variant sm:flex-row sm:items-center sm:gap-5">
        <span>
          Showing {showingFrom}-{showingTo} of {totalItems}
        </span>

        <label className="flex items-center gap-2">
          <span>Rows</span>
          <select
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            className="rounded-full border border-outline-variant/20 bg-surface-container-low px-3 py-2 text-sm text-on-surface outline-none"
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={20}>20</option>
          </select>
        </label>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-sm text-on-surface-variant">
          Page {totalItems === 0 ? 0 : safeCurrentPage} of{" "}
          {totalItems === 0 ? 0 : totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, safeCurrentPage - 1))}
          disabled={safeCurrentPage <= 1 || totalItems === 0}
          className="rounded-full border border-outline-variant/20 px-4 py-2 text-sm font-semibold text-on-surface transition-all hover:bg-surface-container-low disabled:cursor-not-allowed disabled:opacity-60"
        >
          Previous
        </button>
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, safeCurrentPage + 1))}
          disabled={safeCurrentPage >= totalPages || totalItems === 0}
          className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-primary-container disabled:cursor-not-allowed disabled:bg-outline-variant"
        >
          Next
        </button>
      </div>
    </div>
  );
}
