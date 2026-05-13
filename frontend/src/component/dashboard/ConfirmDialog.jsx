import { TriangleAlert, X } from "lucide-react";
import Spinner from "../UI/Spinner";

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  isLoading,
  onClose,
  onConfirm,
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-on-surface/70 p-4 backdrop-blur-xs">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-[2rem] bg-surface-container-lowest">
        <div className="border-b border-outline-variant/20 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
                <TriangleAlert size={20} />
              </div>

              <div>
                <h2 className="text-xl font-semibold text-on-surface">
                  {title}
                </h2>
                <p className="mt-1 text-sm text-on-surface-variant">
                  {description}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-3 px-6 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="rounded-full border border-outline-variant/20 px-5 py-3 text-sm font-semibold text-on-surface transition-all hover:bg-surface-container-low disabled:cursor-not-allowed disabled:opacity-70"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-red-600 px-5 py-3 text-sm font-semibold text-white transition-all hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-300"
          >
            {isLoading ? <Spinner type="sm" color="white" /> : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
