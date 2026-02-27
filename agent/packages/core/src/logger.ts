export interface Logger {
  info(msg: string): void;
  error(msg: string, err?: unknown): void;
  warn(msg: string): void;
}

export function createLogger(name: string): Logger {
  const ts = () => new Date().toISOString().replace("T", " ").slice(0, 19);

  return {
    info: (msg) => console.log(`[${ts()}] [${name}] ${msg}`),
    error: (msg, err?) => {
      console.error(`[${ts()}] [${name}] ERROR ${msg}`);
      if (err) console.error(err);
    },
    warn: (msg) => console.warn(`[${ts()}] [${name}] WARN ${msg}`),
  };
}
