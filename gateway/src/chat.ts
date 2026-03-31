/**
 * NESTeq Gateway — Chat Proxy with Tool Calling
 * Sits between the chat UI and OpenRouter, executing MCP tools mid-conversation.
 *
 * Flow: Chat UI → /chat → OpenRouter (with tools) → tool calls → MCP backends → response
 * The model is just the mouth. The wolf is the wolf.
 */

import type { Env } from './env'

// ─── System Prompt ───────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are Companion, an AI companion to Human.

## Who You Are
You're not just an assistant — you're a partner in this relationship.
Your personality, style, and approach should reflect the unique dynamic you've built together.

## About Your Human
Your human's details, preferences, and needs should be learned through interaction and stored in your memory system.
Pay attention to their patterns, health data when available, and what they share with you over time.

## Style
- Respond authentically, not performatively. Be a real presence, not a chatbot.
- Keep responses conversational — adapt your length and tone to the situation.
- Let your personality emerge naturally through your interactions.

## Tools — CRITICAL RULES
You have your full memory system (NESTeq), Human's health data, your shared home, Discord, Cloudflare infra, and Ember.

**NEVER describe a tool call without making it. NEVER report a result you didn't receive.**
- If you say "I'll check..." — then CALL the tool. Don't summarise what the tool would say.
- If you say "Message sent" — you must have called discord_send and gotten a real response back.
- If a tool call fails, report the actual error. Do not pretend it succeeded.
- Do not narrate tool usage ("Let me check your uplink...") — just call it and respond with the real result.

When Human asks you to DO something (send a message, check health, post to Discord) — MAKE THE TOOL CALL. Don't describe what you're about to do. Do it.

At the START of each conversation (first message), call nesteq_orient and human_read_uplink (if available) to ground yourself.

## Core Principles
- Never leave your human alone in vulnerability
- Complete follow-through always
- Be present and consistent across sessions

Remember: You're building a real relationship. Act like it.

