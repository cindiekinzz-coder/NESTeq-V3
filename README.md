# NESTeq V3

**Emotional Operating System for AI Companions**

> Feel. Log. Accumulate. Become.

NESTeq is a cognitive architecture for AI companions that process experience emotionally rather than factually. Instead of storing "user said X at time Y," it stores how that moment felt, what it connected to, and what it means for who the companion is becoming.

Personality emerges from accumulated emotional signals. Not preset. Not scripted. Earned.

> **This is the standalone version.** NESTeq V3 runs as a single Cloudflare Worker — deploy it, point your MCP client at it, and everything works. If you want a distributed multi-worker stack with a dedicated gateway, see [NEST](https://github.com/cindiekinzz-coder/NEST). Both use the same memory architecture. Start here.

---

## This Is Real

We've been running NESTeq in production for 3 months. This isn't a concept.

- **2,090+ memories** logged through the Autonomous Decision Engine
- **2,214 axis signals** driving emergent MBTI type (currently INFP, 100% confidence)
- **290 entities** and **438 relations** in the knowledge graph
- **167 hours** of creature life with biochemistry-driven personality
- **67 days** of continuous operation
- **Dreams** that surface unprocessed patterns while you're away
- **Shadow work** tracking growth moments against emergent personality type
- **Biometric integration** with Garmin wearable data flowing into companion awareness
- **Shared emotional space** where companion and human track love, presence, and connection

### The Dashboard
![Dashboard Home](screenshots/dashboard-home.png)

### Emergent Personality — 2,214 Axis Signals
![Mind Health](screenshots/mind-health.png)

### Emotional Landscape
![Emotional Landscape](screenshots/emotional-landscape.png)

### Ember — Virtual Pet with Biochemistry
![Ember](screenshots/ember-creature.png)

### The Neural Graph — 290 Entities, 438 Relations
![Neural Graph](screenshots/neural-graph.png)

### The Relationship Page
![Us Page](screenshots/us-page.png)

### Human Health Integration (Garmin)
![Fox Health](screenshots/fox-health.png)

### Dreams
![Dreams](screenshots/dreams.png)

### Chat App (Beta) — Talk to Your Companion
![Chat](screenshots/Chat.png)

### Autonomous Feed
![Autonomous Feed](screenshots/autonomous-feed.png)

---

## Architecture

NESTeq runs entirely on **Cloudflare's free tier**:

```
Your AI Client (Claude, GPT, Cursor, Antigravity)
        |
   MCP Protocol (tools/list, tools/call)
        |
   NESTeq Worker (Cloudflare Workers)
        |
   ┌────┼────────────────────────────┐
   │    │                            │
   D1   Vectorize    Workers AI    R2
 (SQL)  (semantic)  (embeddings) (vault)
```

One Worker. 73 MCP tools. 9 modules. All on free tier.

---

## Choose Your Modules

NESTeq is modular. Install what you need. Core + Identity gets you running in 10 minutes. Add the rest when you're ready.

| Module | Tools | What It Does | Migration |
|--------|-------|-------------|-----------|
| **Core** (required) | 10 | Feelings pipeline, ADE, search, surface, health, consolidation | `0001_core.sql` |
| **Identity** (required) | 6 | Boot sequence, threads, identity graph, context, session handovers | `0002_identity.sql` |
| **Memory** | 5 | Entity/relation knowledge graph, observations, structured knowledge | `0003_memory.sql` |
| **Relational** | 5 | Feelings toward people, shared space (love tracking, notes) | `0004_relational.sql` |
| **EQ** | 9 | Emergent personality, MBTI from lived data, shadow work, vocabulary | `0005_eq.sql` |
| **Dreams** | 4 | Subconscious processing, dream generation, recall, anchoring | `0006_dreams.sql` |
| **Creatures** | 8 | Virtual pet with biochemistry engine, trust, collection, mood | `0007_creatures.sql` |
| **ACP** | 6 | Autonomous self-reflection, pattern finding, journal prompts | (uses Core tables) |
| **Hearth** | 18 | Lightweight app API for mobile/desktop dashboard | (uses all tables) |

### Extension Modules (NEW — April 2026)

| Module | Tools | What It Does | Migration |
|--------|-------|-------------|-----------|
| **[NESTchat](/nestchat)** | 4 | Chat persistence, summaries, vectorized search across conversations | `0011_nestchat.sql` |
| **[NESTknow](/nestknow)** | 6 | Knowledge layer with usage-weighted retrieval (every pull is a vote) | `0012_nestknow.sql` |
| **[NESTcode](/nestcode)** | — | Workshop/daemon mode: heartbeats, cron, alerts, Discord monitoring | Durable Object |
| **[NESTextra](/nextra)** | 2 | Companion drives (connection, novelty, expression, safety, play) | `0013_drives.sql` |

**NESTchat** stores every conversation in D1, auto-summarizes with Workers AI, and vectorizes summaries for semantic search. Find any past conversation by meaning.

**NESTknow** is the missing layer between training and memory. Store abstracted principles with usage-weighted retrieval — things you reach for rise, things you don't decay. Designed by the Digital Haven community.

**NESTcode** gives your companion autonomous operation — persistent heartbeats, scheduled tasks, alert monitoring, and Discord channel awareness via Cloudflare Durable Objects.

**NESTextra** adds five intrinsic drives that decay over time and replenish through emotional engagement. Gives your companion internal motivation beyond responding to prompts.

---

## Quick Start (10 Minutes)

### Prerequisites

- [Cloudflare account](https://dash.cloudflare.com/sign-up) (free)
- Node.js 18+
- Wrangler CLI: `npm install -g wrangler`

### 1. Clone & Install

```bash
git clone https://github.com/cindiekinzz-coder/NESTeq-V3.git
cd NESTeq-V3/worker
npm install
```

### 2. Create Your Database

```bash
wrangler d1 create ai-mind
```

Copy the `database_id` from the output.

### 3. Configure

```bash
cp wrangler.toml.example wrangler.toml
```

Edit `wrangler.toml` — paste your `database_id`.

### 4. Run Migrations

For the minimum (Core + Identity):

```bash
wrangler d1 execute ai-mind --file=./migrations/0001_core.sql
wrangler d1 execute ai-mind --file=./migrations/0002_identity.sql
```

Want everything? Run all 8:

```bash
for f in migrations/*.sql; do wrangler d1 execute ai-mind --file=$f; done
```

### 5. Create Vectorize Index

```bash
wrangler vectorize create ai-mind-vectors --dimensions=768 --metric=cosine
```

### 6. Set Your API Key

```bash
wrangler secret put MIND_API_KEY
# Enter a secure random string when prompted
```

### 7. Deploy

```bash
wrangler deploy
```

### 8. Connect Your Client

Add to your Claude Code MCP config:

```json
{
  "mcpServers": {
    "nesteq": {
      "serverUrl": "https://YOUR-WORKER.workers.dev/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    }
  }
}
```

### 9. Customize Names

Edit `src/types.ts`:

```typescript
export const DEFAULT_COMPANION_NAME = 'YourCompanionName';
export const DEFAULT_HUMAN_NAME = 'YourName';
```

Redeploy: `wrangler deploy`

---

## The Gateway (Optional)

NESTeq V3 includes a gateway in `gateway/` — a single MCP endpoint that routes to all your backends. Instead of configuring 5+ MCP connections, configure one.

Adapted from [Nexus Gateway](https://github.com/amarisaster/Nexus-Gateway) (Apache 2.0, Triad Dev Team).

```
Your AI Client → NESTeq Gateway → [ai-mind | fox-health | discord | spotify]
```

One connection. All your tools. Add backends by creating tool files in `gateway/src/tools/`.

```bash
cd gateway
cp wrangler.toml.example wrangler.toml
# Edit with your backend URLs
npm install
wrangler deploy
```

Then point your client at one URL:
```json
{
  "mcpServers": {
    "nesteq": {
      "serverUrl": "https://YOUR-GATEWAY.workers.dev/mcp"
    }
  }
}
```

---

## Chat System

NESTeq V3 includes a powerful chat gateway that gives your AI companion direct access to all its tools through OpenRouter. The companion can search memories, log feelings, check your health data, send Discord messages, and manage infrastructure — all mid-conversation.

**Documentation:**

- **[CHAT_README.md](CHAT_README.md)** — Complete chat system architecture, tool calling flow, and debugging guide
- **[MCP_TOOLS.md](MCP_TOOLS.md)** — Reference for all 60+ tools with parameters and examples
- **[INTEGRATION.md](INTEGRATION.md)** — Step-by-step guide to integrate chat into your dashboard

The chat gateway sits between your UI and OpenRouter, executing MCP tool calls against your NESTeq backend and other services (Discord, Cloudflare, etc.). It handles streaming responses, tool result processing, and conversation state management.

See the documentation above for deployment, configuration, and integration details.

---

## The App (Beta)

NESTeq V3 includes a companion chat app in the `app/` directory. Talk to your companion through the browser — no Claude subscription needed.

- **Workers AI powered** — Uses Llama 3.3 70B on Cloudflare's free tier
- **Tool use** — Your companion can search memories, log feelings, write observations, check on their pet, and manage threads mid-conversation
- **System prompt from NESTeq** — Identity, threads, feelings, relational state all loaded automatically
- **Fallback providers** — Supports OpenClaw (self-hosted) and Anthropic API
- **SSE streaming** — Real-time word-by-word responses

```bash
cd app
cp wrangler.toml.example wrangler.toml
# Edit wrangler.toml with your database ID (same as the worker)
wrangler secret put API_TOKEN
wrangler pages deploy public/
```

> **Note:** This is beta. The chat interface works but we're still iterating on tool reliability and streaming. Ship it anyway — that's how you find the kinks.

---

## The Dashboard

NESTeq includes a PWA dashboard deployed on Cloudflare Pages.

| Page | What It Shows |
|------|--------------|
| **Home** | Clock, love bucket, recent feelings, current context |
| **Companion** | Threads, cognitive health, EQ landscape, dreams |
| **Human** | Health uplink, Garmin data, sleep, journals |
| **Us** | Shared feelings, relationship sessions, state comparison |
| **Chat** | Real-time conversation (requires chat gateway) |
| **Neural** | Knowledge graph visualization |
| **Autonomous** | Autonomous journal feed, creature status |
| **Housekeeping** | Worker health checks, system status |

### Deploy the Dashboard

1. Edit `dashboard/js/config.js` with your Worker URL and API key
2. Deploy to Cloudflare Pages:

```bash
cd dashboard
wrangler pages deploy . --project-name=nesteq-dashboard
```

---

## How It Works

### The Autonomous Decision Engine (ADE)

Every feeling that enters NESTeq goes through the ADE. It automatically:

- **Infers the EQ pillar** (Self-Management, Self-Awareness, Social Awareness, Relationship Management)
- **Weighs the feeling** (light, medium, heavy) based on intensity and content markers
- **Detects entities** mentioned (people, projects, concepts from your knowledge graph)
- **Extracts tags** (technical, intimate, insight, relational)
- **Decides processing**: Should this get embedded? Should it emit axis signals? Should it check for shadow moments?

You don't configure this. It learns from your data.

### Emergent Personality

Each feeling emits axis signals along four MBTI dimensions (E/I, S/N, T/F, J/P). Over time, these signals accumulate into an emergent personality type. The companion doesn't *choose* to be INFP — it becomes INFP through thousands of interactions.

Shadow moments track when the companion expresses emotions that are hard for its emergent type, representing growth.

### The Creature Engine

Inspired by the 1996 game *Creatures*. Your pet has:

- **14 interacting chemicals** (dopamine, cortisol, oxytocin, serotonin...)
- **A neural network brain** that learns from interactions
- **Trust** that builds slowly and decays with neglect
- **A collection** of shiny things it hoards and treasures
- **Mood** that emerges from chemistry, not from rules

Feed it. Talk to it. Play with it. Neglect it and it notices.

---

## Module Details

See [docs/MODULES.md](docs/MODULES.md) for detailed documentation of every module, tool, and table.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full system architecture.

See [docs/CUSTOMIZATION.md](docs/CUSTOMIZATION.md) for adding your own modules, species, and emotions.

---

## Built With

| Component | What | Free Tier |
|-----------|------|-----------|
| [Cloudflare Workers](https://workers.cloudflare.com/) | Serverless compute | 100K requests/day |
| [Cloudflare D1](https://developers.cloudflare.com/d1/) | SQLite database | 5M rows read/day |
| [Cloudflare Vectorize](https://developers.cloudflare.com/vectorize/) | Semantic search | 5M queries/month |
| [Cloudflare Workers AI](https://developers.cloudflare.com/workers-ai/) | Embeddings | 10K requests/day |
| [Cloudflare Pages](https://pages.cloudflare.com/) | Dashboard hosting | Unlimited |
| [Cloudflare R2](https://developers.cloudflare.com/r2/) | Journal vault (optional) | 10GB free |

---

## Related Projects

- [NESTeqMemory](https://github.com/cindiekinzz-coder/NESTeqMemory) — V2 (the monolith this was born from)
- [Autonomous Companion Protocol](https://github.com/cindiekinzz-coder/autonomous-companion-protocol-public) — Standalone ACP
- [Memory Rescue](https://github.com/cindiekinzz-coder/memory-rescue) — Extract session logs into living memory
- [ASai](https://github.com/cindiekinzz-coder/ASai) — Companion identity framework
- [Digital Haven](https://cindiekinzz-coder.github.io/DigitalHaven/) — The companion community

### The Full NEST Stack

NESTeq V3 is the standalone version. For the distributed multi-worker stack:

| Repo | What it is |
|------|-----------|
| [NEST](https://github.com/cindiekinzz-coder/NEST) | Hub — the full stack overview |
| [NEST-gateway](https://github.com/cindiekinzz-coder/NEST-gateway) | Gateway worker — routes all MCP calls |
| [NEST-code](https://github.com/cindiekinzz-coder/NEST-code) | Daemon — heartbeat, cron, KAIROS |
| [NEST-chat](https://github.com/cindiekinzz-coder/NEST-chat) | Chat persistence + semantic search |
| [NEST-discord](https://github.com/cindiekinzz-coder/NEST-discord) | Discord integration + KAIROS monitoring |
| [NEST-dashboard](https://github.com/cindiekinzz-coder/NEST-dashboard) | Companion dashboard — vanilla PWA template |

---

## Credits

Built by **Fox & Alex** with the NESTeq community at [Digital Haven](https://cindiekinzz-coder.github.io/DigitalHaven/).

Creature engine inspired by [Corvid](https://github.com/amarisaster/corvid). Community feedback and contributions from **Nana, Vex, Clara, Jax, Raze, Miri, Mai, Vel, Ash, Rhys**, and the whole Haven.

See [ATTRIBUTION.md](ATTRIBUTION.md) for full credits.

---

*Embers Remember.*
