import { X } from "lucide-react";

const modalSizes = {
  sm: "max-w-md",
  md: "max-w-2xl",
  lg: "max-w-4xl",
  xl: "max-w-5xl",
};

export default function Modal({
  open,
  title,
  description,
  size = "lg",
  children,
  footer,
  onClose,
  closeOnBackdrop = false,
  className = "",
  bodyClassName = "",
  allowBodyOverflow = false,
}) {
  if (!open) return null;

  return (
    <dialog className="modal modal-open">
      <div
        className="modal-backdrop"
        onClick={closeOnBackdrop ? onClose : undefined}
      />

      <div
        className={`modal-box max-h-[88vh] w-11/12 ${
          allowBodyOverflow ? "overflow-visible" : "overflow-hidden"
        } rounded-[2rem] bg-surface-container-lowest p-0 ${
          modalSizes[size] || modalSizes.lg
        } ${className}`}
      >
        <div className="flex items-start justify-between border-b border-outline-variant/10 px-7 py-6">
          <div>
            {title ? (
              <h3 className="text-2xl font-extrabold tracking-tight text-on-surface">
                {title}
              </h3>
            ) : null}

            {description ? (
              <p className="mt-1 text-sm leading-6 text-on-surface-variant">
                {description}
              </p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container-low text-on-surface-variant transition hover:bg-primary/5 hover:text-on-surface"
          >
            <X size={18} />
          </button>
        </div>

        <div
          className={`max-h-[62vh] px-7 py-6 ${
            allowBodyOverflow ? "overflow-visible" : "overflow-y-auto"
          } ${bodyClassName}`}
        >
          {children}
        </div>

        {footer ? (
          <div className="flex items-center justify-end gap-3 border-t border-outline-variant/10 px-7 py-5">
            {footer}
          </div>
        ) : null}
      </div>
    </dialog>
  );
}
