import { google } from "googleapis";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const TIMEZONE = "Europe/Stockholm";

export async function fetchCalendarEvents(agentDir: string): Promise<string> {
  try {
    const refreshToken = process.env.GMAIL_REFRESH_TOKEN_PERSONAL;
    if (!refreshToken) return "Calendar data unavailable (no token configured).";

    const credPath = resolve(agentDir, "config", "gmail-credentials.json");
    if (!existsSync(credPath)) return "Calendar data unavailable.";

    const raw = JSON.parse(readFileSync(credPath, "utf-8"));
    const creds = raw.installed || raw.web;

    const oauth2 = new google.auth.OAuth2(
      creds.client_id,
      creds.client_secret,
    );
    oauth2.setCredentials({ refresh_token: refreshToken });

    const calendar = google.calendar({ version: "v3", auth: oauth2 });

    const todayStr = new Date().toLocaleDateString("sv-SE", { timeZone: TIMEZONE });
    // Google Calendar API requires RFC3339 timestamps
    const startOfDay = new Date(`${todayStr}T00:00:00`);
    const endOfDay = new Date(`${todayStr}T23:59:59`);

    const res = await calendar.events.list({
      calendarId: "primary",
      timeMin: startOfDay.toISOString(),
      timeMax: endOfDay.toISOString(),
      singleEvents: true,
      orderBy: "startTime",
      timeZone: TIMEZONE,
    });

    const events = res.data.items;
    if (!events?.length) return "No events today.";

    const lines = events.map((event) => {
      const title = event.summary || "(no title)";
      const loc = event.location ? ` (${event.location})` : "";

      if (event.start?.date) {
        return `All day  ${title}${loc}`;
      }

      const fmt = (iso: string) =>
        new Date(iso).toLocaleTimeString("sv-SE", {
          timeZone: TIMEZONE,
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        });

      const start = fmt(event.start?.dateTime || "");
      const end = fmt(event.end?.dateTime || "");
      return `${start} - ${end}  ${title}${loc}`;
    });

    return lines.join("\n");
  } catch {
    return "Calendar data unavailable.";
  }
}
