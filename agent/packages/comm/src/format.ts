const SPECIAL_CHARS = /([_\[\]()~`>#+\-=|{}.!])/g;

function escape(s: string): string {
  return s.replace(SPECIAL_CHARS, "\\$1");
}

function formatInline(line: string): string {
  // Split on inline code to avoid processing inside code spans
  const parts = line.split(/(`[^`]+`)/);
  return parts
    .map((part) => {
      if (part.startsWith("`") && part.endsWith("`")) return part;

      // Links: [text](url) — process before escaping
      let segment = part.replace(
        /\[([^\]]+)\]\(([^)]+)\)/g,
        (_, text, url) => `[${escape(text)}](${url})`
      );

      // Bold: **text** → *text* (process before general escaping)
      const boldParts = segment.split(/(\*\*[^*]+\*\*)/);
      segment = boldParts
        .map((bp) => {
          const boldMatch = bp.match(/^\*\*([^*]+)\*\*$/);
          if (boldMatch) return `*${escape(boldMatch[1])}*`;

          // Italic: *text* → _text_
          const italicParts = bp.split(/(?<!\*)\*([^*]+)\*(?!\*)/);
          return italicParts
            .map((ip, i) => {
              if (i % 2 === 1) return `_${escape(ip)}_`;
              // Escape remaining text but preserve links
              const linkParts = ip.split(/(\[[^\]]+\]\([^)]+\))/);
              return linkParts
                .map((lp) =>
                  /^\[[^\]]+\]\([^)]+\)$/.test(lp) ? lp : escape(lp)
                )
                .join("");
            })
            .join("");
        })
        .join("");

      return segment;
    })
    .join("");
}

/**
 * Convert Claude's markdown to Telegram MarkdownV2 format.
 * Handles: headers, bold, italic, code blocks, inline code, links.
 */
export function markdownToTelegram(text: string): string {
  const lines = text.split("\n");
  const result: string[] = [];
  let inCodeBlock = false;
  let codeBlockLines: string[] = [];
  let codeLang = "";
  let tableHeaders: string[] | null = null;

  for (const line of lines) {
    // Code block toggle
    if (line.trim().startsWith("```")) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeLang = line.trim().slice(3).trim();
        codeBlockLines = [];
      } else {
        inCodeBlock = false;
        const codeContent = codeBlockLines.join("\n");
        result.push(codeLang ? `\`\`\`${codeLang}` : "```");
        result.push(codeContent);
        result.push("```");
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockLines.push(line);
      continue;
    }

    // Headers → bold
    const headerMatch = line.match(/^#{1,6}\s+(.*)/);
    if (headerMatch) {
      result.push(`*${escape(headerMatch[1])}*`);
      continue;
    }

    // Table separator rows (e.g. |---|---|) — skip
    if (/^\|[\s\-:|]+\|$/.test(line.trim())) {
      continue;
    }

    // Table rows → convert to clean format
    if (line.trim().startsWith("|") && line.trim().endsWith("|")) {
      const cells = line
        .trim()
        .slice(1, -1)
        .split("|")
        .map((c) => c.trim());

      if (!tableHeaders) {
        // First row is header
        tableHeaders = cells;
      } else {
        // Data row — format as "key: value" pairs
        const parts = cells.map((cell, i) => {
          const header = tableHeaders![i];
          return header ? `*${escape(header)}*: ${formatInline(cell)}` : formatInline(cell);
        });
        result.push(parts.join("  "));
      }
      continue;
    }

    // End of table — reset headers
    if (tableHeaders) {
      tableHeaders = null;
    }

    // Empty lines
    if (!line.trim()) {
      result.push("");
      continue;
    }

    // Inline formatting
    result.push(formatInline(line));
  }

  // Unclosed code block
  if (inCodeBlock) {
    result.push("```");
    result.push(codeBlockLines.join("\n"));
    result.push("```");
  }

  return result.join("\n");
}

/** Telegram's message character limit */
export const TELEGRAM_MSG_LIMIT = 4096;

/**
 * Split text into chunks that fit Telegram's message limit.
 * Tries to split at newlines.
 */
export function chunkMessage(text: string): string[] {
  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > TELEGRAM_MSG_LIMIT) {
    let splitAt = remaining.lastIndexOf("\n", TELEGRAM_MSG_LIMIT);
    if (splitAt === -1 || splitAt < TELEGRAM_MSG_LIMIT / 2) {
      splitAt = TELEGRAM_MSG_LIMIT;
    }
    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt).replace(/^\n+/, "");
  }

  if (remaining.trim()) chunks.push(remaining);
  return chunks;
}
