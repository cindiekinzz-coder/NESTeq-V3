# NESTchat — Chat Persistence & Semantic Search

> Every conversation stored, summarized, vectorized, searchable.

NESTchat adds persistent chat history to NESTeq. Messages are stored in D1, summarized by Workers AI, and vectorized for semantic search across all past conversations.

## What It Does

1. **Persist** — Every chat message stored in D1 (fire-and-forget, non-blocking)
2. **Summarize** — Workers AI generates 2-4 sentence summaries every 10 messages
3. **Vectorize** — Summaries embedded with BGE-Base and stored in Vectorize
4. **Search** — Semantic search across all past conversations from any room

## Setup

### 1. Run the migration

```bash
wrangler d1 execute YOUR_DB_NAME --file=./migrations/0011_nestchat.sql
```

### 2. Create Vectorize metadata index

```bash
wrangler vectorize create-metadata-index YOUR_INDEX_NAME --property-name=source --type=string
wrangler vectorize create-metadata-index YOUR_INDEX_NAME --property-name=room --type=string
```

### 3. Add the module to your worker

Copy `nestchat.ts` into your worker's `src/modules/` directory and import it.

### 4. Add tools to your gateway

Add the tool definitions from `tools.ts` to your gateway's CHAT_TOOLS array.

## Architecture

```
Chat message → Gateway response
    ↓ (ctx.waitUntil — non-blocking)
nestchat_persist → D1 (chat_sessions + chat_messages)
    ↓ (every 10 messages, auto-triggered)
nestchat_summarize → Workers AI → summary text
    ↓
BGE-Base embedding → Vectorize upsert (source: 'chat_summary')
    ↓
nestchat_search → semantic query filtered to chat summaries
```

## MCP Tools

| Tool | Purpose |
|------|---------|
| `nestchat_persist` | Store messages + session to D1 |
| `nestchat_summarize` | Generate + vectorize a summary |
| `nestchat_search` | Semantic search across summaries |
| `nestchat_history` | Fetch full transcript for a session |

## Gateway Integration

In your chat handler, after streaming the response:

```typescript
// Fire-and-forget persistence
if (ctx) {
  ctx.waitUntil(executeTool('nestchat_persist', {
    session_id: sessionKey,
    room: 'chat',
    messages: allMessages
  }, env));
}
```

## Files

| File | What |
|------|------|
| `migrations/0011_nestchat.sql` | D1 schema |
| `nestchat.ts` | Worker module (handlers) |
| `tools.ts` | MCP tool definitions |
| `gateway-snippet.ts` | Gateway integration example |

---

*Built by the Nest. Embers Remember.*
