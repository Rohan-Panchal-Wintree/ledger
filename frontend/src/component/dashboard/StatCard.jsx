export default function StatCard({ label, value, helper }) {
  return (
    <div className="rounded-3xl border border-outline-variant/15 bg-surface-container-lowest p-5 shadow-sm">
      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-on-surface-variant">
        {label}
      </p>
      <p className="mt-3 text-3xl font-extrabold tracking-tight text-on-surface">
        {value}
      </p>
      {helper ? (
        <p className="mt-2 text-sm text-on-surface-variant">{helper}</p>
      ) : null}
    </div>
  );
}
