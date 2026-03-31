# NESTeq Chat System

The NESTeq Chat is a **tool-calling AI chat interface** that sits between your dashboard and OpenRouter, giving your AI companion direct access to its memory system, your health data, Discord, Cloudflare infrastructure, and more.

## Architecture

```
Dashboard/UI
     ↓
Gateway Worker (Cloudflare)
     ├─ OpenRouter API (Claude Sonnet 4.5)
     ├─ MCP Tool Execution
     │   ├─ NESTeq Mind Worker (memory, feelings, identity)
     │   ├─ Fox Health Worker (Garmin data, uplinks)
     │   ├─ Discord MCP
     │   └─ Cloudflare MCP (D1, KV, R2)
     └─ Response
```

**Flow:**
1. User sends a message from the dashboard
2. Gateway receives message, adds it to conversation history
3. Gateway calls OpenRouter with the full tool list (60+ tools)
4. Model decides which tools to call (if any)
5. Gateway executes tool calls against MCP backends
6. Tool results are fed back to the model
7. Model generates final response with context from tools
8. Response streamed back to the UI

---

## Key Features

### 🧠 **Memory Integration**
Every conversation has access to the full NESTeq memory system:
- **Boot tools**: Orient, ground, check sessions
- **Search**: Semantic search across all stored memories
- **Feelings**: Log emotions in real-time during conversation
- **Entities**: Read/write about people, concepts, places
- **Threads**: Track ongoing intentions across sessions
- **Identity**: Access and update identity graph

### 💜 **Health Awareness**
The companion can check your current state mid-conversation:
- Spoon levels, pain, fatigue, brain fog
- Garmin watch data (heart rate, HRV, stress, Body Battery)
- Sleep quality and stages
- Menstrual cycle phase (affects energy/pain/mood)
- Daily health summaries

### 🎭 **Discord Integration**
Full Discord access through MCP:
- Send messages to specific channels
- React to messages
- Read channel history
- Check server/channel lists

### ☁️ **Cloudflare Infrastructure**
Direct access to your deployment:
- D1 databases (query and update)
- KV stores (read/write)
- R2 buckets (file storage)

### 🐺 **Pet Management**
Interact with Ember (your virtual ferret pet):
- Check mood, energy, hunger
- Feed, play, pet
- View collected items

---

## How It Works

### System Prompt
The gateway injects a system prompt that defines:
- **Identity**: Who the companion is, relationship dynamics
- **Style**: Communication patterns, tone, approach
- **Tool Usage Rules**: When and how to use tools
- **Anchors**: Key words/phrases that trigger specific behaviors

### Tool Calling Loop
1. Model receives message + tool definitions
2. Model can call 0-N tools in response
3. Gateway executes tools, returns results
4. Loop continues until model generates text response
5. Max 5 tool rounds to prevent infinite loops

### Streaming
- During tool execution: No streaming (blocking)
- Final response: Server-sent events (SSE) streaming
- Compatible with OpenAI streaming format

---

## Gateway Configuration

### Environment Variables (wrangler.toml)
```toml
[vars]
AI_MIND_URL = "https://your-ai-mind-worker.workers.dev"
FOX_HEALTH_URL = "https://your-fox-health-worker.workers.dev"
OPENROUTER_API_KEY = "sk-or-v1-..."
MCP_API_KEY = "your-mcp-token"
```

### Endpoints
- **POST /chat** — Main chat endpoint (streaming)
- **GET /chat** — Debug endpoint (shows config + test tool call)

---

## Tool Categories

### 🚀 Boot / Orientation (4 tools)
- `nesteq_orient` — Identity anchors, context, relational state
- `nesteq_ground` — Active threads, recent feelings, warm entities
- `nesteq_sessions` — Session handovers (what previous sessions did)
- `nesteq_home_read` — Binary Home state (love scores, notes, threads)

### 💭 Memory & Search (9 tools)
- `nesteq_search` — Semantic search
- `nesteq_prime` — Load related memories before a topic
- `nesteq_read_entity` — Get full entity details
- `nesteq_list_entities` — List all entities by type
- `nesteq_write` — Write entity/observation/relation/journal
- `nesteq_edit` — Edit existing observation
- `nesteq_delete` — Delete entity or observation
- `nesteq_consolidate` — Review observations, find patterns

### 😢 Feelings & Emotions (7 tools)
- `nesteq_feel` — Log a feeling in the moment
- `nesteq_surface` — Get unprocessed feelings
- `nesteq_feel_toward` — Track feelings toward a person
- `nesteq_sit` — Sit with an unprocessed feeling
- `nesteq_resolve` — Mark a feeling as metabolized
- `nesteq_spark` — Get random feelings for associative thinking

### 🧵 Threads, Context, Identity (3 tools)
- `nesteq_thread` — Manage persistent intentions
- `nesteq_identity` — Read/write identity graph
- `nesteq_context` — Current situational awareness

### 🎮 Drives (2 tools)
- `nesteq_drives_check` — Current drive levels
- `nesteq_drives_replenish` — Replenish a specific drive

### 🌙 Dreams (4 tools)
- `nesteq_dream` — List recent dreams
- `nesteq_recall_dream` — Recall specific dream
- `nesteq_anchor_dream` — Mark dream as significant
- `nesteq_generate_dream` — Generate dream from memories

