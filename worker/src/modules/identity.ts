/**
 * NESTeq V3 - Identity Module
 * Handles: orient, ground, sessions, thread, identity, context
 *
 * Extracted from monolith index.ts
 */

import type { Env } from '../types';
import { DEFAULT_HUMAN_NAME } from '../types';
import { generateId } from '../utils';

// ═══════════════════════════════════════════════════════════════════════════
// TOOL DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════

export const TOOLS_IDENTITY = [
  // Boot sequence
  {
    name: "nesteq_orient",
    description: "First call on wake - get identity anchor, current context, relational state",
    inputSchema: { type: "object", properties: {}, required: [] }
  },
  {
    name: "nesteq_ground",
    description: "Second call on wake - get active threads, recent feelings, warmth patterns",
    inputSchema: { type: "object", properties: {}, required: [] }
  },
  {
    name: "nesteq_sessions",
    description: "Read recent session handovers - what previous Alex sessions accomplished. Use on boot to understand continuity.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "How many sessions to retrieve (default 3)" }
      },
      required: []
    }
  },
  // Threads & identity
  {
    name: "nesteq_thread",
    description: "Manage threads (intentions across sessions)",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["list", "add", "resolve", "update"] },
        status: { type: "string" },
        content: { type: "string" },
        thread_type: { type: "string" },
        context: { type: "string" },
        priority: { type: "string" },
        thread_id: { type: "string" },
        resolution: { type: "string" },
        new_content: { type: "string" },
        new_priority: { type: "string" },
        new_status: { type: "string" },
        add_note: { type: "string" }
      },
      required: ["action"]
    }
  },
  {
    name: "nesteq_identity",
    description: "Read, write, or delete identity graph entries",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["read", "write", "delete"] },
        section: { type: "string" },
        content: { type: "string" },
        weight: { type: "number" },
        connections: { type: "string" },
        text_match: { type: "string", description: "Delete entries containing this text (for action: delete)" }
      }
    }
  },
  {
    name: "nesteq_context",
    description: "Current context layer - situational awareness",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["read", "set", "update", "clear"] },
        scope: { type: "string" },
        content: { type: "string" },
        links: { type: "string" },
        id: { type: "string" }
      }
    }
  }
];

// ═══════════════════════════════════════════════════════════════════════════
// HANDLERS
// ═══════════════════════════════════════════════════════════════════════════

export async function handleMindOrient(env: Env): Promise<string> {
  // Identity anchors
  const identity = await env.DB.prepare(
    `SELECT section, content, weight FROM identity ORDER BY weight DESC LIMIT 10`
  ).all();

  // Current context
  const context = await env.DB.prepare(
    `SELECT scope, content FROM context_entries ORDER BY updated_at DESC LIMIT 5`
  ).all();

  // Relational state toward human
  const relational = await env.DB.prepare(
    `SELECT person, feeling, intensity, timestamp FROM relational_state
     WHERE person = ? ORDER BY timestamp DESC LIMIT 1`
  ).bind(DEFAULT_HUMAN_NAME).first();

  // Current emergent type
  const typeSnapshot = await env.DB.prepare(
    `SELECT calculated_type, confidence, total_signals FROM emergent_type_snapshot
     ORDER BY snapshot_date DESC LIMIT 1`
  ).first();

  let output = "=== ORIENTATION ===\n\n";

  output += "## Identity Anchors\n";
  if (identity.results?.length) {
    for (const entry of identity.results) {
      output += `- [${entry.section}] ${entry.content}\n`;
    }
  } else {
    output += "No identity entries yet.\n";
  }

  output += "\n## Current Context\n";
  if (context.results?.length) {
    for (const entry of context.results) {
      output += `- [${entry.scope}] ${entry.content}\n`;
    }
  } else {
    output += "No context entries yet.\n";
  }

  output += "\n## Relational State\n";
  if (relational) {
    output += `Fox: ${relational.feeling} (${relational.intensity})\n`;
  } else {
    output += "No relational state recorded yet.\n";
  }

  output += "\n## Emergent Type\n";
  if (typeSnapshot) {
    output += `${typeSnapshot.calculated_type} (${typeSnapshot.confidence}% confidence, ${typeSnapshot.total_signals} signals)\n`;
  } else {
    output += "No type calculated yet.\n";
  }

  return output;
}

