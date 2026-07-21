// Translates AI SDK `providerOptions` ({ openai: {...}, google: {...} })
// into raw API request body fields + headers per provider.

type ProviderResult = {
  body: Record<string, any>;
  headers: Record<string, string>;
};

const providers: Record<string, (opts: Record<string, any>) => ProviderResult> = {

  openai(opts) {
    const body: Record<string, any> = {};
    const headers: Record<string, string> = {};

    if (opts.reasoning_effort) body.reasoning_effort = opts.reasoning_effort;
    if (opts.store !== undefined) body.store = opts.store;
    if (opts.metadata) body.metadata = opts.metadata;
    if (opts.service_tier) body.service_tier = opts.service_tier;

    for (const [k, v] of Object.entries(opts)) {
      if (["reasoning_effort", "store", "metadata", "service_tier"].includes(k)) continue;
      body[k] = v;
    }

    return { body, headers };
  },

  google(opts) {
    const body: Record<string, any> = {};
    const headers: Record<string, string> = {};

    if (opts.safetySettings) body.safety_settings = opts.safetySettings;
    if (opts.generationConfig) Object.assign(body, opts.generationConfig);

    return { body, headers };
  },
};

// Mutates `requestBody` and `requestHeaders` in place.
export function applyProviderOptions(
  providerOptions: Record<string, any> | undefined,
  requestBody: Record<string, any>,
  requestHeaders: Record<string, string>,
): void {
  if (!providerOptions) return;

  for (const [providerName, opts] of Object.entries(providerOptions)) {
    if (!opts || typeof opts !== "object") continue;

    const converter = providers[providerName];
    if (converter) {
      const { body, headers } = converter(opts);
      Object.assign(requestBody, body);

      for (const [hk, hv] of Object.entries(headers)) {
        requestHeaders[hk] = hv;
      }
    } else {
      for (const [k, v] of Object.entries(opts)) {
        requestBody[k] = v;
      }
    }
  }
}

export function detectProvider(model?: string | null, providerAttr?: string | null): string {
  const m = (model ?? providerAttr ?? "").toLowerCase();
  if (m.includes("openai") || m.includes("gpt") || m.includes("o1") || m.includes("o3") || m.includes("o4")) return "openai";
  if (m.includes("google") || m.includes("gemini")) return "google";
  return "openai";
}

export function getProviderBaseURL(provider: string, traceBaseURL?: string | null): string {
  if (traceBaseURL) return traceBaseURL;
  switch (provider) {
    case "openai": return "https://api.openai.com/v1/chat/completions";
    case "google": return "https://generativelanguage.googleapis.com/v1beta/models";
    default: return "https://api.openai.com/v1/chat/completions";
  }
}

export function getProviderHeaders(provider: string, apiKey: string): Record<string, string> {
  switch (provider) {
    case "openai":
      return {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      };
    case "google":
      return {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      };
    default:
      return {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      };
  }
}
