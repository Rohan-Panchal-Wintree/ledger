import { LoaderCircle, PencilLine, Trash2 } from "lucide-react";

function renderValue(column, row) {
  if (column.render) {
    return column.render(row);
  }

  const value = row[column.key];

  if (value === undefined || value === null || value === "") {
    return "-";
  }

  return value;
}

export default function EntityTable({
  columns,
  rows,
  isLoading,
  emptyTitle,
  emptyDescription,
  onEdit,
  onDelete,
  canEdit,
  canDelete,
  isDeletePending = false,
  deleteTargetId = null,
}) {
  const hasActions = canEdit || canDelete;

  if (isLoading) {
    return (
      <div className="flex min-h-80 items-center justify-center px-6 py-16 text-on-surface-variant">
        <div className="flex items-center gap-3 text-sm font-semibold">
          <LoaderCircle className="animate-spin" size={18} />
          Loading records...
        </div>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex min-h-80 flex-col items-center justify-center px-6 py-16 text-center">
        <h3 className="text-lg font-bold text-on-surface">{emptyTitle}</h3>
        <p className="mt-2 max-w-md text-sm text-on-surface-variant">
          {emptyDescription}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="hidden overflow-x-auto lg:block">
        <table className="min-w-full border-collapse text-left">
          <thead className="bg-surface-container-low/70">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className="px-6 py-4 text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant"
                >
                  {column.label}
                </th>
              ))}
              {hasActions ? (
                <th className="px-6 py-4 text-right text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
                  Actions
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/10">
            {rows.map((row) => (
              <tr
                key={row._id}
                className="transition-colors hover:bg-surface-container-low/45"
              >
                {columns.map((column) => (
                  <td
                    key={`${row._id}-${column.key}`}
                    className="px-6 py-4 align-top text-sm text-on-surface"
                  >
                    {renderValue(column, row)}
                  </td>
                ))}
                {hasActions ? (
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      {canEdit ? (
                        <button
                          type="button"
                          onClick={() => onEdit(row._id)}
                          className="inline-flex items-center gap-2 rounded-full border border-outline-variant/20 px-3 py-2 text-xs font-semibold text-on-surface transition-all hover:border-primary/20 hover:bg-primary/6 hover:text-primary"
                        >
                          <PencilLine size={14} />
                          Edit
                        </button>
                      ) : null}
                      {canDelete ? (
                        <button
                          type="button"
                          onClick={() => onDelete(row)}
                          disabled={isDeletePending && deleteTargetId === row._id}
                          className="inline-flex items-center gap-2 rounded-full border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 transition-all hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          {isDeletePending && deleteTargetId === row._id ? (
                            <LoaderCircle size={14} className="animate-spin" />
                          ) : (
                            <Trash2 size={14} />
                          )}
                          Delete
                        </button>
                      ) : null}
                    </div>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-4 p-4 lg:hidden">
        {rows.map((row) => (
          <article
            key={row._id}
            className="rounded-3xl border border-outline-variant/15 bg-surface-container-lowest p-4 shadow-sm"
          >
            <div className="space-y-3">
              {columns.map((column) => (
                <div
                  key={`${row._id}-${column.key}-mobile`}
                  className="flex flex-col gap-1 border-b border-outline-variant/10 pb-3 last:border-b-0 last:pb-0"
                >
                  <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
                    {column.label}
                  </span>
                  <div className="text-sm text-on-surface">
                    {renderValue(column, row)}
                  </div>
                </div>
              ))}
            </div>

            {hasActions ? (
              <div className="mt-4 flex gap-3">
                {canEdit ? (
                  <button
                    type="button"
                    onClick={() => onEdit(row._id)}
                    className="flex-1 rounded-full border border-outline-variant/20 px-4 py-3 text-sm font-semibold text-on-surface transition-all hover:border-primary/20 hover:bg-primary/6 hover:text-primary"
                  >
                    Edit
                  </button>
                ) : null}
                {canDelete ? (
                  <button
                    type="button"
                    onClick={() => onDelete(row)}
                    disabled={isDeletePending && deleteTargetId === row._id}
                    className="flex-1 rounded-full border border-red-200 px-4 py-3 text-sm font-semibold text-red-600 transition-all hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isDeletePending && deleteTargetId === row._id
                      ? "Deleting..."
                      : "Delete"}
                  </button>
                ) : null}
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </>
  );
}