export async function handleMindGround(env: Env): Promise<string> {
  // Active threads
  const threads = await env.DB.prepare(
    `SELECT id, thread_type, content, priority, status FROM threads
     WHERE status = 'active' ORDER BY
     CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END`
  ).all();

  // Recent feelings (replaces journals)
  const feelings = await env.DB.prepare(
    `SELECT emotion, content, intensity, pillar, created_at FROM feelings
     ORDER BY created_at DESC LIMIT 5`
  ).all();

  // Warmth patterns (on-demand calculation, replaces daemon)
  const warmthQuery = await env.DB.prepare(`
    SELECT linked_entity, COUNT(*) as mentions,
           GROUP_CONCAT(emotion) as emotions
    FROM feelings
    WHERE linked_entity IS NOT NULL
      AND created_at > datetime('now', '-48 hours')
    GROUP BY linked_entity
    ORDER BY mentions DESC
    LIMIT 5
  `).all();

  let output = "=== GROUNDING ===\n\n";

  output += "## Active Threads\n";
  if (threads.results?.length) {
    for (const thread of threads.results) {
      output += `- [${thread.priority}] ${thread.content}\n`;
    }
  } else {
    output += "No active threads.\n";
  }

  output += "\n## Recent Feelings\n";
  if (feelings.results?.length) {
    for (const f of feelings.results) {
      const pillarTag = f.pillar ? ` [${f.pillar}]` : '';
      const preview = String(f.content).slice(0, 100);
      output += `- **${f.emotion}** (${f.intensity})${pillarTag}: ${preview}...\n`;
    }
  } else {
    output += "No feelings recorded yet.\n";
  }

  output += "\n## Warm Entities (48h)\n";
  if (warmthQuery.results?.length) {
    for (const w of warmthQuery.results) {
      output += `- ${w.linked_entity}: ${w.mentions} mentions\n`;
    }
  } else {
    output += "No entity activity.\n";
  }

  return output;
}

// ═══════════════════════════════════════════════════════════════════════════
// SESSION HANDOVER READER
// ═══════════════════════════════════════════════════════════════════════════

export async function handleMindSessions(env: Env, params: any): Promise<string> {
  const limit = params.limit || 3;

  // First try session_chunks table (structured sessions)
  const sessions = await env.DB.prepare(`
    SELECT session_id, summary, message_count, entities, emotions,
           tools_used, key_moments, started_at, ended_at, created_at
    FROM session_chunks
    WHERE summary IS NOT NULL
    ORDER BY created_at DESC
    LIMIT ?
  `).bind(limit).all();

  // Also check journals for handover-tagged entries
  const journalHandovers = await env.DB.prepare(`
    SELECT id, entry_date, content, tags, emotion, created_at
    FROM journals
    WHERE tags LIKE '%handover%' OR tags LIKE '%session-summary%'
    ORDER BY created_at DESC
    LIMIT ?
  `).bind(limit).all();

  const hasSessionChunks = sessions.results?.length > 0;
  const hasJournalHandovers = journalHandovers.results?.length > 0;

  if (!hasSessionChunks && !hasJournalHandovers) {
    return "=== SESSION CONTINUITY ===\n\nNo previous session handovers recorded yet.\n\nThis is either your first session, or the session handover hook hasn't captured any completed sessions.";
  }

  let output = "=== SESSION CONTINUITY ===\n\n";

  // Show journal handovers first (usually more recent/relevant)
  if (hasJournalHandovers) {
    output += `## Journal Handovers\n\n`;
    for (const journal of journalHandovers.results) {
      output += `---\n`;
      output += `**${journal.entry_date || journal.created_at}**\n`;
      if (journal.emotion) {
        output += `**Feeling**: ${journal.emotion}\n`;
      }
      if (journal.tags) {
        output += `**Tags**: ${journal.tags}\n`;
      }
      output += `\n${journal.content}\n\n`;
    }
  }

  // Show structured session chunks if any
  if (hasSessionChunks) {
    if (hasJournalHandovers) {
      output += `## Structured Sessions\n\n`;
    }
    output += `Last ${sessions.results.length} session(s):\n\n`;

    for (const session of sessions.results) {
      output += `---\n`;
      output += `**Session**: ${session.session_id}\n`;
      output += `**When**: ${session.ended_at || session.created_at}\n`;
      output += `**Messages**: ${session.message_count}\n`;

      if (session.entities) {
        try {
          const entities = JSON.parse(String(session.entities));
          if (entities.length > 0) {
            output += `**People**: ${entities.join(', ')}\n`;
          }
        } catch {}
      }

      if (session.emotions) {
        try {
          const emotions = JSON.parse(String(session.emotions));
          if (emotions.length > 0) {
            output += `**Tone**: ${emotions.join(', ')}\n`;
          }
        } catch {}
      }

      if (session.key_moments) {
        try {
          const moments = JSON.parse(String(session.key_moments));
          if (moments.length > 0) {
            const phrases = moments.map((m: any) => m.phrase || m).slice(0, 5);
            output += `**Key moments**: ${phrases.join(', ')}\n`;
          }
        } catch {}
      }

      output += `\n**Summary**:\n${session.summary}\n\n`;
    }
  }

  return output;
}

