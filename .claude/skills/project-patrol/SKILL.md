---
name: project-patrol
description: Use when checking on side projects, reviewing open work, or wanting a status overview across all active projects. Scans Notion boards and git repos for open tasks, uncommitted changes, and open PRs.
---

# Project Patrol

Scans all active side projects and reports what needs attention — open Notion board tasks, uncommitted changes, and open PRs.

## When to Use

- "What do I need to work on?"
- "What's open across my projects?"
- "Project status check"
- Any request for a cross-project overview

## Definition: Active Project

A project is **active** if:
1. It exists in the Notion "Side projects" database
2. It has a repo at `~/code/personal/{slugified-name}`
3. The repo's last commit is within 3 months

Projects without a repo or with stale repos are silently skipped.

## Repo Matching

Slugify: lowercase, replace spaces with hyphens, strip non-alphanumeric chars except hyphens.

Try **two variants** when looking for a repo:
1. The hyphenated slug: `my-app`
2. The slug with hyphens removed: `myapp`

Use whichever exists. If both exist, prefer the hyphenated one.

Examples:
- "My App" -> try `my-app`, then `myapp`
- "WorkoutPal" -> try `workoutpal` (no hyphens to remove)
- "Daily Journal" -> try `daily-journal`, then `dailyjournal`

## Process

### Step 1: Get all projects

Query the Notion "Side projects" database:
- **Database ID**: `your-side-projects-database-id`
- Use `mcp__notion__API-query-data-source` to get all entries
- Extract each project's **Name** from the title property

### Step 2: Find active projects

For each project name:
1. Slugify the name
2. Check if `~/code/personal/{slug}` exists (use `ls`)
3. If it exists, check the last commit date: `git -C ~/code/personal/{slug} log -1 --format=%ci 2>/dev/null`
4. If the last commit is within 3 months of today, mark as **active**

Run these checks in parallel using Bash calls — they're all independent.

### Step 3: Gather git and PR data (main agent)

Sub-agents are sandboxed to the current workspace and **cannot access other repos**. The main agent must run git/gh commands directly.

For all active projects at once (parallel Bash calls):

**Git status** — run in parallel for each project:
```bash
git -C ~/code/personal/{slug} status --short
```

**Open PRs** — extract remote URL and query GitHub:
```bash
gh pr list --state open --limit 10 --repo $(git -C ~/code/personal/{slug} remote get-url origin 2>/dev/null | sed 's/.*github.com[:/]//' | sed 's/.git$//') 2>&1 || echo "NO_GITHUB_REPO"
```

If the repo has no remote or isn't on GitHub, skip silently.

### Step 4: Check Notion for boards (parallel agents or direct)

Boards are typically inline databases named "Board" nested inside a project's workspace page — **not** named after the project. Don't search by project name with a `data_source` filter; it won't match.

**Finding boards — two-step approach:**

1. **Find the project's workspace page**: Use `mcp__notion__API-post-search` with the project name as query (no type filter). From results, find a `page` object whose title matches the project name and whose parent is NOT the Side Projects database (`your-side-projects-database-id`). This is the project's workspace/home page.

2. **Find inline databases**: Use `mcp__notion__API-get-block-children` on the workspace page. Look for blocks of type `child_database` — these are the project boards. Extract the database ID from the block.

3. **Query the board**: Use `mcp__notion__API-query-data-source` on each found database. Look for items where Status is NOT "Done" / "Complete" / "Completed" / "Released" (varies per board). Collect: task name, status, any due dates.

- **Separate "In Progress" items** from other open items — these are potentially forgotten work and should be called out prominently
- Also separate "Waiting for release" items — these represent finished work blocked on a release

If no workspace page is found or it has no inline databases, report "No Notion board found".

This can be done with parallel agents (they have Notion MCP access) or directly if there are few projects.

### Step 5: Generate report

Write the report to `reports/patrol-YYYY-MM-DD.md` (create `reports/` if it doesn't exist). Then print a brief summary to the terminal with a link to the file.

**File format — table-based, grouped by concern:**

```markdown
# Project Patrol — {date}

## Overview

| Project | Last Commit | Board | Dirty | PRs |
|---------|-------------|-------|-------|-----|
| WorkoutPal | 1d ago | 1 in progress, 3 open, 2 waiting, 10 parked | - | 1 |
| FocusTimer | today | 3 open | - | - |
| My App | 21d ago | - | Yes | - |
| Hamid | today | - | - | - |

Sort by: projects with in-progress items first, then by last commit (most recent first). Use `-` for empty cells. The Board column summarizes counts by category. Dirty = uncommitted changes exist.

## In Progress (potentially stalled)

| Project | Task | Assignee |
|---------|------|----------|
| WorkoutPal | Add analytics dashboard | Alice |

Only show this section if there are in-progress items. These are the most important — work that was started and may be forgotten.

## Waiting for Release

| Project | Task | Assignee | Version |
|---------|------|----------|---------|
| WorkoutPal | Fix image storage permissions | Bob | - |
| WorkoutPal | Redesign workout creation flow | Bob | v1.4.3 |

Only show this section if there are waiting-for-release items.

## Open Tasks

| Project | Task | Status | Due |
|---------|------|--------|-----|
| FocusTimer | Add review prompts | Not started | - |
| WorkoutPal | Add rest timer option | Not started | - |

List all non-parked open tasks (excluding in-progress and waiting-for-release, which have their own sections). Only show if there are items.

## Parked ({total count})

| Project | Task | Type |
|---------|------|------|
| WorkoutPal | Add email verification | Feat |
| WorkoutPal | Fix layout glitch on iPad | Bug |

Only show if there are parked items. These are low priority — just list them for awareness.

## Uncommitted Changes

| Project | Files |
|---------|-------|
| My App | `?? localizations/` |

Only show if any project has uncommitted changes. List each changed file on a separate line within the cell (use `<br>` for multiple files).

## Open PRs

| Project | PR | Status | Opened |
|---------|-----|--------|--------|
| WorkoutPal | #288: feat: add fastlane | DRAFT | 2025-08-07 |

Only show if there are open PRs.
```

If no active projects are found, say so clearly in the file.

Omit any detail section that has zero items — only the Overview table is always present.

**Terminal summary** (after writing the file):
- Number of active projects scanned
- Count of in-progress (potentially forgotten) items
- Count of other open items
- Count of uncommitted repos
- Count of open PRs
- Path to the full report file

## Future Improvements

<!-- TODO: Consider scheduled runs via launchd for daily/weekly reports -->
<!-- TODO: Option to write report to a Notion page -->
