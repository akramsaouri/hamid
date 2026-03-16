import { useState, type FormEvent } from "react";

export function Login({ onLogin }: { onLogin: (token: string) => void }) {
  const [token, setToken] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (token.trim()) {
      localStorage.setItem("svenska_token", token.trim());
      onLogin(token.trim());
    }
  };

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      minHeight: "100vh", background: "#0f1117", color: "#e1e4e8",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
    }}>
      <form onSubmit={handleSubmit} style={{
        display: "flex", flexDirection: "column", gap: 16, width: 320,
      }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, margin: 0 }}>
          Svenska med <span style={{ color: "#6b9fff" }}>Hamid</span>
        </h1>
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Ange token..."
          autoFocus
          style={{
            background: "#1e2230", border: "1px solid #2a2d35", borderRadius: 10,
            padding: "12px 16px", fontSize: 14, color: "#e1e4e8", outline: "none",
          }}
        />
        <button type="submit" style={{
          background: "#6b9fff", border: "none", borderRadius: 10,
          padding: "12px 20px", color: "#0f1117", fontWeight: 600, fontSize: 14, cursor: "pointer",
        }}>
          Logga in
        </button>
      </form>
    </div>
  );
}
