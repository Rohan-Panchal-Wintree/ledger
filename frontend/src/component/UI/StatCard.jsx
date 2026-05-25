export default function StatCard({
  label,
  value,
  helper,
  icon: Icon,
  className = "",
  valueClassName = "",
  children,
}) {
  return (
    <div
      className={`rounded-lg border border-outline-variant/10 bg-surface-container-lowest p-6 ${className}`}
    >
      <div className="flex items-start justify-between">
        <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
          {label}
        </span>

        {Icon ? <Icon className="text-primary" size={20} /> : null}
      </div>

      <div className="mt-8">
        <div
          className={`text-4xl font-extrabold tracking-tight text-on-surface ${valueClassName}`}
        >
          {value}
        </div>

        {helper ? (
          <p className="mt-2 text-xs font-medium text-on-surface-variant">
            {helper}
          </p>
        ) : null}

        {children}
      </div>
    </div>
  );
}
