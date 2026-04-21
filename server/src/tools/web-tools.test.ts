import { describe, it, expect } from "vitest";
import { validateUrl } from "./web-tools.js";

describe("validateUrl", () => {
  it("should accept valid https URLs", () => {
    expect(() => validateUrl("https://example.com/page")).not.toThrow();
  });

  it("should accept valid http URLs", () => {
    expect(() => validateUrl("http://example.com/page")).not.toThrow();
  });

  it("should throw on invalid URL", () => {
    expect(() => validateUrl("not-a-url")).toThrow("Invalid URL");
  });

  it("should throw on unsupported protocol", () => {
    expect(() => validateUrl("ftp://example.com/file")).toThrow("Unsupported protocol");
  });

  it("should block localhost", () => {
    expect(() => validateUrl("http://localhost:3000/api")).toThrow("private/internal networks");
  });

  it("should block 127.0.0.1", () => {
    expect(() => validateUrl("http://127.0.0.1/secret")).toThrow("private/internal networks");
  });

  it("should block 0.0.0.0", () => {
    expect(() => validateUrl("http://0.0.0.0/")).toThrow("private/internal networks");
  });

  it("should block ::1", () => {
    expect(() => validateUrl("http://[::1]/")).toThrow("private/internal networks");
  });

  it("should block .local domains", () => {
    expect(() => validateUrl("http://myserver.local/")).toThrow("private/internal networks");
  });

  it("should block .internal domains", () => {
    expect(() => validateUrl("http://service.internal/")).toThrow("private/internal networks");
  });

  it("should block 10.x private range", () => {
    expect(() => validateUrl("http://10.0.0.1/")).toThrow("private/internal networks");
  });

  it("should block 192.168.x private range", () => {
    expect(() => validateUrl("http://192.168.1.1/")).toThrow("private/internal networks");
  });

  it("should block 172.16-31.x private range", () => {
    expect(() => validateUrl("http://172.16.0.1/")).toThrow("private/internal networks");
    expect(() => validateUrl("http://172.31.255.1/")).toThrow("private/internal networks");
  });

  it("should allow 172.32.x (not in private range)", () => {
    expect(() => validateUrl("http://172.32.0.1/")).not.toThrow();
  });

  it("should block 169.254.x link-local", () => {
    expect(() => validateUrl("http://169.254.1.1/")).toThrow("private/internal networks");
  });

  it("should block fc-prefix (IPv6 unique local)", () => {
    expect(() => validateUrl("http://[fc00::1]/")).toThrow("private/internal networks");
  });

  it("should block fe80-prefix (IPv6 link-local)", () => {
    expect(() => validateUrl("http://[fe80::1]/")).toThrow("private/internal networks");
  });
});
