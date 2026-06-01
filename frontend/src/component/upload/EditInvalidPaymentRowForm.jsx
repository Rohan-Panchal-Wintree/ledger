import { useEffect, useState } from "react";

import FormField from "../UI/FormField";

const editableFields = [
  { key: "merchantName", label: "Merchant Name" },
  { key: "mid", label: "MID" },
  { key: "paymentBank", label: "Bank" },
  { key: "sourceStartDate", label: "Start Date", type: "date" },
  { key: "sourceEndDate", label: "End Date", type: "date" },
  { key: "sourceProcessingCurrency", label: "Source Currency" },
  { key: "paymentCurrency", label: "Payment Currency" },
  { key: "amountPaid", label: "Amount Paid" },
  { key: "rate", label: "Rate" },
];

const inputClassName =
  "w-full rounded-xl border border-outline-variant/20 bg-surface-container-low px-4 py-3 text-sm font-semibold text-on-surface outline-none transition-all placeholder:text-outline/50 focus:border-primary focus:ring-2 focus:ring-primary/20";

function buildInitialFormData(row, initialData) {
  return {
    paymentBank:
      initialData?.paymentBank ??
      row.fixedData?.BANK ??
      row.normalizedRow?.BANK ??
      row.rawRow?.BANK ??
      "",

    merchantName:
      initialData?.merchantName ??
      row.fixedData?.["MERCHANT NAME"] ??
      row.normalizedRow?.["MERCHANT NAME"] ??
      row.rawRow?.["MERCHANT NAME"] ??
      "",

    mid:
      initialData?.mid ??
      row.fixedData?.MID ??
      row.normalizedRow?.MID ??
      row.rawRow?.MID ??
      "",

    sourceStartDate:
      initialData?.sourceStartDate ??
      row.fixedData?.["START DATE"] ??
      row.fixedData?.["FIRST DATE"] ??
      row.normalizedRow?.["START DATE"] ??
      row.normalizedRow?.["FIRST DATE"] ??
      row.rawRow?.["START DATE"] ??
      row.rawRow?.["FIRST DATE"] ??
      "",

    sourceEndDate:
      initialData?.sourceEndDate ??
      row.fixedData?.["END DATE"] ??
      row.normalizedRow?.["END DATE"] ??
      row.rawRow?.["END DATE"] ??
      "",

    sourceProcessingCurrency:
      initialData?.sourceProcessingCurrency ??
      row.fixedData?.["PROCESSING CURRENCY"] ??
      row.fixedData?.CURRENCY ??
      row.normalizedRow?.["PROCESSING CURRENCY"] ??
      row.normalizedRow?.CURRENCY ??
      row.rawRow?.["PROCESSING CURRENCY"] ??
      row.rawRow?.CURRENCY ??
      "",

    amountPaid:
      initialData?.amountPaid ??
      row.fixedData?.AMOUNT ??
      row.normalizedRow?.AMOUNT ??
      row.rawRow?.AMOUNT ??
      "",

    rate:
      initialData?.rate ??
      row.fixedData?.RATE ??
      row.normalizedRow?.RATE ??
      row.rawRow?.RATE ??
      "",

    paymentCurrency:
      initialData?.paymentCurrency ??
      row.fixedData?.["SETTLEMENT CURRENCY"] ??
      row.normalizedRow?.["SETTLEMENT CURRENCY"] ??
      row.rawRow?.["SETTLEMENT CURRENCY"] ??
      "",
  };
}

export default function EditInvalidPaymentRowForm({
  formId = "invalid-payment-row-form",
  row,
  initialData,
  onSubmit,
}) {
  const [formData, setFormData] = useState({});

  useEffect(() => {
    if (!row) return;

    setFormData(buildInitialFormData(row, initialData));
  }, [row, initialData]);

  if (!row) return null;

  return (
    <form
      id={formId}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit?.(formData);
      }}
      className="space-y-5"
    >
      <div className="rounded-2xl bg-surface-container-low px-4 py-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
          Issue
        </p>

        <p className="mt-1 text-sm font-semibold text-on-surface">
          {row.issue || row.failureReason || "Invalid or missing data"}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {editableFields.map((field) => (
          <FormField key={field.key} label={field.label}>
            <input
              type={field.type || "text"}
              value={formData[field.key] || ""}
              onChange={(event) =>
                setFormData((currentData) => ({
                  ...currentData,
                  [field.key]: event.target.value,
                }))
              }
              className={inputClassName}
            />
          </FormField>
        ))}
      </div>
    </form>
  );
}
