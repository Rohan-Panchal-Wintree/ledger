import { LoaderCircle, X } from "lucide-react";

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
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172acc] p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-[2rem] bg-surface-container-lowest shadow-2xl">
        <div className="flex items-start justify-between border-b border-outline-variant/10 px-6 py-5">
          <div>
            <h3 className="text-2xl font-extrabold tracking-tight text-on-surface">
              {title}
            </h3>
            <p className="mt-2 text-sm text-on-surface-variant">{description}</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-full p-2 text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface"
          >
            <X size={18} />
          </button>
        </div>

        {isLoading ? (
          <div className="flex min-h-72 items-center justify-center px-6 py-12 text-on-surface-variant">
            <div className="flex items-center gap-3 text-sm font-semibold">
              <LoaderCircle className="animate-spin" size={18} />
              Loading details...
            </div>
          </div>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              onSubmit();
            }}
            className="flex max-h-[calc(90vh-5.5rem)] flex-col"
          >
            <div className="grid gap-5 overflow-y-auto px-6 py-6 md:grid-cols-2">
              {fields.map((field) => {
                const isTextArea = field.type === "textarea";
                const isSelect = field.type === "select";

                return (
                  <label
                    key={field.name}
                    className={field.fullWidth ? "md:col-span-2" : ""}
                  >
                    <span className="mb-2 block text-sm font-semibold text-on-surface">
                      {field.label}
                    </span>

                    {isSelect ? (
                      <select
                        value={values[field.name] ?? ""}
                        onChange={(event) =>
                          onChange(field.name, event.target.value)
                        }
                        className={`w-full rounded-2xl border px-4 py-3 text-sm text-on-surface outline-none transition-all ${
                          errors[field.name]
                            ? "border-red-300 bg-red-50/60"
                            : "border-outline-variant/20 bg-surface-container-low"
                        }`}
                      >
                        {field.options.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    ) : isTextArea ? (
                      <textarea
                        rows={4}
                        value={values[field.name] ?? ""}
                        onChange={(event) =>
                          onChange(field.name, event.target.value)
                        }
                        placeholder={field.placeholder}
                        className={`w-full rounded-2xl border px-4 py-3 text-sm text-on-surface outline-none transition-all ${
                          errors[field.name]
                            ? "border-red-300 bg-red-50/60"
                            : "border-outline-variant/20 bg-surface-container-low"
                        }`}
                      />
                    ) : (
                      <input
                        type={field.type || "text"}
                        value={values[field.name] ?? ""}
                        onChange={(event) =>
                          onChange(field.name, event.target.value)
                        }
                        placeholder={field.placeholder}
                        className={`w-full rounded-2xl border px-4 py-3 text-sm text-on-surface outline-none transition-all ${
                          errors[field.name]
                            ? "border-red-300 bg-red-50/60"
                            : "border-outline-variant/20 bg-surface-container-low"
                        }`}
                      />
                    )}

                    {errors[field.name] ? (
                      <span className="mt-2 block text-xs font-medium text-red-600">
                        {errors[field.name]}
                      </span>
                    ) : null}
                  </label>
                );
              })}
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-outline-variant/10 px-6 py-5 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="rounded-full border border-outline-variant/20 px-5 py-3 text-sm font-semibold text-on-surface transition-all hover:bg-surface-container-low disabled:cursor-not-allowed disabled:opacity-70"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white transition-all hover:bg-primary-container disabled:cursor-not-allowed disabled:bg-outline-variant"
              >
                {isSubmitting ? (
                  <>
                    <LoaderCircle size={16} className="animate-spin" />
                    Saving...
                  </>
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
