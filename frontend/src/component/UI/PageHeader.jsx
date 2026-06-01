export default function PageHeader({
  title,
  description,
  actions,
  className = "",
}) {
  return (
    <div className={`rounded-2xl bg-surface-lowest px-5 py-5 ${className}`}>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-on-surface">
            {title}
          </h1>

          {description ? (
            <p className="mt-1 text-sm text-surface-variant">{description}</p>
          ) : null}
        </div>

        {actions ? (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>
    </div>
  );
}
