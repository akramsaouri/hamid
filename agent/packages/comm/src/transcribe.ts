import OpenAI from "openai";

/**
 * Download a voice file from Telegram and transcribe it via OpenAI Whisper.
 */
export async function transcribeVoice(
  botToken: string,
  fileId: string,
  openaiApiKey: string
): Promise<string> {
  // Get file path from Telegram
  const fileRes = await fetch(
    `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`
  );
  const fileData = (await fileRes.json()) as {
    ok: boolean;
    result: { file_path: string };
  };
  if (!fileData.ok) {
    throw new Error("Failed to get file from Telegram");
  }

  // Download the audio file
  const audioRes = await fetch(
    `https://api.telegram.org/file/bot${botToken}/${fileData.result.file_path}`
  );
  const audioBuffer = await audioRes.arrayBuffer();
  const audioFile = new File([audioBuffer], "voice.ogg", {
    type: "audio/ogg",
  });

  // Transcribe with Whisper
  const openai = new OpenAI({ apiKey: openaiApiKey });
  const transcription = await openai.audio.transcriptions.create({
    model: "whisper-1",
    file: audioFile,
  });

  return transcription.text;
}
