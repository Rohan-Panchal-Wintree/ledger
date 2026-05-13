import {
  Building2,
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
  useCreateMerchant,
  useDeleteMerchant,
  useMerchants,
  useUpdateMerchant,
} from "../queries/merchantQueries";

const initialMerchantValues = {
  merchantName: "",
  merchantTag: "Transactworld Merchant",
  status: "active",
};

const merchantFields = [
  {
    name: "merchantName",
    label: "Merchant Name",
    placeholder: "Enter merchant name",
    type: "text",
  },
  {
    name: "merchantTag",
    label: "Merchant Tag",
    type: "select",
    options: [
      { label: "Transactworld Merchant", value: "Transactworld Merchant" },
      { label: "Dreamzpay Merchant", value: "Dreamzpay Merchant" },
    ],
  },
  {
    name: "status",
    label: "Status",
    type: "select",
    options: [
      { label: "Active", value: "active" },
      { label: "Inactive", value: "inactive" },
    ],
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

function validateMerchant(values) {
  const errors = {
    merchantName: "",
    merchantTag: "",
    status: "",
  };

  const merchantName = values.merchantName.trim();

  if (!merchantName) {
    errors.merchantName = "Merchant name is required.";
  } else if (merchantName.length < 2) {
    errors.merchantName = "Merchant name must be at least 2 characters.";
  }

  if (
    !["Transactworld Merchant", "Dreamzpay Merchant"].includes(
      values.merchantTag,
    )
  ) {
    errors.merchantTag = "Please select a valid merchant tag.";
  }

  if (!["active", "inactive"].includes(values.status)) {
    errors.status = "Please select a valid status.";
  }

  return errors;
}

function getStatusBadge(status) {
  const normalizedStatus = status?.toLowerCase();

  const styles =
    normalizedStatus === "active"
      ? "bg-green-500/10 text-green-600"
      : "bg-surface-container text-on-surface-variant";

  return (
    <span
      className={`rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest ${styles}`}
    >
      {normalizedStatus || "unknown"}
    </span>
  );
}

function getErrorMessage(error, fallbackMessage) {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    fallbackMessage
  );
}

export default function Merchants() {
  const currentUser = useSelector(selectCurrentUser);
  console.log("currentUser", currentUser);
  const [searchValue, setSearchValue] = useState("");
  const [backendSearch, setBackendSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState("create");
  const [editingId, setEditingId] = useState(null);
  const [formValues, setFormValues] = useState(initialMerchantValues);
  const [formErrors, setFormErrors] = useState({});
  const [deleteTarget, setDeleteTarget] = useState(null);

  const normalizedSearch = searchValue.trim().toLowerCase();

  const { data, isLoading, isFetching, error } = useMerchants({
    page,
    limit: pageSize,
    search: backendSearch,
  });

  const createMerchantMutation = useCreateMerchant();
  const updateMerchantMutation = useUpdateMerchant();
  const deleteMerchantMutation = useDeleteMerchant();

  const merchants = data?.items || [];
  const total = data?.meta?.total || 0;
  const totalPages = data?.meta?.totalPages || 1;

  const isSubmitting =
    createMerchantMutation.isPending || updateMerchantMutation.isPending;

  const isDeletePending = deleteMerchantMutation.isPending;

  const canManageMerchants = ["admin", "finance", "settlement"].includes(
    currentUser?.role,
  );

  const localSearchResults = useMemo(() => {
    if (!normalizedSearch) return merchants;

    return merchants.filter((merchant) => {
      const searchBlob = [
        merchant.merchantName,
        merchant.merchantTag,
        merchant.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchBlob.includes(normalizedSearch);
    });
  }, [merchants, normalizedSearch]);

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
      toast.error(getErrorMessage(error, "Failed to load merchant data."));
    }
  }, [error]);

  function resetForm() {
    setFormMode("create");
    setEditingId(null);
    setFormValues(initialMerchantValues);
    setFormErrors({});
  }

  function openCreateForm() {
    resetForm();
    setIsFormOpen(true);
  }

  function openEditForm(merchant) {
    setFormMode("edit");
    setEditingId(merchant?._id || null);
    setFormErrors({});
    setFormValues({
      merchantName: merchant?.merchantName || "",
      merchantTag: merchant?.merchantTag || "Transactworld Merchant",
      status: merchant?.status || "active",
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
    const nextErrors = validateMerchant(formValues);
    setFormErrors(nextErrors);

    if (Object.values(nextErrors).some(Boolean)) {
      return null;
    }

    return {
      merchantName: formValues.merchantName.trim(),
      merchantTag: formValues.merchantTag,
      status: formValues.status,
    };
  }

  async function handleSubmitMerchant() {
    const payload = getSubmitPayload();

    if (!payload) return false;

    try {
      if (formMode === "edit" && editingId) {
        await updateMerchantMutation.mutateAsync({
          id: editingId,
          payload,
        });

        toast.success("Merchant updated successfully.");
      } else {
        await createMerchantMutation.mutateAsync(payload);
        toast.success("Merchant created successfully.");
      }

      setIsFormOpen(false);
      resetForm();
      return true;
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to save merchant."));
      return false;
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget?._id) return false;

    try {
      await deleteMerchantMutation.mutateAsync(deleteTarget._id);
      toast.success("Merchant deleted successfully.");
      setDeleteTarget(null);
      return true;
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to delete merchant."));
      return false;
    }
  }

  const visibleMerchants = normalizedSearch
    ? shouldUseLocalSearch
      ? localSearchResults
      : merchants
    : merchants;

  const filteredMerchants = visibleMerchants.filter((merchant) => {
    if (statusFilter === "all") return true;

    return merchant.status?.toLowerCase() === statusFilter;
  });

  const activeMerchantCount = merchants.filter(
    (merchant) => merchant.status?.toLowerCase() === "active",
  ).length;

  const inactiveMerchantCount = merchants.filter(
    (merchant) => merchant.status?.toLowerCase() === "inactive",
  ).length;

  const safePage = Math.min(page, totalPages || 1);
  const paginatedMerchants = filteredMerchants;

  const showingFrom = total ? (safePage - 1) * pageSize + 1 : 0;
  const showingTo = Math.min(safePage * pageSize, total);

  const stats = [
    {
      label: "Total Merchants",
      value: total,
      helper: "All merchant records",
      icon: Building2,
    },
    {
      label: "Active Merchants",
      value: activeMerchantCount,
      helper: "Currently active",
      icon: Building2,
    },
    {
      label: "Inactive Merchants",
      value: inactiveMerchantCount,
      helper: "Paused or inactive",
      icon: Building2,
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
          Updating merchant data...
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
            Merchant Management
          </h2>
          <p className="mt-1 text-sm font-medium text-on-surface-variant">
            Create, search, edit, and delete merchant records.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <select
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value);
              setPage(1);
            }}
            className="rounded-full border-none bg-surface-container-low px-4 py-2.5 text-sm font-semibold text-on-surface outline-none transition-all focus:ring-2 focus:ring-primary/20"
          >
            <option value="all">All statuses</option>
            <option value="active">Active only</option>
            <option value="inactive">Inactive only</option>
          </select>

          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant"
              size={16}
            />
            <input
              type="text"
              placeholder="Search merchants..."
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
            disabled={!canManageMerchants}
            className="flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-content transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Plus size={16} />
            Add Merchant
          </button>
        </div>
      </div>

      <section className="overflow-hidden rounded-lg border border-outline-variant/10 bg-surface-container-lowest">
        <div className="flex items-center justify-between border-b border-outline-variant/5 px-8 py-6">
          <h3 className="text-xl font-bold tracking-tight text-on-surface">
            Merchant Records
          </h3>
        </div>

        <div className="overflow-x-auto scrollbar-hide">
          <table className="w-full border-collapse text-left">
            <thead className="bg-surface-container-low/50">
              <tr>
                <th className="whitespace-nowrap px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                  Merchant
                </th>
                <th className="whitespace-nowrap px-8 py-4 text-center text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                  Status
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
              {paginatedMerchants.length ? (
                paginatedMerchants.map((merchant) => (
                  <tr
                    key={merchant._id}
                    className="group transition-all duration-200 hover:bg-surface-container-low/45"
                  >
                    <td className="whitespace-nowrap px-8 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/8">
                          <Building2 className="text-primary" size={16} />
                        </div>

                        <div className="min-w-0">
                          <span className="block truncate text-sm font-bold text-on-surface">
                            {merchant.merchantName || "-"}
                          </span>
                          <span className="mt-1 block text-[11px] font-medium uppercase tracking-wide text-on-surface-variant/75">
                            {merchant.merchantTag || "No tag added"}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="whitespace-nowrap px-8 py-4 text-center">
                      {getStatusBadge(merchant.status)}
                    </td>

                    <td className="whitespace-nowrap px-8 py-4 text-sm font-medium text-on-surface-variant">
                      {formatDate(merchant.createdAt)}
                    </td>

                    <td className="whitespace-nowrap px-8 py-4 text-sm font-medium text-on-surface-variant">
                      {formatDate(merchant.updatedAt)}
                    </td>

                    <td className="whitespace-nowrap px-8 py-4 text-right">
                      <div className="dropdown dropdown-left dropdown-end relative z-30">
                        <button
                          type="button"
                          tabIndex={0}
                          disabled={!canManageMerchants}
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
                              onClick={() => openEditForm(merchant)}
                              disabled={!canManageMerchants}
                              className="flex items-center gap-2 rounded-lg text-sm font-semibold text-on-surface"
                            >
                              <Pencil size={15} />
                              Edit
                            </button>
                          </li>

                          <li>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(merchant)}
                              disabled={!canManageMerchants || isDeletePending}
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
                    colSpan={5}
                    className="px-8 py-12 text-center text-sm font-medium text-on-surface-variant"
                  >
                    No merchants found.
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
              {total} merchants
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
        title={formMode === "edit" ? "Edit Merchant" : "Create Merchant"}
        description="Merchant details are validated before they are sent to the backend."
        fields={merchantFields}
        values={formValues}
        errors={formErrors}
        mode={formMode}
        onClose={closeForm}
        onChange={handleFieldChange}
        onSubmit={handleSubmitMerchant}
        isSubmitting={isSubmitting}
        isLoading={false}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete Merchant?"
        description={`This will permanently remove ${
          deleteTarget?.merchantName || "this merchant"
        }.`}
        confirmLabel="Delete Merchant"
        isLoading={isDeletePending}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
