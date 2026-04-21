import pino from "pino";

export function createLogger(name: string) {
  const level = process.env.OPENFLOW_LOG_LEVEL ?? "info";
  return pino({ name, level });
}
