import { useState, useRef, useEffect, type FormEvent } from "react";
import type { Correction } from "./api";

interface ChatMessage {
  role: "user" | "hamid" | "system";
  content: string;
  corrections?: Correction[];
  positive?: string | null;
}

interface ChatProps {
  messages: ChatMessage[];
  loading: boolean;
  onSend: (text: string) => void;
  onEnd: () => void;
  canEnd: boolean;
  onSelectMessage: (index: number | null) => void;
  selectedIndex: number | null;
}

export function Chat({
  messages, loading, onSend, onEnd, canEnd, onSelectMessage, selectedIndex,
}: ChatProps) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;
    onSend(input.trim());
    setInput("");
  };

  return (
    <div className="conversation-wrapper">
      <div className="conversation">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`message ${msg.role} ${i === selectedIndex ? "selected" : ""}`}
            onClick={() => {
              if (msg.corrections?.length || msg.positive) {
                onSelectMessage(i === selectedIndex ? null : i);
              }
            }}
          >
            {msg.role === "system" && (
              <div className="bubble system-bubble">
                <div className="scene">{msg.content}</div>
              </div>
            )}
            {msg.role === "user" && (
              <>
                <div className="label">Du</div>
                <div className="bubble user-bubble">{msg.content}</div>
              </>
            )}
            {msg.role === "hamid" && (
              <>
                <div className="label"><span className="role">Hamid</span></div>
                <div className="bubble hamid-bubble">{msg.content}</div>
                {/* Mobile: inline corrections */}
                {(msg.corrections?.length || msg.positive) && (
                  <div className="inline-corrections">
                    {msg.corrections?.map((c, j) => (
                      <div key={j} className="correction-item">
                        <div className="original">{c.original}</div>
                        <div className="corrected">{c.corrected}</div>
                        <div className="explanation">{c.explanation}</div>
                      </div>
                    ))}
                    {msg.positive && (
                      <div className="correction-good">
                        <div className="note">{msg.positive}</div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        ))}
        {loading && (
          <div className="message hamid">
            <div className="label"><span className="role">Hamid</span></div>
            <div className="bubble hamid-bubble loading-bubble">...</div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div className="input-area">
        <form className="input-row" onSubmit={handleSubmit}>
          <input
            className="input-field"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Skriv ditt svar på svenska..."
            disabled={loading || !canEnd}
            autoFocus
          />
          <button className="send-btn" type="submit" disabled={loading || !input.trim()}>
            Skicka
          </button>
          {canEnd && (
            <button className="end-btn" type="button" onClick={onEnd} disabled={loading}>
              Avsluta
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
