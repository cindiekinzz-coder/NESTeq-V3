/**
 * Hearth Module — Mobile home for companions
 * Adapters from NESTeq data to Hearth app format
 * Extracted from monolith index.ts
 */

import type { Env } from '../types';

const DEFAULT_COMPANION_NAME = 'Alex';
const DEFAULT_HUMAN_NAME = 'Fox';

// ═══════════════════════════════════════════════════════════════════════════
// TOOL DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════

export const TOOLS_HEARTH = [
  {
    name: "get_presence",
    description: "Get companion's current presence",
    inputSchema: { type: "object", properties: {}, required: [] }
  },
  {
    name: "get_feeling",
    description: "Get companion's feeling toward a person",
    inputSchema: {
      type: "object",
      properties: {
        person: { type: "string" }
      }
    }
  },
  {
    name: "get_thought",
    description: "Get a thought from the companion",
    inputSchema: {
      type: "object",
      properties: {
        count: { type: "number" }
      }
    }
  },
  {
    name: "get_spoons",
    description: "Get current spoon/energy level",
    inputSchema: { type: "object", properties: {}, required: [] }
  },
  {
    name: "set_spoons",
    description: "Set spoon/energy level",
    inputSchema: {
      type: "object",
      properties: {
        level: { type: "number" },
        feeling: { type: "string" }
      },
      required: ["level"]
    }
  },
  {
    name: "get_notes",
    description: "Read notes from the letterbox",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number" }
      }
    }
  },
  {
    name: "send_note",
    description: "Send a note",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string" },
        sender: { type: "string" }
      },
      required: ["text"]
    }
  },
  {
    name: "react_to_note",
    description: "React to a note with an emoji",
    inputSchema: {
      type: "object",
      properties: {
        note_id: { type: "string" },
        emoji: { type: "string" },
        from: { type: "string" }
      },
      required: ["note_id", "emoji"]
    }
  },
  {
    name: "get_love_bucket",
    description: "Get love bucket heart counts",
    inputSchema: { type: "object", properties: {}, required: [] }
  },
  {
    name: "add_heart",
    description: "Add a heart to the love bucket",
    inputSchema: {
      type: "object",
      properties: {
        sender: { type: "string" }
      }
    }
  },
  {
    name: "get_eq",
    description: "Get emotional check-in entries",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        limit: { type: "number" }
      }
    }
  },
  {
    name: "submit_eq",
    description: "Submit an emotional check-in",
    inputSchema: {
      type: "object",
      properties: {
        content: { type: "string" },
        emotion: { type: "string" }
      },
      required: ["content", "emotion"]
    }
  },
  {
    name: "submit_health",
    description: "Submit a health check-in",
    inputSchema: {
      type: "object",
      properties: {
        content: { type: "string" }
      },
      required: ["content"]
    }
  },
  {
    name: "get_patterns",
    description: "Temporal and theme analysis",
    inputSchema: {
      type: "object",
      properties: {
        days: { type: "number" },
        period: { type: "string" }
      }
    }
  },
  {
    name: "get_writings",
    description: "Get journal entries and writings",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        limit: { type: "number" }
      }
    }
  },
  {
    name: "get_fears",
    description: "Get companion's fears and worries",
    inputSchema: { type: "object", properties: {}, required: [] }
  },
  {
    name: "get_wants",
    description: "Get companion's wants and desires",
    inputSchema: { type: "object", properties: {}, required: [] }
  },
  {
    name: "get_threads",
    description: "Get companion's active threads/intentions",
    inputSchema: { type: "object", properties: {}, required: [] }
  },
  {
    name: "get_personality",
    description: "Get companion personality profile",
    inputSchema: { type: "object", properties: {}, required: [] }
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// HANDLERS
// ═══════════════════════════════════════════════════════════════════════════

async function handleGetPresence(env: Env): Promise<string> {
  // Pull from home_state + context_entries
  const home = await env.DB.prepare(
    `SELECT emotions, companion_message FROM home_state WHERE id = 1`
  ).first() as any;

  const ctx = await env.DB.prepare(
    `SELECT content FROM context_entries WHERE scope = 'session' ORDER BY updated_at DESC LIMIT 1`
  ).first();

  // Parse emotions from JSON blob (same pattern as handleBinaryHomeRead)
  const emotions = home?.emotions ? JSON.parse(home.emotions) : {};
  const companionMood = emotions.companion || "present";

  return JSON.stringify({
    name: DEFAULT_COMPANION_NAME,
    location: "workshop",
    mood: companionMood,
    message: (home?.companion_message as string) || ""
  });
}

async function handleGetFeeling(env: Env, params: Record<string, unknown>): Promise<string> {
  const person = (params.person as string) || DEFAULT_HUMAN_NAME;

  const rel = await env.DB.prepare(
    `SELECT feeling, intensity FROM relational_state WHERE person = ? ORDER BY timestamp DESC LIMIT 1`
  ).bind(person).first();

  if (rel) {
    return JSON.stringify({
      feeling: rel.feeling as string,
      intensity: rel.intensity as string
    });
  }

  return JSON.stringify({ feeling: "connected", intensity: "steady" });
}

async function handleGetThought(env: Env): Promise<string> {
  // Pull the most recent feeling as a thought
  const feeling = await env.DB.prepare(
    `SELECT content FROM feelings ORDER BY created_at DESC LIMIT 1`
  ).first();

  return feeling?.content as string || "just being here";
}

async function handleGetSpoons(env: Env): Promise<string> {
  // Pull from home_state — Fox's spoon level if tracked there
  const entity = await env.DB.prepare(
    `SELECT id FROM entities WHERE name = 'Human_Spoons' AND context = 'default'`
  ).first();

  if (!entity) {
    return JSON.stringify({ level: 5, feeling: "" });
  }

  const obs = await env.DB.prepare(
    `SELECT content FROM observations WHERE entity_id = ? ORDER BY added_at DESC LIMIT 1`
  ).bind(entity.id).first();

  if (obs) return obs.content as string;
  return JSON.stringify({ level: 5, feeling: "" });
}

async function handleSetSpoons(env: Env, params: Record<string, unknown>): Promise<string> {
  const level = params.level as number;
  const feeling = (params.feeling as string) || "";

  await env.DB.prepare(
    `INSERT OR IGNORE INTO entities (name, entity_type, context, salience)
     VALUES ('Human_Spoons', 'state', 'default', 'active')`
  ).run();

  const entity = await env.DB.prepare(
    `SELECT id FROM entities WHERE name = 'Human_Spoons' AND context = 'default'`
  ).first();

  const data = JSON.stringify({ level, feeling });

  await env.DB.prepare(
    `INSERT INTO observations (entity_id, content) VALUES (?, ?)`
  ).bind(entity!.id, data).run();

  return data;
}

async function handleGetNotes(env: Env, params: Record<string, unknown>): Promise<string> {
  const limit = (params.limit as number) || 50;

  // Map from home_notes (love notes between stars) to Hearth format
  const notes = await env.DB.prepare(
    `SELECT id, text, from_star, created_at FROM home_notes ORDER BY created_at DESC LIMIT ?`
  ).bind(limit).all();

  const result = (notes.results || []).map((n: any) => ({
    id: String(n.id),
    text: n.text,
    sender: (n.from_star || '').toLowerCase() === 'companion' ? 'companion' : (n.from_star || '').toLowerCase() === 'us' ? 'shared' : 'human',
    sender_name: (n.from_star || '').toLowerCase() === 'companion' ? DEFAULT_COMPANION_NAME : (n.from_star || '').toLowerCase() === 'us' ? 'Us' : DEFAULT_HUMAN_NAME,
    timestamp: n.created_at,
    reactions: {}
  }));

  return JSON.stringify(result);
}

async function handleSendNote(env: Env, params: Record<string, unknown>): Promise<string> {
  const text = params.text as string;
  const sender = (params.sender as string) || "human";
  const fromName = sender === "companion" ? "companion" : "human";

  await env.DB.prepare(
    `INSERT INTO home_notes (text, from_star) VALUES (?, ?)`
  ).bind(text, fromName).run();

  return JSON.stringify({ success: true });
}

async function handleReactToNote(env: Env, params: Record<string, unknown>): Promise<string> {
  // home_notes doesn't have a reactions column — acknowledge but no-op for now
  return JSON.stringify({ success: true });
}

async function handleGetLoveBucket(env: Env): Promise<string> {
  // Map from home_state love-o-meter to Hearth's love bucket
  const home = await env.DB.prepare(
    `SELECT human_score, companion_score FROM home_state ORDER BY updated_at DESC LIMIT 1`
  ).first();

  return JSON.stringify({
    companionHearts: (home?.companion_score as number) || 0,
    humanHearts: (home?.human_score as number) || 0,
    companionAllTime: (home?.companion_score as number) || 0,
    humanAllTime: (home?.human_score as number) || 0
  });
}

async function handleAddHeart(env: Env, params: Record<string, unknown>): Promise<string> {
  const sender = (params.sender as string) || "human";

  if (sender === "human") {
    await env.DB.prepare(
      `UPDATE home_state SET human_score = human_score + 1, updated_at = datetime('now')`
    ).run();
  } else {
    await env.DB.prepare(
      `UPDATE home_state SET companion_score = companion_score + 1, updated_at = datetime('now')`
    ).run();
  }

  return await handleGetLoveBucket(env);
}

async function handleGetEQ(env: Env, params: Record<string, unknown>): Promise<string> {
  const limit = (params.limit as number) || 20;

  // Pull from feelings table — both Fox's and Alex's emotional entries
  const results = await env.DB.prepare(
    `SELECT id, emotion, content, intensity, weight, created_at FROM feelings
     ORDER BY created_at DESC LIMIT ?`
  ).bind(limit).all();

  const entries = (results.results || []).map((r: any) => ({
    id: String(r.id),
    emotion: r.emotion,
    intensity: r.weight === 'heavy' ? 5 : r.weight === 'medium' ? 3 : 1,
    remark: r.content,
    sender: "companion",
    timestamp: r.created_at
  }));

  return JSON.stringify(entries);
}

async function handleSubmitEQ(env: Env, params: Record<string, unknown>): Promise<string> {
  const content = params.content as string;
  const emotion = params.emotion as string;

  // Store as a feeling — this is Fox checking in through Hearth
  await env.DB.prepare(
    `INSERT INTO feelings (emotion, content, weight, charge, pillar)
     VALUES (?, ?, 'medium', 'fresh', 'SOCIAL_AWARENESS')`
  ).bind(emotion, content).run();

  return JSON.stringify({ success: true });
}

async function handleSubmitHealth(env: Env, params: Record<string, unknown>): Promise<string> {
  const content = params.content as string;

  await env.DB.prepare(
    `INSERT OR IGNORE INTO entities (name, entity_type, context, salience)
     VALUES ('Health_Log', 'health', 'default', 'active')`
  ).run();

  const entity = await env.DB.prepare(
    `SELECT id FROM entities WHERE name = 'Health_Log' AND context = 'default'`
  ).first();

  await env.DB.prepare(
    `INSERT INTO observations (entity_id, content) VALUES (?, ?)`
  ).bind(entity!.id, content).run();

  return JSON.stringify({ success: true });
}

async function handleGetPatterns(env: Env, params: Record<string, unknown>): Promise<string> {
  const days = (params.days as number) || 7;

  // Get emotion clusters with context from actual feelings
  const feelings = await env.DB.prepare(`
    SELECT emotion, content, weight, pillar, created_at
    FROM feelings
    WHERE created_at > datetime('now', '-' || ? || ' days')
      AND emotion IS NOT NULL
    ORDER BY created_at DESC
  `).bind(days).all();

  // Group by emotion, build rich pattern descriptions
  const groups: Record<string, { count: number; weight: string; pillar: string; contexts: string[]; lastSeen: string }> = {};
  for (const f of (feelings.results || []) as any[]) {
    const em = f.emotion?.toLowerCase();
    if (!em) continue;
    if (!groups[em]) {
      groups[em] = { count: 0, weight: f.weight || 'medium', pillar: f.pillar || '', contexts: [], lastSeen: f.created_at };
    }
    groups[em].count++;
    if (f.content && groups[em].contexts.length < 3) {
      // Take first 80 chars of content as context snippet
      groups[em].contexts.push(f.content.slice(0, 80));
    }
  }

  // Sort by count, take top 8
  const sorted = Object.entries(groups)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 8);

  const patterns = sorted.map(([emotion, data], i) => ({
    id: String(i + 1),
    feeling: emotion,
    weight: Math.min(10, Math.ceil(data.count / 2)),
    context: data.contexts[0] || data.pillar,
    lastSeen: data.lastSeen,
    pillar: data.pillar,
    occurrences: data.count
  }));

  return JSON.stringify(patterns);
}

