export interface Channel {
  start(): Promise<void>;
  stop(): Promise<void>;
}

export interface NotificationSender {
  sendMessage(chatId: number | string, text: string): Promise<void>;
  sendPhoto(chatId: number | string, photo: string | Buffer, caption?: string): Promise<void>;
}
