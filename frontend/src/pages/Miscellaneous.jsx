import { useMemo, useState } from "react";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  X,
  WalletCards,
  Banknote,
  FileText,
} from "lucide-react";
import toast from "react-hot-toast";

import {
  useCreateMiscellaneousPayment,
  useDeleteMiscellaneousPayment,
  useMiscellaneousPayments,
  useUpdateMiscellaneousPayment,
} from "../queries/miscellaneousQueries";

const initialForm = {
  entryType: "",
  paymentSheetDate: "",
  paymentSheetDateLabel: "",
  bankLabel: "",
  merchantName: "",
  merchantId: "",
  merchantMappingId: "",
  mid: "",
  startDate: "",
  endDate: "",
  processingCurrency: "",
  amountPaid: "",
  rate: "1",
  settlementCurrency: "USD",
  settlementAmount: "",
  notes: "",
};

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

function formatNumber(value) {
  const number = Number(value);
  if (Number.isNaN(number)) return "0.00";

  return number.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(value) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toISOString().slice(0, 10);
}

function getErrorMessage(error, fallback) {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    fallback
  );
}

function MiscellaneousEntryModal({
  open,
  mode,
  form,
  setForm,
  onClose,
  onSubmit,
  isSubmitting,
}) {
  if (!open) return null;

  const isEdit = mode === "edit";

  const updateField = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  return (
    <dialog className="modal modal-open">
      <div className="modal-box max-h-[88vh] w-11/12 max-w-5xl overflow-hidden rounded-[2rem] bg-surface-container-lowest p-0">
        <div className="flex items-start justify-between border-b border-outline-variant/10 px-7 py-6">
          <div>
            <h3 className="text-2xl font-extrabold tracking-tight text-on-surface">
              {isEdit ? "Edit Miscellaneous Entry" : "Add Miscellaneous Entry"}
            </h3>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-on-surface-variant">
              Keep entry type, payment-sheet label, merchant details, and amount
              accurate so the dashboard can place this row into the right payout
              cycle.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container-low text-on-surface-variant transition hover:text-on-surface"
          >
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[62vh] overflow-y-auto px-7 py-6">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <label className="space-y-2 md:col-span-2">
              <span className="text-sm font-semibold text-on-surface">
                Which Type Of Entry
              </span>
              <select
                value={form.entryType}
                onChange={(e) => updateField("entryType", e.target.value)}
                className="select w-full rounded-full border-none bg-surface-container-low px-5 text-sm text-on-surface outline-none"
              >
                <option value="">Select entry type</option>
                {entryTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-on-surface-variant">
                Use this only for non-standard rows like repayment, RR, agent,
                CHB refund, or adjustment.
              </p>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-on-surface">
                Payment Sheet Date
              </span>
              <input
                type="date"
                value={form.paymentSheetDate}
                onChange={(e) =>
                  updateField("paymentSheetDate", e.target.value)
                }
                className="input w-full rounded-full border-none bg-surface-container-low px-5 text-sm text-on-surface outline-none"
              />
              <p className="text-xs text-on-surface-variant">
                This connects the entry with that dashboard payment cycle.
              </p>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-on-surface">
                Payment Sheet Label
              </span>
              <input
                type="text"
                value={form.paymentSheetDateLabel}
                onChange={(e) =>
                  updateField("paymentSheetDateLabel", e.target.value)
                }
                placeholder="14.04 / Repayments / AKCE RR"
                className="input w-full rounded-full border-none bg-surface-container-low px-5 text-sm text-on-surface outline-none"
              />
              <p className="text-xs text-on-surface-variant">
                Keep the exact sheet label when available.
              </p>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-on-surface">
                Merchant Name
              </span>
              <input
                type="text"
                value={form.merchantName}
                onChange={(e) => updateField("merchantName", e.target.value)}
                placeholder="Enter merchant name"
                className="input w-full rounded-full border-none bg-surface-container-low px-5 text-sm text-on-surface outline-none"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-on-surface">
                Connected MID
              </span>
              <input
                type="text"
                value={form.mid}
                onChange={(e) => updateField("mid", e.target.value)}
                placeholder="Optional MID"
                className="input w-full rounded-full border-none bg-surface-container-low px-5 text-sm text-on-surface outline-none"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-on-surface">
                Bank Label
              </span>
              <input
                type="text"
                value={form.bankLabel}
                onChange={(e) => updateField("bankLabel", e.target.value)}
                placeholder="Bank / acquirer name"
                className="input w-full rounded-full border-none bg-surface-container-low px-5 text-sm text-on-surface outline-none"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-on-surface">
                Processing Currency
              </span>
              <input
                type="text"
                value={form.processingCurrency}
                onChange={(e) =>
                  updateField("processingCurrency", e.target.value)
                }
                placeholder="EUR / USD / USDT"
                className="input w-full rounded-full border-none bg-surface-container-low px-5 text-sm uppercase text-on-surface outline-none"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-on-surface">
                Start Date & Time
              </span>
              <input
                type="datetime-local"
                value={form.startDate}
                onChange={(e) => updateField("startDate", e.target.value)}
                className="input w-full rounded-full border-none bg-surface-container-low px-5 text-sm text-on-surface outline-none"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-on-surface">
                End Date & Time
              </span>
              <input
                type="datetime-local"
                value={form.endDate}
                onChange={(e) => updateField("endDate", e.target.value)}
                className="input w-full rounded-full border-none bg-surface-container-low px-5 text-sm text-on-surface outline-none"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-on-surface">
                Processing Amount
              </span>
              <input
                type="number"
                value={form.amountPaid}
                onChange={(e) => updateField("amountPaid", e.target.value)}
                placeholder="0.00"
                className="input w-full rounded-full border-none bg-surface-container-low px-5 text-sm text-on-surface outline-none"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-on-surface">
                Rate
              </span>
              <input
                type="number"
                value={form.rate}
                onChange={(e) => updateField("rate", e.target.value)}
                placeholder="1.000"
                className="input w-full rounded-full border-none bg-surface-container-low px-5 text-sm text-on-surface outline-none"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-on-surface">
                Settlement Currency
              </span>
              <input
                type="text"
                value={form.settlementCurrency}
                onChange={(e) =>
                  updateField("settlementCurrency", e.target.value)
                }
                placeholder="USD"
                className="input w-full rounded-full border-none bg-surface-container-low px-5 text-sm uppercase text-on-surface outline-none"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-on-surface">
                Settlement Amount
              </span>
              <input
                type="number"
                value={form.settlementAmount}
                onChange={(e) =>
                  updateField("settlementAmount", e.target.value)
                }
                placeholder="0.00"
                className="input w-full rounded-full border-none bg-surface-container-low px-5 text-sm text-on-surface outline-none"
              />
            </label>

            <label className="space-y-2 md:col-span-2">
              <span className="text-sm font-semibold text-on-surface">
                Notes
              </span>
              <textarea
                value={form.notes}
                onChange={(e) => updateField("notes", e.target.value)}
                placeholder="Optional context for the settlement team"
                className="textarea min-h-28 w-full rounded-3xl border-none bg-surface-container-low px-5 py-4 text-sm text-on-surface outline-none"
              />
            </label>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-outline-variant/10 px-7 py-5">
          <button
            type="button"
            onClick={onClose}
            className="btn rounded-full bg-surface-container-low px-7 text-on-surface hover:bg-surface-container"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onSubmit}
            disabled={isSubmitting}
            className="btn rounded-full border-none bg-primary px-8 text-primary-content hover:bg-primary disabled:bg-surface-container disabled:text-on-surface-variant"
          >
            {isSubmitting ? "Saving..." : isEdit ? "Update" : "Create"}
          </button>
        </div>
      </div>
    </dialog>
  );
}

