import { useEffect, useState } from "react";

import FormField from "../UI/FormField";
import SearchableDropdown from "../UI/SearchableDropdown";

const EMPTY_FORM = {
  transactionCountryName: "",
  feeCountryCode: "",
  countryCategory: "",
  status: "active",
};

const COUNTRY_CATEGORY_OPTIONS = [
  { label: "EU", value: "EU" },
  { label: "Non EU", value: "NONEU" },
  { label: "All", value: "ALL" },
];

const STATUS_OPTIONS = [
  { label: "Active", value: "active" },
  { label: "Inactive", value: "inactive" },
];

const getInitialForm = (initialValues) => ({
  ...EMPTY_FORM,
  transactionCountryName: initialValues?.transactionCountryName ?? "",
  feeCountryCode: initialValues?.feeCountryCode ?? "",
  countryCategory: initialValues?.countryCategory ?? "",
  status: initialValues?.status ?? "active",
});

export default function MerchantSettlementCountryForm({
  formId = "merchant-country-form",
  initialValues = null,
  onSubmit,
}) {
  const [formData, setFormData] = useState(() => getInitialForm(initialValues));

  const [errors, setErrors] = useState({});

  useEffect(() => {
    setFormData(getInitialForm(initialValues));
    setErrors({});
  }, [initialValues]);

  const handleChange = (name, value) => {
    setFormData((current) => ({
      ...current,
      [name]: value,
    }));

    if (errors[name]) {
      setErrors((current) => {
        const nextErrors = { ...current };
        delete nextErrors[name];
        return nextErrors;
      });
    }
  };

  const validateForm = () => {
    const nextErrors = {};

    if (!formData.transactionCountryName.trim()) {
      nextErrors.transactionCountryName = "Country name is required.";
    }

    if (!formData.feeCountryCode.trim()) {
      nextErrors.feeCountryCode = "Fee country code is required.";
    }

    if (!formData.countryCategory) {
      nextErrors.countryCategory = "Country category is required.";
    }

    setErrors(nextErrors);

    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!validateForm()) {
      return;
    }

    const payload = {
      transactionCountryName: formData.transactionCountryName.trim(),

      feeCountryCode: formData.feeCountryCode.trim().toUpperCase(),

      countryCategory: formData.countryCategory,

      status: formData.status,
    };

    await onSubmit?.(payload);
  };

  return (
    <form id={formId} onSubmit={handleSubmit} className="space-y-8">
      <div>
        <p className="mb-3 text-xs font-bold uppercase tracking-widest text-on-surface-variant">
          Country Configuration
        </p>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <FormField
            label="Country Name"
            helper="Enter the country name used in transaction data."
            required
            error={errors.transactionCountryName}
          >
            <input
              type="text"
              value={formData.transactionCountryName}
              onChange={(event) =>
                handleChange("transactionCountryName", event.target.value)
              }
              placeholder="Germany"
              className="form-input"
            />
          </FormField>

          <FormField
            label="Fee Country Code"
            helper="Enter the code used for fee matching."
            required
            error={errors.feeCountryCode}
          >
            <input
              type="text"
              value={formData.feeCountryCode}
              onChange={(event) =>
                handleChange("feeCountryCode", event.target.value)
              }
              placeholder="DE"
              className="form-input"
            />
          </FormField>
        </div>
      </div>

      <div>
        <p className="mb-3 text-xs font-bold uppercase tracking-widest text-on-surface-variant">
          Classification
        </p>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <FormField
            label="Country Category"
            helper="Select whether the country belongs to EU, Non EU, or All."
            required
            error={errors.countryCategory}
          >
            <SearchableDropdown
              value={formData.countryCategory}
              options={COUNTRY_CATEGORY_OPTIONS}
              placeholder="Select country category"
              searchPlaceholder="Search category..."
              onChange={(value) => handleChange("countryCategory", value)}
            />
          </FormField>

          <FormField
            label="Status"
            helper="Control whether this country is available for matching."
          >
            <SearchableDropdown
              value={formData.status}
              options={STATUS_OPTIONS}
              placeholder="Select status"
              searchPlaceholder="Search status..."
              onChange={(value) => handleChange("status", value)}
            />
          </FormField>
        </div>
      </div>
    </form>
  );
}
