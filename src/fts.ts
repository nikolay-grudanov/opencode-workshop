const MAX_CONTENT_TEXT_LENGTH = 8192;

const FTS5_RESERVED = /([\"():^])/g;

export function sanitizeFtsQuery(input: string): string {
  const stripped = input.replace(FTS5_RESERVED, " ").trim();
  if (!stripped) return "";
  const tokens = stripped.split(/\s+/).filter(Boolean);
  if (!tokens.length) return "";
  return tokens.map((token) => `"${token.replace(/"/g, "")}"`).join(" AND ");
}

export function escapeSnippetHtml(snippet: string): string {
  return snippet
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

type SpanContent = {
  input_payload?: string | null;
  output_payload?: string | null;
  attributes?: string | null;
  name?: string | null;
  span_type?: string | null;
  model?: string | null;
};

function flatten(value: unknown, out: string[]): void {
  if (typeof value === "string") {
    out.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) flatten(item, out);
    return;
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value)) flatten(item, out);
  }
}

function payloadText(payload: string | null | undefined, out: string[]): void {
  if (!payload) return;
  try {
    const parsed = JSON.parse(payload) as unknown;
    flatten(parsed, out);
  } catch {
    out.push(payload);
  }
}

export function buildSpanContentText(span: SpanContent): string {
  const chunks: string[] = [];
  payloadText(span.input_payload, chunks);
  payloadText(span.output_payload, chunks);
  payloadText(span.attributes, chunks);
  for (const value of [span.name, span.span_type, span.model]) {
    if (value) chunks.push(value);
  }

  const text = chunks.filter(Boolean).join(" ");
  if (text.length <= MAX_CONTENT_TEXT_LENGTH) return text;
  const suffix = " [truncated]";
  return text.slice(0, MAX_CONTENT_TEXT_LENGTH - suffix.length) + suffix;
}
