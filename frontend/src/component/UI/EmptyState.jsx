export default function EmptyState({
  title,
  description,
  className = "",
  compact = false,
}) {
  return (
    <div
      className={`rounded-lg border border-dashed border-outline-variant/20 bg-surface-container-lowest text-center ${
        compact ? "px-6 py-8" : "px-8 py-12"
      } ${className}`}
    >
      {title ? (
        <h3 className="text-sm font-bold text-on-surface">{title}</h3>
      ) : null}

      {description ? (
        <p className="mt-2 text-sm font-medium text-on-surface-variant">
          {description}
        </p>
      ) : null}
    </div>
  );
}
