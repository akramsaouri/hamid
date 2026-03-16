import type { SessionSummary } from "./api";

interface SummaryProps {
  summary: SessionSummary;
  onNewScenario: () => void;
}

export function Summary({ summary, onNewScenario }: SummaryProps) {
  return (
    <div className="summary">
      <h2>Session klar</h2>

      {summary.patterns.length > 0 && (
        <div className="summary-section">
          <h3>Mönster att jobba på</h3>
          <ul>
            {summary.patterns.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </div>
      )}

      {summary.wins.length > 0 && (
        <div className="summary-section summary-wins">
          <h3>Bra jobbat</h3>
          <ul>
            {summary.wins.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {summary.focus.length > 0 && (
        <div className="summary-section">
          <h3>Fokus till nästa gång</h3>
          <ul>
            {summary.focus.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </div>
      )}

      <button className="send-btn" onClick={onNewScenario}>
        Nytt scenario
      </button>
    </div>
  );
}
