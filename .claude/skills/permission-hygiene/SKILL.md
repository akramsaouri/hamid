---
name: permission-hygiene
description: Use when asked to clean up permission settings, or when running as a scheduled maintenance task. Consolidates redundant patterns and adds missing ones based on usage data.
---

# Permission Hygiene

## Overview

Claude Code settings files accumulate permission patterns one at a time. This creates redundancy (`Bash(git add:*)` + `Bash(git commit:*)` instead of `Bash(git:*)`) and misses patterns for commands that keep triggering user prompts. This skill analyzes usage data and consolidates settings.

## Input

You'll receive:
1. **Settings files** -- the current allow/deny lists from up to 4 settings files (project settings.json, project settings.local.json, global settings.json, global settings.local.json)
2. **Permission log** -- JSONL entries showing every permission check: tool, command, pattern matched, result, and source

## Process

### 1. Analyze the permission log

Build a picture of what's happening:

| Metric | What it tells you |
|--------|-------------------|
| Commands with `result: "user_allowed"` or `result: "user_session_grant"` | Patterns that should be added to settings |
| Commands with `source: "no_match"` that were allowed by user | Missing patterns |
| Patterns in settings that never matched anything in the log | Potentially dead patterns (but be conservative -- low usage doesn't mean unused) |
| Multiple patterns matching the same prefix | Consolidation candidates |

### 2. Consolidate patterns

Look for groups that share a common prefix:

- `Bash(git add:*)` + `Bash(git commit:*)` + `Bash(git push:*)` -> `Bash(git:*)`
- `Bash(pnpm build:*)` + `Bash(pnpm test:*)` + `Bash(pnpm run:*)` -> `Bash(pnpm:*)`
- `Bash(cd :*)` + `Bash(cd /:*)` -> `Bash(cd:*)`

Only consolidate when ALL sub-patterns exist. Don't over-generalize -- `Bash(npm:*)` shouldn't become `Bash(:*)`.

### 3. Add missing patterns

From the log, find commands that were repeatedly approved by the user (3+ times) and add patterns for them. Use the most specific prefix that covers the usage:

- If user approved `git status` 5 times and `Bash(git:*)` already exists, nothing to add
- If user approved `docker compose up` 3 times with no docker pattern, add `Bash(docker compose:*)`

### 4. Write changes

Modify ONLY the `settings.local.json` files (never `settings.json` -- those are checked into repos). Update both project-level and global-level as appropriate:

- Project-specific patterns (paths, project commands) -> project `settings.local.json`
- General tool patterns (git, common CLI tools) -> global `settings.local.json`

Preserve all non-permission keys in the settings files. Preserve all deny patterns exactly as they are.

## Safety Rules

- **NEVER add destructive command patterns** (rm -rf, git push --force, sudo, etc.)
- **NEVER modify deny lists** -- only touch allow lists
- **NEVER remove a pattern unless it's clearly redundant** (covered by a broader pattern you're adding)
- **NEVER add patterns broader than tool-level** (no `Bash(:*)` or wildcard-everything)
- **Preserve file structure** -- keep JSON formatting, keep non-permission keys
- **Be conservative** -- when unsure, don't change. A few extra user prompts are better than an unsafe pattern.

## Output

After making changes, produce a short summary:
- Patterns consolidated (old -> new)
- Patterns added (and why)
- Patterns removed (and why)
- Any observations about usage that don't warrant changes yet
