import { createLogger } from "../utils/logger.js";
import type { ChatMessage } from "../llm/index.js";
import type { ToolExecutor, ToolResult } from "../tools/index.js";
import type { ConfirmationHandler } from "../tools/confirmation.js";
import type { MemoryStore } from "../memory/index.js";

const log = createLogger("agent/tool-processor");

export interface ToolProcessorDeps {
  tools: ToolExecutor;
  memory: MemoryStore;
  confirmationHandler?: ConfirmationHandler;
  confirmationTimeout?: number;
}

export interface RawToolCall {
  id: string;
  function: { name: string; arguments: string };
}

export function createToolProcessor(deps: ToolProcessorDeps) {
  const { tools, memory, confirmationHandler, confirmationTimeout } = deps;

  async function executeWithConfirmation(
    toolCallId: string,
    toolName: string,
    parsedArgs: Record<string, unknown>,
    chatId: number | string | undefined,
  ): Promise<ToolResult> {
    if (tools.needsConfirmation(toolName) && confirmationHandler && chatId !== undefined) {
      const confirmation = await confirmationHandler.requestConfirmation({
        chatId,
        toolName,
        toolArgs: parsedArgs,
        timeoutMs: confirmationTimeout ?? 60_000,
      });
      if (!confirmation.approved) {
        return {
          toolCallId,
          content: `사용자가 "${toolName}" 실행을 거부했습니다.`,
          isError: true,
        };
      }
    }
    return tools.execute({
      id: toolCallId,
      name: toolName,
      arguments: parsedArgs,
    });
  }

  function persistToolMessage(
    sessionId: string,
    toolCallId: string,
    content: string,
  ): void {
    try {
      memory.addMessage({ sessionId, role: "tool", content, toolCallId });
    } catch (err: unknown) {
      log.error({ sessionId, toolCallId, err }, "failed to persist tool message");
    }
  }

  async function processToolCall(
    toolCall: RawToolCall,
    sessionId: string,
    chatId: number | string | undefined,
    round: number,
  ): Promise<ChatMessage> {
    const toolName = toolCall.function.name;
    let parsedArgs: Record<string, unknown>;
    try {
      parsedArgs = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;
    } catch {
      const parseFailedMsg = `Failed to parse tool arguments for "${toolName}"`;
      log.warn(
        {
          sessionId,
          toolName,
          rawArgs: toolCall.function.arguments.slice(0, 200),
        },
        "tool argument parse failed",
      );
      persistToolMessage(sessionId, toolCall.id, parseFailedMsg);
      return { role: "tool", content: parseFailedMsg, tool_call_id: toolCall.id };
    }
    log.info({ sessionId, toolName, round }, "executing tool");

    const result = await executeWithConfirmation(toolCall.id, toolName, parsedArgs, chatId);
    if (result.isError && tools.needsConfirmation(toolName)) {
      log.info({ sessionId, toolName, round }, "tool execution denied by user");
    }

    persistToolMessage(sessionId, toolCall.id, result.content);
    log.info({ sessionId, toolName, isError: result.isError, round }, "tool execution completed");
    return { role: "tool", content: result.content, tool_call_id: toolCall.id };
  }

  return { processToolCall };
}
