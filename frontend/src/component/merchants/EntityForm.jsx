import FormField from "../UI/FormField";
import Spinner from "../UI/Spinner";

const inputBaseClass = "form-input";

function getInputClassName(hasError) {
  return `${inputBaseClass} ${
    hasError
      ? "border-error/40 bg-error/10"
      : "border-outline-variant/20 bg-surface-container-low"
  }`;
}

export default function EntityForm({
  formId = "entity-form",
  fields = [],
  values = {},
  errors = {},
  onChange,
  onSubmit,
  isLoading = false,
}) {
  if (isLoading) {
    return (
      <div className="flex min-h-72 items-center justify-center text-on-surface-variant">
        <Spinner type="sm" />
      </div>
    );
  }

  return (
    <form
      id={formId}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit?.();
      }}
      className="grid gap-5 md:grid-cols-2"
    >
      {fields.map((field) => {
        const isTextArea = field.type === "textarea";
        const isSelect = field.type === "select";
        const hasError = Boolean(errors[field.name]);
        const fieldClassName = field.fullWidth ? "md:col-span-2" : "";

        return (
          <FormField
            key={field.name}
            label={field.label}
            error={errors[field.name]}
            required={field.required}
            className={fieldClassName}
          >
            {isSelect ? (
              <select
                value={values[field.name] ?? ""}
                onChange={(event) => onChange?.(field.name, event.target.value)}
                className={getInputClassName(hasError)}
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
                onChange={(event) => onChange?.(field.name, event.target.value)}
                placeholder={field.placeholder}
                className={`${getInputClassName(hasError)} resize-none`}
              />
            ) : (
              <input
                type={field.type || "text"}
                value={values[field.name] ?? ""}
                onChange={(event) => onChange?.(field.name, event.target.value)}
                placeholder={field.placeholder}
                className={getInputClassName(hasError)}
              />
            )}
          </FormField>
        );
      })}
    </form>
  );
}
