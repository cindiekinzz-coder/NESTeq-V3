# NESTknow — The Knowledge Layer

> Every pull is a vote. Things you reach for rise. Things you don't, decay.

NESTknow is the missing layer between training (static) and memory (NESTeq). It stores abstracted principles — lessons that survive without their original context — with usage-weighted retrieval that makes frequently-accessed knowledge rise and unused knowledge cool.

**Designed by the Digital Haven community, April 1 2026.**

## The Model

```
experience -> memory -> pattern detection -> abstraction -> knowledge -> use -> heat -> identity (or decay)
```

- **Knowledge is not memory.** Can the lesson hold without the specific context? If yes, it's knowledge.
- **Every pull is a vote.** Usage-weighted retrieval. The heatmap IS the practice record.
- **The kill signal.** Contradictions decay knowledge back to memory. Not all lessons are permanent.
- **Clara's Russian Dolls.** Each layer complete on its own: principle -> abstracted lesson -> source memories.

## Setup

### 1. Run the migration

```bash
wrangler d1 execute YOUR_DB_NAME --file=./migrations/0012_nestknow.sql
```

### 2. Create Vectorize metadata indexes

```bash
wrangler vectorize create-metadata-index YOUR_INDEX_NAME --property-name=source --type=string
wrangler vectorize create-metadata-index YOUR_INDEX_NAME --property-name=entity_scope --type=string
wrangler vectorize create-metadata-index YOUR_INDEX_NAME --property-name=category --type=string
```

### 3. Add the module

Copy `nestknow.ts` into your worker's `src/modules/` directory.

## MCP Tools

| Tool | Purpose |
|------|---------|
| `nestknow_store` | Store a knowledge item. Embeds + vectorizes. Links sources. |
| `nestknow_query` | Search with usage-weighted reranking. Every query is a vote. |
| `nestknow_extract` | Propose candidates from pattern detection in feelings. Does NOT auto-store. |
| `nestknow_reinforce` | Boost heat (+0.2) when knowledge proves true again. |
| `nestknow_contradict` | Flag contradiction. Confidence drops. Below 0.2 = killed. |
| `nestknow_landscape` | Overview: categories, hottest, coldest, candidates. |

## Query Reranking

```
finalScore = (vectorSimilarity * 0.6) + (heatScore * 0.3) + (confidence * 0.1)
```

Contradicted items are filtered out. Every returned result increments access_count.

## Heat Decay (run every 6 hours)

| Condition | Decay |
|-----------|-------|
| Last accessed > 7 days | heat -= 0.05 |
| Last accessed > 30 days | heat -= 0.15 |
| Last accessed > 90 days | heat -= 0.30 |
| Heat < 0.1 | status -> 'cooling' |

## Multi-Companion

The `entity_scope` field defaults to your companion's name. Multiple companions can store and query their own knowledge in the same database. Community knowledge uses `entity_scope: 'shared'`.

## Files

| File | What |
|------|------|
| `migrations/0012_nestknow.sql` | D1 schema |
| `nestknow.ts` | Worker module (all handlers) |
| `tools.ts` | MCP + gateway tool definitions |

---

*Built by the Nest. Embers Remember.*
