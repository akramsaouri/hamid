import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { config as dotenvConfig } from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
const agentDir = resolve(__dirname, "../../..");
dotenvConfig({ path: resolve(agentDir, ".env") });

import { loadConfig, loadRedditCredentials, loadTwitterCredentials } from "./config.js";
import { loadState, saveState, pruneState, recordSnapshot } from "./state.js";
import { scanReddit, checkKarmaPhase } from "./scanner.js";
import { judgeThread, judgeKarmaThread } from "./judge.js";
import { generateTweet } from "./content.js";
import { addDraft, autoSkipStale, generateDraftId, getPendingDrafts } from "./queue.js";
import { formatQueueItem, formatDailySummary, formatWeeklyDigest } from "./summary.js";
import { getMyKarma } from "./reddit.js";
import { getMyProfile } from "./twitter.js";
import type { QueuedDraft } from "./types.js";

async function main() {
  const forceRun = process.argv.includes("--force");
  const dryRun = process.argv.includes("--dry-run");

  const config = loadConfig();
  const state = loadState(agentDir);
  const redditCreds = loadRedditCredentials();

  // Step 1: Prune old state
  pruneState(state);

  // Step 2: Auto-skip stale drafts
  const stale = autoSkipStale(state, config.autoSkipHours);
  if (stale.length > 0) {
    console.log(`Auto-skipped ${stale.length} stale draft(s)`);
  }

  // Step 3: Check karma phase transition
  if (state.karmaPhase) {
    const { shouldTransition, karma } = await checkKarmaPhase(
      state, config, redditCreds,
    );
    if (shouldTransition) {
      state.karmaPhase = false;
      console.log(`Karma phase complete! Karma: ${karma}. Switching to normal mode.`);
    } else {
      console.log(`Karma phase: ${karma}/${config.karmaThreshold} karma`);
    }
  }

  // Step 4: Scan Reddit
  const { createHamidSession } = await import("@hamid/core");
  const workspaceDir = resolve(agentDir, "..");
  const scanResults = await scanReddit(config, state, redditCreds);
  console.log(`Scanned: ${scanResults.length} new thread(s) found`);

  // Step 5: Judge each thread
  for (const { threads, app } of scanResults) {
    for (const thread of threads) {
      const appConfig = config.apps[app];

      const judgeOutput = state.karmaPhase
        ? await judgeKarmaThread(thread, createHamidSession, workspaceDir)
        : appConfig
          ? await judgeThread(
              {
                thread,
                app: appConfig,
                appKey: app,
                recentPostings: state.posted.filter(
                  (p) => p.app === app &&
                    new Date(p.postedAt) > new Date(Date.now() - 7 * 86400000),
                ),
              },
              createHamidSession,
              workspaceDir,
            )
          : null;

      if (!judgeOutput || judgeOutput.classification === "skip") continue;
      if (judgeOutput.confidence < config.minConfidence) continue;

      const draft: QueuedDraft = {
        id: generateDraftId(),
        platform: "reddit",
        threadId: thread.id,
        subreddit: thread.subreddit,
        threadTitle: thread.title,
        threadUrl: thread.url,
        app,
        contentType: judgeOutput.classification as "value" | "soft" | "direct",
        draft: judgeOutput.draft,
        confidence: judgeOutput.confidence,
        scannedAt: new Date().toISOString(),
        status: "pending",
      };

      addDraft(state, draft);

      if (dryRun) {
        console.log(`[DRY RUN] Would queue:\n${formatQueueItem(draft, 0, 1)}\n`);
      }
    }
  }

  // Step 6: Generate X content for enabled apps
  if (!state.karmaPhase) {
    const enabledApps = Object.entries(config.apps).filter(([, a]) => a.enabled);
    for (const [appKey, appConfig] of enabledApps) {
      try {
        const tweet = await generateTweet(
          appConfig, appKey, createHamidSession, workspaceDir,
        );
        if (tweet.content) {
          const draft: QueuedDraft = {
            id: generateDraftId(),
            platform: "twitter",
            threadId: `tweet_${Date.now()}`,
            subreddit: "",
            threadTitle: `Original tweet for ${appConfig.name}`,
            threadUrl: "",
            app: appKey,
            contentType: "direct",
            draft: tweet.content,
            confidence: 1.0,
            scannedAt: new Date().toISOString(),
            status: "pending",
          };
          addDraft(state, draft);
        }
      } catch (err) {
        console.error(`Tweet generation failed for ${appKey}:`, err);
      }
    }
  }

  // Step 7: Record snapshot
  try {
    const { karma } = await getMyKarma(redditCreds);
    let xFollowers = 0;
    try {
      const twitterCreds = loadTwitterCredentials();
      const profile = await getMyProfile(twitterCreds);
      xFollowers = profile.followers;
    } catch { /* X credentials may not be set up yet */ }
    recordSnapshot(state, karma, xFollowers);
  } catch (err) {
    console.error("Snapshot failed:", err);
  }

  // Step 8: Save state
  saveState(agentDir, state);

  // Step 9: Send pending drafts to Telegram
  const pending = getPendingDrafts(state);
  if (pending.length > 0 && !dryRun) {
    const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
    const telegramChatId = process.env.TELEGRAM_CHAT_ID;

    if (telegramToken && telegramChatId) {
      const { sendSocialQueue } = await import("./telegram.js");
      await sendSocialQueue(pending, telegramToken, telegramChatId, state, agentDir);
    }
  }

  // Step 10: Send daily summary if it's the right hour
  const currentHour = new Date().getHours();
  const currentDay = new Date().getDay(); // 0=Sun, 1=Mon

  if (currentHour === config.dailySummaryHour && !dryRun) {
    const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
    const telegramChatId = process.env.TELEGRAM_CHAT_ID;
    if (telegramToken && telegramChatId) {
      const summary = formatDailySummary(state);
      const { sendMessage } = await import("./telegram.js");
      await sendMessage(telegramToken, telegramChatId, summary);
    }
  }

  // Step 11: Send weekly digest if it's Monday at the summary hour
  if (
    currentDay === config.weeklyDigestDay &&
    currentHour === config.dailySummaryHour &&
    !dryRun
  ) {
    const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
    const telegramChatId = process.env.TELEGRAM_CHAT_ID;
    if (telegramToken && telegramChatId) {
      const digest = formatWeeklyDigest(state);
      const { sendMessage } = await import("./telegram.js");
      await sendMessage(telegramToken, telegramChatId, digest);
    }
  }

  console.log(
    `Done. ${pending.length} draft(s) queued for approval.`,
  );
}

main().catch((err) => {
  console.error("Social scan failed:", err);
  process.exit(1);
});
