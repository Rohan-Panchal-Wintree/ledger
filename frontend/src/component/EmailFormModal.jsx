import React from "react";
import { X } from "lucide-react";

const roles = [
  { label: "Admin", value: "admin" },
  { label: "Merchant", value: "merchant" },
  { label: "Finance", value: "finance" },
  { label: "Settlement", value: "settlement" },
];

const EmailFormModal = ({
  isOpen,
  onClose,
  onSubmit,
  formData,
  setFormData,
  isEditing,
  isSubmitting = false,
}) => {
  if (!isOpen) return null;

  const handleChange = (key, value) => {
    setFormData((prev) => {
      const nextData = {
        ...prev,
        [key]: value,
      };

      if (key === "role" && value !== "merchant") {
        nextData.merchantMid = "";
      }

      return nextData;
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-lg rounded-lg bg-surface-container-lowest p-6 shadow-xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-on-surface">
              {isEditing ? "Edit User" : "Add User"}
            </h3>
            <p className="mt-1 text-sm text-on-surface-variant">
              Manage login access and role permissions.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-on-surface-variant transition-colors hover:bg-surface-container"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-on-surface-variant">
              Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(event) => handleChange("name", event.target.value)}
              required
              minLength={2}
              className="w-full rounded-lg bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="Enter full name"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-on-surface-variant">
              Email
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(event) => handleChange("email", event.target.value)}
              required
              className="w-full rounded-lg bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="user@example.com"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-on-surface-variant">
              Role
            </label>
            <select
              value={formData.role}
              onChange={(event) => handleChange("role", event.target.value)}
              required
              className="w-full rounded-lg bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">Select role</option>
              {roles.map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </select>
          </div>

          {formData.role === "merchant" && (
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                MID
              </label>
              <input
                type="text"
                value={formData.merchantMid}
                onChange={(event) =>
                  handleChange("merchantMid", event.target.value)
                }
                required
                className="w-full rounded-lg bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="Enter merchant MID"
              />
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-full px-5 py-2.5 text-sm font-bold text-on-surface-variant transition-colors hover:bg-surface-container disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-content transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting
                ? isEditing
                  ? "Updating..."
                  : "Creating..."
                : isEditing
                  ? "Update User"
                  : "Add User"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EmailFormModal;
