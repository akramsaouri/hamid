---
name: niche-research
description: Use when evaluating iOS app ideas, analyzing app market competition, or deciding whether a niche is worth building for. Use before starting any new iOS app project.
---

# Niche Research

Deep research to evaluate whether an iOS app niche is worth building for. Judgment over metrics.

## When to Use

- "Is X a good app idea?"
- "What should I build next?"
- Exploring a category or market
- Before committing to a new iOS project

## Tools Available

Use these aggressively — the whole point is depth over breadth:

**Research tools (always available):**

| Tool | What it gives you |
|------|-------------------|
| **Web Search** | Blog posts, roundups, industry reports, "best apps for X" articles |
| **Browser (Chrome MCP)** | Browse App Store pages, read reviews, check screenshots, visit any site |
| **Google Trends** (via web) | Real demand signal — is interest growing or dying? Often rate-limits (429). If blocked, search for industry/marketing reports instead (e.g., "ramadan app trends 2025 report") — they often embed Google Trends data and add context. |

**Community sources (browse or search):**

Reddit is high-signal but hard to surface via web search. Use specific query patterns:

| Query pattern | Why it works |
|---------------|-------------|
| `site:reddit.com r/[subreddit] "looking for" OR "any app" [topic]` | Finds actual recommendation threads |
| `site:reddit.com r/[subreddit] "[competitor name]" alternative OR switch` | Finds people leaving competitors |
| `site:reddit.com r/[subreddit] "[competitor name]" frustrating OR annoying OR broken` | Finds pain points |

If web search doesn't surface threads, browse Reddit directly via Chrome MCP — search within specific subreddits.

| Source | Signal |
|--------|--------|
| **Reddit / HN / forums** | Real user pain in their own words |
| **Product Hunt** | What's launching, trending, and how the community reacts |
| **IndieHackers** | What solo devs are building and earning |
| **YouTube** | "Best apps for X" videos — comments are gold for unmet needs |

**Market intelligence:**

| Source | What it covers | When to use |
|--------|---------------|-------------|
| **AppTweak** (Essential plan) | Keyword volumes, download/revenue estimates, category ranking trends, ASO audits, top charts. See AppTweak workflows below. | Primary source for all structured competitor data. Use first. |
| **App Store pages** (via Chrome MCP) | Actual review text, visual screenshot inspection, app "feel" | Reading 1-3 star reviews in users' own words. AppTweak shows metadata but browsing the real page reveals what screenshots look like and how the app presents itself. |
| **Meta Ad Library** | Competitor ad creatives — messaging, features highlighted, visual style | Understanding how competitors position themselves and what they think converts. |
| **Google Ads Transparency Center** | Same as above for Google ads | Same — different creative pool. |

**Skills:**

| Skill | When |
|-------|------|
| **RevenueCat** | Subscription benchmarks, if relevant to the niche |

Don't limit yourself to this list. If a source exists that gives signal, use it.

## AppTweak Workflows (Essential Plan)

Log in at `app.apptweak.com` with `credentials in agent/.env (APPTWEAK_EMAIL / APPTWEAK_PASSWORD)`. Use Chrome MCP to browse. Here's what's available and how to use it:

**1. Competitor keyword strategy** (ASO Intelligence > Keywords > Keyword Research)
- Search for a competitor app in the top search bar
- Go to Keywords > Keyword Research
- See all keywords from their title, subtitle, and description with search volume scores
- Use this to understand what terms drive traffic in the niche and how competitive they are

**2. Download & revenue estimates** (Market Intelligence > App Explorer)
- Navigate to Market Intelligence > App Explorer
- Shows Total DL (All-Time), Total Rev (All-Time), monthly Downloads, monthly Revenue for any app
- Filter by category and country to see top apps in a niche
- This is the best source for sizing competitor traction

**3. Category ranking trends** (ASO Intelligence > Analytics > App Metrics)
- Search for a competitor, go to Analytics > App Metrics
- Shows category rank history over time with a chart
- Includes "To reach rank X, your app needs approximately Y daily downloads" — useful for estimating what it takes to compete
- Watch for seasonal spikes (e.g., Ramadan for Islamic apps)

**4. ASO audit of competitors** (ASO Intelligence > Metadata > ASO Report)
- Shows ASO score, keyword density, screenshot count, IAP pricing, app details
- Useful for understanding how well-optimized competitors are

**5. Top Charts by category** (Store Explorer > Top Charts)
- Filter by Store Category to see top Free/Grossing/Paid apps
- Quick way to identify who dominates a category

**Not available on Essential (don't waste time):**
- Download/Revenue Estimates time-series charts (requires $7,900/yr Explore plan)
- Market Overview, Seasonality, Downloads to Top, Trending Keywords
- In-App Events tracking (+$290/mo)

## Research Process

### 1. Understand the Problem

Before looking at apps, understand the human problem:

- **Who** has this problem? (demographics, context, frequency)
- **How painful** is it? (do people actively search for solutions?)
- **What do they do now?** (manual workarounds, web tools, competitor apps)

Search Reddit, HN, forums, and Quora for threads where people describe the problem in their own words. The language people use reveals what they actually want. Browse YouTube for "best app for X" videos — the comments are gold.

### 2. Map the Competition

Browse the App Store (use Chrome MCP) and search the web for existing solutions. For each significant competitor:

- Name, rating, review count, last updated
- Read the **1-3 star reviews** — that's where unmet needs live
- Pricing model and price points
- Look at screenshots — modern or dated?
- Check Product Hunt for launch reception and feature discussions

**Evaluate quality, not quantity:**

- 50 bad apps = more opportunity than 3 excellent ones
- Watch for the "Duolingo problem" — one dominant player that owns the space
- Stale apps (>12 months no update) = abandoned opportunity
- High ratings but low review count = small but happy user base

### 3. Assess Monetization

- What do people pay for in this space?
- Subscription vs. one-time? What's the typical price point?
- Is this a "will pay" or "wants it free" problem?
- Check competitor pricing on the App Store (browse with Chrome MCP)
- Look at IndieHackers for revenue reports in similar niches

### 4. Evaluate Build Effort

- Core feature complexity (weekend MVP vs. months of work)
- Backend requirements? API dependencies?
- Data or content needs? (e.g., does it need a database of X?)
- Can an MVP validate the idea before full build?

### 5. Check Trends

- Growing or shrinking space? Try Google Trends first. If rate-limited, search for `"[niche] app trends 2025 report"` or `"[niche] market size growth"` — marketing/analytics firms (Adjust, AppsFlyer, Sensor Tower) publish free reports with trend data baked in.
- Platform changes creating opportunity? (new iOS APIs, deprecations)
- Seasonal patterns?
- Adjacent markets worth considering?
- Use AppTweak keyword trends for app-specific demand signals.

## Output

Write an **investment memo**, not a score table:

```
## [Niche Name]

**Verdict**: Build / Skip / Explore Further

**The Problem**: Who needs this and why, in 1-2 sentences.

**Competition**: Landscape summary — who's there, how good they are, what they miss.

**Opportunity**: What gap exists and why an indie dev could win.

**Monetization**: How you'd make money. Realistic price point.

**Effort**: MVP scope, backend needs, timeline ballpark.

**Risks**: What could go wrong.

**Next Step**: One concrete action.
```

## Anti-Patterns

- Don't count keywords and call it analysis
- Don't score things 0-100 — use judgment
- Don't list every competitor — focus on the ones that matter
- Don't be optimistic by default — most niches are well-served
- Don't confuse "low app count" with "good opportunity"
- Don't skip reading actual user reviews
