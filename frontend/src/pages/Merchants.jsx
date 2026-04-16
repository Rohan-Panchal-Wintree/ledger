import { Building2 } from "lucide-react";
import { useDeferredValue, useState } from "react";
import { useSelector } from "react-redux";
import { selectCurrentUser } from "../store/slices/Auth.slice";
import ConfirmDialog from "../component/dashboard/ConfirmDialog";
import EntityFormModal from "../component/dashboard/EntityFormModal";
import EntityTable from "../component/dashboard/EntityTable";
import ManagementToolbar from "../component/dashboard/ManagementToolbar";
import PaginationControls from "../component/dashboard/PaginationControls";
import StatCard from "../component/dashboard/StatCard";
import useCrudManager from "../hooks/useCrudManager";
import merchantService from "../services/merchantService";

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
    placeholder: "Optional internal tag",
    type: "text",
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
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

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

  if (!values.merchantName.trim()) {
    errors.merchantName = "Merchant name is required.";
  } else if (values.merchantName.trim().length < 2) {
    errors.merchantName = "Merchant name must be at least 2 characters.";
  }

  if (values.merchantTag && values.merchantTag.trim().length === 1) {
    errors.merchantTag = "Merchant tag must be at least 2 characters.";
  }

  if (!["active", "inactive"].includes(values.status)) {
    errors.status = "Please select a valid status.";
  }

  return errors;
}

function getStatusBadge(status) {
  const styles =
    status === "active"
      ? "bg-green-50 text-green-700"
      : "bg-slate-200 text-slate-700";

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] ${styles}`}
    >
      {status || "unknown"}
    </span>
  );
}

export default function Merchants() {
  const currentUser = useSelector(selectCurrentUser);
  const [searchValue, setSearchValue] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const deferredSearch = useDeferredValue(searchValue.trim().toLowerCase());

  const merchantManager = useCrudManager({
    entityLabel: "Merchant",
    service: merchantService,
    initialValues: {
      merchantName: "",
      merchantTag: "",
      status: "active",
    },
    validate: validateMerchant,
    mapEntityToFormValues: (merchant) => ({
      merchantName: merchant?.merchantName || "",
      merchantTag: merchant?.merchantTag || "",
      status: merchant?.status || "active",
    }),
    transformValues: (values) => ({
      merchantName: values.merchantName.trim(),
      merchantTag: values.merchantTag.trim() || undefined,
      status: values.status,
    }),
  });

  const canManageMerchants = ["admin", "finance", "settlement"].includes(
    currentUser?.role,
  );

  const filteredMerchants = merchantManager.items.filter((merchant) => {
    const searchBlob = [
      merchant.merchantName,
      merchant.merchantTag,
      merchant.status,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    const matchesSearch =
      !deferredSearch || searchBlob.includes(deferredSearch);
    const matchesStatus =
      statusFilter === "all" || merchant.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const activeMerchantCount = merchantManager.items.filter(
    (merchant) => merchant.status === "active",
  ).length;
  const inactiveMerchantCount =
    merchantManager.items.length - activeMerchantCount;
  const totalPages = Math.max(1, Math.ceil(filteredMerchants.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedMerchants = filteredMerchants.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize,
  );

  const merchantColumns = [
    {
      key: "merchantName",
      label: "Merchant",
      render: (merchant) => (
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/8 text-primary">
              <Building2 size={18} />
            </div>
            <div>
              <p className="font-bold text-on-surface">{merchant.merchantName}</p>
              <p className="text-xs text-on-surface-variant">
                {merchant.merchantTag || "No tag added"}
              </p>
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (merchant) => getStatusBadge(merchant.status),
    },
    {
      key: "createdAt",
      label: "Created",
      render: (merchant) => formatDate(merchant.createdAt),
    },
    {
      key: "updatedAt",
      label: "Updated",
      render: (merchant) => formatDate(merchant.updatedAt),
    },
  ];

  return (
    <div className="space-y-6 text-on-background">
      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard
          label="Total Merchants"
          value={merchantManager.items.length}
          helper="All merchant records available in the system."
        />
        <StatCard
          label="Active Merchants"
          value={activeMerchantCount}
          helper="Merchants currently marked active."
        />
        <StatCard
          label="Inactive Merchants"
          value={inactiveMerchantCount}
          helper="Merchants marked inactive or paused."
        />
      </section>

      <section className="overflow-hidden rounded-[2rem] border border-outline-variant/15 bg-surface-container-lowest shadow-sm">
        <ManagementToolbar
          title="Merchant Management"
          description="Create, search, edit, and delete merchant records from the sidebar page."
          searchValue={searchValue}
          onSearchChange={(value) => {
            setSearchValue(value);
            setPage(1);
          }}
          searchPlaceholder="Search by name, tag, or status"
          actionLabel="Add Merchant"
          onAction={merchantManager.openCreateForm}
          actionDisabled={!canManageMerchants}
        >
          <select
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value);
              setPage(1);
            }}
            className="rounded-full border border-outline-variant/20 bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none"
          >
            <option value="all">All statuses</option>
            <option value="active">Active only</option>
            <option value="inactive">Inactive only</option>
          </select>
        </ManagementToolbar>

        {merchantManager.error ? (
          <div className="border-b border-red-100 bg-red-50 px-6 py-4 text-sm text-red-700">
            {merchantManager.error}
          </div>
        ) : null}

        <EntityTable
          columns={merchantColumns}
          rows={paginatedMerchants}
          isLoading={merchantManager.isLoading}
          emptyTitle="No merchants found"
          emptyDescription="Try changing the search or filter, or create your first merchant record."
          onEdit={merchantManager.openEditForm}
          onDelete={merchantManager.setDeleteTarget}
          canEdit={canManageMerchants}
          canDelete={canManageMerchants}
          isDeletePending={merchantManager.isDeletePending}
          deleteTargetId={merchantManager.deleteTarget?._id}
        />

        <PaginationControls
          totalItems={filteredMerchants.length}
          currentPage={safePage}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(nextPageSize) => {
            setPageSize(nextPageSize);
            setPage(1);
          }}
        />
      </section>

      <EntityFormModal
        open={merchantManager.isFormOpen}
        title={
          merchantManager.formMode === "edit"
            ? "Edit Merchant"
            : "Create Merchant"
        }
        description="Merchant details are validated before they are sent to the backend."
        fields={merchantFields}
        values={merchantManager.formValues}
        errors={merchantManager.formErrors}
        mode={merchantManager.formMode}
        onClose={merchantManager.closeForm}
        onChange={merchantManager.handleFieldChange}
        onSubmit={merchantManager.submitForm}
        isSubmitting={merchantManager.isSubmitting}
        isLoading={merchantManager.isPrefillingForm}
      />

      <ConfirmDialog
        open={Boolean(merchantManager.deleteTarget)}
        title="Delete Merchant?"
        description={`This will permanently remove ${
          merchantManager.deleteTarget?.merchantName || "this merchant"
        }.`}
        confirmLabel="Delete Merchant"
        isLoading={merchantManager.isDeletePending}
        onClose={() => merchantManager.setDeleteTarget(null)}
        onConfirm={merchantManager.confirmDelete}
      />
    </div>
  );
}
