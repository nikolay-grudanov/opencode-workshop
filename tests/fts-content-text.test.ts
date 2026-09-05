import { describe, expect, test } from "bun:test";
import { buildSpanContentText } from "../src/fts";

describe("buildSpanContentText", () => {
  test("combines plain payloads and scalar fields", () => {
    expect(buildSpanContentText({ input_payload: "GET /v1/models", output_payload: "200 OK", attributes: '{"provider":"local","attempt":2}' })).toContain("GET /v1/models");
    expect(buildSpanContentText({ input_payload: "GET /v1/models", output_payload: "200 OK", attributes: '{"provider":"local","attempt":2}' })).toContain("200 OK");
    expect(buildSpanContentText({ input_payload: "GET /v1/models", output_payload: "200 OK", attributes: '{"provider":"local","attempt":2}' })).toContain("local");
  });

  test("extracts text from nested message content", () => {
    const payload = JSON.stringify({ messages: [{ role: "user", content: "Find connection refused" }, { role: "assistant", content: [{ type: "text", text: "I found it" }] }] });
    const text = buildSpanContentText({ input_payload: payload });
    expect(text).toContain("Find connection refused");
    expect(text).toContain("I found it");
  });

  test("caps output at 8KB", () => {
    const text = buildSpanContentText({ input_payload: "x".repeat(9000) });
    expect(text.length).toBeLessThanOrEqual(8192);
    expect(text).toContain("[truncated]");
  });

  test("ignores malformed JSON without throwing", () => {
    expect(() => buildSpanContentText({ attributes: "{" })).not.toThrow();
  });

  test("returns empty text for empty span", () => {
    expect(buildSpanContentText({})).toBe("");
  });
});
