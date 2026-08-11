import { Landmark, Plus, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import toast from "react-hot-toast";

import AcquirerRow from "../component/acquirers/AcquirerRow";
import EntityForm from "../component/acquirers/EntityForm";

import Button from "../component/UI/Button";
import DataTable from "../component/UI/DataTable";
import DeleteModal from "../component/UI/DeleteModal";
import Modal from "../component/UI/Modal";
import SearchInput from "../component/UI/SearchInput";
import Spinner from "../component/UI/Spinner";
import StatCard from "../component/UI/StatCard";

import { selectCurrentUser } from "../store/slices/Auth.slice";

import {
  useAcquirers,
  useCreateAcquirer,
  useDeleteAcquirer,
  useUpdateAcquirer,
} from "../queries/acquirerQueries";

import { getErrorMessage } from "../utils/appUtils";

const initialAcquirerValues = {
  name: "",
};

const acquirerFields = [
  {
    name: "name",
    label: "Acquirer Name",
    placeholder: "Enter acquirer name",
    type: "text",
  },
];

const acquirerColumns = [
  { key: "acquirer", label: "Acquirer" },
  { key: "createdAt", label: "Created" },
  { key: "updatedAt", label: "Updated" },
  { key: "actions", label: "Actions", align: "right" },
];

function validateAcquirer(values) {
  const errors = { name: "" };
  const name = values.name.trim();

  if (!name) {
    errors.name = "Acquirer name is required.";
  } else if (name.length < 2) {
    errors.name = "Acquirer name must be at least 2 characters.";
  }

  return errors;
}

export default function Acquirers() {
  const currentUser = useSelector(selectCurrentUser);

  const [searchValue, setSearchValue] = useState("");
  const [backendSearch, setBackendSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(() => {
    const savedPageSize = Number(
      localStorage.getItem("global-table-rows-per-page"),
    );

    return savedPageSize > 0 ? savedPageSize : 25;
  });
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState("create");
  const [editingId, setEditingId] = useState(null);
  const [formValues, setFormValues] = useState(initialAcquirerValues);
  const [formErrors, setFormErrors] = useState({});
  const [deleteTarget, setDeleteTarget] = useState(null);

  const normalizedSearch = searchValue.trim().toLowerCase();

  const { data, isLoading, isFetching, error } = useAcquirers({
    page,
    limit: pageSize,
    search: backendSearch,
  });

  const createAcquirerMutation = useCreateAcquirer();
  const updateAcquirerMutation = useUpdateAcquirer();
  const deleteAcquirerMutation = useDeleteAcquirer();

  const acquirers = data?.items || [];
  const total = data?.meta?.total || 0;
  const totalPages = data?.meta?.totalPages || 1;

  const isSubmitting =
    createAcquirerMutation.isPending || updateAcquirerMutation.isPending;

  const isDeletePending = deleteAcquirerMutation.isPending;

  const canManageAcquirers = ["admin", "finance"].includes(currentUser?.role);

  const localSearchResults = useMemo(() => {
    if (!normalizedSearch) return acquirers;

    return acquirers.filter((acquirer) =>
      acquirer.name?.toLowerCase().includes(normalizedSearch),
    );
  }, [acquirers, normalizedSearch]);

  const shouldUseLocalSearch = Boolean(
    normalizedSearch && localSearchResults.length,
  );

  useEffect(() => {
    if (!normalizedSearch) {
      setBackendSearch("");
      return;
    }

    if (shouldUseLocalSearch) {
      return;
    }

    const timer = setTimeout(() => {
      setBackendSearch(searchValue.trim());
      setPage(1);
    }, 400);

    return () => clearTimeout(timer);
  }, [normalizedSearch, searchValue, shouldUseLocalSearch]);

  useEffect(() => {
    if (error) {
      toast.error(getErrorMessage(error, "Failed to load acquirer data."));
    }
  }, [error]);

  function resetForm() {
    setFormMode("create");
    setEditingId(null);
    setFormValues(initialAcquirerValues);
    setFormErrors({});
  }

  function openCreateForm() {
    resetForm();
    setIsFormOpen(true);
  }

  function openEditForm(acquirer) {
    setFormMode("edit");
    setEditingId(acquirer?._id || null);
    setFormErrors({});
    setFormValues({
      name: acquirer?.name || "",
    });
    setIsFormOpen(true);
  }

  function closeForm() {
    if (isSubmitting) return;

    setIsFormOpen(false);
    resetForm();
  }

  function handleFieldChange(name, value) {
    setFormValues((currentValues) => ({
      ...currentValues,
      [name]: value,
    }));

    setFormErrors((currentErrors) => ({
      ...currentErrors,
      [name]: "",
    }));
  }

  function getSubmitPayload() {
    const nextErrors = validateAcquirer(formValues);
    setFormErrors(nextErrors);

    if (Object.values(nextErrors).some(Boolean)) {
      return null;
    }

    return {
      name: formValues.name.trim(),
    };
  }

  async function handleSubmitAcquirer() {
    const payload = getSubmitPayload();

    if (!payload) return false;

    try {
      if (formMode === "edit" && editingId) {
        await updateAcquirerMutation.mutateAsync({
          id: editingId,
          payload,
        });

        toast.success("Acquirer updated successfully.");
      } else {
        await createAcquirerMutation.mutateAsync(payload);
        toast.success("Acquirer created successfully.");
      }

      setIsFormOpen(false);
      resetForm();
      return true;
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to save acquirer."));
      return false;
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget?._id) return false;

    try {
      await deleteAcquirerMutation.mutateAsync(deleteTarget._id);
      toast.success("Acquirer deleted successfully.");
      setDeleteTarget(null);
      return true;
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to delete acquirer."));
      return false;
    }
  }

  const visibleAcquirers = normalizedSearch
    ? shouldUseLocalSearch
      ? localSearchResults
      : acquirers
    : acquirers;

  const safePage = Math.min(page, totalPages || 1);
  const paginatedAcquirers = visibleAcquirers;

  const stats = [
    {
      label: "Total Acquirers",
      value: total,
      helper: "Available banking partners",
      icon: Landmark,
    },
    {
      label: "Visible Results",
      value: visibleAcquirers.length,
      helper: "After current search",
      icon: Search,
    },
    {
      label: "Latest Added",
      value: acquirers[0]?.name || "-",
      helper: "Most recent acquirer",
      icon: Landmark,
    },
  ];

  if (isLoading) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center p-8 text-on-surface">
        <Spinner type="xl" />
      </div>
    );
  }

  return (
    <div className="w-full bg-background text-on-background">
      {/* {isFetching ? (
        <div className="mb-4 rounded-lg bg-surface-container-low px-4 py-3 text-xs font-bold uppercase tracking-widest text-on-surface-variant">
          Updating acquirer data...
        </div>
      ) : null} */}

      <section className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
        {stats.map(({ label, value, helper, icon }) => (
          <StatCard
            key={label}
            label={label}
            value={value}
            helper={helper}
            icon={icon}
            className="p-6"
          />
        ))}
      </section>

      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-on-surface">
            Acquirer Management
          </h2>
          <p className="mt-1 text-sm font-medium text-on-surface-variant">
            Create, search, edit, and delete acquirer records.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <SearchInput
            value={searchValue}
            placeholder="Search acquirers..."
            className="w-full sm:w-80"
            onChange={(event) => {
              setSearchValue(event.target.value);
              setPage(1);
            }}
          />

          <Button
            type="button"
            onClick={openCreateForm}
            disabled={!canManageAcquirers}
            leftIcon={<Plus size={16} />}
          >
            Add Acquirer
          </Button>
        </div>
      </div>

      <DataTable
        title="Acquirer Records"
        columns={acquirerColumns}
        totalItems={total}
        itemLabel="acquirers"
        page={safePage}
        isLoading={isFetching}
        isEmpty={paginatedAcquirers.length === 0}
        emptyTitle="No acquirers found."
        emptyDescription="Try adjusting your search."
        onPageChange={setPage}
        onRowsPerPageChange={(value) => {
          setPageSize(value);
          setPage(1);
        }}
      >
        {paginatedAcquirers.map((acquirer) => (
          <AcquirerRow
            key={acquirer._id}
            acquirer={acquirer}
            canManageAcquirers={canManageAcquirers}
            isDeletePending={isDeletePending}
            onEdit={openEditForm}
            onDelete={setDeleteTarget}
          />
        ))}
      </DataTable>

      <Modal
        open={isFormOpen}
        title={formMode === "edit" ? "Edit Acquirer" : "Create Acquirer"}
        description="Acquirer changes use the dedicated CRUD endpoints from your backend."
        size="md"
        onClose={closeForm}
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={closeForm}
              disabled={isSubmitting}
            >
              Cancel
            </Button>

            <Button
              type="submit"
              form="acquirer-form"
              loading={isSubmitting}
              disabled={isSubmitting}
            >
              {formMode === "edit" ? "Update" : "Create"}
            </Button>
          </>
        }
      >
        <EntityForm
          formId="acquirer-form"
          fields={acquirerFields}
          values={formValues}
          errors={formErrors}
          onChange={handleFieldChange}
          onSubmit={handleSubmitAcquirer}
          isLoading={false}
        />
      </Modal>

      <DeleteModal
        open={Boolean(deleteTarget)}
        title="Delete Acquirer?"
        description={`This will permanently remove ${
          deleteTarget?.name || "this acquirer"
        }.`}
        confirmLabel="Delete Acquirer"
        isLoading={isDeletePending}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
