import {
  Landmark,
  Plus,
  Search,
  MoreVertical,
  Pencil,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import toast from "react-hot-toast";

import ConfirmDialog from "../component/dashboard/ConfirmDialog";
import EntityFormModal from "../component/dashboard/EntityFormModal";
import Spinner from "../component/UI/Spinner";

import { selectCurrentUser } from "../store/slices/Auth.slice";
import {
  useAcquirers,
  useCreateAcquirer,
  useDeleteAcquirer,
  useUpdateAcquirer,
} from "../queries/acquirerQueries";

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

function formatDate(value) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

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

function getErrorMessage(error, fallbackMessage) {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    fallbackMessage
  );
}

export default function Acquirers() {
  const currentUser = useSelector(selectCurrentUser);

  const [searchValue, setSearchValue] = useState("");
  const [backendSearch, setBackendSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

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

  const showingFrom = total ? (safePage - 1) * pageSize + 1 : 0;
  const showingTo = Math.min(safePage * pageSize, total);

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
      label: "Access Level",
      value: canManageAcquirers ? "Edit" : "View",
      helper: "Based on your role",
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
        {stats.map(({ label, value, helper, icon: Icon }) => (
          <div
            key={label}
            className="rounded-lg border border-outline-variant/10 bg-surface-container-lowest p-6"
          >
            <div className="flex items-start justify-between">
              <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                {label}
              </span>
              <Icon className="text-primary" size={20} />
            </div>

            <div className="mt-8">
              <div className="text-4xl font-extrabold tracking-tight text-on-surface">
                {value}
              </div>
              <p className="mt-2 text-xs font-medium text-on-surface-variant">
                {helper}
              </p>
            </div>
          </div>
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
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant"
              size={16}
            />
            <input
              type="text"
              placeholder="Search acquirers..."
              value={searchValue}
              onChange={(event) => {
                setSearchValue(event.target.value);
                setPage(1);
              }}
              className="w-full rounded-full border-none bg-surface-container-low py-2.5 pl-10 pr-4 text-sm text-on-surface outline-none transition-all focus:ring-2 focus:ring-primary/20 sm:w-80"
            />
          </div>

          <button
            type="button"
            onClick={openCreateForm}
            disabled={!canManageAcquirers}
            className="flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-content transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Plus size={16} />
            Add Acquirer
          </button>
        </div>
      </div>

      <section className="overflow-hidden rounded-lg border border-outline-variant/10 bg-surface-container-lowest">
        <div className="flex items-center justify-between border-b border-outline-variant/5 px-8 py-6">
          <h3 className="text-xl font-bold tracking-tight text-on-surface">
            Acquirer Records
          </h3>
        </div>

        <div className="overflow-x-auto scrollbar-hide">
          <table className="w-full border-collapse text-left">
            <thead className="bg-surface-container-low/50">
              <tr>
                <th className="whitespace-nowrap px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                  Acquirer
                </th>
                <th className="whitespace-nowrap px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                  Created
                </th>
                <th className="whitespace-nowrap px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                  Updated
                </th>
                <th className="whitespace-nowrap px-8 py-4 text-right text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-outline-variant/5">
              {paginatedAcquirers.length ? (
                paginatedAcquirers.map((acquirer) => (
                  <tr
                    key={acquirer._id}
                    className="group transition-all duration-200 hover:bg-surface-container-low/45"
                  >
                    <td className="whitespace-nowrap px-8 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/8">
                          <Landmark className="text-primary" size={16} />
                        </div>

                        <div className="min-w-0">
                          <span className="block truncate text-sm font-bold text-on-surface">
                            {acquirer.name || "-"}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="whitespace-nowrap px-8 py-4 text-sm font-medium text-on-surface-variant">
                      {formatDate(acquirer.createdAt)}
                    </td>

                    <td className="whitespace-nowrap px-8 py-4 text-sm font-medium text-on-surface-variant">
                      {formatDate(acquirer.updatedAt)}
                    </td>

                    <td className="whitespace-nowrap px-8 py-4 text-right">
                      <div className="dropdown dropdown-left dropdown-end relative z-30">
                        <button
                          type="button"
                          tabIndex={0}
                          disabled={!canManageAcquirers}
                          className="btn btn-ghost btn-circle btn-sm text-on-surface-variant hover:bg-surface-container disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <MoreVertical size={18} />
                        </button>

                        <ul
                          tabIndex={0}
                          className="dropdown-content menu z-20 w-44 rounded-lg border border-outline-variant/10 bg-surface-container-lowest p-2"
                        >
                          <li>
                            <button
                              type="button"
                              onClick={() => openEditForm(acquirer)}
                              disabled={!canManageAcquirers}
                              className="flex items-center gap-2 rounded-lg text-sm font-semibold text-on-surface"
                            >
                              <Pencil size={15} />
                              Edit
                            </button>
                          </li>

                          <li>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(acquirer)}
                              disabled={!canManageAcquirers || isDeletePending}
                              className="flex items-center gap-2 rounded-lg text-sm font-semibold text-error"
                            >
                              <Trash2 size={15} />
                              Delete
                            </button>
                          </li>
                        </ul>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={4}
                    className="px-8 py-12 text-center text-sm font-medium text-on-surface-variant"
                  >
                    No acquirers found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-4 bg-surface-container-low/30 px-8 py-4 text-xs font-bold uppercase tracking-widest text-on-surface-variant lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <div>
              Showing {showingFrom ? `${showingFrom}-${showingTo}` : "0"} of{" "}
              {total} acquirers
            </div>

            <label className="flex items-center gap-2">
              <span>Rows</span>
              <select
                value={pageSize}
                onChange={(event) => {
                  setPageSize(Number(event.target.value));
                  setPage(1);
                }}
                className="rounded-full bg-surface-container px-3 py-2 text-xs font-bold text-on-surface outline-none"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </label>
          </div>

          <div className="flex items-center gap-2">
            <span>
              Page {showingFrom ? safePage : 0} of {total ? totalPages : 0}
            </span>

            <button
              type="button"
              onClick={() => setPage(Math.max(1, safePage - 1))}
              disabled={safePage === 1 || !total}
              className="rounded-full px-4 py-2 transition-colors hover:bg-surface-container disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>

            <button
              type="button"
              onClick={() => setPage(Math.min(totalPages, safePage + 1))}
              disabled={safePage === totalPages || !total}
              className="rounded-full bg-primary px-4 py-2 text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </section>

      <EntityFormModal
        open={isFormOpen}
        title={formMode === "edit" ? "Edit Acquirer" : "Create Acquirer"}
        description="Acquirer changes use the dedicated CRUD endpoints from your backend."
        fields={acquirerFields}
        values={formValues}
        errors={formErrors}
        mode={formMode}
        onClose={closeForm}
        onChange={handleFieldChange}
        onSubmit={handleSubmitAcquirer}
        isSubmitting={isSubmitting}
        isLoading={false}
      />

      <ConfirmDialog
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