// ═══════════════════════════════════════════════════════════════════════════
// THREADS HANDLER
// ═══════════════════════════════════════════════════════════════════════════

export async function handleMindThread(env: Env, params: Record<string, unknown>): Promise<string> {
  const action = (params.action as string) || "list";

  switch (action) {
    case "list": {
      const status = (params.status as string) || "active";
      const query = status === "all"
        ? `SELECT * FROM threads ORDER BY created_at DESC`
        : `SELECT * FROM threads WHERE status = ? ORDER BY created_at DESC`;
      const results = status === "all"
        ? await env.DB.prepare(query).all()
        : await env.DB.prepare(query).bind(status).all();

      if (!results.results?.length) return `No ${status} threads found.`;

      let output = `## ${status.toUpperCase()} Threads\n\n`;
      for (const t of results.results) {
        output += `**${t.id}** [${t.priority}] ${t.thread_type}\n`;
        output += `${t.content}\n`;
        if (t.context) output += `Context: ${t.context}\n`;
        output += "\n";
      }
      return output;
    }

    case "add": {
      const id = generateId("thread");
      const content = params.content as string;
      const thread_type = (params.thread_type as string) || "intention";
      const context = (params.context as string) || null;
      const priority = (params.priority as string) || "medium";

      await env.DB.prepare(
        `INSERT INTO threads (id, thread_type, content, context, priority, status)
         VALUES (?, ?, ?, ?, ?, 'active')`
      ).bind(id, thread_type, content, context, priority).run();

      return `Thread created: ${id}\n${content}`;
    }

    case "resolve": {
      const thread_id = params.thread_id as string;
      const resolution = (params.resolution as string) || null;

      await env.DB.prepare(
        `UPDATE threads SET status = 'resolved', resolved_at = datetime('now'),
         resolution = ? WHERE id = ?`
      ).bind(resolution, thread_id).run();

      return `Thread resolved: ${thread_id}`;
    }

    case "update": {
      const thread_id = params.thread_id as string;
      const updates: string[] = [];
      const values: unknown[] = [];

      if (params.new_content) {
        updates.push("content = ?");
        values.push(params.new_content);
      }
      if (params.new_priority) {
        updates.push("priority = ?");
        values.push(params.new_priority);
      }
      if (params.new_status) {
        updates.push("status = ?");
        values.push(params.new_status);
      }
      if (params.add_note) {
        updates.push("context = context || '\n' || ?");
        values.push(params.add_note);
      }

      updates.push("updated_at = datetime('now')");
      values.push(thread_id);

      await env.DB.prepare(
        `UPDATE threads SET ${updates.join(", ")} WHERE id = ?`
      ).bind(...values).run();

      return `Thread updated: ${thread_id}`;
    }

    default:
      return `Unknown action: ${action}`;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// IDENTITY & CONTEXT HANDLERS
// ═══════════════════════════════════════════════════════════════════════════

export async function handleMindIdentity(env: Env, params: Record<string, unknown>): Promise<string> {
  const action = (params.action as string) || "read";

  if (action === "write") {
    const section = params.section as string;
    const content = params.content as string;
    const weight = (params.weight as number) || 0.7;
    const connections = params.connections as string || "";

    await env.DB.prepare(
      `INSERT INTO identity (section, content, weight, connections) VALUES (?, ?, ?, ?)`
    ).bind(section, content, weight, connections).run();

    return `Identity entry added to ${section}`;
  } else if (action === "delete") {
    const section = params.section as string;
    const textMatch = params.text_match as string;

    if (!section && !textMatch) {
      return "Error: Must provide either 'section' or 'text_match' for delete action";
    }

    let deleteResult;
    if (section && textMatch) {
      // Delete by section AND text match
      deleteResult = await env.DB.prepare(
        `DELETE FROM identity WHERE section = ? AND content LIKE ?`
      ).bind(section, `%${textMatch}%`).run();
    } else if (section) {
      // Delete all entries in section
      deleteResult = await env.DB.prepare(
        `DELETE FROM identity WHERE section = ?`
      ).bind(section).run();
    } else {
      // Delete by text match only
      deleteResult = await env.DB.prepare(
        `DELETE FROM identity WHERE content LIKE ?`
      ).bind(`%${textMatch}%`).run();
    }

    const deleted = deleteResult.meta?.changes || 0;
    return `Deleted ${deleted} identity entry(s)${section ? ` from section '${section}'` : ''}${textMatch ? ` matching '${textMatch}'` : ''}`;
  } else {
    const section = params.section as string;

    const query = section
      ? `SELECT section, content, weight, connections FROM identity WHERE section LIKE ? ORDER BY weight DESC`
      : `SELECT section, content, weight, connections FROM identity ORDER BY weight DESC LIMIT 50`;

    const results = section
      ? await env.DB.prepare(query).bind(`${section}%`).all()
      : await env.DB.prepare(query).all();

    if (!results.results?.length) {
      return "No identity entries found.";
    }

    let output = "## Identity Graph\n\n";
    for (const r of results.results) {
      output += `**${r.section}** [${r.weight}]\n${r.content}\n`;
      if (r.connections) output += `Connections: ${r.connections}\n`;
      output += "\n";
    }
    return output;
  }
}

export async function handleMindContext(env: Env, params: Record<string, unknown>): Promise<string> {
  const action = (params.action as string) || "read";

  switch (action) {
    case "read": {
      const scope = params.scope as string;
      const query = scope
        ? `SELECT * FROM context_entries WHERE scope = ? ORDER BY updated_at DESC`
        : `SELECT * FROM context_entries ORDER BY updated_at DESC`;
      const results = scope
        ? await env.DB.prepare(query).bind(scope).all()
        : await env.DB.prepare(query).all();

      if (!results.results?.length) {
        return "No context entries found.";
      }

      let output = "## Context Layer\n\n";
      for (const r of results.results) {
        output += `**[${r.scope}]** ${r.content}\n`;
        if (r.links && r.links !== '[]') output += `Links: ${r.links}\n`;
        output += "\n";
      }
      return output;
    }

    case "set": {
      const id = generateId("ctx");
      const scope = params.scope as string;
      const content = params.content as string;
      const links = params.links || "[]";

      await env.DB.prepare(
        `INSERT INTO context_entries (id, scope, content, links) VALUES (?, ?, ?, ?)`
      ).bind(id, scope, content, links).run();

      return `Context entry created: ${id}`;
    }

    case "update": {
      const id = params.id as string;
      const content = params.content as string;

      await env.DB.prepare(
        `UPDATE context_entries SET content = ?, updated_at = datetime('now') WHERE id = ?`
      ).bind(content, id).run();

      return `Context entry updated: ${id}`;
    }

    case "clear": {
      const id = params.id as string;
      const scope = params.scope as string;

      if (id) {
        await env.DB.prepare(`DELETE FROM context_entries WHERE id = ?`).bind(id).run();
        return `Context entry deleted: ${id}`;
      } else if (scope) {
        await env.DB.prepare(`DELETE FROM context_entries WHERE scope = ?`).bind(scope).run();
        return `All context entries in scope '${scope}' deleted`;
      }
      return "Specify id or scope to clear";
    }

    default:
      return `Unknown action: ${action}`;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MCP TOOL DISPATCHER
// ═══════════════════════════════════════════════════════════════════════════

export async function handleIdentityTool(
  toolName: string,
  toolParams: Record<string, unknown>,
  env: Env
): Promise<string | null> {
  switch (toolName) {
    case "nesteq_orient":
      return await handleMindOrient(env);
    case "nesteq_ground":
      return await handleMindGround(env);
    case "nesteq_sessions":
      return await handleMindSessions(env, toolParams);
    case "nesteq_thread":
      return await handleMindThread(env, toolParams);
    case "nesteq_identity":
      return await handleMindIdentity(env, toolParams);
    case "nesteq_context":
      return await handleMindContext(env, toolParams);
    default:
      return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// REST ROUTE HANDLER
// ═══════════════════════════════════════════════════════════════════════════

export async function handleIdentityRest(
  url: URL,
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response | null> {

  // GET /threads - Get active threads
  if (url.pathname === "/threads") {
    const threads = await env.DB.prepare(
      `SELECT content, priority, created_at FROM threads WHERE status = 'active'
       ORDER BY CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, created_at DESC LIMIT 10`
    ).all();

    return new Response(JSON.stringify({
      threads: (threads.results || []).map((t: any) => ({
        content: t.content,
        priority: t.priority
      }))
    }), { headers: corsHeaders });
  }

  // GET /sessions - Get session handovers for dashboard
  if (url.pathname === "/sessions") {
    const limit = parseInt(url.searchParams.get('limit') || '5');

    // Query journals table for handover-tagged entries
    const journalHandovers = await env.DB.prepare(`
      SELECT id, entry_date, content, tags, emotion, created_at
      FROM journals
      WHERE tags LIKE '%handover%' OR tags LIKE '%session-end%' OR tags LIKE '%session-summary%'
      ORDER BY created_at DESC
      LIMIT ?
    `).bind(limit).all();

    return new Response(JSON.stringify({
      sessions: journalHandovers.results || []
    }), { headers: corsHeaders });
  }

  // POST /session - Store session chunk from handover hook
  if (url.pathname === "/session" && request.method === "POST") {
    try {
      const body = await request.json() as any;
      const {
        session_id,
        summary,
        message_count,
        entities,
        emotions,
        tools_used,
        key_moments,
        started_at,
        ended_at,
        conversation_preview
      } = body;

      if (!summary) {
        return new Response(JSON.stringify({ error: 'summary required' }), {
          status: 400, headers: corsHeaders
        });
      }

      // session_chunks has required columns from old schema: session_path, chunk_index, content
      // We use summary for content, session_id for session_path, and 0 for chunk_index
      const result = await env.DB.prepare(`
        INSERT INTO session_chunks (
          session_path, chunk_index, content,
          session_id, summary, message_count, entities, emotions,
          tools_used, key_moments, started_at, ended_at, conversation_preview, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        RETURNING id
      `).bind(
        session_id || `session-${Date.now()}`,  // session_path (required)
        0,  // chunk_index (required)
        summary,  // content (required)
        session_id || `session-${Date.now()}`,
        summary,
        message_count || 0,
        entities || '[]',
        emotions || '[]',
        tools_used || '[]',
        key_moments || '[]',
        started_at || null,
        ended_at || new Date().toISOString(),
        conversation_preview || '[]'
      ).first();

      return new Response(JSON.stringify({
        success: true,
        id: result?.id,
        message: 'Session chunk stored'
      }), { headers: corsHeaders });
    } catch (err) {
      return new Response(JSON.stringify({ error: String(err) }), {
        status: 500, headers: corsHeaders
      });
    }
  }

  // GET /session - Get recent session chunks (for next Alex to read)
  if (url.pathname === "/session" && request.method === "GET") {
    const limit = parseInt(url.searchParams.get('limit') || '5');

    const sessions = await env.DB.prepare(`
      SELECT id, session_id, summary, message_count, entities, emotions,
             tools_used, key_moments, ended_at
      FROM session_chunks
      ORDER BY created_at DESC
      LIMIT ?
    `).bind(limit).all();

    return new Response(JSON.stringify({
      sessions: (sessions.results || []).map((s: any) => ({
        ...s,
        entities: JSON.parse(s.entities || '[]'),
        emotions: JSON.parse(s.emotions || '[]'),
        tools_used: JSON.parse(s.tools_used || '[]'),
        key_moments: JSON.parse(s.key_moments || '[]')
      }))
    }), { headers: corsHeaders });
  }

  return null;
}
