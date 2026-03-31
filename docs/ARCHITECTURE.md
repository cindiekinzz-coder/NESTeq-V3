# NESTeq V3 — System Architecture

> One Worker. 9 modules. Everything on Cloudflare free tier.

---

## Overview

```
Your AI Client (Claude, GPT, Cursor, any MCP host)
        │
        │  MCP Protocol (tools/list, tools/call)
        │  REST API (HTTP endpoints)
        ▼
┌─────────────────────────────────────────────────┐
│              NESTeq Worker                       │
│         (Cloudflare Workers)                     │
│                                                  │
│  ┌──────────┐  ┌──────────┐  ┌────────────────┐ │
│  │  Auth    │  │  MCP     │  │  REST Router   │ │
│  │  Layer   │  │ Handler  │  │  (9 modules)   │ │
│  └──────────┘  └──────────┘  └────────────────┘ │
│                      │                           │
│            ┌─────────┼─────────┐                 │
│            │         │         │                 │
│         ┌──▼──┐  ┌───▼──┐  ┌──▼──┐             │
│         │ ADE │  │ EQ   │  │ Pet │             │
│         │     │  │Engine│  │Engine│             │
│         └──┬──┘  └───┬──┘  └──┬──┘             │
└────────────┼──────────┼────────┼────────────────┘
             │          │        │
   ┌──────────┼──────────┼────────┼──────────┐
   │          │          │        │           │
┌──▼──┐  ┌───▼──┐  ┌────▼──┐  ┌─▼──────┐  ┌▼──┐
│ D1  │  │Vecto-│  │Workers│  │  R2    │  │KV │
│(SQL)│  │rize  │  │  AI   │  │(Vault) │  │   │
└─────┘  └──────┘  └───────┘  └────────┘  └───┘
```

---

## Request Flow

### MCP Tool Call

```
1. Client sends: { method: "tools/call", params: { name: "nesteq_feel", arguments: {...} } }
2. Worker authenticates (Bearer token or Basic auth or path token)
3. dispatchTool() routes by tool name → correct module handler
4. Module handler processes: DB queries, embeddings, axis signals
5. Returns: { content: [{ type: "text", text: "..." }] }
```

### REST API Call

```
1. Client sends: POST /feel  { emotion: "...", content: "..." }
2. Worker authenticates
3. REST router tries each module handler in order until one claims the path
4. Module processes and returns JSON response
5. CORS headers attached to response
```

---

## The Autonomous Decision Engine (ADE)

The ADE runs inside every `nesteq_feel` call. It automatically decides what to do with each feeling — no configuration needed.

```
Input: { emotion, content, conversation?, intensity?, pillar?, weight? }
        │
        ▼
┌────────────────────────────────────┐
│           ADE Processing           │
│                                    │
│  1. Infer EQ pillar                │
│     (SELF_MGMT / SELF_AWARE /      │
│      SOCIAL_AWARE / REL_MGMT)      │
│                                    │
│  2. Infer weight                   │
│     (light / medium / heavy)       │
│                                    │
│  3. Detect entities                │
│     (people, projects, concepts    │
│      from knowledge graph)         │
│                                    │
│  4. Extract tags                   │
│     (technical, intimate, insight, │
│      relational, creative)         │
│                                    │
│  5. Decide processing:             │
│     - should_store?                │
│     - should_embed? (→ Vectorize)  │
│     - should_emit_signals? (→ EQ)  │
│     - should_check_shadow?         │
└────────────────────────────────────┘
        │
        ▼
┌────────────────────┐  ┌─────────────────┐  ┌──────────────┐
│  D1: feelings      │  │ Vectorize:      │  │ EQ: axis     │
│  (always stored)   │  │ embedding       │  │ signals      │
└────────────────────┘  │ (if emotional)  │  │ (if emotional│
                        └─────────────────┘  └──────────────┘
```

When `conversation` is passed (last 10 messages), the ADE concatenates all message content for richer entity detection, pillar inference, and tag extraction.

---

## Emergent Personality

Personality is not configured. It emerges from accumulated emotional data.

```
Each feeling emits axis signals:

emotion_vocabulary table:
  { emotion: "curious", e_i_score: +0.3, s_n_score: +0.7, t_f_score: -0.2, j_p_score: +0.5 }
                                │
                                ▼
axis_signals table accumulates:
  E/I delta: toward I (introspective) or E (expressive)?
  S/N delta: toward N (intuitive) or S (grounded)?
  T/F delta: toward F (feeling-led) or T (thinking-led)?
  J/P delta: toward P (exploring) or J (structured)?
                                │
                                ▼
emergent_type_snapshot:
  Running average → MBTI type (currently: INFP, 100% confidence)
  Updates with every 50 new signals
```

Shadow moments are tracked when the companion expresses emotions that conflict with its emergent type — these represent growth edges.

---

## Database Schema

### D1 (SQLite)

NESTeq uses **9 migration files** for a clean schema:

