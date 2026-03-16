import type { Scenario } from "./api";

interface SidebarProps {
  scenarios: Record<string, Scenario[]>;
  activeId: string | null;
  onSelect: (scenario: Scenario) => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  myndigheter: "Myndigheter",
  jobb: "Jobb",
  vardagsliv: "Vardagsliv",
  service: "Service",
};

export function Sidebar({ scenarios, activeId, onSelect }: SidebarProps) {
  return (
    <div className="sidebar">
      <div className="logo">
        Svenska med <span>Hamid</span>
      </div>
      {Object.entries(scenarios).map(([category, items]) => (
        <div className="scenario-section" key={category}>
          <h3>{CATEGORY_LABELS[category] ?? category}</h3>
          {items.map((s) => (
            <div
              key={s.id}
              className={`scenario-item ${s.id === activeId ? "active" : ""}`}
              onClick={() => onSelect(s)}
            >
              {s.name}
              <div className="desc">{s.description}</div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
