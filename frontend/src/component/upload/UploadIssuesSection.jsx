import { useEffect, useMemo, useRef } from "react";
import { Filter, RefreshCcw } from "lucide-react";

import Button from "../UI/Button";
import DataTable from "../UI/DataTable";
import Spinner from "../UI/Spinner";

import UploadIssueRow from "./UploadIssueRow";

import { uploadIssueColumns } from "./uploadIssueConstants";

export default function UploadIssuesSection({
  rows = [],
  meta = {},
  page = 1,
  onPageChange,
  onPageSizeChange,
  onEdit,
  onReconcile,
  isReconciling = false,
  isFetching = false,
  title = "Review Upload Issues",
  description = "Fix invalid rows and reconcile unmatched payment rows.",
  openReviewFilter,
  activeReviewFilterCount = 0,
}) {
  const sectionRef = useRef(null);

  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      if (a.status === "invalid" && b.status !== "invalid") return -1;
      if (a.status !== "invalid" && b.status === "invalid") return 1;

      return 0;
    });
  }, [rows]);

  useEffect(() => {
    sectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, [page]);

  if (!rows.length) return null;

  return (
    <section ref={sectionRef} className="space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-on-surface">
            {title}
          </h2>

          <p className="mt-1 text-sm text-on-surface-variant">{description}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-full bg-surface-container-low px-4 py-2 text-xs font-bold uppercase tracking-wider text-on-surface">
            {meta.total || 0} {(meta.total || 0) === 1 ? "Issue" : "Issues"}
          </div>

          <Button
            type="button"
            variant="primary"
            size="sm"
            leftIcon={<RefreshCcw className="h-4 w-4" />}
            loading={isReconciling}
            disabled={isReconciling}
            onClick={onReconcile}
          >
            Reconcile
          </Button>

          <div className="flex justify-end">
            <Button
              type="button"
              variant="secondary"
              leftIcon={<Filter size={16} />}
              onClick={openReviewFilter}
            >
              Filters
              {activeReviewFilterCount > 0
                ? ` (${activeReviewFilterCount})`
                : ""}
            </Button>
          </div>
        </div>
      </div>

      <DataTable
        columns={uploadIssueColumns}
        totalItems={meta.total || 0}
        page={page}
        onPageChange={onPageChange}
        onRowsPerPageChange={onPageSizeChange}
        isEmpty={!rows.length}
        emptyTitle="No upload issues found"
        emptyDescription="All payment rows are ready for processing."
        showFooter
      >
        {sortedRows.map((row, index) => (
          <UploadIssueRow
            key={`${row._id || row.id || "issue"}-${index}`}
            row={row}
            onEdit={onEdit}
          />
        ))}
      </DataTable>

      {isFetching && rows.length > 0 ? (
        <div className="flex justify-center py-2">
          <Spinner type="sm" />
        </div>
      ) : null}
    </section>
  );
}
