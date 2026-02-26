import { google, gmail_v1 } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import { GmailMessage } from "./types.js";

export class GmailClient {
  private gmail: gmail_v1.Gmail;
  private email: string;

  constructor(auth: OAuth2Client, email: string) {
    this.gmail = google.gmail({ version: "v1", auth });
    this.email = email;
  }

  async fetchUnread(maxResults = 50): Promise<GmailMessage[]> {
    const res = await this.gmail.users.messages.list({
      userId: "me",
      q: "is:unread in:inbox",
      maxResults,
    });

    if (!res.data.messages?.length) return [];

    const messages = await Promise.all(
      res.data.messages.map((m) => this.getMessage(m.id!))
    );

    return messages.filter((m): m is GmailMessage => m !== null);
  }

  async getMessage(messageId: string): Promise<GmailMessage | null> {
    try {
      const res = await this.gmail.users.messages.get({
        userId: "me",
        id: messageId,
        format: "full",
      });

      const headers = res.data.payload?.headers || [];
      const getHeader = (name: string) =>
        headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())
          ?.value || "";

      const body = this.extractBody(res.data.payload);

      return {
        id: res.data.id!,
        threadId: res.data.threadId!,
        from: getHeader("From"),
        to: getHeader("To"),
        subject: getHeader("Subject"),
        snippet: res.data.snippet || "",
        body,
        date: new Date(parseInt(res.data.internalDate || "0")),
        labels: res.data.labelIds || [],
      };
    } catch {
      return null;
    }
  }

  async trash(messageId: string): Promise<void> {
    await this.gmail.users.messages.trash({
      userId: "me",
      id: messageId,
    });
  }

  async markAsRead(messageId: string): Promise<void> {
    await this.gmail.users.messages.modify({
      userId: "me",
      id: messageId,
      requestBody: {
        removeLabelIds: ["UNREAD"],
      },
    });
  }

  async getGmailLink(messageId: string): Promise<string> {
    return `https://mail.google.com/mail/u/?authuser=${this.email}#inbox/${messageId}`;
  }

  private extractBody(
    payload: gmail_v1.Schema$MessagePart | undefined
  ): string {
    if (!payload) return "";

    // Simple text body
    if (payload.mimeType === "text/plain" && payload.body?.data) {
      return Buffer.from(payload.body.data, "base64url").toString("utf-8");
    }

    // Multipart — recurse through parts, prefer text/plain
    if (payload.parts) {
      const textPart = payload.parts.find((p) => p.mimeType === "text/plain");
      if (textPart?.body?.data) {
        return Buffer.from(textPart.body.data, "base64url").toString("utf-8");
      }

      // Fall back to HTML
      const htmlPart = payload.parts.find((p) => p.mimeType === "text/html");
      if (htmlPart?.body?.data) {
        const html = Buffer.from(htmlPart.body.data, "base64url").toString(
          "utf-8"
        );
        return stripHtml(html);
      }

      // Recurse into nested multipart
      for (const part of payload.parts) {
        const body = this.extractBody(part);
        if (body) return body;
      }
    }

    return "";
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
