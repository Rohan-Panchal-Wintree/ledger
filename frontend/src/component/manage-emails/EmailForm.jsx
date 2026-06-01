import FormField from "../UI/FormField";
import SearchableDropdown from "../UI/SearchableDropdown";

const roles = [
  { label: "Admin", value: "admin" },
  { label: "Merchant", value: "merchant" },
  { label: "Finance", value: "finance" },
  { label: "Settlement", value: "settlement" },
];

export default function EmailForm({
  formId = "email-user-form",
  formData,
  setFormData,
  onSubmit,
}) {
  const handleChange = (key, value) => {
    setFormData((prev) => {
      const nextData = {
        ...prev,
        [key]: value,
      };

      if (key === "role" && value !== "merchant") {
        nextData.merchantMid = "";
      }

      return nextData;
    });
  };

  return (
    <form id={formId} onSubmit={onSubmit} className="space-y-5">
      <FormField label="Role" required>
        <SearchableDropdown
          value={formData.role}
          options={roles}
          placeholder="Select role"
          searchPlaceholder="Search role..."
          onChange={(value) => handleChange("role", value)}
        />
      </FormField>

      <FormField label="Name" required>
        <input
          type="text"
          value={formData.name}
          onChange={(event) => handleChange("name", event.target.value)}
          required
          minLength={2}
          className="form-input"
          placeholder="Enter full name"
        />
      </FormField>

      <FormField label="Email" required>
        <input
          type="email"
          value={formData.email}
          onChange={(event) => handleChange("email", event.target.value)}
          required
          className="form-input"
          placeholder="user@example.com"
        />
      </FormField>

      {formData.role === "merchant" ? (
        <FormField label="MID" required>
          <input
            type="text"
            inputMode="numeric"
            value={formData.merchantMid}
            onChange={(event) =>
              handleChange("merchantMid", event.target.value.replace(/\D/g, ""))
            }
            required
            className="form-input"
            placeholder="Enter merchant MID"
          />
        </FormField>
      ) : null}
    </form>
  );
}
