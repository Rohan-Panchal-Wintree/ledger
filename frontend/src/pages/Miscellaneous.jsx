import { useCallback, useEffect, useMemo, useState } from "react";
import { Banknote, FileText, Plus, WalletCards } from "lucide-react";
import toast from "react-hot-toast";

import {
  useCreateMiscellaneousPayment,
  useDeleteMiscellaneousPayment,
  useMiscellaneousPayments,
  useUpdateMiscellaneousPayment,
} from "../queries/miscellaneousQueries";

import {
  buildMiscellaneousPayload,
  filterMiscellaneousEntries,
  getMiscellaneousSummary,
  mapMiscellaneousEntryToForm,
  miscellaneousInitialForm,
  validateMiscellaneousForm,
} from "../utils/miscellaneousUtils";

import { formatDate, formatNumber, getErrorMessage } from "../utils/appUtils";

import Button from "../component/UI/Button";
import EmptyState from "../component/UI/EmptyState";
import Modal from "../component/UI/Modal";
import SearchInput from "../component/UI/SearchInput";
import Spinner from "../component/UI/Spinner";
import StatCard from "../component/UI/StatCard";

import MiscellaneousEntryForm from "../component/miscellaneous/MiscellaneousEntryForm";
import MiscellaneousEntryRow from "../component/miscellaneous/MiscellaneousEntryRow";

export default function Miscellaneous() {
  // Page state
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [form, setForm] = useState(miscellaneousInitialForm);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Queries
  const miscellaneousQuery = useMiscellaneousPayments();

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
  const summary = useMemo(() => {
    return getMiscellaneousSummary(filteredEntries);
  }, [filteredEntries]);

  // Update form field
  const handleFormChange = useCallback((field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }, []);

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
      {/* Summary cards */}
      <section className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard
          label="Total Entries"
          value={summary.totalEntries}
          helper="Miscellaneous payment records"
          icon={FileText}
        />

        <StatCard
          label="Processing Total"
          value={formatNumber(summary.totalAmountPaid)}
          helper="Total processing amount"
          icon={WalletCards}
        />

        <StatCard
          label="Settlement Total"
          value={formatNumber(summary.totalSettlementAmount)}
          helper="Total actual paid amount"
          icon={Banknote}
        />
      </section>

      {/* Toolbar */}
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
            className="rounded-full"
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
        <section className="flex flex-col">
          {filteredEntries.map((entry, index) => (
            <MiscellaneousEntryRow
              key={entry._id}
              entry={entry}
              index={index}
              totalEntries={filteredEntries.length}
              formatNumber={formatNumber}
              formatDate={formatDate}
              onEdit={openEditModal}
              onDelete={requestDelete}
              isDeleting={
                deleteMutation.isPending && deleteTarget?._id === entry._id
              }
            />
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
        onClose={closeModal}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={closeModal}
              disabled={isSaving}
              className="rounded-full"
            >
              Cancel
            </Button>

            <Button
              variant="primary"
              onClick={handleSubmit}
              loading={isSaving}
              className="rounded-full"
            >
              {editingEntry ? "Update" : "Create"}
            </Button>
          </>
        }
      >
        <MiscellaneousEntryForm form={form} onChange={handleFormChange} />
      </Modal>

      {/* Delete modal */}
      <Modal
        open={Boolean(deleteTarget)}
        size="sm"
        onClose={cancelDelete}
        title="Delete Entry?"
        description="This action cannot be undone. The miscellaneous entry will be permanently removed."
        footer={
          <>
            <Button
              variant="secondary"
              onClick={cancelDelete}
              disabled={deleteMutation.isPending}
              className="rounded-full"
            >
              Cancel
            </Button>

            <Button
              variant="danger"
              onClick={confirmDelete}
              loading={deleteMutation.isPending}
              className="rounded-full"
            >
              Delete
            </Button>
          </>
        }
      />
    </div>
  );
}