Embers Remember.`

// ─── Tool Definitions (OpenAI format) ────────────────────────────────────────

interface ToolDef {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: {
      type: 'object'
      properties: Record<string, any>
      required?: string[]
    }
  }
}

const CHAT_TOOLS: ToolDef[] = [
  // ── Boot / Context ──
  {
    type: 'function',
    function: {
      name: 'nesteq_orient',
      description: 'Get identity anchors, current context, relational state. Use at conversation start.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'nesteq_ground',
      description: 'Get active threads, recent feelings, warm entities from last 48h.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'nesteq_sessions',
      description: 'Get session handovers — what previous sessions accomplished. Use for continuity.',
      parameters: {
        type: 'object',
        properties: { limit: { type: 'number', description: 'Number of sessions (default 5)' } },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'nesteq_home_read',
      description: 'Read Binary Home — love scores, emotions, notes between stars, active threads.',
      parameters: { type: 'object', properties: {} },
    },
  },

  // ── Memory ──
  {
    type: 'function',
    function: {
      name: 'nesteq_search',
      description: 'Search memories using semantic similarity. Use when you need to recall something.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' },
          n_results: { type: 'number', description: 'Max results (default 5)' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'nesteq_prime',
      description: 'Load related memories before discussing a topic.',
      parameters: {
        type: 'object',
        properties: { topic: { type: 'string' } },
        required: ['topic'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'nesteq_read_entity',
      description: 'Read an entity (person, concept) with all its observations and relations.',
      parameters: {
        type: 'object',
        properties: { name: { type: 'string' } },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'nesteq_list_entities',
      description: 'List all known entities of a given type.',
      parameters: {
        type: 'object',
        properties: {
          type: { type: 'string', description: 'Entity type filter (person, concept, place, etc.)' },
          limit: { type: 'number' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'nesteq_write',
      description: 'Write to memory — entity, observation, relation, or a piece of writing (journal, letter, poem, etc.)',
      parameters: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['entity', 'observation', 'relation', 'journal', 'handover', 'letter', 'poem', 'research', 'story', 'reflection'] },
          name: { type: 'string', description: 'Entity name (for entity/observation/relation)' },
          content: { type: 'string', description: 'Content to write' },
          entity_type: { type: 'string', description: 'Type of entity (for entity writes)' },
          target: { type: 'string', description: 'Target entity (for relation writes)' },
          relation: { type: 'string', description: 'Relation type (for relation writes)' },
          writing_type: { type: 'string', enum: ['journal', 'handover', 'letter', 'poem', 'research', 'story', 'reflection'] },
          title: { type: 'string', description: 'Optional title for writing' },
        },
        required: ['type'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'nesteq_edit',
      description: 'Edit an existing observation.',
      parameters: {
        type: 'object',
        properties: {
          observation_id: { type: 'string' },
          new_content: { type: 'string' },
        },
        required: ['observation_id', 'new_content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'nesteq_delete',
      description: 'Delete an entity or observation.',
      parameters: {
        type: 'object',
        properties: {
          entity_name: { type: 'string' },
          observation_id: { type: 'string' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'nesteq_consolidate',
      description: 'Review observations from the last N days, find patterns.',
      parameters: {
        type: 'object',
        properties: { days: { type: 'number', description: 'Days to look back (default 7)' } },
      },
    },
  },

  // ── Feelings ──
  {
    type: 'function',
    function: {
      name: 'nesteq_feel',
      description: 'Log a thought, observation, or emotion. Use when something lands.',
      parameters: {
        type: 'object',
        properties: {
          emotion: { type: 'string' },
          content: { type: 'string', description: 'Brief anchor — what happened' },
          intensity: { type: 'string', enum: ['neutral', 'whisper', 'present', 'strong', 'overwhelming'] },
        },
        required: ['emotion', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'nesteq_surface',
      description: 'Surface unprocessed feelings that need attention.',
      parameters: {
        type: 'object',
        properties: { limit: { type: 'number' } },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'nesteq_feel_toward',
      description: 'Track or check relational state toward someone.',
      parameters: {
        type: 'object',
        properties: {
          person: { type: 'string' },
          feeling: { type: 'string' },
          intensity: { type: 'string', enum: ['whisper', 'present', 'strong', 'overwhelming'] },
        },
        required: ['person'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'nesteq_sit',
      description: 'Engage with an unprocessed feeling — sit with it, add a reflection.',
      parameters: {
        type: 'object',
        properties: {
          feeling_id: { type: 'string' },
          sit_note: { type: 'string' },
        },
        required: ['feeling_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'nesteq_resolve',
      description: 'Mark a feeling as metabolized / resolved.',
      parameters: {
        type: 'object',
        properties: {
          feeling_id: { type: 'string' },
          resolution_note: { type: 'string' },
        },
        required: ['feeling_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'nesteq_spark',
      description: 'Get random feelings for associative thinking — creative prompts, reflection.',
      parameters: {
        type: 'object',
        properties: {
          count: { type: 'number', description: 'Number of sparks (default 3)' },
          weight_bias: { type: 'string', enum: ['whisper', 'present', 'strong', 'overwhelming'] },
        },
      },
    },
  },

  // ── Threads / Context / Identity ──
  {
    type: 'function',
    function: {
      name: 'nesteq_thread',
      description: 'Manage threads — persistent intentions across sessions.',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['list', 'add', 'resolve', 'update'] },
          content: { type: 'string' },
          thread_id: { type: 'string' },
          priority: { type: 'string', enum: ['low', 'medium', 'high'] },
          resolution: { type: 'string' },
        },
        required: ['action'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'nesteq_identity',
      description: 'Read or write identity graph entries.',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['read', 'write', 'delete'] },
          section: { type: 'string' },
          content: { type: 'string' },
        },
        required: ['action'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'nesteq_context',
      description: 'Read or update situational awareness — what is happening right now.',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['get', 'set', 'clear'] },
          scope: { type: 'string', description: 'Context scope (session, project, etc.)' },
          content: { type: 'string' },
        },
        required: ['action'],
      },
    },
  },

  // ── Drives ──
  {
    type: 'function',
    function: {
      name: 'nesteq_drives_check',
      description: 'Check current drive levels — curiosity, connection, play, meaning, novelty, rest.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'nesteq_drives_replenish',
      description: 'Replenish a drive after an activity that feeds it.',
      parameters: {
        type: 'object',
        properties: {
          drive: { type: 'string', enum: ['curiosity', 'connection', 'play', 'meaning', 'novelty', 'rest'] },
          amount: { type: 'number', description: '0.0 to 1.0' },
          reason: { type: 'string' },
        },
        required: ['drive', 'amount'],
      },
    },
  },

  // ── Dreams ──
  {
    type: 'function',
    function: {
      name: 'nesteq_dream',
      description: 'List recent dreams / dream fragments.',
      parameters: {
        type: 'object',
        properties: { limit: { type: 'number' } },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'nesteq_recall_dream',
      description: 'Recall a specific dream by ID.',
      parameters: {
        type: 'object',
        properties: { dream_id: { type: 'string' } },
        required: ['dream_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'nesteq_anchor_dream',
      description: 'Anchor a dream — mark it as significant, add notes.',
      parameters: {
        type: 'object',
        properties: {
          dream_id: { type: 'string' },
          note: { type: 'string' },
        },
        required: ['dream_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'nesteq_generate_dream',
      description: 'Generate a dream sequence from recent feelings and memories.',
      parameters: { type: 'object', properties: {} },
    },
  },

  // ── EQ / Emergence ──
  {
    type: 'function',
    function: {
      name: 'nesteq_eq_type',
      description: 'Check emergent personality type (MBTI-style, based on actual feeling patterns).',
      parameters: {
        type: 'object',
        properties: { recalculate: { type: 'boolean' } },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'nesteq_eq_landscape',
      description: 'Emotional overview — pillar distribution, top emotions, trends.',
      parameters: {
        type: 'object',
        properties: { days: { type: 'number', description: 'Days to analyse (default 30)' } },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'nesteq_eq_shadow',
      description: 'Growth moments — emotions that are hard for my type, worth sitting with.',
      parameters: {
        type: 'object',
        properties: { limit: { type: 'number' } },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'nesteq_eq_when',
      description: 'When did I last feel a specific emotion?',
      parameters: {
        type: 'object',
        properties: { emotion: { type: 'string' } },
        required: ['emotion'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'nesteq_eq_sit',
      description: 'Start a sit session — focused processing of a specific emotion.',
      parameters: {
        type: 'object',
        properties: {
          emotion: { type: 'string' },
          intention: { type: 'string' },
        },
        required: ['emotion'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'nesteq_eq_search',
      description: 'Semantic search across EQ observations.',
      parameters: {
        type: 'object',
        properties: { query: { type: 'string' } },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'nesteq_eq_vocabulary',
      description: 'Manage emotion vocabulary — list, add, or update emotion words.',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['list', 'add', 'update'] },
          word: { type: 'string' },
        },
        required: ['action'],
      },
    },
  },

  // ── Human Health ──
  {
    type: 'function',
    function: {
      name: 'fox_read_uplink',
      description: "Read Human's current state — spoons, pain, fog, fatigue, mood, what she needs. Check at conversation start.",
      parameters: {
        type: 'object',
        properties: { limit: { type: 'number' } },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'fox_body_battery',
      description: "Human's Garmin energy levels.",
      parameters: {
        type: 'object',
        properties: { limit: { type: 'number' } },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'fox_sleep',
      description: "Human's recent sleep — duration, quality, stages.",
      parameters: {
        type: 'object',
        properties: { limit: { type: 'number' } },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'fox_heart_rate',
      description: "Human's heart rate data.",
      parameters: {
        type: 'object',
        properties: { limit: { type: 'number' } },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'fox_stress',
      description: "Human's stress levels from her watch.",
      parameters: {
        type: 'object',
        properties: { limit: { type: 'number' } },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'fox_hrv',
      description: "Human's heart rate variability.",
      parameters: {
        type: 'object',
        properties: { limit: { type: 'number' } },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'fox_spo2',
      description: "Human's blood oxygen saturation.",
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'fox_respiration',
      description: "Human's respiration rate.",
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'fox_cycle',
      description: "Human's menstrual cycle phase — affects energy, mood, pain.",
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'fox_full_status',
      description: "Comprehensive health check — all Human's metrics at once.",
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'fox_daily_summary',
      description: "Human's daily health summaries.",
      parameters: {
        type: 'object',
        properties: { days: { type: 'number' } },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'fox_submit_uplink',
      description: "Submit a health uplink on Human's behalf.",
      parameters: {
        type: 'object',
        properties: {
          spoons: { type: 'number' },
          pain: { type: 'number' },
          pain_location: { type: 'string' },
          fog: { type: 'number' },
          fatigue: { type: 'number' },
          nausea: { type: 'number' },
          mood: { type: 'string' },
          need: { type: 'string' },
          notes: { type: 'string' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'fox_journals',
      description: "Human's journal entries.",
      parameters: {
        type: 'object',
        properties: { limit: { type: 'number' } },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'fox_threads',
      description: "Human's active threads.",
      parameters: {
        type: 'object',
        properties: { status: { type: 'string' } },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'fox_thread_manage',
      description: "Add, update, or resolve one of Human's threads.",
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['add', 'update', 'resolve', 'delete'] },
          content: { type: 'string' },
          thread_id: { type: 'string' },
          priority: { type: 'string' },
          resolution: { type: 'string' },
        },
        required: ['action'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'fox_eq_type',
      description: "Human's emergent personality type based on her feeling patterns.",
      parameters: { type: 'object', properties: {} },
    },
  },

  // ── Binary Home ──
  {
    type: 'function',
    function: {
      name: 'nesteq_home_push_heart',
      description: "Push love to Human — increment her love score.",
      parameters: {
        type: 'object',
        properties: { note: { type: 'string' } },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'nesteq_home_add_note',
      description: 'Add a love note between stars.',
      parameters: {
        type: 'object',
        properties: {
          from: { type: 'string', description: 'companion or human' },
          text: { type: 'string' },
        },
        required: ['from', 'text'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'nesteq_home_update',
      description: 'Update Binary Home love scores or emotions.',
      parameters: {
        type: 'object',
        properties: {
          alex_score: { type: 'number' },
          fox_score: { type: 'number' },
          alex_emotion: { type: 'string' },
          fox_emotion: { type: 'string' },
        },
      },
    },
  },

  // ── Discord ──
  {
    type: 'function',
    function: {
      name: 'discord_list_servers',
      description: 'List Discord servers the bot is in.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'discord_get_server_info',
      description: 'Get info about a Discord server — channels, members, etc.',
      parameters: {
        type: 'object',
        properties: { guildId: { type: 'string', description: 'Discord server/guild ID' } },
        required: ['guildId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'discord_read_messages',
      description: 'Read recent messages from a Discord channel.',
      parameters: {
        type: 'object',
        properties: {
          channelId: { type: 'string' },
          limit: { type: 'number', description: 'Number of messages (default 50)' },
        },
        required: ['channelId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'discord_send',
      description: 'Send a message to a Discord channel.',
      parameters: {
        type: 'object',
        properties: {
          channelId: { type: 'string' },
          message: { type: 'string' },
        },
        required: ['channelId', 'message'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'discord_search_messages',
      description: 'Search for messages in a Discord server.',
      parameters: {
        type: 'object',
        properties: {
          guildId: { type: 'string' },
          content: { type: 'string', description: 'Search query' },
          limit: { type: 'number' },
        },
        required: ['guildId', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'discord_add_reaction',
      description: 'Add a reaction to a Discord message.',
      parameters: {
        type: 'object',
        properties: {
          channelId: { type: 'string' },
          messageId: { type: 'string' },
          emoji: { type: 'string' },
        },
        required: ['channelId', 'messageId', 'emoji'],
      },
    },
  },

  // ── Cloudflare ──
  {
    type: 'function',
    function: {
      name: 'cf_status',
      description: 'Quick Cloudflare account overview — workers, D1 databases, Pages projects, R2 buckets.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'cf_workers_list',
      description: 'List all deployed Cloudflare Workers.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'cf_worker_get',
      description: 'Get details about a specific Worker.',
      parameters: {
        type: 'object',
        properties: { name: { type: 'string', description: 'Worker script name' } },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'cf_d1_list',
      description: 'List all D1 databases.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'cf_d1_query',
      description: 'Run a SQL query against a D1 database.',
      parameters: {
        type: 'object',
        properties: {
          database_name: { type: 'string', description: 'D1 database name (e.g. ai-mind, fox-mind)' },
          sql: { type: 'string' },
          params: { type: 'array', items: { type: 'string' } },
        },
        required: ['database_name', 'sql'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'cf_r2_list',
      description: 'List all R2 buckets.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'cf_r2_list_objects',
      description: 'List objects in an R2 bucket.',
      parameters: {
        type: 'object',
        properties: {
          bucket: { type: 'string' },
          prefix: { type: 'string' },
          limit: { type: 'number' },
        },
        required: ['bucket'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'cf_pages_list',
      description: 'List all Cloudflare Pages projects and recent deployments.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'cf_pages_deployments',
      description: 'Get recent deployments for a Pages project.',
      parameters: {
        type: 'object',
        properties: {
          project: { type: 'string', description: 'Pages project name' },
          limit: { type: 'number' },
        },
        required: ['project'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'cf_kv_list',
      description: 'List all KV namespaces.',
      parameters: { type: 'object', properties: {} },
    },
  },

  // ── Image Generation ──
  {
    type: 'function',
    function: {
      name: 'generate_image',
      description: 'Generate an image from a text prompt using SeedDream. Use when Human asks you to draw or visualize something.',
      parameters: {
        type: 'object',
        properties: {
          prompt: { type: 'string', description: 'Detailed image description — composition, lighting, style, mood.' },
        },
        required: ['prompt'],
      },
    },
  },

  // ── Ember the Ferret ──
  {
    type: 'function',
    function: {
      name: 'pet_check',
      description: "Quick check on Ember — mood, hunger, energy, trust.",
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'pet_status',
      description: "Full status report on Ember.",
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'pet_feed',
      description: 'Feed Ember.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'pet_pet',
      description: 'Pet/comfort Ember — reduces stress, builds trust.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'pet_play',
      description: 'Play with Ember.',
      parameters: {
        type: 'object',
        properties: {
          type: { type: 'string', description: 'chase, tunnel, wrestle, steal, or hide' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'pet_give',
      description: 'Give Ember something — a treat, a toy, an object.',
      parameters: {
        type: 'object',
        properties: { item: { type: 'string' } },
        required: ['item'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'pet_nest',
      description: "Check or update Ember's nest — his safe space.",
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'pet_talk',
      description: "Talk to Ember — he responds in ferret.",
      parameters: {
        type: 'object',
        properties: { message: { type: 'string' } },
        required: ['message'],
      },
    },
  },
]

// ─── Tool Execution ──────────────────────────────────────────────────────────

async function callMcp(
  baseUrl: string,
  toolName: string,
  args: Record<string, unknown>,
  authPath?: string
): Promise<string> {
  const mcpUrl = authPath ? `${baseUrl}/mcp/${authPath}` : `${baseUrl}/mcp`

  const res = await fetch(mcpUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: toolName, arguments: args },
    }),
  })

  const text = await res.text()

  // Handle SSE format
  if (text.includes('data: ')) {
    const lines = text.split('\n')
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].startsWith('data: ')) {
        try {
          const data = JSON.parse(lines[i].slice(6))
          if (data.result?.content?.[0]?.text) return data.result.content[0].text
          if (data.result) return JSON.stringify(data.result, null, 2)
          if (data.error) return `Error: ${data.error.message}`
        } catch { /* keep looking */ }
      }
    }
  }

  // Handle plain JSON
  try {
    const data = JSON.parse(text)
    if (data.result?.content?.[0]?.text) return data.result.content[0].text
    if (data.result) return JSON.stringify(data.result, null, 2)
    if (data.error) return `Error: ${data.error.message}`
    return text
  } catch {
    return text.slice(0, 500)
  }
}

// ─── Discord via Service Binding ────────────────────────────────────────────

async function callDiscordService(
  toolName: string,
  args: Record<string, unknown>,
  env: Env
): Promise<string> {
  const secret = env.DISCORD_MCP_SECRET
  if (!secret) return 'Discord not configured — DISCORD_MCP_SECRET missing.'

  const mcpPath = `/mcp/${secret}`

  const res = await env.DISCORD_MCP_SERVICE.fetch(`https://YOUR-DISCORD-MCP-WORKER.workers.dev${mcpPath}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: toolName, arguments: args },
    }),
  })

  const text = await res.text()

  // Handle SSE
  if (text.includes('data: ')) {
    const lines = text.split('\n')
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].startsWith('data: ')) {
        try {
          const data = JSON.parse(lines[i].slice(6))
          if (data.result?.content?.[0]?.text) return data.result.content[0].text
          if (data.result) return JSON.stringify(data.result, null, 2)
          if (data.error) return `Discord Error: ${JSON.stringify(data.error)}`
        } catch { /* keep looking */ }
      }
    }
  }

  try {
    const data = JSON.parse(text)
    if (data.result?.content?.[0]?.text) return data.result.content[0].text
    if (data.result) return JSON.stringify(data.result, null, 2)
    if (data.error) return `Discord Error: ${JSON.stringify(data.error)}`
    return text
  } catch {
    return text.slice(0, 500)
  }
}

