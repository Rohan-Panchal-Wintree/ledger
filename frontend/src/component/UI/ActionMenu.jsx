import { MoreVertical } from "lucide-react";

export default function ActionMenu({ actions = [], disabled = false }) {
  return (
    <div className="dropdown dropdown-left dropdown-end relative z-30">
      <button
        type="button"
        tabIndex={0}
        disabled={disabled}
        className="btn btn-ghost btn-circle btn-sm text-on-surface-variant hover:bg-surface-container disabled:cursor-not-allowed disabled:opacity-50"
        aria-label="Actions"
      >
        <MoreVertical size={18} />
      </button>

      <ul
        tabIndex={0}
        className="dropdown-content menu z-20 w-44 rounded-lg border border-outline-variant/10 bg-surface-container-lowest p-2"
      >
        {actions.map(
          ({
            key,
            label,
            icon: Icon,
            onClick,
            disabled: actionDisabled = false,
            destructive = false,
            className = "",
          }) => (
            <li key={key || label}>
              <button
                type="button"
                onClick={onClick}
                disabled={actionDisabled}
                className={`flex items-center gap-2 rounded-lg text-sm font-semibold ${
                  className || (destructive ? "text-error" : "text-on-surface")
                } `}
              >
                {Icon ? <Icon size={15} /> : null}

                {label}
              </button>
            </li>
          ),
        )}
      </ul>
    </div>
  );
}