export default function Miscellaneous() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [form, setForm] = useState(initialForm);

  const miscellaneousQuery = useMiscellaneousPayments();
  const createMutation = useCreateMiscellaneousPayment();
  const updateMutation = useUpdateMiscellaneousPayment();
  const deleteMutation = useDeleteMiscellaneousPayment();

  const entries = miscellaneousQuery.data?.items || [];
  const isLoading =
    miscellaneousQuery.isLoading || miscellaneousQuery.isFetching;

  const filteredEntries = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) return entries;

    return entries.filter((entry) => {
      const values = [
        entry.entryTypeLabel,
        entry.entryType,
        entry.merchantDisplayName,
        entry.merchantName,
        entry.bankLabel,
        entry.linkedMid,
        entry.mid,
        entry.processingCurrency,
        entry.settlementCurrency,
        entry.paymentSheetDateLabel,
        entry.notes,
      ]
        .filter(Boolean)
        .map((value) => String(value).toLowerCase());

      return values.some((value) => value.includes(query));
    });
  }, [entries, searchQuery]);

  const summary = useMemo(() => {
    return filteredEntries.reduce(
      (acc, entry) => {
        acc.totalEntries += 1;
        acc.totalAmountPaid += Number(entry.amountPaid || 0);
        acc.totalSettlementAmount += Number(entry.settlementAmount || 0);

        if (entry.merchantDisplayName || entry.merchantName) {
          acc.merchants.add(entry.merchantDisplayName || entry.merchantName);
        }

        return acc;
      },
      {
        totalEntries: 0,
        totalAmountPaid: 0,
        totalSettlementAmount: 0,
        merchants: new Set(),
      },
    );
  }, [filteredEntries]);

  const openCreateModal = () => {
    setEditingEntry(null);
    setForm(initialForm);
    setIsModalOpen(true);
  };

  const openEditModal = (entry) => {
    setEditingEntry(entry);

    setForm({
      entryType: entry.entryType || "",
      paymentSheetDate: entry.paymentSheetDate
        ? formatDate(entry.paymentSheetDate)
        : "",
      paymentSheetDateLabel: entry.paymentSheetDateLabel || "",
      bankLabel: entry.bankLabel || "",
      merchantName: entry.merchantDisplayName || entry.merchantName || "",
      merchantId: entry.merchantId?._id || entry.merchantId || "",
      merchantMappingId:
        entry.merchantMappingId?._id || entry.merchantMappingId || "",
      mid: entry.linkedMid || entry.mid || "",
      startDate: entry.startDate
        ? new Date(entry.startDate).toISOString().slice(0, 16)
        : "",
      endDate: entry.endDate
        ? new Date(entry.endDate).toISOString().slice(0, 16)
        : "",
      processingCurrency: entry.processingCurrency || "",
      amountPaid: entry.amountPaid ?? "",
      rate: entry.rate ?? "1",
      settlementCurrency: entry.settlementCurrency || "USD",
      settlementAmount: entry.settlementAmount ?? "",
      notes: entry.notes || "",
    });

    setIsModalOpen(true);
  };

  const closeModal = () => {
    setEditingEntry(null);
    setForm(initialForm);
    setIsModalOpen(false);
  };

  const validateForm = () => {
    if (!form.entryType) return "Please select entry type.";
    if (!form.paymentSheetDate) return "Please select payment sheet date.";
    if (!form.merchantName && !form.merchantId) return "Please enter merchant.";
    if (!form.amountPaid) return "Please enter processing amount.";
    if (!form.settlementCurrency) return "Please enter settlement currency.";
    if (!form.settlementAmount) return "Please enter settlement amount.";

    return "";
  };

  const buildPayload = () => ({
    entryType: form.entryType,
    paymentSheetDate: form.paymentSheetDate,
    paymentSheetDateLabel: form.paymentSheetDateLabel,
    bankLabel: form.bankLabel,
    merchantName: form.merchantName,
    merchantId: form.merchantId || undefined,
    merchantMappingId: form.merchantMappingId || undefined,
    mid: form.mid,
    startDate: form.startDate || undefined,
    endDate: form.endDate || undefined,
    processingCurrency: form.processingCurrency,
    amountPaid: Number(form.amountPaid || 0),
    rate: Number(form.rate || 0),
    settlementCurrency: form.settlementCurrency,
    settlementAmount: Number(form.settlementAmount || 0),
    notes: form.notes,
  });

  const handleSubmit = async () => {
    const error = validateForm();

    if (error) {
      toast.error(error);
      return;
    }

    try {
      if (editingEntry) {
        await updateMutation.mutateAsync({
          id: editingEntry._id,
          payload: buildPayload(),
        });

        toast.success("Miscellaneous entry updated.");
      } else {
        await createMutation.mutateAsync(buildPayload());
        toast.success("Miscellaneous entry created.");
      }

      closeModal();
    } catch (err) {
      toast.error(getErrorMessage(err, "Unable to save miscellaneous entry."));
    }
  };

  const handleDelete = async (entry) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this miscellaneous entry?",
    );

    if (!confirmed) return;

    try {
      await deleteMutation.mutateAsync(entry._id);
      toast.success("Miscellaneous entry deleted.");
    } catch (err) {
      toast.error(getErrorMessage(err, "Unable to delete entry."));
    }
  };

  return (
    <div className="w-full bg-background text-on-background">
      <section className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-outline-variant/10 bg-surface-container-lowest p-6">
          <div className="flex items-start justify-between">
            <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
              Total Entries
            </span>
            <FileText className="text-primary" size={20} />
          </div>

          <div className="mt-8">
            <div className="text-4xl font-extrabold tracking-tight text-on-surface">
              {summary.totalEntries}
            </div>
            <p className="mt-2 text-xs font-medium text-on-surface-variant">
              Miscellaneous payment records
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-outline-variant/10 bg-surface-container-lowest p-6">
          <div className="flex items-start justify-between">
            <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
              Processing Total
            </span>
            <WalletCards className="text-primary" size={20} />
          </div>

          <div className="mt-8">
            <div className="text-4xl font-extrabold tracking-tight text-on-surface">
              {formatNumber(summary.totalAmountPaid)}
            </div>
            <p className="mt-2 text-xs font-medium text-on-surface-variant">
              Total processing amount
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-outline-variant/10 bg-surface-container-lowest p-6">
          <div className="flex items-start justify-between">
            <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
              Settlement Total
            </span>
            <Banknote className="text-primary" size={20} />
          </div>

          <div className="mt-8">
            <div className="text-4xl font-extrabold tracking-tight text-on-surface">
              {formatNumber(summary.totalSettlementAmount)}
            </div>
            <p className="mt-2 text-xs font-medium text-on-surface-variant">
              Total actual paid amount
            </p>
          </div>
        </div>
      </section>

      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-on-surface">
            Miscellaneous Entries
          </h2>
          <p className="mt-1 text-sm font-medium text-on-surface-variant">
            Create, search, edit, and delete miscellaneous payment records.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant"
              size={16}
            />
            <input
              type="text"
              placeholder="Search entries..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="w-full rounded-full border-none bg-surface-container-low py-2.5 pl-10 pr-4 text-sm text-on-surface outline-none transition-all focus:ring-2 focus:ring-primary/20 sm:w-80"
            />
          </div>

          <button
            type="button"
            onClick={openCreateModal}
            className="flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-content transition-all active:scale-[0.98]"
          >
            <Plus size={16} />
            Add Entry
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-lg border border-outline-variant/10 bg-surface-container-lowest px-8 py-12 text-center text-sm font-medium text-on-surface-variant">
          Loading miscellaneous entries...
        </div>
      ) : filteredEntries.length === 0 ? (
        <div className="rounded-lg border border-dashed border-outline-variant/20 bg-surface-container-lowest px-8 py-14 text-center">
          <h3 className="text-lg font-bold text-on-surface">
            No miscellaneous entries found.
          </h3>
          <p className="mt-2 text-sm text-on-surface-variant">
            Add a new entry or adjust your search.
          </p>
        </div>
      ) : (
        <section className="flex flex-col">
          {filteredEntries.map((entry, index) => (
            <article
              key={entry._id}
              className={`
        flex flex-col lg:flex-row lg:items-center justify-between gap-4 px-6 py-3
        bg-surface-container-lowest transition-colors
        ${index !== filteredEntries.length - 1 ? "border-b border-outline-variant/10" : ""}
      `}
            >
              {/* 1. Merchant & Identity Group */}
              <div className="flex min-w-[280px] items-center gap-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-container text-[10px] font-black text-primary/70">
                  {entry.entryType?.substring(0, 3).toUpperCase() || "PAY"}
                </div>
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-bold text-on-surface">
                    {entry.merchantDisplayName ||
                      entry.merchantName ||
                      "Unknown Merchant"}
                  </h3>
                  <p className="truncate text-[11px] font-medium text-on-surface-variant/60">
                    {entry.bankLabel || "-"} •{" "}
                    <span className="font-mono">
                      {entry.linkedMid || entry.mid || "-"}
                    </span>
                  </p>
                </div>
              </div>

              {/* 2. Date/Period Section */}
              <div className="hidden xl:block min-w-[120px]">
                <p className="text-[10px] font-bold uppercase tracking-tighter text-on-surface-variant/40">
                  Sheet Date
                </p>
                <p className="text-xs font-semibold text-on-surface/80">
                  {entry.paymentSheetDateLabel ||
                    formatDate(entry.paymentSheetDate)}
                </p>
              </div>

              {/* 3. Financial Data - Compact & Aligned */}
              <div className="flex items-center gap-10 lg:gap-16">
                <div className="min-w-[90px]">
                  <p className="text-[10px] font-bold uppercase tracking-tighter text-on-surface-variant/40">
                    Processing
                  </p>
                  <p className="text-sm font-bold text-on-surface">
                    {formatNumber(entry.amountPaid)}{" "}
                    <span className="text-[10px] text-primary/50">
                      {entry.processingCurrency}
                    </span>
                  </p>
                </div>

                <div className="min-w-[90px]">
                  <p className="text-[10px] font-bold uppercase tracking-tighter text-on-surface-variant/40">
                    Settlement
                  </p>
                  <p className="text-sm font-bold text-on-surface">
                    {formatNumber(entry.settlementAmount)}{" "}
                    <span className="text-[10px] text-secondary/60">
                      {entry.settlementCurrency}
                    </span>
                  </p>
                </div>
              </div>

              {/* 4. Persistent Actions */}
              <div className="flex items-center justify-end gap-2 pl-4">
                <button
                  type="button"
                  onClick={() => openEditModal(entry)}
                  className="flex h-8 items-center gap-2 rounded-md bg-surface-container px-3 text-xs font-bold text-on-surface-variant transition-colors hover:bg-primary/10 hover:text-primary"
                >
                  <Pencil size={13} strokeWidth={2.5} />
                  <span>Edit</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDelete(entry)}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-red-400 transition-colors hover:bg-red-500/10 hover:text-red-600"
                  title="Delete"
                >
                  <Trash2 size={14} strokeWidth={2.5} />
                </button>
              </div>
            </article>
          ))}
        </section>
      )}

      <MiscellaneousEntryModal
        open={isModalOpen}
        mode={editingEntry ? "edit" : "create"}
        form={form}
        setForm={setForm}
        onClose={closeModal}
        onSubmit={handleSubmit}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
      />
    </div>
  );
}
