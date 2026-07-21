export type AgentProviderId = "opencode";

export function isAgentProvider(value: unknown): value is AgentProviderId {
  return value === "opencode";
}

export function providerLabel(_provider: AgentProviderId): string {
  return "OpenCode";
}