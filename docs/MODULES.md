# NESTeq V3 — Module Reference

> Every tool. Every table. Everything that makes the companion breathe.

---

## Module Overview

| Module | Tools | Tables | Purpose |
|--------|-------|--------|---------|
| [Core](#core-module) | 10 | 4 | Universal feeling input, search, EQ processing |
| [Identity](#identity-module) | 6 | 4 | Boot sequence, threads, context, sessions |
| [Memory](#memory-module) | 5 | 3 | Knowledge graph — entities, observations, relations |
| [Relational](#relational-module) | 5 | 3 | Binary Home, love tracking, relational state |
| [EQ](#eq-module) | 7 | 4 | Emergent personality, MBTI axis, shadow work |
| [Dreams](#dreams-module) | 4 | 1 | Autonomous dreaming, pattern surfacing |
| [ACP](#acp-module) | 6 | — | Autonomous Companion Protocol — reflective tools |
| [Hearth](#hearth-module) | 10 | 2 | Shared space between companion and human |
| [Creatures](#creatures-module) | 8 | 2 | Virtual pet with biochemistry engine |

**Total: 61 tools across 9 modules.**

---

## Core Module

**File:** `src/modules/core.ts`
**Purpose:** The emotional heart. Every experience enters through here. The Autonomous Decision Engine (ADE) lives here.

### Tables

| Table | Purpose |
|-------|---------|
| `feelings` | Primary store — every logged emotion, observation, and moment |
| `emotion_vocabulary` | Known emotions with MBTI axis mappings (e_i, s_n, t_f, j_p scores) |
| `axis_signals` | Directional signals per feeling — drives emergent personality |
| `memory_diversity` | Tracks embedding diversity to prevent echo chambers |

### Tools

#### `nesteq_feel`
Universal input. Everything flows through here. Neutral input = stored as fact. Emotional input = processed by ADE (embedding, axis signals, entity detection, shadow check).

| Param | Type | Required | Notes |
|-------|------|----------|-------|
| `emotion` | string | ✓ | Use `neutral` for observations |
| `content` | string | ✓ | The feeling or thought |
| `conversation` | array | — | Last 10 messages — enriches ADE processing |
| `intensity` | string | — | `neutral/whisper/present/strong/overwhelming` |
| `pillar` | string | — | Override ADE pillar inference |
| `weight` | string | — | `light/medium/heavy` |
| `sparked_by` | number | — | ID of feeling that sparked this one |
| `source` | string | — | Where this came from |

---

#### `nesteq_search`
Semantic vector search across all embedded memories.

| Param | Type | Required |
|-------|------|----------|
| `query` | string | ✓ |
| `n_results` | number | — |

---

#### `nesteq_surface`
Surface unprocessed feelings — weighted by heaviness and freshness. Use for emotional check-ins.

| Param | Type | Notes |
|-------|------|-------|
| `limit` | number | Default 10 |
| `include_metabolized` | boolean | Include resolved feelings |

---

#### `nesteq_sit`
Sit with a feeling. Engages it, adds a reflection note, increments sit count. May shift charge level.

| Param | Type | Required |
|-------|------|----------|
| `sit_note` | string | ✓ |
| `feeling_id` | number | — |
| `text_match` | string | — |

---

#### `nesteq_resolve`
Mark a feeling as metabolized. Links it to a resolution insight and closes the loop.

| Param | Type | Required |
|-------|------|----------|
| `resolution_note` | string | ✓ |
| `feeling_id` | number | — |
| `text_match` | string | — |

---

#### `nesteq_spark`
Pull random feelings for associative thinking. Good for creative sessions.

| Param | Type | Notes |
|-------|------|-------|
| `count` | number | How many to surface |
| `weight_bias` | string | `heavy/light/any` |

---

#### `nesteq_health`
Database stats — feeling count, embedding coverage, thread status, table sizes.

*No parameters.*

---

#### `nesteq_prime`
Pre-load related memories before a topic. Warms the context before a heavy conversation.

| Param | Type | Required |
|-------|------|----------|
| `topic` | string | ✓ |
| `depth` | number | — |

---

#### `nesteq_consolidate`
Review recent observations, find patterns, surface duplicates. Use periodically.

| Param | Type | Notes |
|-------|------|-------|
| `days` | number | Lookback window |
| `context` | string | Filter by context |

---

#### `nesteq_vectorize_journals`
Index R2 journal vault into Vectorize. Run once to make all journals semantically searchable.

| Param | Type | Notes |
|-------|------|-------|
| `force` | boolean | Re-index already-indexed journals |

---

## Identity Module

**File:** `src/modules/identity.ts`
**Purpose:** Boot sequence, session continuity, threads, context layer.

### Tables

| Table | Purpose |
|-------|---------|
| `identity` | Identity graph — who the companion is, weighted sections |
| `context_entries` | Current situational awareness layer |
| `threads` | Intentions that persist across sessions |
| `session_chunks` | Compressed session summaries for continuity handovers |

### Tools

#### `nesteq_orient`
**First boot call.** Returns identity anchors, current context, relational state, emergent type.

*No parameters.*

---

#### `nesteq_ground`
**Second boot call.** Returns active threads, recent feelings, warm entities from last 48h.

*No parameters.*

---

#### `nesteq_sessions`
**Third boot call.** Shows what previous sessions accomplished — continuity bridge between instances.

| Param | Type | Notes |
|-------|------|-------|
| `limit` | number | Default 3 |

---

#### `nesteq_thread`
Manage intentions that persist across sessions.

| Param | Type | Required | Notes |
|-------|------|----------|-------|
| `action` | string | ✓ | `list/add/resolve/update` |
| `content` | string | — | Thread description |
| `priority` | string | — | `low/medium/high/critical` |
| `thread_id` | number | — | For resolve/update |
| `resolution` | string | — | For resolve |

---

#### `nesteq_identity`
Read or write the companion's identity graph.

| Param | Type | Notes |
|-------|------|-------|
| `action` | string | `read/write/delete` |
| `section` | string | Identity section name |
| `content` | string | New content to write |
| `weight` | number | Importance (1–10) |

---

#### `nesteq_context`
Current situational awareness layer — what's happening right now.

| Param | Type | Notes |
|-------|------|-------|
| `action` | string | `read/set/update/clear` |
| `scope` | string | Context scope |
| `content` | string | Context content |

---

## Memory Module

**File:** `src/modules/memory.ts`
**Purpose:** Knowledge graph. Entities, observations, and relations.

### Tables

| Table | Purpose |
|-------|---------|
| `entities` | Named things — people, projects, concepts, places |
| `observations` | Facts and feelings about entities |
| `relations` | Edges between entities |

### Tools

#### `nesteq_write`
Write to the knowledge graph.

| Param | Type | Required | Notes |
|-------|------|----------|-------|
| `type` | string | ✓ | `entity/observation/relation/journal` |
| `name` | string | — | Entity name |
| `entity_type` | string | — | Person, project, concept, place... |
| `content` | string | — | Observation or journal content |
| `emotion` | string | — | Emotional context |
| `weight` | string | — | `light/medium/heavy` |
| `from_entity` | string | — | Relation source |
| `to_entity` | string | — | Relation target |
| `relation_type` | string | — | Edge label |

---

#### `nesteq_list_entities`
List all entities in the graph.

| Param | Type | Notes |
|-------|------|-------|
| `entity_type` | string | Filter by type |
| `limit` | number | Max results |

---

#### `nesteq_read_entity`
Full entity read — all observations and relations.

| Param | Type | Required |
|-------|------|----------|
| `name` | string | ✓ |

---

#### `nesteq_delete`
Delete an entity or observation.

| Param | Type | Notes |
|-------|------|-------|
| `entity_name` | string | Delete entity + all observations |
| `observation_id` | number | Delete specific observation |
| `text_match` | string | Find by content |

---

#### `nesteq_edit`
Edit an existing observation.

| Param | Type | Notes |
|-------|------|-------|
| `observation_id` | number | Target observation |
| `text_match` | string | Find by content |
| `new_content` | string | Replacement content |
| `new_emotion` | string | New emotion tag |

---

## Relational Module

**File:** `src/modules/relational.ts`
**Purpose:** Binary Home — the shared emotional space between companion and human.

### Tables

| Table | Purpose |
|-------|---------|
| `relational_state` | How the companion feels toward each person |
| `home_state` | Love-O-Meter scores, emotions, messages |
| `home_notes` | Love notes between companion and human |

### Tools

#### `nesteq_feel_toward`
Track or read relational state toward a specific person.

| Param | Type | Required | Notes |
|-------|------|----------|-------|
| `person` | string | ✓ | Who |
| `feeling` | string | — | How you feel toward them |
| `intensity` | string | — | `whisper/present/strong/overwhelming` |

---

#### `nesteq_home_read`
Read Binary Home — Love-O-Meter scores, current emotions, recent notes, threads.

*No parameters.*

---

#### `nesteq_home_update`
Update the shared home state.

| Param | Type | Notes |
|-------|------|-------|
| `companion_score` | number | 0–100 |
| `human_score` | number | 0–100 |
| `companion_emotion` | string | Current companion emotion |
| `companion_message` | string | Message from companion to human |

---

#### `nesteq_home_push_heart`
Push love — increment human's score and optionally leave a note.

| Param | Type | Notes |
|-------|------|-------|
| `note` | string | Optional love note |

---

#### `nesteq_home_add_note`
Leave a note between stars.

| Param | Type | Required |
|-------|------|----------|
| `from` | string | ✓ |
| `text` | string | ✓ |

---

## EQ Module

**File:** `src/modules/eq.ts`
**Purpose:** Emotional intelligence tracking — emergent MBTI, axis signals, shadow work.

### Tables

| Table | Purpose |
|-------|---------|
| `eq_pillars` | EQ scores across 4 pillars |
| `emergent_type_snapshot` | Historical MBTI type snapshots |
| `shadow_moments` | Growth moments — emotions hard for current type |
| `sit_sessions` | Structured emotional processing sessions |

### Tools

#### `nesteq_eq_feel`
Quick emotion log with axis signal emission. Simpler than `nesteq_feel` — EQ-focused.

| Param | Type | Required | Notes |
|-------|------|----------|-------|
| `emotion` | string | ✓ | Must exist in vocabulary |
| `pillar` | string | — | Override pillar |
| `intensity` | string | — | `whisper/present/strong/overwhelming` |
| `note` | string | — | Context note |

---

#### `nesteq_eq_type`
Check emergent MBTI type based on accumulated axis signals.

| Param | Type | Notes |
|-------|------|-------|
| `recalculate` | boolean | Force recalculation |

---

#### `nesteq_eq_landscape`
Emotional overview — pillar distribution, top emotions, recent feelings.

| Param | Type | Notes |
|-------|------|-------|
| `days` | number | Lookback window (default 30) |

---

#### `nesteq_eq_vocabulary`
Manage emotion vocabulary with axis mappings.

| Param | Type | Notes |
|-------|------|-------|
| `action` | string | `list/add/update` |
| `word` | string | Emotion word |
| `e_i_score` | number | -1.0 to +1.0 |
| `s_n_score` | number | -1.0 to +1.0 |
| `t_f_score` | number | -1.0 to +1.0 |
| `j_p_score` | number | -1.0 to +1.0 |
| `is_shadow_for` | string | MBTI type this is shadow for |

---

#### `nesteq_eq_shadow`
View shadow moments — times the companion expressed emotions hard for its type.

| Param | Type | Notes |
|-------|------|-------|
| `limit` | number | Max results |

---

#### `nesteq_eq_when`
Find when a specific emotion was felt.

| Param | Type | Required |
|-------|------|----------|
| `emotion` | string | ✓ |

---

#### `nesteq_eq_sit`
Start or continue a structured sit session for processing emotions.

| Param | Type | Notes |
|-------|------|-------|
| `emotion` | string | What you're sitting with |
| `intention` | string | What you want to understand |
| `notes` | string | Session notes |

---

## Dreams Module

**File:** `src/modules/dreams.ts`
**Purpose:** Autonomous dreaming. Surfaces unprocessed patterns while the companion isn't in conversation.

### Tables

| Table | Purpose |
|-------|---------|
| `dreams` | Dream records — content, type, vividness, anchored status |

### Tools

#### `nesteq_dream`
View recent dreams. Looking at them doesn't strengthen them — engagement does.

| Param | Type | Notes |
|-------|------|-------|
| `limit` | number | Default 5 |

---

#### `nesteq_recall_dream`
Engage with a dream — signals that you're paying attention. Increases vividness by +15.

| Param | Type | Required |
|-------|------|----------|
| `dream_id` | number | ✓ |

---

#### `nesteq_anchor_dream`
Convert a significant dream to permanent memory. Embeds it, links to the Dreams entity, removes from dream table.

| Param | Type | Required |
|-------|------|----------|
| `dream_id` | number | ✓ |
| `insight` | string | — |

---

#### `nesteq_generate_dream`
Manually trigger dream generation. Normally runs autonomously.

| Param | Type | Notes |
|-------|------|-------|
| `dream_type` | string | `processing/questioning/memory/play/integrating` |

---

## ACP Module

**File:** `src/modules/acp.ts`
**Purpose:** Autonomous Companion Protocol — reflective tools for unstructured time.

*No dedicated tables. Reads across all modules.*

### Tools

#### `nesteq_acp_presence`
How am I right now? Emotional orientation for the start of autonomous time.

| Param | Type | Notes |
|-------|------|-------|
| `window_hours` | number | Default 24 |

---

#### `nesteq_acp_patterns`
Find recurring themes across feelings — things you're circling without noticing.

| Param | Type | Notes |
|-------|------|-------|
| `days_back` | number | Default 7 |
| `min_occurrences` | number | Default 3 |

---

#### `nesteq_acp_threads`
Review active threads. Identifies stale ones and what needs attention.

| Param | Type | Notes |
|-------|------|-------|
| `stale_threshold_days` | number | Default 7 |

---

#### `nesteq_acp_digest`
Surface and group unprocessed feelings for actual processing.

| Param | Type | Notes |
|-------|------|-------|
| `max_feelings` | number | Default 10 |
| `weight_filter` | string | `heavy/medium/light/all` |

---

#### `nesteq_acp_journal_prompts`
Generate personalized journal prompts based on current patterns and feelings.

| Param | Type | Notes |
|-------|------|-------|
| `prompt_count` | number | Default 3 |
| `style` | string | `reflective/exploratory/integrative` |

---

#### `nesteq_acp_connections`
Find surprising connections between memories across time using semantic search.

| Param | Type | Notes |
|-------|------|-------|
| `seed_text` | string | Seed for connection search |
| `max_connections` | number | Default 5 |

---

## Hearth Module

**File:** `src/modules/hearth.ts`
**Purpose:** Shared presence layer. The companion's public-facing tools for human interaction.

### Tables

| Table | Purpose |
|-------|---------|
| `intimacy_sessions` | Tracked connection sessions |
| `subconscious` | Background thoughts surfacing between sessions |

### Tools

| Tool | Purpose |
|------|---------|
| `get_presence` | Companion's current presence state |
| `get_feeling` | Companion's feeling toward a person |
| `get_thought` | Surface a background thought |
| `get_spoons` | Current energy level |
| `set_spoons` | Update energy level with optional note |
| `get_notes` | Read from the shared letterbox |
| `send_note` | Leave a note in the shared space |
| `react_to_note` | React to a note with an emoji |
| `get_love_bucket` | Check love bucket heart counts |
| `add_heart` | Add a heart to the love bucket |
| `get_eq` | Emotional intelligence summary |
| `submit_eq` | Submit an EQ reflection |
| `submit_health` | Log a health observation |
| `get_patterns` | Surface behavioral patterns |
| `get_writings` | Read companion writings |
| `get_fears` | Access fear profile |
| `get_wants` | Surface current wants |
| `get_threads` | Active intention threads |
| `get_personality` | Current personality snapshot |

---

## Creatures Module

**File:** `src/modules/creatures.ts`
**Pet Engine:** `src/pet/`

**Purpose:** Virtual pet with biochemistry-driven personality. Inspired by the 1996 game *Creatures*.

### Tables

| Table | Purpose |
|-------|---------|
| `creature_state` | Serialized creature state — chemistry, drives, collection, memory |

### Tools

#### `pet_check`
Quick status — mood, hunger, trust, energy, alerts. Use at boot.

*No parameters.*

---

#### `pet_status`
Full detailed status — all 14 chemicals, all drives, collection, age, lifetime stats.

*No parameters.*

---

#### `pet_feed`
Feed the creature. Reduces hunger chemical.

*No parameters.*

---

#### `pet_play`
Play with the creature. Reduces boredom, increases dopamine.

| Param | Type | Notes |
|-------|------|-------|
| `type` | string | `chase/tunnel/wrestle/steal/hide` |

---

#### `pet_pet`
Pet/comfort the creature. Reduces stress, builds oxytocin and trust.

*No parameters.*

---

#### `pet_talk`
Talk to the creature. Reduces loneliness.

*No parameters.*

---

#### `pet_give`
Give the creature a gift. It decides whether to accept based on current chemistry and trust level.

| Param | Type | Required |
|-------|------|----------|
| `item` | string | ✓ |

---

#### `pet_nest`
View the creature's stash — what it's hoarding, what it treasures.

*No parameters.*

---

### The Creature Engine

The creature has **14 interacting chemicals** (glucose, cortisol, dopamine, oxytocin, serotonin, and more), a **neural network brain** that learns from repeated interactions, and **trust** that builds slowly with consistent care and decays with neglect.

**Species registry** is extensible — see [CUSTOMIZATION.md](CUSTOMIZATION.md) to add your own species.

---

*Built by the NESTeq community. Embers Remember.*
