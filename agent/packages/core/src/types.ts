export interface HamidSessionOptions {
  /** Absolute path to workspace root (where SOUL.md, memory/, etc. live) */
  workingDir: string;
  /** Callback when a tool needs user approval */
  onPermissionRequest: (req: PermissionRequest) => Promise<PermissionDecision>;
  /** Resume an existing session by ID */
  sessionId?: string;
  /** Custom system prompt. If provided, replaces SOUL.md as the system prompt. */
  systemPrompt?: string;
  /** Path to JSONL file for logging permission checks */
  permissionLogPath?: string;
}

export interface PermissionRequest {
  /** Unique ID for this request (for correlating with button callbacks) */
  id: string;
  /** Tool name (e.g., "Bash", "Edit", "Write") */
  toolName: string;
  /** Tool input (e.g., { command: "npm test" } for Bash) */
  input: unknown;
  /** Whether this is a destructive operation (no "This session" option) */
  isDestructive: boolean;
}

export type PermissionDecision =
  | { behavior: "allow" }
  | { behavior: "allow_session" }
  | { behavior: "deny"; message?: string };

export type HamidEvent =
  | { type: "tool_start"; toolName: string; input: unknown }
  | { type: "tool_end"; toolName: string }
  | { type: "permission_request"; request: PermissionRequest }
  | { type: "text"; content: string }
  | { type: "result"; content: string; sessionId: string }
  | { type: "error"; message: string };

export interface HamidSession {
  /** Send a message and stream events back */
  send(message: string): AsyncGenerator<HamidEvent>;
  /** Current session ID (null if not started) */
  sessionId: string | null;
}

/** Parsed permission rules from Claude Code settings files */
export interface PermissionRules {
  allow: string[];
  deny: string[];
}
