interface FilterTabsProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const TABS = [
  { id: "all", label: "All Time" },
  { id: "trending", label: "Trending" },
  { id: "top", label: "Top Rated" },
  { id: "new", label: "New" },
];

export function FilterTabs({ activeTab, onTabChange }: FilterTabsProps) {
  return (
    <div className="inline-flex gap-1">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`rounded-lg px-3 py-1.5 font-mono text-xs uppercase tracking-wide transition-colors ${
            activeTab === tab.id
              ? "bg-sx-accent-muted text-sx-accent"
              : "text-sx-fg-muted hover:text-sx-fg"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
