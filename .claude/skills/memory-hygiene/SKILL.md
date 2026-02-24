---
name: memory-hygiene
description: Use when asked to clean up memory, or when running as a scheduled maintenance task. Prevents context.md drift and daily note accumulation.
---

# Memory Hygiene

## Overview

Memory is write-once-per-session. Without active maintenance, `context.md` drifts from reality and daily notes pile up with redundant detail. This skill fixes that.

## Process

### 1. Audit context.md

Read every daily note and weekly summary. Compare against context.md. Look for:

| Symptom | Action |
|---------|--------|
| Project listed as "pending" but already built | Update status |
| Feature missing entirely | Add it |
| Tool/integration no longer used | Remove it |
| Preference or decision superseded | Update it |
| Credential note that belongs in project docs | Move or remove |

Rewrite stale sections of context.md. Don't patch -- rewrite what drifted.

### 2. Compress old dailies

**Daily notes older than 7 days:** Merge into `memory/YYYY-WNN.md` (weekly summary). Keep only decisions, outcomes, and things future sessions need. Drop implementation play-by-play.

**Weekly summaries older than 30 days:** Merge into `memory/archive/YYYY-MM.md` (monthly). Only retain what's still relevant.

**Compression rules:**
- Keep: decisions made, preferences learned, architectural choices, gotchas that'll recur
- Drop: build steps, test counts (unless tracking trends), session-by-session narration
- When in doubt: if it's in context.md, the daily note can lose it
- Delete originals after compression

### 3. Commit

Commit all memory changes in a single commit.

## Common Mistakes

- **Appending to context.md instead of rewriting** -- creates contradictions. Rewrite the stale section.
- **Compressing too aggressively** -- gotchas and "why X over Y" decisions are worth keeping months later.
- **Forgetting to delete originals** -- the point is reducing noise for future sessions.
