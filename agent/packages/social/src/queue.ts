import type { QueuedDraft, SocialState } from "./types.js";
import { randomBytes } from "node:crypto";

export function generateDraftId(): string {
  return `draft_${randomBytes(6).toString("hex")}`;
}

export function addDraft(state: SocialState, draft: QueuedDraft): void {
  state.queue.push(draft);
  state.stats.totalDrafted++;
}

export function skipDraft(state: SocialState, draftId: string): void {
  const idx = state.queue.findIndex((d) => d.id === draftId);
  if (idx < 0) return;

  const draft = state.queue[idx];
  state.skipped.push({
    threadId: draft.threadId,
    skippedAt: new Date().toISOString(),
  });
  state.queue.splice(idx, 1);
  state.stats.totalSkipped++;
}

export function approveDraft(
  state: SocialState,
  draftId: string,
): QueuedDraft | undefined {
  const draft = state.queue.find((d) => d.id === draftId);
  if (!draft) return undefined;
  draft.status = "approved";
  state.stats.totalApproved++;
  return draft;
}

export function markPosted(
  state: SocialState,
  draftId: string,
  postId: string,
): void {
  const idx = state.queue.findIndex((d) => d.id === draftId);
  if (idx < 0) return;

  const draft = state.queue[idx];
  state.posted.push({
    id: draft.id,
    platform: draft.platform,
    threadId: draft.threadId,
    postId,
    postedAt: new Date().toISOString(),
    app: draft.app,
    contentType: draft.contentType,
  });
  state.queue.splice(idx, 1);
  state.stats.totalPosted++;
}

export function autoSkipStale(
  state: SocialState,
  maxAgeHours: number,
): QueuedDraft[] {
  const cutoff = new Date();
  cutoff.setHours(cutoff.getHours() - maxAgeHours);
  const cutoffISO = cutoff.toISOString();

  const stale = state.queue.filter(
    (d) => d.status === "pending" && d.scannedAt < cutoffISO,
  );

  for (const draft of stale) {
    skipDraft(state, draft.id);
  }

  return stale;
}

export function getPendingDrafts(state: SocialState): QueuedDraft[] {
  return state.queue.filter((d) => d.status === "pending");
}
