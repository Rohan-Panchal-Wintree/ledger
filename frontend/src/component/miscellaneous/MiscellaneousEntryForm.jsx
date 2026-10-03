import FormField from "../UI/FormField";
import SearchableDropdown from "../UI/SearchableDropdown";

import { shouldHideMiscellaneousBankAndDates } from "../../utils/miscellaneousUtils";

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

export default function MiscellaneousEntryForm({
  form,
  paymentSheetOptions = [],
  merchantOptions = [],
  acquirerOptions = [],
  onChange,
}) {
  const isAgentEntry = form.entryType === "agent";
  const hideBankAndDates = shouldHideMiscellaneousBankAndDates(form.entryType);

  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
      {/* Entry Type */}
      <FormField
        label="Entry Type"
        helper="Select the miscellaneous payment category."
        required
        className="md:col-span-2"
      >
        <SearchableDropdown
          value={form.entryType}
          options={entryTypes}
          placeholder="Select entry type"
          searchPlaceholder="Search entry type..."
          onChange={(value) => onChange("entryType", value)}
        />
      </FormField>

      {isAgentEntry ? (
        <FormField
          label="Agent Name"
          helper="Enter the agent name for this entry."
          required
          className="md:col-span-2"
        >
          <input
            type="text"
            value={form.merchantName}
            onChange={(event) => onChange("merchantName", event.target.value)}
            placeholder="Enter agent name"
            className="form-input"
          />
        </FormField>
      ) : (
        <>
          <FormField
            label="Merchant Name"
            helper="Merchant connected to this entry."
            required
          >
            <SearchableDropdown
              value={form.merchantName}
              options={merchantOptions}
              placeholder="Select merchant"
              searchPlaceholder="Search merchant..."
              onChange={(value) => onChange("merchantName", value)}
            />
          </FormField>

          <FormField
            label="MID No."
            helper="Merchant MID associated with this entry."
            required
          >
            <input
              type="text"
              inputMode="numeric"
              value={form.mid}
              onChange={(event) => {
                const numericValue = event.target.value.replace(/\D/g, "");

                onChange("mid", numericValue);
              }}
              placeholder="Merchant MID"
              className="form-input"
            />
          </FormField>
        </>
      )}

      {/* Payment Sheet */}
      <FormField
        label="Payment Sheet Label"
        helper="Select the payment sheet this entry belongs to."
        required
      >
        <SearchableDropdown
          value={form.paymentSheetDateLabel}
          options={paymentSheetOptions}
          placeholder="Select payment sheet"
          searchPlaceholder="Search payment sheet..."
          onChange={(value) => onChange("paymentSheetDateLabel", value)}
        />
      </FormField>

      <FormField
        label="Payment Sheet Date"
        helper="Auto-filled from selected payment sheet."
        required
      >
        <input
          type="date"
          value={form.paymentSheetDate}
          onChange={(event) => onChange("paymentSheetDate", event.target.value)}
          className="form-input"
        />
      </FormField>

      {/* Bank — only for extended entry types */}
      {!hideBankAndDates ? (
        <FormField label="Bank Label" helper="Bank or acquirer name." required>
          <SearchableDropdown
            value={form.bankLabel}
            options={acquirerOptions}
            placeholder="Select bank / acquirer"
            searchPlaceholder="Search bank / acquirer..."
            onChange={(value) => onChange("bankLabel", value)}
          />
        </FormField>
      ) : null}

      {/* Processing Currency */}
      <FormField
        label="Processing Currency"
        helper="Currency used for processing."
        required
      >
        <input
          type="text"
          value={form.processingCurrency}
          onChange={(event) => {
            const textOnlyValue = event.target.value
              .replace(/[^a-zA-Z]/g, "")
              .toUpperCase();

            onChange("processingCurrency", textOnlyValue);
          }}
          placeholder="EUR / USD / USDT"
          className="form-input uppercase"
        />
      </FormField>

      {/* Dates — only for extended entry types */}
      {!hideBankAndDates ? (
        <>
          <FormField label="Start Date & Time" required>
            <input
              type="datetime-local"
              value={form.startDate}
              onChange={(event) => onChange("startDate", event.target.value)}
              className="form-input"
            />
          </FormField>

          <FormField label="End Date & Time" required>
            <input
              type="datetime-local"
              value={form.endDate}
              onChange={(event) => onChange("endDate", event.target.value)}
              className="form-input"
            />
          </FormField>
        </>
      ) : null}

      {/* Processing Amount */}
      <FormField
        label="Processing Amount"
        helper="Original processing amount."
        required
      >
        <input
          type="number"
          value={form.amountPaid}
          min="0"
          step="any"
          onChange={(event) => onChange("amountPaid", event.target.value)}
          placeholder="0.00"
          className="form-input"
        />
      </FormField>

      {/* Rate */}
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

      {/* Settlement Currency */}
      <FormField
        label="Settlement Currency"
        helper="Currency used for settlement."
        required
      >
        <input
          type="text"
          value={form.settlementCurrency}
          onChange={(event) => {
            const textOnlyValue = event.target.value
              .replace(/[^a-zA-Z]/g, "")
              .toUpperCase();

            onChange("settlementCurrency", textOnlyValue);
          }}
          placeholder="USD"
          className="form-input uppercase"
        />
      </FormField>

      {/* Settlement Amount */}
      <FormField
        label="Settlement Amount"
        helper="Auto-calculated but editable."
        required
      >
        <input
          type="number"
          value={form.settlementAmount}
          min="0"
          step="any"
          onChange={(event) => onChange("settlementAmount", event.target.value)}
          placeholder="0.00"
          className="form-input"
        />
      </FormField>

      {/* Notes */}
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
