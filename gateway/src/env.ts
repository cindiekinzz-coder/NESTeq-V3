export interface Env {
  MCP_OBJECT: DurableObjectNamespace

  // Backend URLs (set in wrangler.toml [vars])
  AI_MIND_URL: string
  FOX_HEALTH_URL: string
  DISCORD_URL: string
  SPOTIFY_URL: string

  // Secrets (set with wrangler secret put)
  MCP_API_KEY: string
  OPENROUTER_API_KEY: string
}
