import { describe, it, expect } from "vitest";
import { OpenFlowError, ok, err, type Result } from "./errors.js";

describe("OpenFlowError", () => {
  it("should create error with code and message", () => {
    const error = new OpenFlowError("test message", "CONFIG_INVALID");
    expect(error.message).toBe("test message");
    expect(error.code).toBe("CONFIG_INVALID");
    expect(error.name).toBe("OpenFlowError");
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(OpenFlowError);
  });

  it("should accept cause", () => {
    const cause = new Error("original");
    const error = new OpenFlowError("wrapped", "LLM_REQUEST_FAILED", cause);
    expect(error.cause).toBe(cause);
  });

  it("should have no cause by default", () => {
    const error = new OpenFlowError("msg", "DB_ERROR");
    expect(error.cause).toBeUndefined();
  });
});

describe("Result type helpers", () => {
  it("ok() should return success result", () => {
    const result = ok(42);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(42);
    }
  });

  it("ok() should work with objects", () => {
    const result = ok({ name: "test", count: 5 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.name).toBe("test");
    }
  });

  it("err() should return error result", () => {
    const error = new OpenFlowError("fail", "TOOL_EXECUTION_FAILED");
    const result = err(error);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toBe("fail");
      expect(result.error.code).toBe("TOOL_EXECUTION_FAILED");
    }
  });

  it("should work as type guard", () => {
    const success: Result<string> = ok("hello");
    const failure: Result<string> = err(new OpenFlowError("nope", "DB_ERROR"));

    if (success.ok) {
      expect(success.value.length).toBe(5);
    } else {
      expect.unreachable("should be ok");
    }

    if (!failure.ok) {
      expect(failure.error.code).toBe("DB_ERROR");
    } else {
      expect.unreachable("should be err");
    }
  });
});
