import { useEffect, useState } from "react";
import { X } from "lucide-react";

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

export default function EditInvalidPaymentRowModal({
  open,
  row,
  initialData,
  onClose,
  onSave,
}) {
  const [formData, setFormData] = useState({});

  useEffect(() => {
    if (!row) return;

    const fixedData = row.fixedData || {};
    const normalizedRow = row.normalizedRow || {};
    const rawRow = row.rawRow || {};

    setFormData({
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
    });
  }, [row, initialData]);

  if (!open || !row) return null;

  return (
    <dialog className="modal modal-open">
      <div className="modal-box w-11/12 max-w-4xl rounded-[2rem] bg-surface-container-lowest p-0">
        <div className="flex items-start justify-between border-b border-outline-variant/10 px-6 py-5">
          <div>
            <h3 className="text-xl font-extrabold text-on-surface">
              Edit Invalid Payment Row
            </h3>
            <p className="mt-1 text-sm text-on-surface-variant">
              Fix the row data before reconciliation.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-surface-container-low p-2 text-on-surface-variant hover:text-on-surface"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5">
          <div className="mb-5 rounded-2xl bg-surface-container-low px-4 py-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
              Issue
            </p>
            <p className="mt-1 text-sm font-semibold text-on-surface">
              {row.issue || row.failureReason || "Invalid or missing data"}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {editableFields.map((field) => (
              <label key={field.key} className="form-control">
                <span className="mb-2 text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                  {field.label}
                </span>

                <input
                  type={field.type || "text"}
                  value={formData[field.key] || ""}
                  onChange={(event) =>
                    setFormData((prev) => ({
                      ...prev,
                      [field.key]: event.target.value,
                    }))
                  }
                  className="input input-bordered w-full rounded-xl border-outline-variant/20 bg-surface-container-lowest text-sm font-semibold text-on-surface"
                />
              </label>
            ))}
          </div>
        </div>

        <div className="modal-action border-t border-outline-variant/10 px-6 py-5">
          <button
            type="button"
            onClick={onClose}
            className="btn rounded-full bg-surface-container-low px-6 text-on-surface hover:bg-surface-container"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={() => onSave(formData)}
            className="btn rounded-full border-none bg-primary px-6 text-primary-content hover:bg-primary"
          >
            Save Changes
          </button>
        </div>
      </div>
    </dialog>
  );
}