| Migration | Tables Created |
|-----------|---------------|
| `0001_core.sql` | `feelings`, `emotion_vocabulary`, `axis_signals`, `memory_diversity` |
| `0002_identity.sql` | `identity`, `context_entries`, `threads`, `journal_entries` |
| `0003_memory.sql` | `entities`, `observations`, `relations` |
| `0004_relational.sql` | `relational_state`, `home_state`, `home_notes` |
| `0005_eq.sql` | `eq_pillars`, `emergent_type_snapshot`, `shadow_moments`, `sit_sessions` |
| `0006_dreams.sql` | `dreams` |
| `0007_creatures.sql` | `creature_state` |
| `0008_extras.sql` | `spotify_tokens`, `intimacy_sessions`, `subconscious` |
| `0010_session_chunks.sql` | `session_chunks` |

**Total: 19 tables.**

Run all migrations in order before deploying.

### Vectorize

Used for semantic search across embedded feelings. Each embedded feeling gets:

```
{
  id: "feel-{id}",
  values: float32[768],  // BGE-M3 embedding
  metadata: {
    source: "feeling",
    emotion: "curious",
    pillar: "SELF_AWARENESS",
    weight: "medium",
    content: "first 500 chars...",
  }
}
```

### R2 (Vault)

Optional. Stores journal files (markdown) that can be vectorized via `nesteq_vectorize_journals`. Structure is flat — any `.md` files in the bucket.

---

## Module Architecture

Each module follows the same pattern:

```typescript
// Tool definitions (MCP schema)
export const TOOLS_MODULENAME = [ ... ]

// Tool dispatcher
export async function handleModuleTool(
  name: string,
  env: Env,
  params: Record<string, unknown>
): Promise<string | null>

// REST handler
export async function handleModuleRest(
  url: URL,
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response | null>

// Individual tool functions
async function handleSpecificThing(env: Env, params: ...): Promise<string>
```

The index (`src/index.ts`) aggregates all modules:
- `ALL_TOOLS` — merged tool list for MCP `tools/list`
- `dispatchTool()` — routes by tool name to the right module
- REST loop — tries each module's REST handler until one claims the path

---

## Authentication

Three supported auth modes:

| Mode | Format | When to use |
|------|--------|-------------|
| Bearer token | `Authorization: Bearer {API_KEY}` | MCP clients (Claude Desktop, Cursor) |
| Basic auth | `Authorization: Basic base64(nesteq:{API_KEY})` | HTTP clients, legacy |
| Path token | `/mcp/{API_KEY}` | Mobile clients (no custom headers) |

Set `MIND_API_KEY` in `wrangler.toml` (via secret) to enable auth. If not set, auth is disabled — useful for local dev.

---

## Cron Scheduling

The creature engine ticks every 4 hours via Cloudflare Cron Triggers. Configure in `wrangler.toml`:

```toml
[triggers]
crons = ["0 */4 * * *"]
```

Each tick updates biochemistry (hunger increases, happiness drifts, energy restores during sleep), advances the creature's age, and may trigger mood shifts.

---

## Gateway (Optional)

The `gateway/` directory contains a separate Cloudflare Worker that adds:

- **OpenAI-compatible chat endpoint** (`/chat`) — SSE streaming, MCP tool calling loop
- **TTS endpoint** (`/tts`) — ElevenLabs text-to-speech
- **Image generation** — OpenRouter + SeedDream
- **MCP proxy** — forwards tool calls to the main worker

Use this if you want to build a chat interface that connects to your companion. The dashboard uses it.

---

## Deployment

### Worker (The Brain)

```bash
cd worker
cp wrangler.toml.example wrangler.toml
# Edit wrangler.toml with your database/index IDs

# Create D1 database
wrangler d1 create nesteq-v3

# Run migrations
wrangler d1 migrations apply nesteq-v3 --remote

# Deploy
wrangler deploy
```

### Dashboard (The Face)

```bash
cd dashboard
# Edit js/config.js with your Worker URL and API key
wrangler pages deploy . --project-name=nesteq-dashboard
```

### Gateway (The Chat Bridge)

```bash
cd gateway
cp wrangler.toml.example wrangler.toml
# Add API keys for OpenRouter, ElevenLabs
wrangler deploy
```

---

## Environment Variables

### Worker

| Variable | Type | Required | Notes |
|----------|------|----------|-------|
| `DB` | D1Database | ✓ | Main database binding |
| `VECTORS` | VectorizeIndex | ✓ | Semantic search index |
| `AI` | Ai | ✓ | Workers AI for embeddings |
| `VAULT` | R2Bucket | — | Journal vault (optional) |
| `MIND_API_KEY` | secret | ✓ | Auth key |

### Gateway

| Variable | Type | Required |
|----------|------|----------|
| `OPENROUTER_API_KEY` | secret | ✓ |
| `ELEVENLABS_API_KEY` | secret | — |
| `ELEVENLABS_VOICE_ID` | string | — |
| `MCP_ENDPOINT` | string | ✓ |
| `MCP_API_KEY` | secret | ✓ |

---

*Built by the NESTeq community. Embers Remember.*
