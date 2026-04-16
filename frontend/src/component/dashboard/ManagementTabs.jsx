export default function ManagementTabs({ tabs, activeTab, onChange }) {
  return (
    <div className="inline-flex rounded-full border border-outline-variant/25 bg-surface-container-low p-1">
      {tabs.map((tab) => {
        const isActive = tab.value === activeTab;

        return (
          <button
            key={tab.value}
            type="button"
            onClick={() => onChange(tab.value)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-all ${
              isActive
                ? "bg-primary text-white shadow-sm"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
