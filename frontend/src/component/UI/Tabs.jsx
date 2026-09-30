import { useEffect } from "react";

const TAB_STORAGE_KEY = "app-tab-state";

function readTabStorage() {
  if (typeof window === "undefined") return {};

  try {
    const stored = window.localStorage.getItem(TAB_STORAGE_KEY);

    if (!stored) return {};

    const parsed = JSON.parse(stored);

    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeStoredTab(persistenceKey, value) {
  if (typeof window === "undefined" || !persistenceKey || !value) {
    return;
  }

  try {
    const stored = readTabStorage();

    window.localStorage.setItem(
      TAB_STORAGE_KEY,
      JSON.stringify({
        ...stored,
        [persistenceKey]: value,
      }),
    );
  } catch {
    // Ignore unavailable localStorage.
  }
}

export function readStoredTab(persistenceKey, fallbackValue, tabs = []) {
  if (!persistenceKey) return fallbackValue;

  const storedValue = readTabStorage()[persistenceKey];

  if (!storedValue) return fallbackValue;

  const availableTabs = tabs.filter(
    (tab) => tab.visible !== false && !tab.disabled,
  );

  const isValid = availableTabs.some((tab) => tab.value === storedValue);

  return isValid ? storedValue : fallbackValue;
}

export default function Tabs({
  tabs = [],
  activeTab,
  onChange,
  persistenceKey,
  className = "",
}) {
  const visibleTabs = tabs.filter((tab) => tab.visible !== false);

  useEffect(() => {
    if (!persistenceKey || !activeTab) return;

    writeStoredTab(persistenceKey, activeTab);
  }, [activeTab, persistenceKey]);

  if (!visibleTabs.length) return null;

  return (
    <div
      className={`mb-3 flex w-fit items-center gap-1 rounded-xl bg-surface-container-low p-1 ${className}`}
    >
      {visibleTabs.map((tab) => {
        const isActive = activeTab === tab.value;
        const Icon = tab.icon;

        return (
          <button
            key={tab.value}
            type="button"
            onClick={() => onChange?.(tab.value)}
            disabled={tab.disabled}
            className={`flex cursor-pointer items-center gap-2 rounded-lg px-6 py-2.5 text-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${
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