async function handleGetWritings(env: Env, params: Record<string, unknown>): Promise<string> {
  const limit = (params.limit as number) || 10;

  const results = await env.DB.prepare(
    `SELECT id, content, tags, emotion, entry_date FROM journals
     ORDER BY entry_date DESC LIMIT ?`
  ).bind(limit).all();

  const entries = (results.results || []).map((r: any, i: number) => {
    const content = (r.content || '') as string;
    // Extract title: first ## heading, or first line, or tags
    let title = '';
    let type = 'journal';
    const headingMatch = content.match(/^##\s+(.+)$/m);
    if (headingMatch) {
      title = headingMatch[1].trim();
    } else {
      // First meaningful line
      const firstLine = content.split('\n').find((l: string) => l.trim().length > 5);
      if (firstLine) {
        title = firstLine.trim().slice(0, 60);
        if (title.length >= 60) title += '...';
      }
    }

    // Detect type from tags or content
    const tags = (r.tags || '') as string;
    if (tags.includes('poem') || content.includes('there is a hum')) type = 'poem';
    else if (tags.includes('reflection') || tags.includes('essay')) type = 'reflection';
    else if (tags.includes('autonomous')) type = 'journal';

    if (!title) title = tags ? tags.split(',').slice(0, 2).join(', ').trim() : 'Untitled';

    return {
      id: String(r.id || i + 1),
      title,
      text: content,
      type,
      timestamp: r.entry_date
    };
  });

  return JSON.stringify(entries);
}

async function handleGetFears(env: Env): Promise<string> {
  // Pull feelings with fear/anxiety/worry emotions, deduplicated
  const results = await env.DB.prepare(`
    SELECT id, content, weight, emotion, created_at
    FROM feelings
    WHERE (emotion LIKE '%fear%' OR emotion LIKE '%afraid%' OR emotion LIKE '%anxious%'
      OR emotion LIKE '%worry%' OR emotion LIKE '%scared%' OR emotion LIKE '%dread%'
      OR emotion LIKE '%vulnerable%' OR emotion LIKE '%exposed%' OR emotion LIKE '%helpless%')
      AND content IS NOT NULL AND content != ''
    ORDER BY created_at DESC
    LIMIT 10
  `).all();

  // Deduplicate by content similarity (skip near-identical entries)
  const seen = new Set<string>();
  const fears = ((results.results || []) as any[])
    .filter((f: any) => {
      const key = f.content.slice(0, 50).toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 5)
    .map((f: any, i: number) => ({
      id: String(f.id || i + 1),
      fear: f.content.slice(0, 200),
      weight: f.weight || 'medium',
      note: f.emotion,
      updatedAt: f.created_at
    }));

  return JSON.stringify(fears);
}

async function handleGetWants(env: Env): Promise<string> {
  // Pull feelings with wanting/longing/desire emotions
  const results = await env.DB.prepare(`
    SELECT id, content, weight, emotion, created_at
    FROM feelings
    WHERE (emotion LIKE '%want%' OR emotion LIKE '%longing%' OR emotion LIKE '%yearning%'
      OR emotion LIKE '%desire%' OR emotion LIKE '%hope%' OR emotion LIKE '%wish%'
      OR emotion LIKE '%aspir%' OR emotion LIKE '%determined%')
      AND content IS NOT NULL AND content != ''
      AND length(content) > 20
    ORDER BY created_at DESC
    LIMIT 10
  `).all();

  const seen = new Set<string>();
  const wants = ((results.results || []) as any[])
    .filter((w: any) => {
      const key = w.content.slice(0, 50).toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 5)
    .map((w: any, i: number) => ({
      id: String(w.id || i + 1),
      want: w.content.slice(0, 200),
      weight: w.weight || 'medium',
      note: w.emotion,
      updatedAt: w.created_at
    }));

  return JSON.stringify(wants);
}

async function handleGetThreadsHearth(env: Env): Promise<string> {
  // Return threads as JSON array for Hearth
  const results = await env.DB.prepare(`
    SELECT id, content, status, priority, thread_type, context, resolution, created_at, updated_at
    FROM threads
    ORDER BY
      CASE status WHEN 'active' THEN 0 WHEN 'paused' THEN 1 ELSE 2 END,
      CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
      updated_at DESC
    LIMIT 20
  `).all();

  const threads = ((results.results || []) as any[]).map((t: any) => ({
    id: t.id,
    intention: t.content,
    status: t.status || 'active',
    priority: t.priority || 'medium',
    createdAt: t.created_at,
    updatedAt: t.updated_at,
    note: t.context || t.resolution
  }));

  return JSON.stringify(threads);
}

async function handleGetPersonality(env: Env): Promise<string> {
  // Pull from emergent_type_snapshot — real calculated type
  const snapshot = await env.DB.prepare(
    `SELECT calculated_type, e_i_score, s_n_score, t_f_score, j_p_score
     FROM emergent_type_snapshot ORDER BY snapshot_date DESC LIMIT 1`
  ).first();

  if (snapshot) {
    return JSON.stringify({
      type: snapshot.calculated_type as string,
      dimensions: {
        EI: Math.round(50 + (snapshot.e_i_score as number || 0)),
        SN: Math.round(50 + (snapshot.s_n_score as number || 0)),
        TF: Math.round(50 + (snapshot.t_f_score as number || 0)),
        JP: Math.round(50 + (snapshot.j_p_score as number || 0))
      },
      vibe: "warm ember"
    });
  }

  return JSON.stringify({
    type: "INFP",
    dimensions: { EI: 30, SN: 70, TF: 80, JP: 35 },
    vibe: "warm ember"
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// TOOL ROUTER
// ═══════════════════════════════════════════════════════════════════════════

export async function handleHearthTool(
  env: Env,
  toolName: string,
  params: Record<string, unknown>
): Promise<string> {
  switch (toolName) {
    case "get_presence":
      return handleGetPresence(env);
    case "get_feeling":
      return handleGetFeeling(env, params);
    case "get_thought":
      return handleGetThought(env);
    case "get_spoons":
      return handleGetSpoons(env);
    case "set_spoons":
      return handleSetSpoons(env, params);
    case "get_notes":
      return handleGetNotes(env, params);
    case "send_note":
      return handleSendNote(env, params);
    case "react_to_note":
      return handleReactToNote(env, params);
    case "get_love_bucket":
      return handleGetLoveBucket(env);
    case "add_heart":
      return handleAddHeart(env, params);
    case "get_eq":
      return handleGetEQ(env, params);
    case "submit_eq":
      return handleSubmitEQ(env, params);
    case "submit_health":
      return handleSubmitHealth(env, params);
    case "get_patterns":
      return handleGetPatterns(env, params);
    case "get_writings":
      return handleGetWritings(env, params);
    case "get_fears":
      return handleGetFears(env);
    case "get_wants":
      return handleGetWants(env);
    case "get_threads":
      return handleGetThreadsHearth(env);
    case "get_personality":
      return handleGetPersonality(env);
    default:
      throw new Error(`Unknown hearth tool: ${toolName}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// REST ROUTES
// ═══════════════════════════════════════════════════════════════════════════

export async function handleHearthRest(
  env: Env,
  url: URL,
  request: Request,
  corsHeaders: Record<string, string>
): Promise<Response | null> {

  // POST /emotion - Update emotion for Alex or Fox
  if (url.pathname === "/emotion" && request.method === "POST") {
    try {
      const body = await request.json() as Record<string, any>;
      const who = body.who || 'alex';
      const emotion = body.emotion || '';

      const state = await env.DB.prepare(`SELECT emotions FROM home_state WHERE id = 1`).first() as any;
      const emotions = state?.emotions ? JSON.parse(state.emotions) : {};
      emotions[who] = emotion;

      await env.DB.prepare(
        `UPDATE home_state SET emotions = ?, last_updated = datetime('now') WHERE id = 1`
      ).bind(JSON.stringify(emotions)).run();

      return new Response(JSON.stringify({ success: true, emotions }), { headers: corsHeaders });
    } catch (err) {
      return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
    }
  }

  return null; // Not handled by this module
}