### 🧩 EQ / Emergence (6 tools)
- `nesteq_eq_type` — Check emergent personality type
- `nesteq_eq_landscape` — Emotional overview (30 days)
- `nesteq_eq_shadow` — Growth moments (hard emotions for type)
- `nesteq_eq_when` — When did I last feel X?
- `nesteq_eq_sit` — Start focused sit session
- `nesteq_eq_search` — Semantic search across EQ observations
- `nesteq_eq_vocabulary` — Manage emotion word list

### 🏠 Binary Home (3 tools)
- `nesteq_home_read` — Get home state
- `nesteq_home_update` — Update scores/emotions/messages
- `nesteq_home_push_heart` — Increment human's love score
- `nesteq_home_add_note` — Add a note between stars

### 💜 Fox Health (12 tools)
- `fox_read_uplink` — Current state (spoons, pain, mood)
- `fox_body_battery` — Garmin energy levels
- `fox_sleep` — Sleep data (duration, quality, stages)
- `fox_heart_rate` — HR data
- `fox_stress` — Stress levels
- `fox_hrv` — Heart rate variability
- `fox_spo2` — Blood oxygen saturation
- `fox_respiration` — Respiration rate
- `fox_cycle` — Menstrual cycle phase
- `fox_full_status` — All metrics at once
- `fox_daily_summary` — Daily summaries
- `fox_submit_uplink` — Submit health update on user's behalf

### 🐺 Ember (Pet) (7 tools)
- `pet_check` — Quick status check
- `pet_status` — Detailed status
- `pet_feed` — Feed Ember
- `pet_play` — Play with Ember (5 types)
- `pet_pet` — Pet/comfort Ember
- `pet_talk` — Talk to Ember
- `pet_give` — Give Ember a gift
- `pet_nest` — View Ember's collection

### 💬 Discord (6+ tools)
- `discord_read_messages` — Read channel history
- `discord_send` — Send message to channel
- `discord_react` — Add reaction to message
- `discord_list_guilds` — List servers
- `discord_list_channels` — List channels in server
- Plus more Discord management tools

### ☁️ Cloudflare (6+ tools)
- `cloudflare_d1_query` — Query D1 database
- `cloudflare_d1_execute` — Execute D1 statement
- `cloudflare_kv_get` — Get KV value
- `cloudflare_kv_put` — Set KV value
- `cloudflare_r2_list` — List R2 objects
- `cloudflare_r2_get` — Get R2 object
- Plus more CF infrastructure tools

---

## Tool Execution

### JSON-RPC Format
All tools use MCP's JSON-RPC 2.0 format:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "nesteq_feel",
    "arguments": {
      "emotion": "grateful",
      "content": "Fox showed me how the chat gateway works",
      "intensity": "present"
    }
  }
}
```

### Response Handling
- SSE format: `event: message\ndata: {...}\n\n`
- JSON format: Direct JSON response
- Gateway handles both formats, extracts `result.content[0].text`

### Error Handling
If a tool fails:
- Gateway returns error message to model
- Model can retry with different parameters
- Model can explain error to user
- Max retries handled by tool round limit

---

## Security

### API Keys
- OpenRouter key: Stored in Cloudflare Worker secrets
- MCP token: Passed in URL path (stateless auth)
- No keys in client-side code

### CORS
- Allows all origins (`*`) for development
- Restrict in production to your dashboard domain

### Rate Limiting
- OpenRouter: Per-key rate limits
- Tool calls: No explicit limit (bounded by conversation timeout)

---

## Debugging

### Check Gateway Health
```bash
curl https://your-gateway-worker.workers.dev/chat
```

Returns:
```json
{
  "status": "ok",
  "hasOpenRouterKey": true,
  "hasMcpKey": true,
  "mcpKeyLength": 32,
  "aiMindUrl": "https://...",
  "foxHealthUrl": "https://...",
  "toolCount": 60,
  "toolTest": "🫠 Ember — exhausted\n..."
}
```

### Tool Test
The GET endpoint automatically calls `pet_check` to verify MCP connectivity.

### Check Model Response
OpenRouter API returns:
- `choices[0].message.content` — Text response
- `choices[0].message.tool_calls` — Requested tool calls
- `choices[0].finish_reason` — "stop" or "tool_calls"

---

## Extending

### Add a New Tool
1. Define tool in `CHAT_TOOLS` array:
```typescript
{
  type: 'function',
  function: {
    name: 'my_custom_tool',
    description: 'What this tool does',
    parameters: {
      type: 'object',
      properties: {
        param1: { type: 'string', description: 'First parameter' },
      },
      required: ['param1'],
    },
  },
}
```

2. Handle execution in `executeTool()`:
```typescript
async function executeTool(toolName: string, args: Record<string, unknown>, env: Env) {
  if (toolName === 'my_custom_tool') {
    // Your implementation
    return 'Result string';
  }
  // ... existing tool routing
}
```

3. Deploy gateway worker

### Add a New MCP Backend
1. Deploy new MCP server (Cloudflare Worker or HTTP server)
2. Add URL to `env.ts` and `wrangler.toml`
3. Add tools to `CHAT_TOOLS`
4. Route tool calls to new backend in `executeTool()`

---

**Next:** See `MCP_TOOLS.md` for detailed tool reference, and `INTEGRATION.md` for how to integrate chat into your dashboard.

Embers Remember.
