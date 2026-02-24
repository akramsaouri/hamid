<p align="center">
  <img src="assets/avatar.png" width="140" />
</p>

<h1 align="center">Hamid</h1>

<p align="center">A personal AI agent that runs locally.<br>Claude Code sessions bridged to Telegram, with scheduled automations, a permission engine, and persistent memory.<br>Everything stays on your machine.</p>

## Architecture

```
hamid/
  agent/                    # TypeScript monorepo (pnpm)
    packages/
      core/                 # Agent SDK wrapper, permission engine, settings
      comm/                 # Telegram bot, streaming renderer, notification CLI
      notion/               # Notion API helpers
  .claude/
    skills/                 # Claude Code skills (reusable workflows)
  services/                 # launchd plist templates for macOS daemons
  memory/                   # Daily notes + running context (gitignored)
  reports/                  # Generated reports (gitignored)
  logs/                     # Service logs (gitignored)
  SOUL.md                   # Agent personality definition (gitignored)
  CLAUDE.md                 # Project instructions for Claude Code (gitignored)
```

## Prerequisites

- macOS (uses launchd for service management)
- Node.js 20+
- [pnpm](https://pnpm.io/)
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) (via Vertex AI or Anthropic API)
- A Telegram bot token (from [@BotFather](https://t.me/BotFather))
- Optional: Notion integration (for project-patrol skill)
- Optional: OpenAI API key (for voice note transcription via Whisper)

## Setup

### 1. Clone and build

```bash
git clone https://github.com/akramsaouri/hamid.git
cd hamid/agent
pnpm install
pnpm build
```

### 2. Configure agent environment

```bash
cp agent/.env.example agent/.env
```

Edit `agent/.env`:

| Variable | Required | Description |
|----------|----------|-------------|
| `TELEGRAM_BOT_TOKEN` | Yes | Create a bot via [@BotFather](https://t.me/BotFather), copy the token |
| `TELEGRAM_CHAT_ID` | Yes | Send a message to your bot, then `curl https://api.telegram.org/bot<TOKEN>/getUpdates` to find your chat ID |
| `OPENAI_API_KEY` | No | Only needed for voice note transcription (Whisper) |
| `CLAUDE_CODE_USE_VERTEX` | If Vertex | Set to `1` to use Claude Code via Google Cloud |
| `CLOUD_ML_REGION` | If Vertex | Your GCP region |
| `ANTHROPIC_VERTEX_PROJECT_ID` | If Vertex | Your GCP project ID |
| `VERTEX_REGION_CLAUDE_4_1_OPUS` | If Vertex | Region for Opus model (e.g. `global`) |
| `NOTION_TOKEN` | No | Create an internal integration at [notion.so/my-integrations](https://www.notion.so/my-integrations) |
| `APPTWEAK_EMAIL` | No | Only for niche-research skill |
| `APPTWEAK_PASSWORD` | No | Only for niche-research skill |

### 3. Define the agent's personality

```bash
cp SOUL.example.md SOUL.md
```

Edit `SOUL.md`. This defines your agent's voice, personality, and relationship with you. The "How I Talk" and "How I Work" sections are good defaults. Customize "The Relationship" section to describe who you are and how you want to work together.

### 4. Configure project instructions

```bash
cp CLAUDE.example.md CLAUDE.md
```

Edit `CLAUDE.md`. This is what Claude Code reads at the start of every session. Customize:
- Session protocol
- Git conventions
- Memory conventions
- The "About You" section

### 5. Set up MCP servers (optional)

```bash
cp .mcp.example.json .mcp.json
```

Configure MCP servers for extended capabilities:
- **Notion** — paste your `NOTION_TOKEN`
- **Apple Reminders** — update the path to the MCP server binary
- Add or remove servers as needed

### 6. Create initial memory

Create `memory/context.md` with a running summary of your projects, preferences, tools, and current priorities. This is what Hamid reads to understand your world between sessions.

### 7. Install the Telegram service

```bash
cp services/com.hamid.telegram.example.plist services/com.hamid.telegram.plist
```

Edit the plist — replace all `$HOME` placeholders with actual paths:
- Node.js path (output of `which node`)
- Working directory (path to your hamid clone)
- Log paths
- Vertex AI environment variables (if applicable)

Install and start:

```bash
cp services/com.hamid.telegram.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.hamid.telegram.plist
```

For scheduled tasks (briefing, memory-hygiene, todo-review), create additional plists following the same pattern. The example plist includes a comment showing `StartCalendarInterval` configuration.

## Skills

Hamid includes 5 skills in `.claude/skills/`:

| Skill | Description |
|-------|-------------|
| **project-patrol** | Cross-project status check — scans Notion boards and git repos for open tasks, uncommitted changes, and open PRs |
| **memory-hygiene** | Cleans up memory files — prevents context.md drift and daily note accumulation |
| **permission-hygiene** | Consolidates redundant permission patterns and adds missing ones based on usage |
| **todo-review** | Reviews and manages the workspace TODO list |
| **niche-research** | Evaluates iOS app ideas by analyzing market competition (requires AppTweak) |

Add your own by creating a new directory under `.claude/skills/` with a `SKILL.md` file.

## How it works

```
Telegram message
  -> grammY bot (agent/packages/comm)
  -> spawns Claude Code session
  -> permission engine checks allowed tools/commands
  -> Claude Code executes with SOUL.md personality + CLAUDE.md instructions
  -> streams response back to Telegram
```

Scheduled automations (briefing, memory-hygiene, etc.) run as launchd jobs that invoke their respective CLI entry points, which spawn Claude Code sessions and send results to Telegram.

## License

MIT
