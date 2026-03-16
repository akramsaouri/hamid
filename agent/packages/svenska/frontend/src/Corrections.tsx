import type { Correction } from "./api";

interface ChatMessage {
  role: "user" | "hamid" | "system";
  content: string;
  corrections?: Correction[];
  positive?: string | null;
}

interface CorrectionsPanelProps {
  message: ChatMessage | null;
}

export function CorrectionsPanel({ message }: CorrectionsPanelProps) {
  if (!message) {
    return (
      <div className="corrections-panel">
        <div className="corrections-title">Rättningar</div>
        <div className="corrections-empty">
          Klicka på ett meddelande för att se rättningar.
        </div>
      </div>
    );
  }

  const { corrections = [], positive } = message;

  return (
    <div className="corrections-panel">
      <div className="corrections-title">Rättningar</div>
      {corrections.length > 0 && (
        <div className="correction-card">
          {corrections.map((c, i) => (
            <div key={i} className="correction-item">
              <div className="original">{c.original}</div>
              <div className="corrected">{c.corrected}</div>
              <div className="explanation">{c.explanation}</div>
            </div>
          ))}
        </div>
      )}
      {positive && (
        <div className="correction-card correction-good">
          <div className="note">{positive}</div>
        </div>
      )}
    </div>
  );
}
