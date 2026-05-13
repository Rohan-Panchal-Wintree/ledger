import React from "react";
import { X } from "lucide-react";

const EmailFormModal = ({
  isOpen,
  onClose,
  onSubmit,
  formData,
  setFormData,
  isEditing,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-on-surface/70 p-4 backdrop-blur-xs">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-surface-container-lowest">
        {/* Header */}
        <div className="border-b border-outline-variant/20 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-on-surface">
                {isEditing ? "Edit Email" : "Add New Email"}
              </h2>
              <p className="mt-1 text-sm text-on-surface-variant">
                Manage user access, roles, and merchant mapping.
              </p>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="grid gap-5 overflow-y-auto px-6 py-6 md:grid-cols-2">
            {/* Email */}
            <label className="md:col-span-2">
              <span className="mb-2 block text-xs font-semibold uppercase text-on-surface-variant">
                Email Address
              </span>
              <input
                type="email"
                required
                placeholder="e.g. name@company.com"
                value={formData.email}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    email: e.target.value,
                  }))
                }
                className="w-full rounded-xl border border-outline-variant/20 bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none transition-all placeholder:text-outline/50 focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </label>

            {/* Role */}
            <label>
              <span className="mb-2 block text-xs font-semibold uppercase text-on-surface-variant">
                Access Role
              </span>
              <select
                required
                value={formData.role}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    role: e.target.value,
                  }))
                }
                className="w-full rounded-xl border border-outline-variant/20 bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
              >
                <option value="">Select Role</option>
                <option value="Admin">Admin</option>
                <option value="Merchant">Merchant</option>
                <option value="Support">Support</option>
              </select>
            </label>

            {/* MID */}
            <label>
              <span className="mb-2 block text-xs font-semibold uppercase text-on-surface-variant">
                Merchant MID
              </span>
              <input
                type="text"
                placeholder="MID-0000-X"
                value={formData.merchantMid}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    merchantMid: e.target.value,
                  }))
                }
                className="w-full rounded-xl border border-outline-variant/20 bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none transition-all placeholder:text-outline/50 focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </label>
          </div>

          {/* Footer */}
          <div className="flex flex-col-reverse gap-3 border-t border-outline-variant/20 px-6 py-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-outline-variant/20 px-5 py-3 text-sm font-semibold text-on-surface transition-all hover:bg-surface-container-low"
            >
              Cancel
            </button>

            <button
              type="submit"
              className="rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-primary-container"
            >
              {isEditing ? "Save Changes" : "Add Email"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EmailFormModal;
