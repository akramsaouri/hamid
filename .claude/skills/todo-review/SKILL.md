---
name: todo-review
description: Use when asked to review TODOs, check task completion, or manage the workspace TODO list. Can be run on-demand or as a scheduled daily task.
---

# TODO Review

## Overview

TODO.md is the workspace-level task list. Items are added during sessions and by this review process. Without active review, items go stale — completed work stays unchecked, and new work goes untracked. This skill fixes that.

## When to Use

- "Review my TODOs"
- "What's done on the TODO list?"
- "Check TODO.md"
- Any request to audit, update, or clean up workspace tasks

## Process

### 1. Read and parse TODO.md

Each item is a markdown checkbox:
- `- [ ]` — open/pending
- `- [x]` — done

### 2. Verify each unchecked item

For each open item, inspect the workspace to determine completion:

| Evidence type | How to check |
|---------------|-------------|
| Config/integration added | Read config files, check .mcp.json, .env, etc. |
| Feature built | Glob for relevant files, grep for implementations |
| Git history | git log --oneline --all --grep="keyword" |
| Tool installed | which/command -v, check package.json |
| Service configured | Check launchd plists, cron |

Mark done items `[x]`. Leave uncertain items unchanged.

### 3. Discover new items

Scan for untracked work:
- Memory notes mentioning planned work not in TODO.md
- Stale configurations or broken references
- Missing integrations visible from context

Be conservative. Only add items that matter enough to track.

### 4. Update TODO.md

Edit TODO.md with changes. Do not reorder, rephrase, or remove existing items.
TODO.md is not git-tracked — do not attempt to commit it.

## Output

Produce a compact, scannable summary. Match the style of other scheduled skills:

```
📋 TODO Review

✅ Completed — <item> (evidence: <how you confirmed>)
✅ Completed — <item> (evidence: <how you confirmed>)
➕ Added — <item> (reason: <why it matters>)
📌 Open — <item1>, <item2>, ...
```

Rules for the summary:
- One line per change (completed or added), with brief evidence/reason
- Group all unchanged open items on a single "Open" line
- If nothing changed, say so in one line — don't narrate the verification process
- Never explain what you checked or how you decided something wasn't done — only report outcomes

## Rules

- Read-only workspace access (except TODO.md itself)
- No code changes, no bug fixes, no file creation
- Conservative with new items — quality over quantity
