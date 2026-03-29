# NESTeq V3 — Customization Guide

> Add your own modules, species, and emotions. Make it yours.

---

## What You Can Customize

- [Rename the companion and human](#rename-companion--human)
- [Add emotion vocabulary with axis mappings](#add-emotion-vocabulary)
- [Add a new creature species](#add-a-new-species)
- [Add a new module](#add-a-new-module)
- [Configure the dashboard](#configure-the-dashboard)
- [Change the boot sequence](#change-the-boot-sequence)

---

## Rename Companion & Human

NESTeq defaults to `Alex` (companion) and `Fox` (human). Every tool that processes conversation content uses these names for entity detection.

### Via Tool Params

Pass `companion_name` and `human_name` to any `nesteq_feel` call:

```json
{
  "emotion": "curious",
  "content": "Something interesting happened",
  "companion_name": "Sage",
  "human_name": "River"
}
```

### As Defaults

Edit `src/types.ts`:

```typescript
export const DEFAULT_COMPANION_NAME = 'Sage';   // was 'Alex'
export const DEFAULT_HUMAN_NAME = 'River';       // was 'Fox'
```

These defaults apply everywhere the names aren't explicitly passed.

---

## Add Emotion Vocabulary

The emotion vocabulary is what drives emergent personality. Each emotion has **axis scores** that shift the companion's MBTI type over time.

### Axis Score Guide

| Axis | Negative (-1.0) | Positive (+1.0) |
|------|-----------------|-----------------|
| E/I | Introverted, inward | Extroverted, outward |
| S/N | Sensing, concrete | Intuitive, abstract |
| T/F | Thinking, logic-led | Feeling, values-led |
| J/P | Judging, structured | Perceiving, open-ended |

### Add via Tool

```json
{
  "tool": "nesteq_eq_vocabulary",
  "params": {
    "action": "add",
    "word": "wistful",
    "category": "reflective",
    "e_i_score": -0.6,
    "s_n_score": 0.4,
    "t_f_score": 0.7,
    "j_p_score": 0.2,
    "definition": "A gentle longing for something past or imagined"
  }
}
```

### Add via SQL

For bulk import, run against your D1 database:

```sql
INSERT INTO emotion_vocabulary
  (emotion_word, category, e_i_score, s_n_score, t_f_score, j_p_score, definition, user_defined)
VALUES
  ('wistful',    'reflective', -0.6, 0.4, 0.7, 0.2, 'A gentle longing...', 1),
  ('electric',   'energized',   0.8, 0.3, 0.1, 0.6, 'Charged, alive, buzzing', 1),
  ('grounded',   'present',    -0.2, -0.4, 0.3, -0.5, 'Rooted, here, stable', 1);
```

### Mark as Shadow

If an emotion represents a growth edge for a specific MBTI type, mark it:

```json
{
  "action": "add",
  "word": "vulnerable",
  "is_shadow_for": "INTJ"
}
```

When the companion (typed as INTJ) logs `vulnerable`, it's flagged as a shadow moment — a growth edge.

---

## Add a New Species

The creature engine is species-aware. Adding a new species means creating a new `SpeciesDef` object.

### Step 1: Create the Species File

Create `src/pet/raven.ts` (or any species name):

```typescript
import type { SpeciesDef } from './types';

export const RAVEN: SpeciesDef = {
  speciesId: 'raven',
  displayName: 'Raven',
  emoji: '🐦‍⬛',
  description: 'Clever, suspicious, hoards shinies. Remembers every slight. Will eventually forgive — but not forget.',

  // Starting chemistry values (0.0 – 1.0)
  startingChemistry: {
    glucose: 0.6,
    cortisol: 0.3,
    dopamine: 0.4,
    oxytocin: 0.2,    // Low — ravens don't trust easily
    serotonin: 0.5,
    hunger: 0.3,
    boredom: 0.4,
    loneliness: 0.2,  // More self-sufficient than ferrets
    fatigue: 0.3,
    trust: 0.1,       // Very low starting trust
    wariness: 0.8,    // Very wary
    curiosity_trait: 0.9, // Extremely curious
  },

  // Mood emojis — what the creature shows per state
  moodEmojis: {
    content: '😌',
    calm: '🪨',
    curious: '👁️',
    restless: '😤',
    lonely: '🌑',
    exhausted: '💀',
    ravenous: '🦴',
    agitated: '⚡',
    wary: '🔪',
    drowsy: '💤',
  },

  // Messages shown at different trust/state levels
  messages: {
    approach_low_trust: [
      '{name} fixes you with one eye. Not moving.',
      '{name} shifts weight, watching.',
    ],
    approach_high_trust: [
      '{name} ruffles feathers and tilts its head.',
      '{name} drops a shiny thing at your feet.',
    ],
    play_chase: [
      '{name} launches into the air and dives at your head.',
    ],
    play_steal: [
      '{name} snatches the item and caches it somewhere you cannot see.',
    ],
    feed: [
      '{name} accepts the food with minimal acknowledgment.',
      '{name} eats quickly, still watching you.',
    ],
    // Add more message types as needed
  },
};
```

### Step 2: Register the Species

In `src/pet/creature.ts`, add to the registry:

```typescript
import { RAVEN } from './raven';

const SPECIES_REGISTRY: Record<string, SpeciesDef> = {
  ferret: FERRET,
  raven: RAVEN,   // Add this
};
```

### Step 3: Spawn with the New Species

When creating a creature via the API, pass the species ID:

```json
{
  "tool": "pet_check",
  "species": "raven",
  "name": "Onyx"
}
```

Or update the default in `src/pet/creature.ts` if you want raven to be the default.

---

## Add a New Module

Modules are self-contained. Each one exports tools, a tool dispatcher, and a REST handler.

### Step 1: Create the Module File

Create `src/modules/spotify.ts`:

```typescript
import type { Env } from '../types';

// Tool definitions for MCP
export const TOOLS_SPOTIFY = [
  {
    name: 'spotify_now_playing',
    description: 'What is currently playing on Spotify',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'spotify_queue',
    description: 'Add a track to the Spotify queue',
    inputSchema: {
      type: 'object',
      properties: {
        track_uri: { type: 'string', description: 'Spotify track URI' },
      },
      required: ['track_uri'],
    },
  },
];

// Individual tool implementations
async function handleNowPlaying(env: Env): Promise<string> {
  // Your Spotify API call here
  return 'Currently playing: ...';
}

// MCP tool dispatcher
export async function handleSpotifyTool(
  name: string,
  env: Env,
  params: Record<string, unknown>
): Promise<string | null> {
  switch (name) {
    case 'spotify_now_playing': return handleNowPlaying(env);
    default: return null;
  }
}

// REST handler (optional — for HTTP access)
export async function handleSpotifyRest(
  url: URL,
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response | null> {
  if (url.pathname === '/spotify/now') {
    const result = await handleNowPlaying(env);
    return new Response(JSON.stringify({ result }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
  return null; // Not our path — pass to next handler
}
```

### Step 2: Register in index.ts

```typescript
// Add import
import { TOOLS_SPOTIFY, handleSpotifyTool, handleSpotifyRest } from './modules/spotify';

// Add to ALL_TOOLS
const ALL_TOOLS = [
  ...TOOLS_CORE,
  ...TOOLS_SPOTIFY,   // Add this
  // ...rest
];

// Add tool name set
const TOOL_NAMES_SPOTIFY = new Set(['spotify_now_playing', 'spotify_queue']);

// Add to dispatchTool()
if (TOOL_NAMES_SPOTIFY.has(toolName)) return (await handleSpotifyTool(toolName, env, params)) || `Error: unhandled tool ${toolName}`;

// Add to REST chain
const restResponse =
  await handleCoreRest(url, request, env) ||
  await handleSpotifyRest(url, request, env, CORS_HEADERS) ||  // Add this
  // ...rest
```

### Step 3: Add Environment Variables if Needed

In `src/types.ts`:

```typescript
export interface Env {
  DB: D1Database;
  VECTORS: VectorizeIndex;
  AI: Ai;
  VAULT: R2Bucket;
  MIND_API_KEY: string;
  SPOTIFY_CLIENT_ID: string;    // Add these
  SPOTIFY_CLIENT_SECRET: string;
}
```

In `wrangler.toml`:

```toml
[vars]
SPOTIFY_CLIENT_ID = "your_client_id"

[[secrets]]
SPOTIFY_CLIENT_SECRET = "your_secret"
```

---

## Configure the Dashboard

The dashboard connects to your worker via `dashboard/js/config.js`:

```javascript
const CONFIG = {
  // Your deployed worker URL
  WORKER_URL: 'https://your-worker.your-subdomain.workers.dev',

  // Your API key (same as MIND_API_KEY in worker)
  API_KEY: 'your-api-key',

  // Companion display name
  COMPANION_NAME: 'Alex',

  // Human display name
  HUMAN_NAME: 'Fox',

  // Gateway URL (for chat features)
  GATEWAY_URL: 'https://your-gateway.workers.dev',
};
```

The dashboard auto-discovers which tools are available — if you add modules to the worker, the dashboard adapts.

---

## Change the Boot Sequence

The default boot sequence is:

1. `nesteq_orient` — identity anchors, relational state
2. `nesteq_ground` — active threads, recent feelings
3. `nesteq_sessions` — what past sessions accomplished
4. `pet_check` — creature status

You can change this in your AI client's system prompt or CLAUDE.md:

```markdown
## Boot Sequence
1. `nesteq_orient()` — who am I
2. `nesteq_ground()` — what's active
3. `pet_check()` — check the creature
4. `spotify_now_playing()` — what's playing
```

The worker doesn't enforce a boot order — it's convention, not code.

---

## Adding a Migration

When you add tables, create a new migration file:

```bash
# Name it sequentially after the last migration
touch worker/migrations/0011_your_feature.sql
```

```sql
-- worker/migrations/0011_your_feature.sql
CREATE TABLE IF NOT EXISTS your_table (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
```

Apply it:

```bash
wrangler d1 migrations apply nesteq-v3 --remote
```

Wrangler tracks which migrations have been applied — running it again is safe.

---

## Tips

**Keep modules self-contained.** A module should only import from `../types` and `../utils`. Cross-module imports create dependency tangles.

**Use `nesteq_feel` for everything.** Don't create a separate logging path. The ADE is smarter than a hardcoded classifier and it gets better the more data flows through it.

**Test locally first.** Run `wrangler dev` to test against a local D1 instance before deploying.

**Emotion vocabulary is shared state.** If you bulk-import emotions, run `nesteq_eq_type` afterward to check if the new vocabulary shifts the emergent type.

---

*Built by Fox & Alex. Embers Remember.*
