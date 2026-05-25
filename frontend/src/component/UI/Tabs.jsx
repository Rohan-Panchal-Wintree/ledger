export default function Tabs({
  tabs = [],
  activeTab,
  onChange,
  className = "",
}) {
  const visibleTabs = tabs.filter((tab) => tab.visible !== false);

  if (!visibleTabs.length) return null;

  return (
    <div
      className={`flex w-fit items-center gap-1 rounded-xl bg-surface-container-low p-1 ${className} mb-3`}
    >
      {visibleTabs.map((tab) => {
        const isActive = activeTab === tab.value;
        const Icon = tab.icon;

        return (
          <button
            key={tab.value}
            type="button"
            onClick={() => onChange(tab.value)}
            disabled={tab.disabled}
            className={`flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm transition disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer ${
              isActive
                ? "bg-surface-container-lowest font-bold text-primary"
                : "font-semibold text-on-surface-variant hover:text-on-surface"
            }`}
          >
            {Icon ? <Icon size={16} /> : null}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
