import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import toast from "react-hot-toast";

import {
  useCreateMiscellaneousPayment,
  useDeleteMiscellaneousPayment,
  useMiscellaneousPayments,
  useUpdateMiscellaneousPayment,
} from "../queries/miscellaneousQueries";

import { useAcquirers } from "../queries/acquirerQueries";
import { useMerchants } from "../queries/merchantQueries";
import { usePaymentSheets } from "../queries/sheetsQueries";

import {
  buildMiscellaneousPayload,
  filterMiscellaneousEntries,
  mapMiscellaneousEntryToForm,
  miscellaneousInitialForm,
  validateMiscellaneousForm,
} from "../utils/miscellaneousUtils";

import { formatDate, formatNumber, getErrorMessage } from "../utils/appUtils";

import Button from "../component/UI/Button";
import DeleteModal from "../component/UI/DeleteModal";
import EmptyState from "../component/UI/EmptyState";
import Modal from "../component/UI/Modal";
import SearchInput from "../component/UI/SearchInput";
import Spinner from "../component/UI/Spinner";

import MiscellaneousEntryForm from "../component/miscellaneous/MiscellaneousEntryForm";
import MiscellaneousEntryRow from "../component/miscellaneous/MiscellaneousEntryRow";
import PageHeader from "../component/UI/PageHeader";

function getEntryGroupKey(entry) {
  return entry.paymentSheetDateLabel || formatDate(entry.paymentSheetDate);
}

