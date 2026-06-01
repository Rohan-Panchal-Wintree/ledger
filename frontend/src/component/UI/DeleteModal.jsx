import { AlertTriangle } from "lucide-react";

import Button from "./Button";
import Modal from "./Modal";

export default function DeleteModal({
  open,
  title = "Delete Record?",
  description = "This action cannot be undone.",
  confirmLabel = "Delete",
  isLoading = false,
  onClose,
  onConfirm,
}) {
  return (
    <Modal
      open={open}
      title={title}
      size="sm"
      onClose={isLoading ? undefined : onClose}
      footer={
        <>
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </Button>

          <Button
            type="button"
            variant="danger"
            onClick={onConfirm}
            loading={isLoading}
            disabled={isLoading}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-500/10 text-red-500">
          <AlertTriangle size={20} />
        </div>

        <div>
          <p className="text-sm leading-6 text-on-surface-variant">
            {description}
          </p>

          <p className="mt-3 text-xs font-semibold uppercase tracking-widest text-error">
            This action cannot be undone.
          </p>
        </div>
      </div>
    </Modal>
  );
}
