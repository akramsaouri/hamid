import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

const MEDIA_DIR = "/tmp/hamid-media";

/**
 * Download a file from Telegram by file_id and save it locally.
 * Returns the local file path.
 */
export async function downloadTelegramFile(
  botToken: string,
  fileId: string,
  ext?: string
): Promise<string> {
  mkdirSync(MEDIA_DIR, { recursive: true });

  // Resolve file path via Telegram API
  const res = await fetch(
    `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`
  );
  const data = (await res.json()) as {
    ok: boolean;
    result: { file_path: string };
  };
  if (!data.ok) {
    throw new Error("Failed to get file from Telegram");
  }

  const telegramPath = data.result.file_path;
  const extension = ext ?? telegramPath.split(".").pop() ?? "bin";

  // Download file contents
  const fileRes = await fetch(
    `https://api.telegram.org/file/bot${botToken}/${telegramPath}`
  );
  const buffer = await fileRes.arrayBuffer();

  const localPath = join(MEDIA_DIR, `${randomUUID()}.${extension}`);
  writeFileSync(localPath, Buffer.from(buffer));

  return localPath;
}