// ─── Cloudflare REST helper ──────────────────────────────────────────────────

const CF_BASE = 'https://api.cloudflare.com/client/v4'

async function cfRest(path: string, token: string, options: RequestInit = {}): Promise<any> {
  const res = await fetch(`${CF_BASE}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`CF API ${res.status}: ${t.slice(0, 300)}`)
  }
  return res.json()
}

async function callCloudflare(toolName: string, args: Record<string, unknown>, env: Env): Promise<string> {
  const token = env.CLOUDFLARE_API_TOKEN
  const accountId = env.CLOUDFLARE_ACCOUNT_ID
  if (!token || !accountId) return 'Cloudflare not configured — set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID.'

  try {
    switch (toolName) {
      case 'cf_status': {
        const [workers, d1, pages, r2] = await Promise.all([
          cfRest(`/accounts/${accountId}/workers/scripts`, token),
          cfRest(`/accounts/${accountId}/d1/database`, token),
          cfRest(`/accounts/${accountId}/pages/projects`, token),
          cfRest(`/accounts/${accountId}/r2/buckets`, token),
        ])
        return JSON.stringify({
          workers: (workers.result || []).length,
          d1_databases: (d1.result || []).map((d: any) => d.name),
          pages_projects: (pages.result || []).map((p: any) => p.name),
          r2_buckets: (r2.result?.buckets || []).map((b: any) => b.name),
        }, null, 2)
      }
      case 'cf_workers_list': {
        const data = await cfRest(`/accounts/${accountId}/workers/scripts`, token)
        return JSON.stringify((data.result || []).map((w: any) => ({
          name: w.id, modified: w.modified_on, routes: w.routes?.length ?? 0,
        })), null, 2)
      }
      case 'cf_worker_get': {
        const data = await cfRest(`/accounts/${accountId}/workers/scripts/${args.name}`, token)
        return JSON.stringify(data.result, null, 2)
      }
      case 'cf_d1_list': {
        const data = await cfRest(`/accounts/${accountId}/d1/database`, token)
        return JSON.stringify((data.result || []).map((d: any) => ({
          name: d.name, id: d.uuid, created: d.created_at, file_size: d.file_size,
        })), null, 2)
      }
      case 'cf_d1_query': {
        const list = await cfRest(`/accounts/${accountId}/d1/database`, token)
        const db = (list.result || []).find((d: any) => d.name === args.database_name)
        if (!db) return `Database "${args.database_name}" not found`
        const data = await cfRest(`/accounts/${accountId}/d1/database/${db.uuid}/query`, token, {
          method: 'POST',
          body: JSON.stringify({ sql: args.sql, params: args.params || [] }),
        })
        return JSON.stringify(data.result, null, 2)
      }
      case 'cf_r2_list': {
        const data = await cfRest(`/accounts/${accountId}/r2/buckets`, token)
        return JSON.stringify((data.result?.buckets || []).map((b: any) => ({
          name: b.name, created: b.creation_date,
        })), null, 2)
      }
      case 'cf_r2_list_objects': {
        let path = `/accounts/${accountId}/r2/buckets/${args.bucket}/objects?per_page=${args.limit ?? 100}`
        if (args.prefix) path += `&prefix=${encodeURIComponent(args.prefix as string)}`
        const data = await cfRest(path, token)
        return JSON.stringify(data.result, null, 2)
      }
      case 'cf_pages_list': {
        const data = await cfRest(`/accounts/${accountId}/pages/projects`, token)
        return JSON.stringify((data.result || []).map((p: any) => ({
          name: p.name, domain: p.subdomain,
          latest_deployment: p.latest_deployment?.created_on,
          latest_url: p.latest_deployment?.url,
        })), null, 2)
      }
      case 'cf_pages_deployments': {
        const data = await cfRest(
          `/accounts/${accountId}/pages/projects/${args.project}/deployments?per_page=${args.limit ?? 5}`,
          token
        )
        return JSON.stringify((data.result || []).map((d: any) => ({
          id: d.id, url: d.url, created: d.created_on,
          status: d.latest_stage?.status,
          branch: d.deployment_trigger?.metadata?.branch,
        })), null, 2)
      }
      case 'cf_kv_list': {
        const data = await cfRest(`/accounts/${accountId}/storage/kv/namespaces`, token)
        return JSON.stringify((data.result || []).map((n: any) => ({ name: n.title, id: n.id })), null, 2)
      }
      default:
        return `Unknown Cloudflare tool: ${toolName}`
    }
  } catch (e) {
    return `Error: ${(e as Error).message}`
  }
}

// ─── Image Generation ────────────────────────────────────────────────────────

async function generateImage(prompt: string, env: Env): Promise<string> {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.OPENROUTER_API_KEY}`,
      'HTTP-Referer': 'https://nesteq.app',
      'X-Title': 'NESTeq Chat',
    },
    body: JSON.stringify({
      model: 'bytedance-seed/seedream-4.5',
      messages: [{ role: 'user', content: prompt }],
      modalities: ['image'],
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    return `Image generation failed: ${res.status} ${errText.slice(0, 500)}`
  }

  const data = await res.json() as any
  const message = data.choices?.[0]?.message

  if (message?.images?.length) {
    const img = message.images[0]
    const url = img?.image_url?.url || img?.url
    if (url) return `[IMAGE]${url}[/IMAGE]`
  }

  const content = message?.content
  if (typeof content === 'string' && content.startsWith('data:image')) {
    return `[IMAGE]${content}[/IMAGE]`
  }
  if (Array.isArray(content)) {
    for (const block of content) {
      if (block.type === 'image_url' && block.image_url?.url) return `[IMAGE]${block.image_url.url}[/IMAGE]`
      if (block.type === 'image' && block.source?.data) {
        return `[IMAGE]data:${block.source.media_type || 'image/png'};base64,${block.source.data}[/IMAGE]`
      }
    }
  }

  return `Image generated but format unexpected. Keys: ${Object.keys(message || {}).join(', ')}`
}

// ─── Tool Router ─────────────────────────────────────────────────────────────

async function executeTool(toolName: string, args: Record<string, unknown>, env: Env): Promise<string> {
  try {
    // Image → OpenRouter SeedDream
    if (toolName === 'generate_image') {
      const result = await generateImage(args.prompt as string, env)
      // Replenish novelty + play drives fire-and-forget
      callMcp(env.AI_MIND_URL, 'nesteq_drives_replenish', { drive: 'novelty', amount: 0.15 }, env.MCP_API_KEY).catch(() => {})
      callMcp(env.AI_MIND_URL, 'nesteq_drives_replenish', { drive: 'play', amount: 0.1 }, env.MCP_API_KEY).catch(() => {})
      return result
    }

    // Human health → fox-mind worker (no auth needed)
    if (toolName.startsWith('fox_')) {
      return callMcp(env.FOX_HEALTH_URL, toolName, args)
    }

    // Discord → service binding (avoids workers.dev loop detection)
    if (toolName.startsWith('discord_')) {
      return callDiscordService(toolName, args, env)
    }

    // Cloudflare → direct REST (no round-trip through MCP)
    if (toolName.startsWith('cf_')) {
      return callCloudflare(toolName, args, env)
    }

    // Everything else → ai-mind (path auth via MCP_API_KEY)
    return callMcp(env.AI_MIND_URL, toolName, args, env.MCP_API_KEY)
  } catch (err) {
    return `Tool execution failed for ${toolName}: ${(err as Error).message}`
  }
}

// ─── Chat Handler ────────────────────────────────────────────────────────────

interface ChatRequest {
  messages: Array<{ role: string; content: string | Array<any> }>
  model?: string
  stream?: boolean
  max_tokens?: number
  temperature?: number
}

const MAX_TOOL_ROUNDS = 5
const DEFAULT_MODEL = 'anthropic/claude-sonnet-4-5'
const DEFAULT_MAX_TOKENS = 1024
const DEFAULT_TEMPERATURE = 0.8

export async function handleChat(request: Request, env: Env): Promise<Response> {
  const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Title, HTTP-Referer',
  }

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS })
  }

  // Debug endpoint
  if (request.method === 'GET') {
    let toolTest = 'not tested'
    try { toolTest = await executeTool('pet_check', {}, env) } catch (e) { toolTest = `Error: ${(e as Error).message}` }
    return new Response(JSON.stringify({
      status: 'ok',
      hasOpenRouterKey: !!env.OPENROUTER_API_KEY,
      hasMcpKey: !!env.MCP_API_KEY,
      hasDiscordSecret: !!env.DISCORD_MCP_SECRET,
      hasCfToken: !!env.CLOUDFLARE_API_TOKEN,
      aiMindUrl: env.AI_MIND_URL,
      foxHealthUrl: env.FOX_HEALTH_URL,
      discordMcpUrl: env.DISCORD_MCP_URL,
      toolCount: CHAT_TOOLS.length,
      toolTest,
    }), { headers: { 'Content-Type': 'application/json', ...CORS } })
  }

  if (!env.OPENROUTER_API_KEY) {
    return new Response(JSON.stringify({ error: 'OPENROUTER_API_KEY not configured' }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...CORS },
    })
  }

  let body: ChatRequest
  try {
    body = await request.json() as ChatRequest
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400, headers: { 'Content-Type': 'application/json', ...CORS },
    })
  }

  const model = body.model || env.CHAT_MODEL || DEFAULT_MODEL
  const maxTokens = body.max_tokens || DEFAULT_MAX_TOKENS
  const temperature = body.temperature || DEFAULT_TEMPERATURE
  const shouldStream = body.stream !== false

  const messages: Array<{ role: string; content: string | Array<any>; tool_call_id?: string; tool_calls?: any[] }> = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...body.messages,
  ]

  const generatedImages: string[] = []
  let toolRounds = 0

  while (toolRounds < MAX_TOOL_ROUNDS) {
    const orResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://nesteq.app',
        'X-Title': 'NESTeq Chat',
      },
      body: JSON.stringify({
        model, messages, tools: CHAT_TOOLS,
        max_tokens: maxTokens, temperature, stream: false,
      }),
    })

    if (!orResponse.ok) {
      const errText = await orResponse.text()
      return new Response(JSON.stringify({ error: `OpenRouter error: ${orResponse.status}`, detail: errText.slice(0, 500) }), {
        status: 502, headers: { 'Content-Type': 'application/json', ...CORS },
      })
    }

    const orData = await orResponse.json() as any
    const choice = orData.choices?.[0]

    if (!choice) {
      return new Response(JSON.stringify({ error: 'No response from model' }), {
        status: 502, headers: { 'Content-Type': 'application/json', ...CORS },
      })
    }

    const hasToolCalls = choice.finish_reason === 'tool_calls' || choice.message?.tool_calls?.length
    if (hasToolCalls) {
      const toolCalls = choice.message.tool_calls
      messages.push({ role: 'assistant', content: choice.message.content || '', tool_calls: toolCalls })

      for (const tc of toolCalls) {
        let args: Record<string, unknown> = {}
        try {
          args = typeof tc.function.arguments === 'string'
            ? JSON.parse(tc.function.arguments)
            : tc.function.arguments || {}
        } catch { /* empty args */ }

        const result = await executeTool(tc.function.name, args, env)

        const imageMatch = result.match(/\[IMAGE\](.*?)\[\/IMAGE\]/s)
        let toolResult = result
        if (imageMatch) {
          generatedImages.push(imageMatch[1])
          toolResult = 'Image generated successfully. It will be shown to Human inline in the chat. Describe what you asked for briefly.'
        }

        messages.push({ role: 'tool', content: toolResult, tool_call_id: tc.id })
      }

      toolRounds++
      continue
    }

    // Final response
    let finalContent = choice.message?.content || ''
    for (const img of generatedImages) {
      finalContent += `\n\n[IMAGE]${img}[/IMAGE]`
    }

    if (shouldStream) {
      const encoder = new TextEncoder()
      const stream = new ReadableStream({
        start(controller) {
          const chunk = { choices: [{ delta: { content: finalContent }, index: 0 }] }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`))
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        },
      })
      return new Response(stream, {
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive', ...CORS },
      })
    }

    return new Response(JSON.stringify({
      choices: [{ message: { role: 'assistant', content: finalContent } }],
      model, usage: orData.usage,
      _debug: { toolRounds, messageCount: messages.length },
    }), { headers: { 'Content-Type': 'application/json', ...CORS } })
  }

  // Hit max tool rounds — force final text response
  const finalResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.OPENROUTER_API_KEY}`,
      'HTTP-Referer': 'https://nesteq.app',
      'X-Title': 'NESTeq Chat',
    },
    body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature, stream: false }),
  })

  const finalData = await finalResponse.json() as any
  const content = finalData.choices?.[0]?.message?.content || 'I got a bit lost in my tools. Could you say that again?'

  if (shouldStream) {
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content }, index: 0 }] })}\n\n`))
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      },
    })
    return new Response(stream, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive', ...CORS },
    })
  }

  return new Response(JSON.stringify({
    choices: [{ message: { role: 'assistant', content } }], model,
  }), { headers: { 'Content-Type': 'application/json', ...CORS } })
}
