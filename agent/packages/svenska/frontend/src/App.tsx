import { useState, useEffect } from "react";
import { Login } from "./Login";
import { Sidebar } from "./Sidebar";
import { Chat } from "./Chat";
import { CorrectionsPanel } from "./Corrections";
import { Summary } from "./Summary";
import * as api from "./api";
import type { Scenario, Correction } from "./api";
import "./App.css";

interface ChatMessage {
  role: "user" | "hamid" | "system";
  content: string;
  corrections?: Correction[];
  positive?: string | null;
}

export function App() {
  const [authed, setAuthed] = useState(api.hasToken());
  const [scenarios, setScenarios] = useState<Record<string, Scenario[]>>({});
  const [activeScenario, setActiveScenario] = useState<Scenario | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<api.SessionSummary | null>(null);
  const [selectedMsgIndex, setSelectedMsgIndex] = useState<number | null>(null);

  useEffect(() => {
    if (authed) {
      api.getScenarios().then(setScenarios).catch(console.error);
    }
  }, [authed]);

  if (!authed) return <Login onLogin={() => setAuthed(true)} />;

  const handleSelectScenario = async (scenario: Scenario) => {
    if (conversationId && activeScenario) {
      await api.endConversation(conversationId, activeScenario.id);
    }

    setActiveScenario(scenario);
    setSummary(null);
    setSelectedMsgIndex(null);
    setLoading(true);

    const { conversationId: id, firstMessage } = await api.startConversation(scenario.id);
    setConversationId(id);
    setMessages([{ role: "system", content: firstMessage.content }]);
    setLoading(false);
  };

  const handleSend = async (text: string) => {
    if (!conversationId) return;
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setLoading(true);

    const response = await api.sendMessage(conversationId, text);
    const newMsg: ChatMessage = {
      role: "hamid",
      content: response.reply,
      corrections: response.corrections,
      positive: response.positive,
    };
    setMessages((prev) => [...prev, newMsg]);
    setLoading(false);

    if (response.done) {
      setLoading(true);
      const sum = await api.getSummary(conversationId);
      setSummary(sum);
      await api.endConversation(conversationId, activeScenario!.id);
      setConversationId(null);
      setLoading(false);
    }
  };

  const handleEnd = async () => {
    if (!conversationId || !activeScenario) return;
    setLoading(true);
    const sum = await api.getSummary(conversationId);
    setSummary(sum);
    await api.endConversation(conversationId, activeScenario.id);
    setConversationId(null);
    setLoading(false);
  };

  const selectedCorrections = selectedMsgIndex !== null
    ? messages[selectedMsgIndex]
    : null;

  return (
    <div className="app">
      <Sidebar
        scenarios={scenarios}
        activeId={activeScenario?.id ?? null}
        onSelect={handleSelectScenario}
      />
      <div className="main">
        {activeScenario && (
          <div className="header">
            <span className="header-badge">
              {activeScenario.category}
            </span>
            <span className="header-title">
              {activeScenario.name} — {activeScenario.description}
            </span>
          </div>
        )}
        <div className="chat-area">
          {summary ? (
            <Summary summary={summary} onNewScenario={() => setSummary(null)} />
          ) : (
            <>
              <Chat
                messages={messages}
                loading={loading}
                onSend={handleSend}
                onEnd={handleEnd}
                canEnd={!!conversationId}
                onSelectMessage={setSelectedMsgIndex}
                selectedIndex={selectedMsgIndex}
              />
              <CorrectionsPanel message={selectedCorrections} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
