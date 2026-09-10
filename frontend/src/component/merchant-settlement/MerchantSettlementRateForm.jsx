import { useEffect, useState } from "react";

import FormField from "../UI/FormField";
import SearchableDropdown from "../UI/SearchableDropdown";

const EMPTY_FORM = {
  merchantName: "",
  memberId: "",
  partnerName: "",
  accountIds: "",
  country: "",
  gatewayName: "ALL",
  currency: "",
  brand: "",
  mdrPercent: "",
  approvalFee: "",
  declineFee: "",
  reversalFee: "",
  chargebackFee: "",
  rollingReservePercent: "",
  settlementExpensePercent: "",
  type: "",
  changeReason: "",
};

const COUNTRY_OPTIONS = [
  { label: "All Countries", value: "ALL" },
  { label: "European Union (EU)", value: "EU" },
  { label: "Non-EU", value: "NONEU" },
];

const GATEWAY_OPTIONS = [{ label: "All Gateways", value: "ALL" }];

const CURRENCY_OPTIONS = [
  { label: "EUR", value: "EUR" },
  { label: "USD", value: "USD" },
  { label: "GBP", value: "GBP" },
];

const BRAND_OPTIONS = [
  { label: "Visa", value: "VISA" },
  { label: "Mastercard", value: "MASTERCARD" },
];

const requiredFields = [
  ["merchantName", "Merchant name"],
  ["memberId", "Member ID"],
  ["currency", "Currency"],
  ["brand", "Brand"],
  ["changeReason", "Change reason"],
];

const numberFields = [
  "mdrPercent",
  "approvalFee",
  "declineFee",
  "reversalFee",
  "chargebackFee",
  "rollingReservePercent",
  "settlementExpensePercent",
];

const fieldClassName = "form-input";

const getInitialForm = (initialValues) => {
  if (!initialValues) {
    return { ...EMPTY_FORM };
  }

  return {
    ...EMPTY_FORM,

    merchantName: initialValues.merchantName ?? "",
    memberId: initialValues.memberId ?? "",
    partnerName: initialValues.partnerName ?? "",

    accountIds: Array.isArray(initialValues.accountIds)
      ? initialValues.accountIds.join(", ")
      : "",

    country:
      initialValues.countryRuleRaw ??
      initialValues.country ??
      initialValues.countryCode ??
      "",

    gatewayName: initialValues.gatewayName ?? "ALL",
    currency: initialValues.currency ?? "",
    brand: initialValues.brand ?? "",

    mdrPercent: initialValues.mdrPercent ?? "",
    approvalFee: initialValues.approvalFee ?? "",
    declineFee: initialValues.declineFee ?? "",
    reversalFee: initialValues.reversalFee ?? "",
    chargebackFee: initialValues.chargebackFee ?? "",
    rollingReservePercent: initialValues.rollingReservePercent ?? "",
    settlementExpensePercent: initialValues.settlementExpensePercent ?? "",

    type: initialValues.type ?? "",

    // Never carry the previous reason into a new approval request.
    changeReason: "",
  };
};

