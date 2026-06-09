import React from "react";

function Badge({
  className = "",
  variant = "default",
  children,
  textSize = "10px",
  ...props
}) {
  const base = `inline-flex items-center rounded-full border px-2.5 py-0.5 text-[${textSize}] font-semibold transition-colors`;

  const variants = {
    default: "border-transparent bg-blue-600 text-white",
    secondary:
      "border-transparent bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-100",
    destructive: "border-transparent bg-red-500 text-white",
    outline:
      "border-gray-300 text-gray-800 dark:border-gray-600 dark:text-gray-100",
    TW: "border-transparent bg-orange-200 text-orange-600 dark:bg-orange-900/40 dark:text-orange-300",
    DP: "border-transparent bg-primary/10 text-primary",
  };

  return (
    <div
      className={`${base} ${variants[variant] || variants.default} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export default Badge;
