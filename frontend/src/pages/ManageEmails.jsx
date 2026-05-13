import React, { useMemo, useState } from "react";
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
} from "lucide-react";
import EmailFormModal from "../component/EmailFormModal";

const initialEmails = [
  {
    id: 1,
    email: "admin@company.com",
    role: "Admin",
    merchantMid: "MID-0001-X",
  },
  {
    id: 2,
    email: "merchant@company.com",
    role: "Merchant",
    merchantMid: "MID-0002-X",
  },
  {
    id: 3,
    email: "support@company.com",
    role: "Support",
    merchantMid: "MID-0003-X",
  },
];

const roleClasses = {
  Admin: "bg-primary/10 text-primary",
  Merchant: "bg-green-500/10 text-green-600",
  Support: "bg-orange-400/10 text-orange-600",
};

const emptyForm = {
  email: "",
  role: "",
  merchantMid: "",
};

const ManageEmails = () => {
  const [emails, setEmails] = useState(initialEmails);
  const [searchQuery, setSearchQuery] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingEmail, setEditingEmail] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const filteredEmails = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) return emails;

    return emails.filter((item) =>
      [item.email, item.role, item.merchantMid]
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
      label: "Total Emails",
      value: emails.length,
      helper: "All registered emails",
      icon: Mail,
    },
    {
      label: "Admins",
      value: emails.filter((item) => item.role === "Admin").length,
      helper: "Admin access users",
      icon: ShieldCheck,
    },
    {
      label: "Merchants",
      value: emails.filter((item) => item.role === "Merchant").length,
      helper: "Merchant access users",
      icon: Store,
    },
    {
      label: "Support Users",
      value: emails.filter((item) => item.role === "Support").length,
      helper: "Support access users",
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
      email: emailItem.email,
      role: emailItem.role,
      merchantMid: emailItem.merchantMid,
    });
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingEmail(null);
    setFormData(emptyForm);
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    if (editingEmail) {
      setEmails((prev) =>
        prev.map((item) =>
          item.id === editingEmail.id ? { ...item, ...formData } : item,
        ),
      );
    } else {
      setEmails((prev) => [
        {
          id: Date.now(),
          ...formData,
        },
        ...prev,
      ]);
    }

    handleCloseForm();
  };

  const handleDelete = (id) => {
    setEmails((prev) => prev.filter((item) => item.id !== id));
  };

  return (
    <div className="w-full bg-background text-on-background">
      <section className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
              placeholder="Search emails..."
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
            Add Email
          </button>
        </div>
      </div>

      <section className="overflow-hidden rounded-lg border border-outline-variant/10 bg-surface-container-lowest">
        <div className="flex items-center justify-between border-b border-outline-variant/5 px-8 py-6">
          <h3 className="text-xl font-bold tracking-tight text-on-surface">
            Registered Emails
          </h3>
        </div>

        <div className="overflow-x-auto scrollbar-hide">
          <table className="w-full border-collapse text-left">
            <thead className="bg-surface-container-low/50">
              <tr>
                <th className="whitespace-nowrap px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                  Email
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
              {paginatedEmails.length > 0 ? (
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

                        <span className="text-sm font-bold text-on-surface">
                          {item.email}
                        </span>
                      </div>
                    </td>

                    <td className="whitespace-nowrap px-8 py-4 text-center">
                      <span
                        className={`rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest ${
                          roleClasses[item.role] ||
                          "bg-surface-container text-on-surface-variant"
                        }`}
                      >
                        {item.role || "-"}
                      </span>
                    </td>

                    <td className="whitespace-nowrap px-8 py-4 text-sm font-bold text-on-surface-variant">
                      {item.merchantMid || "-"}
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
                              onClick={() => handleDelete(item.id)}
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
                    No registered emails found.
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
              {filteredEmails.length} emails
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
      />
    </div>
  );
};

export default ManageEmails;
