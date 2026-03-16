import type { SocialConfig, AppConfig } from "./types.js";

function env(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing env var: ${key}`);
  return val;
}

const przone: AppConfig = {
  name: "PrZone",
  enabled: true,
  reddit: {
    subreddits: [
      "fitness",
      "weightroom",
      "gym",
      "powerlifting",
      "bodybuilding",
      "GymMotivation",
    ],
    keywords: [
      "gym tracker",
      "workout log",
      "PR tracker",
      "personal record app",
      "progressive overload",
      "best gym app",
      "track my lifts",
      "workout app recommendation",
    ],
  },
  twitter: {
    hashtags: ["gymlife", "powerlifting", "fitnesstracker"],
    contentThemes: [
      "PR celebrations and progressive overload tips",
      "Feature announcements and app updates",
      "Gym culture and lifting motivation",
    ],
  },
  voice:
    "Knowledgeable gym-goer. Speaks from experience. Understands the frustration of inconsistent logging. Direct, no fluff.",
  features:
    "Gym workout tracker with automatic PR detection across weight, reps, volume, distance, pace, and time. Custom routines, supersets, streak tracking, exercise goals. Free, no ads. iOS and Android.",
};

const khushu: AppConfig = {
  name: "Khushu",
  enabled: true,
  reddit: {
    subreddits: [
      "islam",
      "MuslimLounge",
      "hijabis",
      "Ramadan",
      "productivity",
      "digitalminimalism",
      "nosurf",
    ],
    keywords: [
      "prayer app",
      "phone during salah",
      "distraction prayer",
      "screen time prayer",
      "Islamic app",
      "deen app",
      "phone addiction muslim",
      "focus during prayer",
    ],
  },
  twitter: {
    hashtags: ["salah", "khushu", "MuslimTech", "Ramadan", "digitalminimalism"],
    contentThemes: [
      "Digital minimalism during prayer times",
      "Phone-free salah experiences",
      "Ramadan tech tips and focus",
    ],
  },
  voice:
    "Relatable Muslim who struggled with phone distraction during prayer. Empathetic, not preachy. Understands the spiritual dimension without being performative.",
  features:
    "Blocks distracting apps during the five daily prayer times using Screen Time API. Auto-detects prayer times by GPS. Streak tracking, prayer history. Privacy-first, no account required. Free with Pro upgrade.",
};

const babyselfie: AppConfig = {
  name: "BabySelfie",
  enabled: false, // activate after App Store launch
  reddit: {
    subreddits: [
      "NewParents",
      "beyondthebump",
      "daddit",
      "Mommit",
      "Parenting",
      "BabyBumps",
    ],
    keywords: [
      "baby photo",
      "baby won't look at camera",
      "newborn photos",
      "baby attention",
      "baby camera app",
    ],
  },
  twitter: {
    hashtags: ["newborn", "babyphotos", "newparents"],
    contentThemes: [
      "Baby photo tips and infant attention tricks",
      "Visual development facts for new parents",
    ],
  },
  voice:
    "Parent who knows the struggle. Practical, warm, slightly humorous about the chaos of baby photography.",
  features:
    "Camera app that overlays age-appropriate visual effects to grab baby's attention. Adapts to 0-3m, 3-9m, 9m+ age profiles based on infant visual development research. Privacy-first, on-device only.",
};

export function loadConfig(): SocialConfig {
  return {
    apps: { przone, khushu, babyselfie },
    autoSkipHours: 6,
    dailySummaryHour: 21,
    weeklyDigestDay: 1, // Monday
    karmaThreshold: 200,
    accountAgeDays: 30,
    minConfidence: 0.7,
    maxPostsPerSubPerDay: 1,
  };
}

export function loadRedditCredentials() {
  return {
    clientId: env("REDDIT_CLIENT_ID"),
    clientSecret: env("REDDIT_CLIENT_SECRET"),
    username: env("REDDIT_USERNAME"),
    password: env("REDDIT_PASSWORD"),
  };
}

export function loadTwitterCredentials() {
  return {
    apiKey: env("TWITTER_API_KEY"),
    apiSecret: env("TWITTER_API_SECRET"),
    accessToken: env("TWITTER_ACCESS_TOKEN"),
    accessTokenSecret: env("TWITTER_ACCESS_TOKEN_SECRET"),
  };
}
