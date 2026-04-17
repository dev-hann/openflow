export interface ConfirmationRequest {
  chatId: number | string;
  toolName: string;
  toolArgs: Record<string, unknown>;
  timeoutMs: number;
}

export interface ConfirmationResult {
  approved: boolean;
}

export interface ConfirmationHandler {
  requestConfirmation(request: ConfirmationRequest): Promise<ConfirmationResult>;
}

export const NOOP_CONFIRMATION_HANDLER: ConfirmationHandler = {
  async requestConfirmation() {
    return { approved: true };
  },
};
