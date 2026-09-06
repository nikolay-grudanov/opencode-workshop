import { describe, expect, test } from "bun:test";
import { escapeSnippetHtml, sanitizeFtsQuery } from "../src/fts";

describe("sanitizeFtsQuery", () => {
  test("wraps tokens as quoted phrase AND clauses", () => {
    expect(sanitizeFtsQuery("connection refused")).toBe('"connection" AND "refused"');
  });

  test("strips FTS5 reserved characters before quoting", () => {
    expect(sanitizeFtsQuery("(open): ^code")).toBe('"open" AND "code"');
  });

  test("drops quote characters inside tokens", () => {
    expect(sanitizeFtsQuery('hello "world"')).toBe('"hello" AND "world"');
  });

  test("returns empty string for whitespace-only input", () => {
    expect(sanitizeFtsQuery("   ")).toBe("");
  });

  test("handles a query where malicious-looking tokens must not break MATCH", () => {
    expect(sanitizeFtsQuery('"); DROP TABLE spans; --')).toBe('";" AND "DROP" AND "TABLE" AND "spans;" AND "--"');
  });
});

describe("escapeSnippetHtml", () => {
  test("escapes XSS payloads that survive FTS5 highlighting", () => {
    expect(escapeSnippetHtml('<img src=x onerror="alert(1)">')).toBe('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
  });

  test("preserves <mark>…</mark> wrappers used by snippet()", () => {
    expect(escapeSnippetHtml("<mark>connection</mark> refused")).toBe("&lt;mark&gt;connection&lt;/mark&gt; refused");
  });

  test("escapes ampersand and quotes", () => {
    expect(escapeSnippetHtml('a & b "c"')).toBe("a &amp; b &quot;c&quot;");
  });
});
