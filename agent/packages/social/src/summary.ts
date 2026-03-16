import type { QueuedDraft, SocialState, Snapshot } from "./types.js";

export function formatQueueItem(
  draft: QueuedDraft,
  index: number,
  total: number,
): string {
  const typeLabel =
    draft.contentType === "direct"
      ? "Direct recommendation"
      : draft.contentType === "soft"
        ? "Soft mention"
        : "Value reply";

  const platform =
    draft.platform === "reddit" ? `Reddit r/${draft.subreddit}` : "X";

  return [
    `${index + 1}/${total} — ${platform}`,
    `Thread: "${draft.threadTitle}"`,
    `Type: ${typeLabel}`,
    "",
    "Draft:",
    draft.draft,
  ].join("\n");
}

export function formatDailySummary(state: SocialState): string {
  const today = new Date().toISOString().slice(0, 10);
  const todayPosted = state.posted.filter((p) =>
    p.postedAt.startsWith(today),
  );
  const todaySkipped = state.skipped.filter((s) =>
    s.skippedAt.startsWith(today),
  );
  const pending = state.queue.filter((d) => d.status === "pending");

  const lines = [
    `Social today: ${todayPosted.length} posted, ${todaySkipped.length} skipped, ${pending.length} pending`,
  ];

  for (const p of todayPosted) {
    const platform = p.platform === "reddit" ? "Reddit" : "X";
    lines.push(`- ${platform} ${p.contentType} reply`);
  }

  return lines.join("\n");
}

export function formatWeeklyDigest(state: SocialState): string {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekAgoISO = weekAgo.toISOString();

  const weekPosted = state.posted.filter((p) => p.postedAt > weekAgoISO);
  const weekSkipped = state.skipped.filter((s) => s.skippedAt > weekAgoISO);

  const redditPosts = weekPosted.filter((p) => p.platform === "reddit");
  const xPosts = weekPosted.filter((p) => p.platform === "twitter");

  const snaps = state.snapshots.slice(-2);
  const karmaLine =
    snaps.length >= 2
      ? `Reddit karma: ${snaps[0].redditKarma} -> ${snaps[1].redditKarma}`
      : snaps.length === 1
        ? `Reddit karma: ${snaps[0].redditKarma}`
        : "";

  const lines = [
    "Social this week:",
    `- ${weekPosted.length} posts (${redditPosts.length} Reddit, ${xPosts.length} X)`,
    `- ${weekSkipped.length} opportunities skipped`,
    `- ${state.stats.totalScanned} threads scanned`,
  ];

  if (karmaLine) lines.push(`- ${karmaLine}`);

  if (state.karmaPhase) {
    lines.push(
      `- Karma phase: building reputation (target: ${state.stats.totalPosted} posts)`,
    );
  }

  return lines.join("\n");
}
