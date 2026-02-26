import type { EmailConfig } from "./types.js";

function env(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing env var: ${key}`);
  return val;
}

export function loadConfig(): EmailConfig {
  return {
    accounts: {
      personal: {
        address: env("GMAIL_ADDRESS_PERSONAL"),
        schedule: "0 9,13,18 * * *", // 9am, 1pm, 6pm daily
        allowDelete: true,
        rules: [
          { match: { from: "*noreply*" }, action: "trash" },
          { match: { from: "*no-reply*" }, action: "trash" },
          { match: { from: "*@marketing.*" }, action: "trash" },
          { match: { from: "*newsletter*" }, action: "trash" },
          { match: { from: "*promo*" }, action: "trash" },
          { match: { subject: "*unsubscribe*" }, action: "trash" },
        ],
      },
      work: {
        address: env("GMAIL_ADDRESS_WORK"),
        schedule: "0 8,12,17 * * 1-5", // 8am, 12pm, 5pm weekdays
        allowDelete: true,
        rules: [
          { match: { from: "*noreply*" }, action: "trash" },
          { match: { from: "*no-reply*" }, action: "trash" },
          { match: { from: "*@marketing.*" }, action: "trash" },
          { match: { from: "*newsletter*" }, action: "trash" },
        ],
      },
      przone: {
        address: env("GMAIL_ADDRESS_PRZONE"),
        schedule: "0 9,13,17 * * *", // 9am, 1pm, 5pm daily
        allowDelete: true,
        rules: [
          { match: { from: "*noreply*" }, action: "trash" },
          { match: { from: "*no-reply*" }, action: "trash" },
          { match: { from: "*@marketing.*" }, action: "trash" },
        ],
      },
    },
  };
}
