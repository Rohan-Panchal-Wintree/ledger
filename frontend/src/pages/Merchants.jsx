import { Building2, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import toast from "react-hot-toast";

import Modal from "../component/UI/Modal";
import EntityForm from "../component/merchants/EntityForm";
import MerchantRow from "../component/merchants/MerchantRow";

import Button from "../component/UI/Button";
import DataTable from "../component/UI/DataTable";
import DeleteModal from "../component/UI/DeleteModal";
import SearchInput from "../component/UI/SearchInput";
import Spinner from "../component/UI/Spinner";
import StatCard from "../component/UI/StatCard";

import { selectCurrentUser } from "../store/slices/Auth.slice.js";
import {
  useCreateMerchant,
  useDeleteMerchant,
  useMerchants,
  useUpdateMerchant,
} from "../queries/merchantQueries";

import { getErrorMessage } from "../utils/appUtils.js";

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

const merchantColumns = [
  { key: "merchant", label: "Merchant" },
  { key: "mid", label: "MID" },
  { key: "status", label: "Status", align: "center" },
  { key: "createdAt", label: "Created" },
  { key: "updatedAt", label: "Updated" },
  { key: "actions", label: "Actions", align: "right" },
];

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

export default function Merchants() {
  const currentUser = useSelector(selectCurrentUser);
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

  const stats = [
    {
      label: "Total Merchants",
      value: total,
      helper: "All merchant records",
      icon: Building2,
    },
    {
      label: "Visible Results",
      value: activeMerchantCount,
      helper: "After current search",
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

          <SearchInput
            value={searchValue}
            placeholder="Search merchants..."
            className="w-full sm:w-80"
            onChange={(event) => {
              setSearchValue(event.target.value);
              setPage(1);
            }}
          />

          <Button
            type="button"
            onClick={openCreateForm}
            disabled={!canManageMerchants}
            leftIcon={<Plus size={16} />}
          >
            Add Merchant
          </Button>
        </div>
      </div>

      <DataTable
        title="Merchant Records"
        columns={merchantColumns}
        totalItems={total}
        itemLabel="merchants"
        page={safePage}
        isLoading={isFetching}
        isEmpty={paginatedMerchants.length === 0}
        emptyTitle="No merchants found."
        emptyDescription="Try adjusting your search or status filter."
        onPageChange={setPage}
        onRowsPerPageChange={(value) => {
          setPageSize(value);
          setPage(1);
        }}
      >
        {paginatedMerchants.map((merchant) => (
          <MerchantRow
            key={merchant._id}
            merchant={merchant}
            canManageMerchants={canManageMerchants}
            isDeletePending={isDeletePending}
            onEdit={openEditForm}
            onDelete={setDeleteTarget}
          />
        ))}
      </DataTable>

      <Modal
        open={isFormOpen}
        title={formMode === "edit" ? "Edit Merchant" : "Create Merchant"}
        description="Merchant details are validated before they are sent to the backend."
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
              form="merchant-form"
              loading={isSubmitting}
              disabled={isSubmitting}
            >
              {formMode === "edit" ? "Update" : "Create"}
            </Button>
          </>
        }
      >
        <EntityForm
          formId="merchant-form"
          fields={merchantFields}
          values={formValues}
          errors={formErrors}
          onChange={handleFieldChange}
          onSubmit={handleSubmitMerchant}
          isLoading={false}
        />
      </Modal>

      <DeleteModal
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
