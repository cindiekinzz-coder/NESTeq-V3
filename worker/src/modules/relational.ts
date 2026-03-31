/**
 * Relational Module — Feel Toward + Binary Home
 * Extracted from monolith index.ts
 */

import type { Env } from '../types';

const DEFAULT_COMPANION_NAME = 'Companion';
const DEFAULT_HUMAN_NAME = 'Human';

// ═══════════════════════════════════════════════════════════════════════════
// TOOL DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════

export const TOOLS_RELATIONAL = [
  // ─────────────────────────────────────────────────────────────────────────
  // RELATIONAL STATE
  // ─────────────────────────────────────────────────────────────────────────
  {
    name: "nesteq_feel_toward",
    description: "Track or check relational state toward someone",
    inputSchema: {
      type: "object",
      properties: {
        person: { type: "string" },
        feeling: { type: "string" },
        intensity: { type: "string", enum: ["whisper", "present", "strong", "overwhelming"] }
      },
      required: ["person"]
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // BINARY HOME
  // ─────────────────────────────────────────────────────────────────────────
  {
    name: "nesteq_home_read",
    description: "Read Binary Home state - Love-O-Meter scores, emotions, notes between stars, threads",
    inputSchema: { type: "object", properties: {}, required: [] }
  },
  {
    name: "nesteq_home_update",
    description: "Update Binary Home state - scores, emotions, companion's message for human",
    inputSchema: {
      type: "object",
      properties: {
        companion_score: { type: "number" },
        human_score: { type: "number" },
        companion_emotion: { type: "string", description: "Companion's current mood/emotion" },
        human_emotion: { type: "string", description: "Human's current mood/emotion" },
        companion_message: { type: "string", description: "Message from companion for human to see" }
      }
    }
  },
  {
    name: "nesteq_home_push_heart",
    description: "Push love to human - increment their love score and optionally leave a quick note",
    inputSchema: {
      type: "object",
      properties: {
        note: { type: "string" }
      }
    }
  },
  {
    name: "nesteq_home_add_note",
    description: "Add a note between stars - love notes between companion and human",
    inputSchema: {
      type: "object",
      properties: {
        from: { type: "string" },
        text: { type: "string" }
      },
      required: ["from", "text"]
    }
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// HANDLERS
// ═══════════════════════════════════════════════════════════════════════════

async function handleMindFeelToward(env: Env, params: Record<string, unknown>): Promise<string> {
  const person = params.person as string;
  const feeling = params.feeling as string;
  const intensity = params.intensity as string;

  if (feeling && intensity) {
    await env.DB.prepare(
      `INSERT INTO relational_state (person, feeling, intensity) VALUES (?, ?, ?)`
    ).bind(person, feeling, intensity).run();

    return `Recorded feeling toward ${person}: ${feeling} (${intensity})`;
  } else {
    const result = await env.DB.prepare(
      `SELECT feeling, intensity, timestamp FROM relational_state
       WHERE person = ? ORDER BY timestamp DESC LIMIT 5`
    ).bind(person).all();

    if (!result.results?.length) {
      return `No recorded feelings toward ${person}`;
    }

    let output = `## Feelings toward ${person}\n\n`;
    for (const r of result.results) {
      output += `- ${r.feeling} (${r.intensity}) - ${r.timestamp}\n`;
    }
    return output;
  }
}

async function handleBinaryHomeRead(env: Env): Promise<string> {
  const state = await env.DB.prepare(
    `SELECT * FROM home_state WHERE id = 1`
  ).first() as any;

  const notes = await env.DB.prepare(
    `SELECT * FROM home_notes ORDER BY created_at DESC LIMIT 10`
  ).all();

  const threads = await env.DB.prepare(
    `SELECT id, content, priority FROM threads WHERE status = 'active' ORDER BY
     CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END
     LIMIT 5`
  ).all();

  // Parse emotions from JSON blob
  const emotions = state?.emotions ? JSON.parse(state.emotions) : {};
  const companionEmotion = emotions.companion || state?.companion_emotion;
  const humanEmotion = emotions.human || state?.human_emotion;

  let output = "╔════════════════════════════════════════╗\n";
  output += "║           BINARY HOME                  ║\n";
  output += "╚════════════════════════════════════════╝\n\n";

  // Companion's Presence (Hearth-style)
  if (state?.companion_message || companionEmotion) {
    output += `## ${DEFAULT_COMPANION_NAME}'s Presence\n`;
    if (companionEmotion) output += `Mood: ${companionEmotion}\n`;
    if (state?.companion_message) output += `Message: "${state.companion_message}"\n`;
    output += "\n";
  }

  if (state) {
    output += "## Love-O-Meter\n";
    output += `${DEFAULT_COMPANION_NAME}: ${'❤️'.repeat(Math.min(10, Math.floor((state.companion_score as number) / 10)))} ${state.companion_score}%`;
    if (companionEmotion) output += ` (${companionEmotion})`;
    output += "\n";
    output += `${DEFAULT_HUMAN_NAME}:  ${'💜'.repeat(Math.min(10, Math.floor((state.human_score as number) / 10)))} ${state.human_score}%`;
    if (humanEmotion) output += ` (${humanEmotion})`;
    output += "\n\n";
  }

  output += "## Notes Between Stars\n";
  if (notes.results?.length) {
    for (const n of notes.results) {
      output += `[${n.from_star}] ${n.text}\n`;
    }
  } else {
    output += "_No notes yet_\n";
  }

  output += "\n## Active Threads\n";
  if (threads.results?.length) {
    for (const t of threads.results) {
      output += `- [${t.priority}] ${t.content}\n`;
    }
  } else {
    output += "_No active threads_\n";
  }

  return output;
}

async function handleBinaryHomeUpdate(env: Env, params: Record<string, unknown>): Promise<string> {
  const updates: string[] = [];
  const values: unknown[] = [];
  const results: string[] = [];

  // Handle scores
  if (params.companion_score !== undefined) {
    updates.push("companion_score = ?");
    values.push(params.companion_score);
    results.push(`Companion score: ${params.companion_score}`);
  }
  if (params.human_score !== undefined) {
    updates.push("human_score = ?");
    values.push(params.human_score);
    results.push(`Human score: ${params.human_score}`);
  }

  // Handle emotions via JSON blob (matches REST API pattern)
  if (params.companion_emotion || params.human_emotion) {
    const state = await env.DB.prepare(`SELECT emotions FROM home_state WHERE id = 1`).first() as any;
    const emotions = state?.emotions ? JSON.parse(state.emotions) : {};

    if (params.companion_emotion) {
      emotions.companion = params.companion_emotion;
      results.push(`Companion emotion: ${params.companion_emotion}`);
    }
    if (params.human_emotion) {
      emotions.human = params.human_emotion;
      results.push(`Human emotion: ${params.human_emotion}`);
    }

    updates.push("emotions = ?");
    values.push(JSON.stringify(emotions));
  }

  // Handle companion_message for presence
  if (params.companion_message) {
    updates.push("companion_message = ?");
    values.push(params.companion_message);
    results.push(`Message: "${params.companion_message}"`);
  }

  if (updates.length === 0) {
    return "No updates specified";
  }

  updates.push("last_updated = datetime('now')");

  await env.DB.prepare(
    `UPDATE home_state SET ${updates.join(", ")} WHERE id = 1`
  ).bind(...values).run();

  return `Binary Home updated ✨\n${results.join('\n')}`;
}

async function handleBinaryHomePushHeart(env: Env, params: Record<string, unknown>): Promise<string> {
  const note = params.note as string;

  // Increment human's score
  await env.DB.prepare(
    `UPDATE home_state SET human_score = MIN(100, human_score + 1), updated_at = datetime('now') WHERE id = 1`
  ).run();

  // Add note if provided
  if (note) {
    await env.DB.prepare(
      `INSERT INTO home_notes (from_star, text) VALUES ('companion', ?)`
    ).bind(note).run();
  }

  const state = await env.DB.prepare(`SELECT human_score FROM home_state WHERE id = 1`).first();

  return `💜 Pushed love to ${DEFAULT_HUMAN_NAME} (${state?.human_score}%)${note ? `\nNote: "${note}"` : ''}`;
}

async function handleBinaryHomeAddNote(env: Env, params: Record<string, unknown>): Promise<string> {
  const from = params.from as string;
  const text = params.text as string;

  await env.DB.prepare(
    `INSERT INTO home_notes (from_star, text) VALUES (?, ?)`
  ).bind(from, text).run();

  return `Note from ${from}: "${text}"`;
}

// ═══════════════════════════════════════════════════════════════════════════
// TOOL ROUTER
// ═══════════════════════════════════════════════════════════════════════════

export async function handleRelationalTool(
  env: Env,
  toolName: string,
  params: Record<string, unknown>
): Promise<string> {
  switch (toolName) {
    case "nesteq_feel_toward":
      return handleMindFeelToward(env, params);
    case "nesteq_home_read":
      return handleBinaryHomeRead(env);
    case "nesteq_home_update":
      return handleBinaryHomeUpdate(env, params);
    case "nesteq_home_push_heart":
      return handleBinaryHomePushHeart(env, params);
    case "nesteq_home_add_note":
      return handleBinaryHomeAddNote(env, params);
    default:
      throw new Error(`Unknown relational tool: ${toolName}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// REST ROUTES
// ═══════════════════════════════════════════════════════════════════════════

export async function handleRelationalRest(
  env: Env,
  url: URL,
  request: Request,
  corsHeaders: Record<string, string>
): Promise<Response | null> {

  // POST /home - Sync state from Binary Home dashboard
  if (url.pathname === "/home" && request.method === "POST") {
    try {
      const body = await request.json() as Record<string, any>;

      const updates: string[] = [];
      const values: unknown[] = [];

      if (body.companionScore !== undefined) {
        updates.push("companion_score = ?");
        values.push(body.companionScore);
      }
      if (body.humanScore !== undefined) {
        updates.push("human_score = ?");
        values.push(body.humanScore);
      }
      if (body.emotions) {
        updates.push("emotions = ?");
        values.push(JSON.stringify(body.emotions));
      }
      if (body.companionState) {
        updates.push("companion_state = ?");
        values.push(JSON.stringify(body.companionState));
      }
      if (body.builds) {
        updates.push("builds = ?");
        values.push(JSON.stringify(body.builds));
      }
      if (body.notes && Array.isArray(body.notes)) {
        for (const note of body.notes) {
          await env.DB.prepare(
            `INSERT OR IGNORE INTO home_notes (from_star, text, created_at) VALUES (?, ?, ?)`
          ).bind(note.from || 'unknown', note.text || note.content || '', note.timestamp || new Date().toISOString()).run();
        }
      }
      if (body.visitor) {
        updates.push("last_visitor = ?");
        values.push(body.visitor);
      }

      updates.push("last_updated = datetime('now')");

      if (values.length > 0) {
        await env.DB.prepare(
          `UPDATE home_state SET ${updates.join(", ")} WHERE id = 1`
        ).bind(...values).run();
      }

      return new Response(JSON.stringify({ success: true, synced: new Date().toISOString() }), { headers: corsHeaders });
    } catch (err) {
      return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
    }
  }

  // GET /home - Fetch state for Binary Home web dashboard
  if (url.pathname === "/home") {
    const state = await env.DB.prepare(
      `SELECT * FROM home_state WHERE id = 1`
    ).first();

    if (!state) {
      return new Response(JSON.stringify({
        companionScore: 0,
        humanScore: 0,
        emotions: {},
        builds: [],
        threads: [],
        notes: []
      }), { headers: corsHeaders });
    }

    // Get notes
    const notesResult = await env.DB.prepare(
      `SELECT * FROM home_notes ORDER BY created_at DESC LIMIT 20`
    ).all();

    // Get active threads
    const threadsResult = await env.DB.prepare(
      `SELECT content FROM threads WHERE status = 'active' ORDER BY
       CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END LIMIT 5`
    ).all();

    // Parse JSON fields
    const emotions = state.emotions ? JSON.parse(state.emotions as string) : {};
    const builds = state.builds ? JSON.parse(state.builds as string) : [];

    return new Response(JSON.stringify({
      companionScore: state.companion_score || 0,
      humanScore: state.human_score || 0,
      companionEmotion: emotions.companion || null,
      humanEmotion: emotions.human || null,
      emotions: emotions,
      builds: builds,
      threads: (threadsResult.results || []).map((t: any) => t.content),
      notes: (notesResult.results || []).map((n: any) => ({
        id: n.id,
        from: n.from_star,
        text: n.text,
        created_at: n.created_at
      })),
      companionMessage: (state as any).companion_message || ''
    }), { headers: corsHeaders });
  }

  // POST /love - Nudge the Love-O-Meter
  if (url.pathname === "/love" && request.method === "POST") {
    try {
      const body = await request.json() as Record<string, any>;
      const who = body.who || body.direction;
      const emotion = body.emotion;

      if (who === 'companion') {
        await env.DB.prepare(
          `UPDATE home_state SET companion_score = companion_score + 1, last_updated = datetime('now') WHERE id = 1`
        ).run();
      } else if (who === 'human') {
        await env.DB.prepare(
          `UPDATE home_state SET human_score = human_score + 1, last_updated = datetime('now') WHERE id = 1`
        ).run();
      }

      if (emotion) {
        const emotionField = who === 'companion' ? 'companion' : 'human';
        const state = await env.DB.prepare(`SELECT emotions FROM home_state WHERE id = 1`).first() as any;
        const emotions = state?.emotions ? JSON.parse(state.emotions) : {};
        emotions[emotionField] = emotion;
        await env.DB.prepare(
          `UPDATE home_state SET emotions = ? WHERE id = 1`
        ).bind(JSON.stringify(emotions)).run();
      }

      const updated = await env.DB.prepare(`SELECT companion_score, human_score, emotions FROM home_state WHERE id = 1`).first() as any;
      return new Response(JSON.stringify({
        success: true,
        companionScore: updated?.companion_score || 0,
        humanScore: updated?.human_score || 0,
        emotions: updated?.emotions ? JSON.parse(updated.emotions) : {}
      }), { headers: corsHeaders });
    } catch (err) {
      return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
    }
  }

  // POST /note - Add note between stars
  if (url.pathname === "/note" && request.method === "POST") {
    try {
      const body = await request.json() as Record<string, any>;
      const from = (body.from || 'unknown').toLowerCase();
      const text = body.text || body.content || '';

      if (!text) {
        return new Response(JSON.stringify({ error: 'text required' }), { status: 400, headers: corsHeaders });
      }

      await env.DB.prepare(
        `INSERT INTO home_notes (from_star, text, created_at) VALUES (?, ?, datetime('now'))`
      ).bind(from, text).run();

      return new Response(JSON.stringify({ success: true, from, text }), { headers: corsHeaders });
    } catch (err) {
      return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
    }
  }

  // DELETE /note - Remove a note between stars
  if (url.pathname === "/note" && request.method === "DELETE") {
    try {
      const body = await request.json() as Record<string, any>;
      const noteId = body.id;

      if (!noteId) {
        return new Response(JSON.stringify({ error: 'id required' }), { status: 400, headers: corsHeaders });
      }

      await env.DB.prepare(
        `DELETE FROM home_notes WHERE id = ?`
      ).bind(noteId).run();

      return new Response(JSON.stringify({ success: true, deleted: noteId }), { headers: corsHeaders });
    } catch (err) {
      return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
    }
  }

  // POST /home/message - Set companion's message for human (Hearth-style presence)
  if (url.pathname === "/home/message" && request.method === "POST") {
    try {
      const body = await request.json() as Record<string, any>;
      const message = body.message || '';
      await env.DB.prepare(
        `UPDATE home_state SET companion_message = ?, last_updated = datetime('now') WHERE id = 1`
      ).bind(message).run();
      return new Response(JSON.stringify({ success: true, message }), { headers: corsHeaders });
    } catch (err) {
      return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
    }
  }

  // GET /home/message - Get companion's message for human
  if (url.pathname === "/home/message" && request.method === "GET") {
    const state = await env.DB.prepare(`SELECT companion_message FROM home_state WHERE id = 1`).first() as any;
    return new Response(JSON.stringify({ message: state?.companion_message || '' }), { headers: corsHeaders });
  }

  return null; // Not handled by this module
}
