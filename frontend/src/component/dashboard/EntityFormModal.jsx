import { LoaderCircle, X } from "lucide-react";
import Spinner from "../UI/Spinner";

export default function EntityFormModal({
  open,
  title,
  description,
  fields,
  values,
  errors,
  mode,
  onClose,
  onChange,
  onSubmit,
  isSubmitting,
  isLoading,
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-on-surface/70 p-4 backdrop-blur-xs">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-[2rem] bg-surface-container-lowest">
        {/* Header */}
        <div className="border-b border-outline-variant/20 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-on-surface">{title}</h2>
              {description && (
                <p className="mt-1 text-sm text-on-surface-variant">
                  {description}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Body */}
        {isLoading ? (
          <div className="flex min-h-72 items-center justify-center px-6 py-12 text-on-surface-variant">
            <div className="flex items-center gap-3 text-sm font-semibold">
              <Spinner type="sm" />
            </div>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onSubmit();
            }}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="grid gap-5 overflow-y-auto px-6 py-6 md:grid-cols-2">
              {fields.map((field) => {
                const isTextArea = field.type === "textarea";
                const isSelect = field.type === "select";
                const hasError = Boolean(errors[field.name]);

                const baseClass = `w-full rounded-xl border px-4 py-3 text-sm text-on-surface outline-none transition-all placeholder:text-outline/50 focus:border-primary focus:ring-2 focus:ring-primary/20 ${
                  hasError
                    ? "border-error/40 bg-error/10"
                    : "border-outline-variant/20 bg-surface-container-low"
                }`;

                return (
                  <label
                    key={field.name}
                    className={field.fullWidth ? "md:col-span-2" : ""}
                  >
                    <span className="mb-2 block text-xs font-semibold uppercase text-on-surface-variant">
                      {field.label}
                    </span>

                    {isSelect ? (
                      <select
                        value={values[field.name] ?? ""}
                        onChange={(e) => onChange(field.name, e.target.value)}
                        className={baseClass}
                      >
                        {field.options.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    ) : isTextArea ? (
                      <textarea
                        rows={4}
                        value={values[field.name] ?? ""}
                        onChange={(e) => onChange(field.name, e.target.value)}
                        placeholder={field.placeholder}
                        className={`${baseClass} resize-none`}
                      />
                    ) : (
                      <input
                        type={field.type || "text"}
                        value={values[field.name] ?? ""}
                        onChange={(e) => onChange(field.name, e.target.value)}
                        placeholder={field.placeholder}
                        className={baseClass}
                      />
                    )}

                    {hasError && (
                      <span className="mt-2 block text-xs font-medium text-error">
                        {errors[field.name]}
                      </span>
                    )}
                  </label>
                );
              })}
            </div>

            {/* Footer */}
            <div className="flex flex-col-reverse gap-3 border-t border-outline-variant/20 px-6 py-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="rounded-full border border-outline-variant/20 px-5 py-3 text-sm font-semibold text-on-surface transition-all hover:bg-surface-container-low disabled:opacity-60"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-primary-container disabled:opacity-60"
              >
                {isSubmitting ? (
                  <Spinner type="sm" color="white" />
                ) : mode === "edit" ? (
                  "Update"
                ) : (
                  "Create"
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
