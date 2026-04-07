import React from "react";

function Badge({ className = "", variant = "default", children, ...props }) {
  const base =
    "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors";

  const variants = {
    default: "border-transparent bg-blue-600 text-white",
    secondary: "border-transparent bg-gray-200 text-gray-800",
    destructive: "border-transparent bg-red-500 text-white",
    outline: "border-gray-300 text-gray-800",
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

export { Badge };
