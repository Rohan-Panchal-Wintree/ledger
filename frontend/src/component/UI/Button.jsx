import Spinner from "./Spinner";

export default function Button({
  children,
  type = "button",
  variant = "primary",
  size = "md",
  fullWidth = false,
  leftIcon,
  rightIcon,
  className = "",
  disabled = false,
  loading = false,
  active = false,
  onClick,
}) {
  const variants = {
    primary: "bg-primary text-primary-content hover:bg-primary",

    secondary: active
      ? "bg-primary/12 text-primary hover:bg-primary/18"
      : "bg-surface-container text-on-surface hover:bg-surface-container-high",

    ghost: "bg-transparent text-on-surface-variant hover:bg-surface-container",

    danger: "bg-red-500 text-white hover:bg-red-500/95",
  };

  const sizes = {
    sm: "h-9 px-4 text-sm rounded-lg",
    md: "h-10 px-5 text-sm rounded-xl",
    lg: "h-11 px-6 text-sm rounded-xl",
  };

  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={`
        inline-flex items-center justify-center gap-2
        font-semibold transition-all duration-200 cursor-pointer
        active:scale-[0.98]
        disabled:pointer-events-none disabled:opacity-60
        ${variants[variant]}
        ${sizes[size]}
        ${fullWidth ? "w-full" : ""}
        ${className}
      `}
    >
      {leftIcon && !loading ? leftIcon : null}

      {loading ? <Spinner type="sm" color="base-100" /> : children}

      {rightIcon && !loading ? rightIcon : null}
    </button>
  );
}
