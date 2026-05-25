import React, { useEffect, useMemo, useState } from "react";
import {
  Mail,
  Search,
  ShieldCheck,
  Store,
  UsersRound,
  MoreVertical,
  Pencil,
  Trash2,
  Plus,
  BadgeDollarSign,
} from "lucide-react";
import EmailFormModal from "../component/EmailFormModal";
import {
  createUser,
  deleteUser,
  getUsers,
  updateUser,
} from "../queries/userQueries";

const roleClasses = {
  admin: "bg-primary/10 text-primary",
  merchant: "bg-green-500/10 text-green-600",
  finance: "bg-blue-500/10 text-blue-600",
  settlement: "bg-orange-400/10 text-orange-600",
};

const roleLabels = {
  admin: "Admin",
  merchant: "Merchant",
  finance: "Finance",
  settlement: "Settlement",
};

const emptyForm = {
  name: "",
  email: "",
  role: "",
  merchantMid: "",
};

const ManageEmails = () => {
  const [emails, setEmails] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingEmail, setEditingEmail] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState(null);

  const loadUsers = async () => {
    try {
      setIsLoading(true);

      const response = await getUsers();

      setEmails(response?.data || []);
    } catch (error) {
      console.error("Failed to load users:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const filteredEmails = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) return emails;

    return emails.filter((item) =>
      [
        item.name,
        item.email,
        roleLabels[item.role] || item.role,
        item.merchantMid,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [emails, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredEmails.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const startIndex = (safePage - 1) * pageSize;

  const paginatedEmails = filteredEmails.slice(
    startIndex,
    startIndex + pageSize,
  );

  const showingFrom = filteredEmails.length > 0 ? startIndex + 1 : 0;
  const showingTo = Math.min(
    startIndex + paginatedEmails.length,
    filteredEmails.length,
  );

  const stats = [
    {
      label: "Total Users",
      value: emails.length,
      helper: "All registered users",
      icon: Mail,
    },
    {
      label: "Admins",
      value: emails.filter((item) => item.role === "admin").length,
      helper: "Admin access users",
      icon: ShieldCheck,
    },
    {
      label: "Merchants",
      value: emails.filter((item) => item.role === "merchant").length,
      helper: "Merchant access users",
      icon: Store,
    },
    {
      label: "Finance",
      value: emails.filter((item) => item.role === "finance").length,
      helper: "Finance access users",
      icon: BadgeDollarSign,
    },
    {
      label: "Settlement",
      value: emails.filter((item) => item.role === "settlement").length,
      helper: "Settlement access users",
      icon: UsersRound,
    },
  ];

  const handleOpenAddForm = () => {
    setEditingEmail(null);
    setFormData(emptyForm);
    setIsFormOpen(true);
  };

  const handleOpenEditForm = (emailItem) => {
    setEditingEmail(emailItem);
    setFormData({
      name: emailItem.name || "",
      email: emailItem.email || "",
      role: emailItem.role || "",
      merchantMid: emailItem.merchantMid || "",
    });
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    if (isSubmitting) return;

    setIsFormOpen(false);
    setEditingEmail(null);
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
      setIsSubmitting(true);

      const payload = buildPayload();

      if (editingEmail) {
        await updateUser(editingEmail.id, payload);
      } else {
        await createUser(payload);
      }

      await loadUsers();
      handleCloseForm();
    } catch (error) {
      console.error("Failed to save user:", error);
      alert(error?.response?.data?.message || "Failed to save user");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this user?",
    );

    if (!confirmed) return;

    try {
      setDeletingUserId(id);

      await deleteUser(id);

      setEmails((prev) => prev.filter((item) => item.id !== id));
    } catch (error) {
      console.error("Failed to delete user:", error);
      alert(error?.response?.data?.message || "Failed to delete user");
    } finally {
      setDeletingUserId(null);
    }
  };

  return (
    <div className="w-full bg-background text-on-background">
      <section className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {stats.map((item) => {
          const Icon = item.icon;

          return (
            <div
              key={item.label}
              className="rounded-lg border border-outline-variant/10 bg-surface-container-lowest p-6"
            >
              <div className="flex items-start justify-between">
                <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                  {item.label}
                </span>
                <Icon className="text-primary" size={20} />
              </div>

              <div className="mt-8">
                <div className="text-4xl font-extrabold tracking-tight text-on-surface">
                  {item.value}
                </div>
                <p className="mt-2 text-xs font-medium text-on-surface-variant">
                  {item.helper}
                </p>
              </div>
            </div>
          );
        })}
      </section>

      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-on-surface">
            Email Management
          </h2>
          <p className="mt-1 text-sm font-medium text-on-surface-variant">
            Manage email access, roles, and merchant MIDs.
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
              placeholder="Search users..."
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(event.target.value);
                setPage(1);
              }}
              className="w-full rounded-full border-none bg-surface-container-low py-2.5 pl-10 pr-4 text-sm text-on-surface outline-none transition-all focus:ring-2 focus:ring-primary/20 sm:w-80"
            />
          </div>

          <button
            type="button"
            onClick={handleOpenAddForm}
            className="flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-content transition-all active:scale-[0.98]"
          >
            <Plus size={16} />
            Add User
          </button>
        </div>
      </div>

      <section className="overflow-hidden rounded-lg border border-outline-variant/10 bg-surface-container-lowest">
        <div className="flex items-center justify-between border-b border-outline-variant/5 px-8 py-6">
          <h3 className="text-xl font-bold tracking-tight text-on-surface">
            Registered Users
          </h3>
        </div>

        <div className="overflow-x-auto scrollbar-hide">
          <table className="w-full border-collapse text-left">
            <thead className="bg-surface-container-low/50">
              <tr>
                <th className="whitespace-nowrap px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                  User
                </th>
                <th className="whitespace-nowrap px-8 py-4 text-center text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                  Role
                </th>
                <th className="whitespace-nowrap px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                  Merchant MID
                </th>
                <th className="whitespace-nowrap px-8 py-4 text-right text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-outline-variant/5">
              {isLoading ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-8 py-12 text-center text-sm font-medium text-on-surface-variant"
                  >
                    Loading users...
                  </td>
                </tr>
              ) : paginatedEmails.length > 0 ? (
                paginatedEmails.map((item) => (
                  <tr
                    key={item.id}
                    className="group transition-all duration-200 hover:bg-surface-container-low/45"
                  >
                    <td className="whitespace-nowrap px-8 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/8">
                          <Mail className="text-primary" size={16} />
                        </div>

                        <div>
                          <span className="block text-sm font-bold text-on-surface capitalize">
                            {item.name || "-"}
                          </span>
                          <span className="mt-1 block text-xs font-medium text-on-surface-variant">
                            {item.email}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="whitespace-nowrap px-8 py-4 text-center">
                      <span
                        className={`rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest ${
                          roleClasses[item.role] ||
                          "bg-surface-container text-on-surface-variant"
                        }`}
                      >
                        {roleLabels[item.role] || item.role || "-"}
                      </span>
                    </td>

                    <td className="whitespace-nowrap px-8 py-4 text-sm font-bold text-on-surface-variant">
                      {item.role === "merchant" ? item.merchantMid || "-" : "-"}
                    </td>

                    <td className="whitespace-nowrap px-8 py-4 text-right">
                      <div className="dropdown dropdown-end">
                        <button
                          type="button"
                          tabIndex={0}
                          className="btn btn-ghost btn-circle btn-sm text-on-surface-variant hover:bg-surface-container"
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
                              onClick={() => handleOpenEditForm(item)}
                              className="flex items-center gap-2 rounded-lg text-sm font-semibold text-on-surface"
                            >
                              <Pencil size={15} />
                              Edit
                            </button>
                          </li>

                          <li>
                            <button
                              type="button"
                              disabled={deletingUserId === item.id}
                              onClick={() => handleDelete(item.id)}
                              className="flex items-center gap-2 rounded-lg text-sm font-semibold text-error disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <Trash2 size={15} />
                              {deletingUserId === item.id
                                ? "Deleting..."
                                : "Delete"}
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
                    No registered users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-4 bg-surface-container-low/30 px-8 py-4 text-xs font-bold uppercase tracking-widest text-on-surface-variant lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <div>
              Showing {showingFrom > 0 ? `${showingFrom}-${showingTo}` : "0"} of{" "}
              {filteredEmails.length} users
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
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </label>
          </div>

          <div className="flex items-center gap-2">
            <span>
              Page {showingFrom === 0 ? 0 : safePage} of{" "}
              {filteredEmails.length === 0 ? 0 : totalPages}
            </span>

            <button
              type="button"
              onClick={() => setPage(Math.max(1, safePage - 1))}
              disabled={safePage === 1 || filteredEmails.length === 0}
              className="rounded-full px-4 py-2 transition-colors hover:bg-surface-container disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>

            <button
              type="button"
              onClick={() => setPage(Math.min(totalPages, safePage + 1))}
              disabled={safePage === totalPages || filteredEmails.length === 0}
              className="rounded-full bg-primary px-4 py-2 text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </section>

      <EmailFormModal
        isOpen={isFormOpen}
        onClose={handleCloseForm}
        onSubmit={handleSubmit}
        formData={formData}
        setFormData={setFormData}
        isEditing={Boolean(editingEmail)}
        isSubmitting={isSubmitting}
      />
    </div>
  );
};

export default ManageEmails;
