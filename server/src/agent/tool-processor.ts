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
      log.warn(
        {
          sessionId,
          toolName,
          rawArgs: toolCall.function.arguments.slice(0, 200),
        },
        "tool argument parse failed",
      );
      const errorMsg: ChatMessage = {
        role: "tool",
        content: `Failed to parse tool arguments for "${toolName}"`,
        tool_call_id: toolCall.id,
      };
      try {
        memory.addMessage({
          sessionId,
          role: "tool",
          content: `Failed to parse tool arguments for "${toolName}"`,
          toolCallId: toolCall.id,
        });
      } catch (err: unknown) {
        log.error({ sessionId, toolCallId: toolCall.id, err }, "failed to save tool error");
      }
      return errorMsg;
    }
    log.info({ sessionId, toolName, round }, "executing tool");

    const result = await executeWithConfirmation(toolCall.id, toolName, parsedArgs, chatId);
    if (result.isError && tools.needsConfirmation(toolName)) {
      log.info({ sessionId, toolName, round }, "tool execution denied by user");
    }

    const toolMessage: ChatMessage = {
      role: "tool",
      content: result.content,
      tool_call_id: toolCall.id,
    };

    try {
      memory.addMessage({
        sessionId,
        role: "tool",
        content: result.content,
        toolCallId: toolCall.id,
      });
    } catch (err: unknown) {
      log.error({ sessionId, toolCallId: toolCall.id, err }, "failed to save tool result");
    }

    log.info({ sessionId, toolName, isError: result.isError, round }, "tool execution completed");
    return toolMessage;
  }

  return { processToolCall };
}
