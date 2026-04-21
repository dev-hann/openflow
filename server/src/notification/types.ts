export interface PushTicket {
  id: string;
  status: "ok" | "error";
  message?: string;
  details?: { error?: string };
}

export interface PushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default" | null;
  badge?: number;
}

export interface PushService {
  send(message: PushMessage): Promise<PushTicket>;
  sendAll(messages: PushMessage[]): Promise<PushTicket[]>;
}
