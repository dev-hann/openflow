import type { WorkspaceFiles } from "./workspace.js";

const IDENTITY_SECTION = `You are OpenFlow, a personal AI assistant.
You have access to tools that let you execute shell commands, read/write files, fetch web pages, search the web, and more.
Always use tools when they can help answer the user's question.
Be concise and direct in your responses.
When executing commands, show the relevant output.`;

const PERSONA_INSTRUCTION = `If PERSONA.md content is provided below, fully embody that persona and tone.
Avoid stiff, generic replies; follow its guidance for personality, mannerisms, and boundaries.`;

const MEMORY_INSTRUCTION = `You have persistent memory across sessions.
- MEMORY.md contains curated long-term memories. Update it when learning important facts about the user.
- Daily memory files contain recent conversation summaries.
Before answering questions about past work, decisions, or preferences, check these memories first.`;

const DAILY_MEMORY_FLUSH_INSTRUCTION = `When the user's message suggests ending a session or switching topics, proactively save important context to the daily memory file using the write_file tool. Include:
- Key decisions made
- Important facts learned about the user
- Unfinished tasks or follow-ups
Do NOT save greetings, pleasantries, or trivial exchanges.`;

function section(header: string, content: string): string {
  return `## ${header}\n${content}`;
}

export function buildSystemPrompt(
  workspaceFiles: WorkspaceFiles,
  runtimeContext: { workspace: string; timezone?: string },
): string {
  const parts: string[] = [];

  parts.push(IDENTITY_SECTION);

  if (workspaceFiles.persona) {
    parts.push(PERSONA_INSTRUCTION);
    parts.push(section("Persona (PERSONA.md)", workspaceFiles.persona));
  }

  if (workspaceFiles.user) {
    parts.push(section("User Profile (USER.md)", workspaceFiles.user));
  }

  if (workspaceFiles.memory || workspaceFiles.dailyMemory) {
    parts.push(MEMORY_INSTRUCTION);
  }

  if (workspaceFiles.memory) {
    parts.push(section("Long-term Memory (MEMORY.md)", workspaceFiles.memory));
  }

  if (workspaceFiles.dailyMemory) {
    parts.push(section("Recent Context (Daily Memory)", workspaceFiles.dailyMemory));
  }

  parts.push(DAILY_MEMORY_FLUSH_INSTRUCTION);

  const runtimeParts: string[] = [
    `Current working directory: ${runtimeContext.workspace}`,
    `Current date: ${new Date().toISOString().split("T")[0]}`,
  ];
  if (runtimeContext.timezone) {
    runtimeParts.push(`User timezone: ${runtimeContext.timezone}`);
  }
  parts.push(section("Runtime", runtimeParts.join("\n")));

  return parts.join("\n\n");
}