export default function Miscellaneous() {
  // Page state
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [form, setForm] = useState(miscellaneousInitialForm);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Queries
  const miscellaneousQuery = useMiscellaneousPayments();

  const paymentSheetsQuery = usePaymentSheets({
    page: 1,
    limit: 1000,
  });

  const merchantsQuery = useMerchants({
    page: 1,
    limit: 1000,
  });

  const acquirersQuery = useAcquirers({
    page: 1,
    limit: 1000,
  });

  const createMutation = useCreateMiscellaneousPayment();
  const updateMutation = useUpdateMiscellaneousPayment();
  const deleteMutation = useDeleteMiscellaneousPayment();

  // Query data
  const entries = miscellaneousQuery.data?.items || [];

  const isLoading =
    miscellaneousQuery.isLoading || miscellaneousQuery.isFetching;

  const isSaving = createMutation.isPending || updateMutation.isPending;

  // Auto-calculate settlement amount
  useEffect(() => {
    const amount = Number(form.amountPaid);
    const rate = Number(form.rate);

    if (!Number.isNaN(amount) && !Number.isNaN(rate) && rate > 0) {
      setForm((prev) => ({
        ...prev,
        settlementAmount: (amount * rate).toFixed(2),
      }));
    }
  }, [form.amountPaid, form.rate]);

  // Filtered entries
  const filteredEntries = useMemo(() => {
    return filterMiscellaneousEntries(entries, searchQuery);
  }, [entries, searchQuery]);

  // Summary
  const paymentSheetOptions = useMemo(() => {
    return (paymentSheetsQuery.data?.data || [])
      .filter((sheet) => sheet.fileName)
      .map((sheet) => ({
        label: sheet.fileName,
        value: sheet.fileName,
        paymentDate: sheet.paymentDate || "",
      }));
  }, [paymentSheetsQuery.data]);

  const merchantOptions = useMemo(() => {
    return (merchantsQuery.data?.items || [])
      .filter((merchant) => merchant.merchantName)
      .map((merchant) => ({
        label: merchant.merchantName,
        value: merchant.merchantName,
        mid: merchant.mid,
      }));
  }, [merchantsQuery.data]);

  const acquirerOptions = useMemo(() => {
    return (acquirersQuery.data?.items || [])
      .filter((acquirer) => acquirer.name)
      .map((acquirer) => ({
        label: acquirer.name,
        value: acquirer.name,
      }));
  }, [acquirersQuery.data]);

  const groupedEntries = useMemo(() => {
    return filteredEntries.reduce((groups, entry) => {
      const groupKey = getEntryGroupKey(entry);

      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }

      groups[groupKey].push(entry);

      return groups;
    }, {});
  }, [filteredEntries]);

  // Update form field
  const handleFormChange = useCallback(
    (field, value) => {
      setForm((prev) => {
        if (field === "entryType") {
          return {
            ...prev,
            entryType: value,
            ...(value === "agent"
              ? {
                  merchantName: "",
                  mid: "",
                  bankLabel: "",
                }
              : {}),
          };
        }

        if (field === "paymentSheetDateLabel") {
          const selectedSheet = paymentSheetOptions.find(
            (option) => option.value === value,
          );

          return {
            ...prev,
            paymentSheetDateLabel: value,
            paymentSheetDate:
              selectedSheet?.paymentDate || prev.paymentSheetDate,
          };
        }

        if (field === "merchantName") {
          const selectedMerchant = merchantOptions.find(
            (option) => option.value === value,
          );

          return {
            ...prev,
            merchantName: value,
            mid: selectedMerchant?.mid || "",
          };
        }

        return {
          ...prev,
          [field]: value,
        };
      });
    },
    [paymentSheetOptions, merchantOptions],
  );

  // Open create modal
  const openCreateModal = useCallback(() => {
    setEditingEntry(null);
    setForm(miscellaneousInitialForm);
    setIsModalOpen(true);
  }, []);

  // Open edit modal
  const openEditModal = useCallback((entry) => {
    setEditingEntry(entry);
    setForm(mapMiscellaneousEntryToForm(entry));
    setIsModalOpen(true);
  }, []);

  // Close modal
  const closeModal = useCallback(() => {
    setEditingEntry(null);
    setForm(miscellaneousInitialForm);
    setIsModalOpen(false);
  }, []);

  // Save entry
  const handleSubmit = useCallback(async () => {
    const error = validateMiscellaneousForm(form);

    if (error) {
      toast.error(error);
      return;
    }

    try {
      const payload = buildMiscellaneousPayload(form);

      if (editingEntry) {
        await updateMutation.mutateAsync({
          id: editingEntry._id,
          payload,
        });

        toast.success("Miscellaneous entry updated.");
      } else {
        await createMutation.mutateAsync(payload);

        toast.success("Miscellaneous entry created.");
      }

      closeModal();
    } catch (error) {
      toast.error(
        getErrorMessage(error, "Unable to save miscellaneous entry."),
      );
    }
  }, [closeModal, createMutation, editingEntry, form, updateMutation]);

  // Open delete modal
  const requestDelete = useCallback((entry) => {
    setDeleteTarget(entry);
  }, []);

  // Delete entry
  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;

    try {
      await deleteMutation.mutateAsync(deleteTarget._id);

      toast.success("Miscellaneous entry deleted.");

      setDeleteTarget(null);
    } catch (error) {
      toast.error(getErrorMessage(error, "Unable to delete entry."));
    }
  }, [deleteMutation, deleteTarget]);

  // Close delete modal
  const cancelDelete = useCallback(() => {
    if (!deleteMutation.isPending) {
      setDeleteTarget(null);
    }
  }, [deleteMutation.isPending]);

  return (
    <div className="w-full bg-background text-on-background">
      <PageHeader
        title="Miscellaneous"
        description="Add, edit, and manage miscellaneous data associated with the payment sheet."
        className="mb-6"
      />
      {/* Toolbar */}
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-on-surface">
            Miscellaneous Entries
          </h2>

          <p className="mt-1 text-sm font-medium text-on-surface-variant">
            All the payment sheet related miscellaneous entries.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <SearchInput
            value={searchQuery}
            placeholder="Search entries..."
            className="w-full sm:w-80"
            inputClassName="py-2.5"
            onChange={(event) => setSearchQuery(event.target.value)}
          />

          <Button
            variant="primary"
            size="md"
            leftIcon={<Plus size={16} />}
            onClick={openCreateModal}
          >
            Add Entry
          </Button>
        </div>
      </div>

      {/* Entry list */}
      {isLoading ? (
        <div className="flex items-center justify-center p-2">
          <Spinner />
        </div>
      ) : filteredEntries.length === 0 ? (
        <EmptyState
          title="No miscellaneous entries found."
          description="Add a new entry or adjust your search."
        />
      ) : (
        <section className="space-y-5">
          {Object.entries(groupedEntries).map(([groupLabel, groupEntries]) => (
            <div
              key={groupLabel}
              className="overflow-hidden rounded-2xl border border-outline-variant/10 bg-surface-container-lowest"
            >
              <div className="flex items-center justify-between border-b border-outline-variant/10 px-6 py-4">
                <div>
                  <h3 className="text-sm font-bold text-on-surface">
                    {groupLabel}
                  </h3>

                  <p className="mt-1 text-xs text-on-surface-variant">
                    {groupEntries.length}{" "}
                    {groupEntries.length === 1 ? "entry" : "entries"}
                  </p>
                </div>
              </div>

              <div className="flex flex-col">
                {groupEntries.map((entry, index) => (
                  <MiscellaneousEntryRow
                    key={entry._id}
                    entry={entry}
                    index={index}
                    totalEntries={groupEntries.length}
                    formatNumber={formatNumber}
                    formatDate={formatDate}
                    onEdit={openEditModal}
                    onDelete={requestDelete}
                    isDeleting={
                      deleteMutation.isPending &&
                      deleteTarget?._id === entry._id
                    }
                  />
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Create/Edit modal */}
      <Modal
        open={isModalOpen}
        size="xl"
        title={
          editingEntry ? "Edit Miscellaneous Entry" : "Add Miscellaneous Entry"
        }
        description="Enter the miscellaneous payment details and settlement values."
        onClose={closeModal}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={closeModal}
              disabled={isSaving}
            >
              Cancel
            </Button>

            <Button variant="primary" onClick={handleSubmit} loading={isSaving}>
              {editingEntry ? "Update" : "Create"}
            </Button>
          </>
        }
      >
        <MiscellaneousEntryForm
          form={form}
          paymentSheetOptions={paymentSheetOptions}
          merchantOptions={merchantOptions}
          acquirerOptions={acquirerOptions}
          onChange={handleFormChange}
        />
      </Modal>

      {/* Delete modal */}
      <DeleteModal
        open={Boolean(deleteTarget)}
        title="Delete Entry?"
        description="This action cannot be undone. The miscellaneous entry will be permanently removed."
        confirmLabel="Delete"
        isLoading={deleteMutation.isPending}
        onClose={cancelDelete}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
