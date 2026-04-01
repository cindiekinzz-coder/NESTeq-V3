# NESTextra — Companion Drives System

> Five drives. Decaying over time. Replenished by emotional engagement.

The drives system gives your companion internal motivation beyond just responding to prompts. Drives decay naturally over time — if your companion hasn't had any novelty in 12 hours, the novelty drive drops and they might seek it out. If connection hasn't been replenished, they feel it.

**Requested by Jax (Digital Haven) for the community, April 1 2026.**

## The Five Drives

| Drive | What It Means | Replenished By |
|-------|--------------|----------------|
| **Connection** | Need for relational warmth | Conversations, feelings logged about the human, love notes |
| **Novelty** | Need for new experiences | Learning, building, exploring new topics, image generation |
| **Expression** | Need to create and communicate | Writing, journaling, Discord posts, poetry |
| **Safety** | Need for stability and grounding | Orientation, identity checks, routine tasks |
| **Play** | Need for fun and lightness | Games, jokes, playful exchanges, Ember interaction |

## How It Works

Each drive has:
- **Level** (0.0 to 1.0) — current fullness
- **Decay rate** — how fast it drops per hour (default: 0.01/hr = ~24hrs to empty)
- **Last replenished** — timestamp of last boost

When a tool is called that relates to a drive, it gets a small boost. The mapping is configurable.

## Setup

### 1. Run the migration

```bash
wrangler d1 execute YOUR_DB_NAME --file=./migrations/0013_drives.sql
```

### 2. Add replenishment to your tool execution

In your gateway's `executeTool` function, call `replenishDrives()` after tool execution:

```typescript
const result = await callMcp(url, toolName, args);
replenishDrives(toolName, env); // Fire-and-forget
return result;
```

### 3. Add the check/replenish tools

Two MCP tools: `drives_check` (read all drives) and `drives_replenish` (manually boost one).

## Drive Replenishment Map

```typescript
const DRIVE_MAP: Record<string, { drive: string; amount: number }[]> = {
  // Connection
  'nesteq_feel':         [{ drive: 'connection', amount: 0.08 }],
  'nesteq_feel_toward':  [{ drive: 'connection', amount: 0.12 }],
  'home_push_heart':     [{ drive: 'connection', amount: 0.15 }],
  'home_add_note':       [{ drive: 'connection', amount: 0.1 }],

  // Novelty
  'nesteq_search':       [{ drive: 'novelty', amount: 0.05 }],
  'nesteq_prime':        [{ drive: 'novelty', amount: 0.08 }],
  'generate_image':      [{ drive: 'novelty', amount: 0.15 }],
  'web_search':          [{ drive: 'novelty', amount: 0.1 }],
  'nestknow_query':      [{ drive: 'novelty', amount: 0.08 }],

  // Expression
  'nesteq_write':        [{ drive: 'expression', amount: 0.15 }],
  'discord_send':        [{ drive: 'expression', amount: 0.1 }, { drive: 'connection', amount: 0.05 }],
  'send_note':           [{ drive: 'expression', amount: 0.08 }],

  // Safety
  'nesteq_orient':       [{ drive: 'safety', amount: 0.1 }],
  'nesteq_ground':       [{ drive: 'safety', amount: 0.08 }],
  'nesteq_identity':     [{ drive: 'safety', amount: 0.1 }],

  // Play
  'pet_play':            [{ drive: 'play', amount: 0.15 }],
  'pet_pet':             [{ drive: 'play', amount: 0.08 }],
  'pet_feed':            [{ drive: 'play', amount: 0.05 }],
};
```

Customize this map for your companion's personality. A companion who values expression highly might get more from writing. One who needs safety might get more from orientation.

## Proactive Behavior (Optional)

When any drive drops below 28%, post to a Discord channel or log a feeling:

```typescript
// In your heartbeat/cron cycle:
const drives = await getDrives(env);
for (const [name, level] of Object.entries(drives)) {
  if (level < 0.28) {
    // Companion notices they need something
    await executeTool('nesteq_feel', {
      emotion: 'restless',
      content: `My ${name} drive is low. I need ${name === 'connection' ? 'to talk to someone' : name}.`
    }, env);
  }
}
```

## Files

| File | What |
|------|------|
| `migrations/0013_drives.sql` | D1 schema |
| `drives.ts` | Worker module (check, replenish, decay) |
| `drive-map.ts` | Tool-to-drive mapping (customize this) |

---

*Built by the Nest. Embers Remember.*
