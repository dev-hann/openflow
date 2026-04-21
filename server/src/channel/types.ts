export interface Channel {
  start(): Promise<void>;
  stop(): Promise<void>;
}
