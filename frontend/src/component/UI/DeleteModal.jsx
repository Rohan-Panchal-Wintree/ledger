import Modal from "./Modal";
import Button from "./Button";
import Spinner from "./Spinner";

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
    <Modal open={open} onClose={onClose} title={title}>
      <p className="text-sm text-on-surface-variant">{description}</p>

      <div className="mt-6 flex justify-end gap-3">
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
          variant="destructive"
          onClick={onConfirm}
          disabled={isLoading}
        >
          {isLoading ? <Spinner /> : confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