export default function MerchantSettlementRateForm({
  formId = "merchant-rate-form",
  initialValues = null,
  onSubmit,
}) {
  const isEditing = Boolean(initialValues);

  const [formData, setFormData] = useState(() => getInitialForm(initialValues));

  const [errors, setErrors] = useState({});

  useEffect(() => {
    setFormData(getInitialForm(initialValues));
    setErrors({});
  }, [initialValues]);

  const updateField = (name, value) => {
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

  const handleInputChange = (event) => {
    const { name, value } = event.target;

    updateField(name, value);
  };

  const validateForm = () => {
    const nextErrors = {};

    requiredFields.forEach(([field, label]) => {
      if (!String(formData[field] ?? "").trim()) {
        nextErrors[field] = `${label} is required.`;
      }
    });

    numberFields.forEach((field) => {
      const value = formData[field];

      if (value !== "" && !Number.isFinite(Number(value))) {
        nextErrors[field] = "Enter a valid number.";
      }
    });

    setErrors(nextErrors);

    const firstErrorField = Object.keys(nextErrors)[0];

    if (firstErrorField) {
      requestAnimationFrame(() => {
        const field = document.querySelector(`[name="${firstErrorField}"]`);

        field?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });

        field?.focus?.();
      });
    }

    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!validateForm()) {
      return;
    }

    const accountIds = formData.accountIds
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    const payload = {
      merchantName: formData.merchantName.trim(),
      memberId: formData.memberId.trim(),
      partnerName: formData.partnerName.trim(),
      accountIds,

      country: formData.country.trim(),

      gatewayName: formData.gatewayName.trim().toUpperCase() || "ALL",

      currency: formData.currency.trim().toUpperCase(),
      brand: formData.brand.trim().toUpperCase(),

      mdrPercent: Number(formData.mdrPercent || 0),
      approvalFee: Number(formData.approvalFee || 0),
      declineFee: Number(formData.declineFee || 0),
      reversalFee: Number(formData.reversalFee || 0),
      chargebackFee: Number(formData.chargebackFee || 0),

      rollingReservePercent: Number(formData.rollingReservePercent || 0),

      settlementExpensePercent: Number(formData.settlementExpensePercent || 0),

      type: formData.type.trim(),
      changeReason: formData.changeReason.trim(),
    };

    await onSubmit?.(payload);
  };

  return (
    <form id={formId} onSubmit={handleSubmit} className="space-y-6">
      {/* Merchant Configuration */}
      <section>
        <div className="mb-4">
          <h3 className="text-sm font-bold text-on-surface">
            Merchant Configuration
          </h3>

          <p className="mt-1 text-xs text-on-surface-variant">
            Define the merchant and processing combination this rate applies to.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField label="Merchant Name" required error={errors.merchantName}>
            <input
              name="merchantName"
              type="text"
              value={formData.merchantName}
              onChange={handleInputChange}
              placeholder="Enter merchant name"
              className={fieldClassName}
            />
          </FormField>

          <FormField label="Member ID" required error={errors.memberId}>
            <input
              name="memberId"
              type="text"
              value={formData.memberId}
              onChange={handleInputChange}
              placeholder="Enter member ID"
              className={fieldClassName}
            />
          </FormField>

          <FormField label="Partner Name">
            <input
              name="partnerName"
              type="text"
              value={formData.partnerName}
              onChange={handleInputChange}
              placeholder="Enter partner name"
              className={fieldClassName}
            />
          </FormField>

          <FormField
            label="Account IDs"
            helper="Separate multiple account IDs with commas."
          >
            <input
              name="accountIds"
              type="text"
              value={formData.accountIds}
              onChange={handleInputChange}
              placeholder="ACC001, ACC002"
              className={fieldClassName}
            />
          </FormField>

          <FormField
            label="Country Rule"
            helper="Select the country scope this rate applies to."
          >
            <SearchableDropdown
              value={formData.country}
              options={COUNTRY_OPTIONS}
              placeholder="Select country rule"
              searchPlaceholder="Search country rule..."
              onChange={(value) => updateField("country", value)}
            />
          </FormField>

          <FormField
            label="Gateway"
            helper="Select the gateway this rate applies to."
          >
            <SearchableDropdown
              value={formData.gatewayName}
              options={GATEWAY_OPTIONS}
              placeholder="Select gateway"
              searchPlaceholder="Search gateway..."
              onChange={(value) => updateField("gatewayName", value)}
            />
          </FormField>

          <FormField label="Currency" required error={errors.currency}>
            <SearchableDropdown
              value={formData.currency}
              options={CURRENCY_OPTIONS}
              placeholder="Select currency"
              searchPlaceholder="Search currency..."
              onChange={(value) => updateField("currency", value)}
            />
          </FormField>

          <FormField label="Brand" required error={errors.brand}>
            <SearchableDropdown
              value={formData.brand}
              options={BRAND_OPTIONS}
              placeholder="Select brand"
              searchPlaceholder="Search brand..."
              onChange={(value) => updateField("brand", value)}
            />
          </FormField>

          <FormField label="Type">
            <input
              name="type"
              type="text"
              value={formData.type}
              onChange={handleInputChange}
              placeholder="Enter rate type"
              className={fieldClassName}
            />
          </FormField>
        </div>
      </section>

      <div className="border-t border-outline-variant/20" />

      {/* Rate Configuration */}
      <section>
        <div className="mb-4">
          <h3 className="text-sm font-bold text-on-surface">
            Rate Configuration
          </h3>

          <p className="mt-1 text-xs text-on-surface-variant">
            Configure percentage and transaction-level settlement fees.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FormField label="MDR %" error={errors.mdrPercent}>
            <input
              name="mdrPercent"
              type="number"
              step="any"
              value={formData.mdrPercent}
              onChange={handleInputChange}
              placeholder="0"
              className={fieldClassName}
            />
          </FormField>

          <FormField label="Approval Fee" error={errors.approvalFee}>
            <input
              name="approvalFee"
              type="number"
              step="any"
              value={formData.approvalFee}
              onChange={handleInputChange}
              placeholder="0"
              className={fieldClassName}
            />
          </FormField>

          <FormField label="Decline Fee" error={errors.declineFee}>
            <input
              name="declineFee"
              type="number"
              step="any"
              value={formData.declineFee}
              onChange={handleInputChange}
              placeholder="0"
              className={fieldClassName}
            />
          </FormField>

          <FormField label="Reversal Fee" error={errors.reversalFee}>
            <input
              name="reversalFee"
              type="number"
              step="any"
              value={formData.reversalFee}
              onChange={handleInputChange}
              placeholder="0"
              className={fieldClassName}
            />
          </FormField>

          <FormField label="Chargeback Fee" error={errors.chargebackFee}>
            <input
              name="chargebackFee"
              type="number"
              step="any"
              value={formData.chargebackFee}
              onChange={handleInputChange}
              placeholder="0"
              className={fieldClassName}
            />
          </FormField>

          <FormField
            label="Rolling Reserve %"
            error={errors.rollingReservePercent}
          >
            <input
              name="rollingReservePercent"
              type="number"
              step="any"
              value={formData.rollingReservePercent}
              onChange={handleInputChange}
              placeholder="0"
              className={fieldClassName}
            />
          </FormField>

          <FormField
            label="Settlement Expense %"
            error={errors.settlementExpensePercent}
          >
            <input
              name="settlementExpensePercent"
              type="number"
              step="any"
              value={formData.settlementExpensePercent}
              onChange={handleInputChange}
              placeholder="0"
              className={fieldClassName}
            />
          </FormField>
        </div>
      </section>

      <div className="border-t border-outline-variant/20" />

      {/* Approval Reason */}
      <section>
        <FormField
          label={isEditing ? "Change Reason" : "Creation Reason"}
          helper="This request will be submitted for checker approval."
          required
          error={errors.changeReason}
        >
          <textarea
            name="changeReason"
            rows={3}
            value={formData.changeReason}
            onChange={handleInputChange}
            placeholder={
              isEditing
                ? "Explain why these rate changes are required..."
                : "Explain why this rate configuration is being created..."
            }
            className={`form-textarea resize-none`}
          />
        </FormField>
      </section>
    </form>
  );
}
