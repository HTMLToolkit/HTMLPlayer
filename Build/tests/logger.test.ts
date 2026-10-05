import { describeError } from "../src/helpers/logger";
import { describe, it, expect } from "@jest/globals";

describe("describeError", () => {
  it("returns the stack of a normal error", () => {
    const error = new Error("boom");
    expect(describeError(error)).toBe(error.stack);
  });

  it("prefixes name and message when the stack omits them", () => {
    const frames = ["parse@https://app/main.js", "rr@https://app/main.js"];
    const error = new Error("Could not determine file type");
    error.stack = frames.join("\n");
    expect(describeError(error)).toBe(
      `Error: Could not determine file type\n${frames.join("\n")}`,
    );
  });

  it("does not repeat the header when the stack already carries it", () => {
    const error = new Error("boom");
    expect(describeError(error).match(/Error: boom/g)).toHaveLength(1);
  });

  it("falls back to name and message when the error has no stack", () => {
    const error = new Error("boom");
    error.stack = undefined;
    expect(describeError(error)).toBe("Error: boom");
  });

  it("keeps the error name when the message is empty", () => {
    const error = new Error("");
    error.stack = undefined;
    expect(describeError(error)).toBe("Error");
  });

  it("describes an ErrorEvent style failure that carries no message", () => {
    const event = { type: "error", target: null };

    expect(describeError(event)).toBe('{"type":"error","target":null}');
  });

  it("returns a thrown string unchanged", () => {
    expect(describeError("plain failure")).toBe("plain failure");
  });

  it("serializes a thrown plain object", () => {
    expect(describeError({ code: 7, reason: "bad" })).toBe(
      '{"code":7,"reason":"bad"}',
    );
  });

  it("renders an empty object as something other than a bare type name", () => {
    expect(describeError({})).toBe("[object Object]");
  });

  it("survives a circular thrown value", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    expect(describeError(circular)).toBe("[object Object]");
  });

  it("describes null and undefined", () => {
    expect(describeError(null)).toBe("null");
    expect(describeError(undefined)).toBe("undefined");
  });
});