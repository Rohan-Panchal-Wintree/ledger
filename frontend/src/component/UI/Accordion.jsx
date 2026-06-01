export default function Accordion({
  title,
  subtitle,
  icon,
  meta,
  children,
  className = "",
}) {
  return (
    <div
      className={`collapse collapse-arrow overflow-hidden rounded-lg border border-outline-variant/10 bg-surface-container-lowest ${className}`}
    >
      <input type="checkbox" />

      <div className="collapse-title table-row-hover px-5 py-5 lg:px-6">
        <div className="flex items-center justify-between gap-4 pr-8">
          <div className="flex min-w-0 items-center gap-4">
            {icon ? (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-primary/10 bg-primary/5">
                {icon}
              </div>
            ) : null}

            <div className="min-w-0">
              <h3 className="truncate text-base font-semibold text-on-surface">
                {title}
              </h3>

              {subtitle ? (
                <p className="mt-0.5 text-xs text-on-surface-variant">
                  {subtitle}
                </p>
              ) : null}
            </div>
          </div>

          {meta ? <div className="hidden md:block">{meta}</div> : null}
        </div>
      </div>

      <div className="collapse-content px-5 pb-5 lg:px-6 lg:pb-6">
        {children}
      </div>
    </div>
  );
}
