import FormField from "../UI/FormField";

const entryTypes = [
  { value: "repayment", label: "Repayment" },
  { value: "bank_rr", label: "Bank RR" },
  { value: "rr", label: "Cap RR" },
  { value: "agent", label: "Agent" },
  { value: "overcapped_rr_refund", label: "Overcapped RR Refund" },
  { value: "chb_refund", label: "CHB Refund" },
  { value: "adjustment", label: "Adjustment" },
  { value: "other", label: "Other" },
];

export default function MiscellaneousEntryForm({ form, onChange }) {
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
      <FormField
        label="Entry Type"
        helper="Select the miscellaneous payment category."
        required
        className="md:col-span-2"
      >
        <select
          value={form.entryType}
          onChange={(event) => onChange("entryType", event.target.value)}
          className="form-select"
        >
          <option value="">Select entry type</option>

          {entryTypes.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      </FormField>

      <FormField
        label="Payment Sheet Date"
        helper="Connect this entry to a payment cycle."
        required
      >
        <input
          type="date"
          value={form.paymentSheetDate}
          onChange={(event) => onChange("paymentSheetDate", event.target.value)}
          className="form-input"
        />
      </FormField>

      <FormField
        label="Payment Sheet Label"
        helper="Optional dashboard/payment-sheet label."
      >
        <input
          type="text"
          value={form.paymentSheetDateLabel}
          onChange={(event) =>
            onChange("paymentSheetDateLabel", event.target.value)
          }
          placeholder="14.04 / Repayments"
          className="form-input"
        />
      </FormField>

      <FormField
        label="Merchant Name"
        helper="Merchant connected to this entry."
        required
      >
        <input
          type="text"
          value={form.merchantName}
          onChange={(event) => onChange("merchantName", event.target.value)}
          placeholder="Enter merchant name"
          className="form-input"
        />
      </FormField>

      <FormField label="Connected MID" helper="Optional MID reference.">
        <input
          type="text"
          value={form.mid}
          onChange={(event) => onChange("mid", event.target.value)}
          placeholder="Optional MID"
          className="form-input"
        />
      </FormField>

      <FormField label="Bank Label" helper="Bank or acquirer name.">
        <input
          type="text"
          value={form.bankLabel}
          onChange={(event) => onChange("bankLabel", event.target.value)}
          placeholder="Bank / acquirer name"
          className="form-input"
        />
      </FormField>

      <FormField
        label="Processing Currency"
        helper="Currency used for processing."
      >
        <input
          type="text"
          value={form.processingCurrency}
          onChange={(event) =>
            onChange("processingCurrency", event.target.value)
          }
          placeholder="EUR / USD / USDT"
          className="form-input uppercase"
        />
      </FormField>

      <FormField label="Start Date & Time">
        <input
          type="datetime-local"
          value={form.startDate}
          onChange={(event) => onChange("startDate", event.target.value)}
          className="form-input"
        />
      </FormField>

      <FormField label="End Date & Time">
        <input
          type="datetime-local"
          value={form.endDate}
          onChange={(event) => onChange("endDate", event.target.value)}
          className="form-input"
        />
      </FormField>

      <FormField
        label="Processing Amount"
        helper="Original processing amount."
        required
      >
        <input
          type="number"
          value={form.amountPaid}
          onChange={(event) => onChange("amountPaid", event.target.value)}
          placeholder="0.00"
          className="form-input"
        />
      </FormField>

      <FormField label="Rate" helper="Settlement conversion rate." required>
        <input
          type="number"
          value={form.rate}
          min="0.000001"
          step="any"
          onChange={(event) => onChange("rate", event.target.value)}
          placeholder="1.000"
          className="form-input"
        />
      </FormField>

      <FormField
        label="Settlement Currency"
        helper="Currency used for settlement."
        required
      >
        <input
          type="text"
          value={form.settlementCurrency}
          onChange={(event) =>
            onChange("settlementCurrency", event.target.value)
          }
          placeholder="USD"
          className="form-input uppercase"
        />
      </FormField>

      <FormField
        label="Settlement Amount"
        helper="Auto-calculated but editable."
        required
      >
        <input
          type="number"
          value={form.settlementAmount}
          onChange={(event) => onChange("settlementAmount", event.target.value)}
          placeholder="0.00"
          className="form-input"
        />
      </FormField>

      <FormField
        label="Notes"
        helper="Optional settlement/internal notes."
        className="md:col-span-2"
      >
        <textarea
          value={form.notes}
          onChange={(event) => onChange("notes", event.target.value)}
          placeholder="Optional notes"
          className="form-textarea"
        />
      </FormField>
    </div>
  );
}
