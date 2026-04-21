import { Landmark } from "lucide-react";
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
import acquirerService from "../services/acquirerService";

const acquirerFields = [
  {
    name: "name",
    label: "Acquirer Name",
    placeholder: "Enter acquirer name",
    type: "text",
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

function validateAcquirer(values) {
  const errors = { name: "" };

  if (!values.name.trim()) {
    errors.name = "Acquirer name is required.";
  } else if (values.name.trim().length < 2) {
    errors.name = "Acquirer name must be at least 2 characters.";
  }

  return errors;
}

export default function Acquirers() {
  const currentUser = useSelector(selectCurrentUser);
  const [searchValue, setSearchValue] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const deferredSearch = useDeferredValue(searchValue.trim().toLowerCase());

  const acquirerManager = useCrudManager({
    entityLabel: "Acquirer",
    service: acquirerService,
    initialValues: {
      name: "",
    },
    validate: validateAcquirer,
    mapEntityToFormValues: (acquirer) => ({
      name: acquirer?.name || "",
    }),
    transformValues: (values) => ({
      name: values.name.trim(),
    }),
  });

  const canManageAcquirers = ["admin", "finance"].includes(currentUser?.role);

  const filteredAcquirers = acquirerManager.items.filter((acquirer) => {
    const searchBlob = [acquirer.name].filter(Boolean).join(" ").toLowerCase();
    return !deferredSearch || searchBlob.includes(deferredSearch);
  });

  const totalPages = Math.max(1, Math.ceil(filteredAcquirers.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedAcquirers = filteredAcquirers.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize,
  );

  const acquirerColumns = [
    {
      key: "name",
      label: "Acquirer",
      render: (acquirer) => (
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/8 text-primary">
            <Landmark size={18} />
          </div>
          <div>
            <p className="font-bold text-on-surface">{acquirer.name}</p>
            <p className="text-xs text-on-surface-variant">
              Banking partner record
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "createdAt",
      label: "Created",
      render: (acquirer) => formatDate(acquirer.createdAt),
    },
    {
      key: "updatedAt",
      label: "Updated",
      render: (acquirer) => formatDate(acquirer.updatedAt),
    },
  ];

  return (
    <div className="space-y-6 text-on-background">
      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard
          label="Total Acquirers"
          value={acquirerManager.items.length}
          helper="Available banking and acquiring partners."
        />
        <StatCard
          label="Visible Results"
          value={filteredAcquirers.length}
          helper="Results after applying the current search."
        />
        <StatCard
          label="Access Level"
          value={canManageAcquirers ? "Edit" : "View"}
          helper="Admin and finance users can create, update, and delete."
        />
      </section>

      <section className="overflow-hidden rounded-[2rem] border border-outline-variant/15 bg-surface-container-lowest shadow-sm">
        <ManagementToolbar
          title="Acquirer Management"
          description="Create, search, edit, and delete acquirer records from the sidebar page."
          searchValue={searchValue}
          onSearchChange={(value) => {
            setSearchValue(value);
            setPage(1);
          }}
          searchPlaceholder="Search by acquirer name"
          actionLabel="Add Acquirer"
          onAction={acquirerManager.openCreateForm}
          actionDisabled={!canManageAcquirers}
        />

        {acquirerManager.error ? (
          <div className="border-b border-red-100 bg-red-50 px-6 py-4 text-sm text-red-700">
            {acquirerManager.error}
          </div>
        ) : null}

        <EntityTable
          columns={acquirerColumns}
          rows={paginatedAcquirers}
          isLoading={acquirerManager.isLoading}
          emptyTitle="No acquirers found"
          emptyDescription="Try a different search, or create your first acquirer record."
          onEdit={acquirerManager.openEditForm}
          onDelete={acquirerManager.setDeleteTarget}
          canEdit={canManageAcquirers}
          canDelete={canManageAcquirers}
          isDeletePending={acquirerManager.isDeletePending}
          deleteTargetId={acquirerManager.deleteTarget?._id}
        />

        <PaginationControls
          totalItems={filteredAcquirers.length}
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
        open={acquirerManager.isFormOpen}
        title={
          acquirerManager.formMode === "edit"
            ? "Edit Acquirer"
            : "Create Acquirer"
        }
        description="Acquirer changes use the dedicated CRUD endpoints from your backend."
        fields={acquirerFields}
        values={acquirerManager.formValues}
        errors={acquirerManager.formErrors}
        mode={acquirerManager.formMode}
        onClose={acquirerManager.closeForm}
        onChange={acquirerManager.handleFieldChange}
        onSubmit={acquirerManager.submitForm}
        isSubmitting={acquirerManager.isSubmitting}
        isLoading={acquirerManager.isPrefillingForm}
      />

      <ConfirmDialog
        open={Boolean(acquirerManager.deleteTarget)}
        title="Delete Acquirer?"
        description={`This will permanently remove ${
          acquirerManager.deleteTarget?.name || "this acquirer"
        }.`}
        confirmLabel="Delete Acquirer"
        isLoading={acquirerManager.isDeletePending}
        onClose={() => acquirerManager.setDeleteTarget(null)}
        onConfirm={acquirerManager.confirmDelete}
      />
    </div>
  );
}
