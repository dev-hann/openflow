import { describe, it, expect, vi, beforeEach } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { createSendMessageTool, createSendImageTool } from "./channel-tools.js";
import type { ChannelSender } from "./types.js";

function mockSender(): ChannelSender {
  return {
    sendMessage: vi.fn().mockResolvedValue(undefined),
    sendPhoto: vi.fn().mockResolvedValue(undefined),
  };
}

describe("createSendMessageTool", () => {
  it("should send message with correct parameters", async () => {
    const sender = mockSender();
    const tool = createSendMessageTool(sender);

    const result = await tool.execute({ chatId: 42, text: "Hello world" });
    expect(result).toBe("OK");
    expect(sender.sendMessage).toHaveBeenCalledWith(42, "Hello world");
  });

  it("should send message with string chatId", async () => {
    const sender = mockSender();
    const tool = createSendMessageTool(sender);

    const result = await tool.execute({ chatId: "session-1", text: "test" });
    expect(result).toBe("OK");
    expect(sender.sendMessage).toHaveBeenCalledWith("session-1", "test");
  });
});

describe("createSendImageTool", () => {
  let workspace: string;

  beforeEach(() => {
    workspace = mkdtempSync(join(tmpdir(), "openflow-test-channel-tools-"));
  });

  it("should send image from URL", async () => {
    const sender = mockSender();
    const tool = createSendImageTool(sender, workspace);

    const result = await tool.execute({ chatId: 1, source: "https://example.com/img.png" });
    expect(result).toBe("OK");
    expect(sender.sendPhoto).toHaveBeenCalledWith(1, "https://example.com/img.png", undefined);
  });

  it("should send image from URL with caption", async () => {
    const sender = mockSender();
    const tool = createSendImageTool(sender, workspace);

    const result = await tool.execute({ chatId: 1, source: "http://img.test/pic.jpg", caption: "A photo" });
    expect(result).toBe("OK");
    expect(sender.sendPhoto).toHaveBeenCalledWith(1, "http://img.test/pic.jpg", "A photo");
  });

  it("should send image from local file in workspace", async () => {
    const sender = mockSender();
    const tool = createSendImageTool(sender, workspace);
    const imgPath = join(workspace, "photo.png");
    writeFileSync(imgPath, "fake-image-data");

    const result = await tool.execute({ chatId: 1, source: imgPath });
    expect(result).toBe("OK");
    expect(sender.sendPhoto).toHaveBeenCalledWith(1, expect.any(Buffer), undefined);
  });

  it("should reject path outside workspace", async () => {
    const sender = mockSender();
    const tool = createSendImageTool(sender, workspace);

    await expect(
      tool.execute({ chatId: 1, source: resolve("/etc/passwd") }),
    ).rejects.toThrow("Path is outside workspace");
  });

  it("should error on missing local file", async () => {
    const sender = mockSender();
    const tool = createSendImageTool(sender, workspace);

    await expect(
      tool.execute({ chatId: 1, source: join(workspace, "nonexistent.png") }),
    ).rejects.toThrow("Image file not found");
  });
});
