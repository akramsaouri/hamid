# Setup

## Prerequisites

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code)
- A Telegram bot token (from [@BotFather](https://t.me/BotFather))
- _Optional_: Notion integration (for project-patrol skill)
- _Optional_: OpenAI API key (for voice note transcription via Whisper)

## 1. Clone and build

```bash
git clone https://github.com/akramsaouri/hamid.git
cd hamid/agent
pnpm install
pnpm build
```

## 2. Configure agent environment

```bash
cp agent/.env.example agent/.env
```

Edit `agent/.env`:

| Variable             | Required | Description                                                                                                 |
| -------------------- | -------- | ----------------------------------------------------------------------------------------------------------- |
| `TELEGRAM_BOT_TOKEN` | Yes      | Create a bot via [@BotFather](https://t.me/BotFather), copy the token                                       |
| `TELEGRAM_CHAT_ID`   | Yes      | Send a message to your bot, then `curl https://api.telegram.org/bot<TOKEN>/getUpdates` to find your chat ID |
| `OPENAI_API_KEY`     | No       | Only needed for voice note transcription (Whisper)                                                          |
| `NOTION_TOKEN`       | No       | Create an internal integration at [notion.so/my-integrations](https://www.notion.so/my-integrations)        |

The `.env.example` file includes additional variables for Vertex AI if you need them.

## 3. Define the agent's personality

```bash
cp SOUL.example.md SOUL.md
```

Edit `SOUL.md`. This defines your agent's voice, personality, and relationship with you. The "How I Talk" and "How I Work" sections are good defaults. Customize "The Relationship" section to describe who you are and how you want to work together.

## 4. Configure project instructions

```bash
cp CLAUDE.example.md CLAUDE.md
```

Edit `CLAUDE.md`. This is what Claude Code reads at the start of every session. Customize:

- Session protocol
- Git conventions
- Memory conventions
- The "About You" section

## 5. Set up MCP servers (optional)

```bash
cp .mcp.example.json .mcp.json
```

Configure MCP servers for extended capabilities:

- **Notion** — paste your `NOTION_TOKEN`
- **Apple Reminders** — update the path to the MCP server binary
- Add or remove servers as needed

## 6. Create initial memory

Create `memory/context.md` with a running summary of your projects, preferences, tools, and current priorities. This is what Hamid reads to understand your world between sessions.

## 7. Install the Telegram service

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
