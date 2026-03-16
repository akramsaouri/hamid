// === Platform types ===

export type Platform = "reddit" | "twitter";
export type ContentType = "value" | "soft" | "direct";
export type DraftStatus = "pending" | "approved" | "posted" | "skipped";

// === Config types ===

export interface AppConfig {
  name: string;
  enabled: boolean;
  reddit: {
    subreddits: string[];
    keywords: string[];
  };
  twitter: {
    hashtags: string[];
    contentThemes: string[];
  };
  voice: string;
  features: string;
}

export interface SocialConfig {
  apps: Record<string, AppConfig>;
  autoSkipHours: number;
  dailySummaryHour: number;
  weeklyDigestDay: number;
  karmaThreshold: number;
  accountAgeDays: number;
  minConfidence: number;
  maxPostsPerSubPerDay: number;
}

// === Scanner types ===

export interface ScannedThread {
  id: string;
  subreddit: string;
  title: string;
  body: string;
  url: string;
  author: string;
  upvotes: number;
  commentCount: number;
  createdAt: string;
}

// === Judge types ===

export interface JudgeInput {
  thread: ScannedThread;
  app: AppConfig;
  appKey: string;
  recentPostings: PostedItem[];
}

export interface JudgeOutput {
  classification: ContentType | "skip";
  draft: string;
  confidence: number;
  reasoning: string;
}

// === Queue types ===

export interface QueuedDraft {
  id: string;
  platform: Platform;
  threadId: string;
  subreddit: string;
  threadTitle: string;
  threadUrl: string;
  app: string;
  contentType: ContentType;
  draft: string;
  confidence: number;
  scannedAt: string;
  status: DraftStatus;
  telegramMessageId?: number;
}

export interface PostedItem {
  id: string;
  platform: Platform;
  threadId: string;
  postId: string;
  postedAt: string;
  app: string;
  contentType: ContentType;
}

export interface SkippedItem {
  threadId: string;
  skippedAt: string;
}

export interface Snapshot {
  date: string;
  redditKarma: number;
  xFollowers: number;
}

// === State types ===

export interface SocialState {
  karmaPhase: boolean;
  cursors: Record<string, string>;
  queue: QueuedDraft[];
  posted: PostedItem[];
  skipped: SkippedItem[];
  stats: {
    totalScanned: number;
    totalDrafted: number;
    totalApproved: number;
    totalSkipped: number;
    totalPosted: number;
  };
  snapshots: Snapshot[];
}

// === X Content types ===

export interface GeneratedTweet {
  app: string;
  content: string;
  hashtags: string[];
}
