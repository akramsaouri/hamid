<p align="center">
  <img src="assets/avatar.svg" width="140" />
</p>

<h1 align="center">Hamid</h1>

<p align="center">A personal AI agent that runs locally.<br>Claude Code sessions bridged to Telegram, with scheduled automations, a permission engine, and persistent memory.<br>Everything stays on your machine.</p>

## What is this

Hamid is a framework for running a persistent AI agent on your Mac. You talk to it through Telegram. It talks back through Claude Code.

Hamid spawns Claude Code sessions in your workspace, with a personality you define (`SOUL.md`), project instructions it follows (`CLAUDE.md`), and memory it writes to disk so the next session isn't starting from zero.

## What it does

**Telegram bridge** — Send messages (text or voice) to your Telegram bot. Hamid spawns a Claude Code session, streams the response back, and shuts down. Your files, your machine, no data leaves.

**Persistent memory** — Hamid writes daily notes and a running context file. Each session reads these back, so it knows what you were working on yesterday, what your preferences are, and what decisions were already made.

**Scheduled automations** — launchd jobs that run on a schedule and message you on Telegram:

- **Daily briefing** — morning summary of your day
- **Memory hygiene** — cleans up stale notes, keeps context.md focused
- **TODO review** — checks your task list, flags forgotten items
- **Permission hygiene** — consolidates Claude Code permission patterns
- **Project patrol** — scans all your repos and Notion boards for open work

**Permission engine** — Controls what Claude Code is allowed to do. Bash commands, file access, MCP tools — all gated by configurable patterns.

**Skills** — Reusable workflows defined as markdown files in `.claude/skills/`. Claude Code reads them when a task matches.

## How it works

```mermaid
graph LR
    You["Telegram"] --> Bot["grammY Bot"] --> CC["Claude Code"] --> You
    CC <--> Mem["memory/"]
```

## Getting started

See **[docs/SETUP.md](docs/SETUP.md)** for the full setup guide.

## License

MIT
