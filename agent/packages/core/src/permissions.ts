import { matchesPermissionPattern } from "./settings.js";
import type { PermissionRules } from "./types.js";

const READ_ONLY_TOOLS = new Set(["Read", "Glob", "Grep", "WebSearch", "WebFetch"]);

const DESTRUCTIVE_PATTERNS = [
  /\brm\s+(-\w*r\w*|-\w*f\w*)\b/,   // rm -rf, rm -r, rm -f variants
  /\bgit\s+push\s+.*--force\b/,       // git push --force
  /\bgit\s+push\s+.*-f\b/,            // git push -f
  /\bgit\s+reset\s+--hard\b/,         // git reset --hard
  /\bgit\s+clean\s+.*-f/,             // git clean -f
  /\bgit\s+checkout\s+\.\s*$/,        // git checkout .
  /\bgit\s+restore\s+\.\s*$/,         // git restore .
  /\bsudo\b/,                          // any sudo
  /\bDROP\s+TABLE\b/i,                // DROP TABLE
  /\bDELETE\s+FROM\b(?!.*\bWHERE\b)/i, // DELETE FROM without WHERE
];

export type CheckResult = "allow" | "deny" | "ask" | "ask_destructive";

export type CheckSource =
  | "read_only"
  | "destructive"
  | "session_grant"
  | "settings_deny"
  | "settings_allow"
  | "no_match";

export interface CheckDetail {
  result: CheckResult;
  source: CheckSource;
  /** The settings pattern that matched, if any */
  pattern?: string;
}

interface SessionGrant {
  toolName: string;
  commandPrefix?: string;
}

export class PermissionEngine {
  private rules: PermissionRules;
  private sessionGrants: SessionGrant[] = [];

  constructor(rules: PermissionRules) {
    this.rules = rules;
  }

  /**
   * Check whether a tool invocation is allowed.
   * Returns the resolution result following the layered model.
   */
  check(toolName: string, input: unknown): CheckResult {
    return this.checkDetailed(toolName, input).result;
  }

  /**
   * Like check(), but returns which layer matched and which pattern.
   */
  checkDetailed(toolName: string, input: unknown): CheckDetail {
    // Layer 1: Read-only tools always allowed
    if (READ_ONLY_TOOLS.has(toolName))
      return { result: "allow", source: "read_only" };

    // Layer 2: Destructive operations always ask
    if (this.isDestructive(toolName, input))
      return { result: "ask_destructive", source: "destructive" };

    // Layer 3: Session runtime grants
    if (this.matchesSessionGrant(toolName, input))
      return { result: "allow", source: "session_grant" };

    // Layer 4+5: Settings-based rules (deny checked first)
    for (const pattern of this.rules.deny) {
      if (matchesPermissionPattern(pattern, toolName, input))
        return { result: "deny", source: "settings_deny", pattern };
    }
    for (const pattern of this.rules.allow) {
      if (matchesPermissionPattern(pattern, toolName, input))
        return { result: "allow", source: "settings_allow", pattern };
    }

    // Layer 6: No match — ask
    return { result: "ask", source: "no_match" };
  }

  addSessionGrant(toolName: string, input: unknown): void {
    const grant: SessionGrant = { toolName };
    if (toolName === "Bash" && input && typeof input === "object" && "command" in input) {
      grant.commandPrefix = String((input as { command: string }).command);
    }
    this.sessionGrants.push(grant);
  }

  resetSessionGrants(): void {
    this.sessionGrants = [];
  }

  private isDestructive(toolName: string, input: unknown): boolean {
    if (toolName !== "Bash") return false;
    if (!input || typeof input !== "object" || !("command" in input)) return false;
    const command = String((input as { command: string }).command);
    return DESTRUCTIVE_PATTERNS.some((pattern) => pattern.test(command));
  }

  private matchesSessionGrant(toolName: string, input: unknown): boolean {
    return this.sessionGrants.some((grant) => {
      if (grant.toolName !== toolName) return false;
      if (grant.commandPrefix && toolName === "Bash") {
        if (!input || typeof input !== "object" || !("command" in input)) return false;
        const command = String((input as { command: string }).command);
        return command.startsWith(grant.commandPrefix);
      }
      // Non-Bash grant: tool name match is enough
      return !grant.commandPrefix;
    });
  }
}
