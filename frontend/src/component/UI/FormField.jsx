export default function FormField({
  label,
  helper,
  error,
  required = false,
  className = "",
  children,
}) {
  return (
    <label className={`form-control w-full gap-2 ${className}`}>
      {label ? (
        <div className="label pb-0">
          <span className="label-text text-sm font-semibold text-on-surface">
            {label}

            {required ? <span className="ml-1 text-error">*</span> : null}
          </span>
        </div>
      ) : null}

      {children}

      {helper && !error ? (
        <div className="label pt-0">
          <span className="label-text-alt text-xs text-on-surface-variant">
            {helper}
          </span>
        </div>
      ) : null}

      {error ? (
        <div className="label pt-0">
          <span className="label-text-alt text-xs font-medium text-error">
            {error}
          </span>
        </div>
      ) : null}
    </label>
  );
}
