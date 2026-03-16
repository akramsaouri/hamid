import type {
  ScannedThread,
  SocialState,
  SocialConfig,
  AppConfig,
} from "./types.js";
import { searchSubreddit, getMyKarma } from "./reddit.js";

const KARMA_PHASE_SUBREDDITS = [
  "AskReddit",
  "NoStupidQuestions",
  "explainlikeimfive",
  "TooAfraidToAsk",
];

const KARMA_PHASE_KEYWORDS = [
  "how to",
  "what is",
  "why do",
  "help with",
  "advice",
];

export function filterNewThreads(
  threads: ScannedThread[],
  state: SocialState,
  ownUsername: string,
  maxPostsPerSubPerDay = 1,
): ScannedThread[] {
  const postedIds = new Set(state.posted.map((p) => p.threadId));
  const skippedIds = new Set(state.skipped.map((s) => s.threadId));
  const queuedIds = new Set(state.queue.map((q) => q.threadId));

  // Count posts per subreddit in last 24h
  const dayAgo = new Date(Date.now() - 86400000).toISOString();
  const recentPostsBySub = new Map<string, number>();
  for (const p of state.posted) {
    if (p.platform === "reddit" && p.postedAt > dayAgo) {
      const sub = state.queue.find((q) => q.threadId === p.threadId)?.subreddit
        ?? state.posted.find((pp) => pp.threadId === p.threadId)?.app ?? "";
      recentPostsBySub.set(sub, (recentPostsBySub.get(sub) ?? 0) + 1);
    }
  }

  return threads.filter((t) => {
    if (postedIds.has(t.id)) return false;
    if (skippedIds.has(t.id)) return false;
    if (queuedIds.has(t.id)) return false;
    if (t.author.toLowerCase() === ownUsername.toLowerCase()) return false;
    if ((recentPostsBySub.get(t.subreddit) ?? 0) >= maxPostsPerSubPerDay) return false;
    return true;
  });
}

function updateCursor(
  state: SocialState,
  cursorKey: string,
  threads: ScannedThread[],
): void {
  if (threads.length > 0) {
    state.cursors[cursorKey] = threads[0].id;
  }
}

function threadsAfterCursor(
  threads: ScannedThread[],
  cursorId: string | undefined,
): ScannedThread[] {
  if (!cursorId) return threads;
  const idx = threads.findIndex((t) => t.id === cursorId);
  return idx < 0 ? threads : threads.slice(0, idx);
}

export interface ScanResult {
  threads: ScannedThread[];
  app: string;
}

export async function scanReddit(
  config: SocialConfig,
  state: SocialState,
  redditCreds: { clientId: string; clientSecret: string; username: string; password: string },
): Promise<ScanResult[]> {
  const results: ScanResult[] = [];
  const apps = Object.entries(config.apps).filter(([, a]) => a.enabled);

  const subreddits = state.karmaPhase
    ? KARMA_PHASE_SUBREDDITS
    : [...new Set(apps.flatMap(([, a]) => a.reddit.subreddits))];

  const keywords = state.karmaPhase
    ? KARMA_PHASE_KEYWORDS
    : undefined;

  for (const sub of subreddits) {
    const searchKeywords = keywords
      ? keywords
      : [...new Set(apps.flatMap(([, a]) =>
          a.reddit.subreddits.includes(sub) ? a.reddit.keywords : [],
        ))];

    for (const kw of searchKeywords) {
      const cursorKey = `reddit:r/${sub}:${kw}`;
      const cursorId = state.cursors[cursorKey];

      try {
        const raw = await searchSubreddit(redditCreds, sub, kw, 10);
        const newThreads = threadsAfterCursor(raw, cursorId);
        const filtered = filterNewThreads(newThreads, state, redditCreds.username);

        updateCursor(state, cursorKey, raw);

        if (filtered.length > 0) {
          const appKey = state.karmaPhase
            ? "__karma__"
            : findBestApp(filtered[0], apps) ?? apps[0]?.[0] ?? "unknown";

          for (const thread of filtered) {
            results.push({ threads: [thread], app: appKey });
          }
        }

        state.stats.totalScanned += raw.length;
      } catch (err) {
        console.error(`Scan failed for r/${sub} "${kw}":`, err);
      }
    }
  }

  return results;
}

function findBestApp(
  thread: ScannedThread,
  apps: [string, AppConfig][],
): string | undefined {
  for (const [key, app] of apps) {
    if (app.reddit.subreddits.includes(thread.subreddit)) return key;
  }
  return undefined;
}

export async function checkKarmaPhase(
  state: SocialState,
  config: SocialConfig,
  redditCreds: { clientId: string; clientSecret: string; username: string; password: string },
): Promise<{ shouldTransition: boolean; karma: number }> {
  const { karma, createdUtc } = await getMyKarma(redditCreds);
  const accountAgeDays = (Date.now() / 1000 - createdUtc) / 86400;

  const shouldTransition =
    state.karmaPhase &&
    karma >= config.karmaThreshold &&
    accountAgeDays >= config.accountAgeDays;

  return { shouldTransition, karma };
}
