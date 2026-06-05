import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Mail, Plus, ShieldCheck, Store } from "lucide-react";

import Button from "../component/UI/Button";
import DataTable, { readStoredRowsPerPage } from "../component/UI/DataTable";
import DeleteModal from "../component/UI/DeleteModal";
import Modal from "../component/UI/Modal";
import PageHeader from "../component/UI/PageHeader";
import SearchInput from "../component/UI/SearchInput";
import Spinner from "../component/UI/Spinner";
import StatCard from "../component/UI/StatCard";

import EmailForm from "../component/manage-emails/EmailForm";
import UserRow from "../component/manage-emails/UserRow";

import {
  useCreateUser,
  useDeleteUser,
  useUpdateUser,
  useUsers,
} from "../queries/userQueries";

import { getErrorMessage } from "../utils/appUtils";

const emptyForm = {
  name: "",
  email: "",
  role: "",
  merchantMid: "",
};

const userColumns = [
  { key: "user", label: "User" },
  { key: "role", label: "Role", align: "center" },
  { key: "merchantMid", label: "Merchant MID" },
  { key: "actions", label: "Actions", align: "right" },
];

function filterUsers(users = [], searchQuery = "") {
  const query = searchQuery.trim().toLowerCase();

  if (!query) return users;

  return users.filter((user) =>
    [user.name, user.email, user.role, user.merchantMid]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query)),
  );
}

export default function ManageEmails() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [formData, setFormData] = useState(emptyForm);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(readStoredRowsPerPage);

  const usersQuery = useUsers();
  const createUserMutation = useCreateUser();
  const updateUserMutation = useUpdateUser();
  const deleteUserMutation = useDeleteUser();

  const users = usersQuery.data || [];

  const isSubmitting =
    createUserMutation.isPending || updateUserMutation.isPending;

  const filteredUsers = useMemo(
    () => filterUsers(users, searchQuery),
    [searchQuery, users],
  );

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const startIndex = (safePage - 1) * pageSize;

  const paginatedUsers = filteredUsers.slice(startIndex, startIndex + pageSize);

  const stats = useMemo(
    () => [
      {
        label: "Total Users",
        value: users.length,
        helper: "All registered users",
        icon: Mail,
      },
      {
        label: "Admin Users",
        value: users.filter((user) => user.role === "admin").length,
        helper: "Users with admin access",
        icon: ShieldCheck,
      },
      {
        label: "Merchant Users",
        value: users.filter((user) => user.role === "merchant").length,
        helper: "Users linked to merchant access",
        icon: Store,
      },
    ],
    [users],
  );

  useEffect(() => {
    if (usersQuery.error) {
      toast.error(getErrorMessage(usersQuery.error, "Failed to load users."));
    }
  }, [usersQuery.error]);

  const handleOpenAddForm = () => {
    setEditingUser(null);
    setFormData(emptyForm);
    setIsFormOpen(true);
  };

  const handleOpenEditForm = (user) => {
    setEditingUser(user);

    setFormData({
      name: user.name || "",
      email: user.email || "",
      role: user.role || "",
      merchantMid: user.merchantMid || "",
    });

    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    if (isSubmitting) return;

    setIsFormOpen(false);
    setEditingUser(null);
    setFormData(emptyForm);
  };

  const buildPayload = () => {
    const payload = {
      name: formData.name.trim(),
      email: formData.email.trim(),
      role: formData.role,
      isActive: true,
    };

    if (formData.role === "merchant") {
      payload.merchantMid = formData.merchantMid.trim();
    }

    return payload;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      const payload = buildPayload();

      if (editingUser) {
        await updateUserMutation.mutateAsync({
          id: editingUser.id,
          payload,
        });
      } else {
        await createUserMutation.mutateAsync(payload);
      }

      handleCloseForm();
      toast.success(
        editingUser ? "User updated successfully." : "User added successfully.",
      );
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to save user."));
    }
  };

  const requestDelete = (user) => {
    setDeleteTarget(user);
  };

  const cancelDelete = () => {
    if (deleteUserMutation.isPending) return;

    setDeleteTarget(null);
  };

  const confirmDelete = async () => {
    if (!deleteTarget?.id) return;

    try {
      await deleteUserMutation.mutateAsync(deleteTarget.id);

      setDeleteTarget(null);
      toast.success("User deleted successfully.");
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to delete user."));
    }
  };

  const handleRowsPerPageChange = (nextPageSize) => {
    setPageSize(Number(nextPageSize));
    setPage(1);
  };

  if (usersQuery.isLoading) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center bg-surface p-4">
        <Spinner type="xl" />
      </div>
    );
  }

  return (
    <div className="w-full bg-background text-on-background">
      <PageHeader
        title="Email Management"
        description="Manage email access, roles, and merchant MIDs."
        className="mb-6"
      />

      <section className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
        {stats.map((item) => (
          <StatCard
            key={item.label}
            label={item.label}
            value={item.value}
            helper={item.helper}
            icon={item.icon}
          />
        ))}
      </section>

      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-on-surface">
            Registered Users
          </h2>

          <p className="mt-1 text-sm font-medium text-on-surface-variant">
            Search and manage users with role-based access.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <SearchInput
            value={searchQuery}
            placeholder="Search users..."
            className="w-full sm:w-80"
            onChange={(event) => {
              setSearchQuery(event.target.value);
              setPage(1);
            }}
          />

          <Button
            type="button"
            variant="primary"
            size="md"
            leftIcon={<Plus size={16} />}
            onClick={handleOpenAddForm}
          >
            Add User
          </Button>
        </div>
      </div>

      <DataTable
        title="Users"
        columns={userColumns}
        totalItems={filteredUsers.length}
        itemLabel="users"
        isEmpty={paginatedUsers.length === 0}
        emptyTitle="No registered users found"
        emptyDescription="Users will appear here once they are added."
        emptyIcon={Mail}
        page={safePage}
        meta={{
          total: filteredUsers.length,
          page: safePage,
          limit: pageSize,
          totalPages,
        }}
        onPageChange={setPage}
        onRowsPerPageChange={handleRowsPerPageChange}
        isFetching={usersQuery.isFetching}
      >
        {paginatedUsers.map((user) => (
          <UserRow
            key={user.id}
            user={user}
            onEdit={handleOpenEditForm}
            onDelete={requestDelete}
            isDeleting={
              deleteUserMutation.isPending &&
              deleteUserMutation.variables === user.id
            }
          />
        ))}
      </DataTable>

      <Modal
        open={isFormOpen}
        title={editingUser ? "Edit User" : "Add User"}
        description="Manage login access and role permissions."
        size="md"
        onClose={handleCloseForm}
        allowBodyOverflow
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={handleCloseForm}
              disabled={isSubmitting}
            >
              Cancel
            </Button>

            <Button type="submit" form="email-user-form" loading={isSubmitting}>
              {editingUser ? "Update User" : "Add User"}
            </Button>
          </>
        }
      >
        <EmailForm
          formId="email-user-form"
          formData={formData}
          setFormData={setFormData}
          onSubmit={handleSubmit}
        />
      </Modal>

      <DeleteModal
        open={Boolean(deleteTarget)}
        title="Delete User?"
        description={
          deleteTarget
            ? `This will remove access for ${deleteTarget.email}. This action cannot be undone.`
            : "This action cannot be undone."
        }
        confirmLabel="Delete"
        isLoading={deleteUserMutation.isPending}
        onClose={cancelDelete}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
