// /api/chat-sessions — Manage chat sessions and messages
// GET: list recent sessions or load a specific session's messages
// POST: create session, save message, or summarize+vectorize

interface Env {
  DB: D1Database;
  VECTORIZE?: VectorizeIndex;
  AI?: any;
  API_TOKEN: string;
}

function checkAuth(request: Request, env: Env): boolean {
  const auth = request.headers.get('Authorization')?.replace('Bearer ', '') || '';
  return auth === env.API_TOKEN || auth === (env as any).MIND_API_KEY;
}

// GET /api/chat-sessions?action=list|load|active
export const onRequestGet: PagesFunction<Env> = async (context) => {
  if (!checkAuth(context.request, context.env)) {
    return new Response('Unauthorized', { status: 401 });
  }

  const url = new URL(context.request.url);
  const action = url.searchParams.get('action') || 'list';
  const db = context.env.DB;

  if (action === 'active') {
    // Find the most recent session that hasn't ended (or ended less than 30 min ago)
    const session = await db.prepare(`
      SELECT id, started_at, message_count, last_message_at
      FROM chat_sessions
      WHERE ended_at IS NULL
         OR last_message_at > datetime('now', '-30 minutes')
      ORDER BY last_message_at DESC
      LIMIT 1
    `).first();

    if (session) {
      // Load its messages
      const messages = await db.prepare(`
        SELECT role, content, created_at
        FROM chat_messages
        WHERE session_id = ?
        ORDER BY created_at ASC
      `).bind(session.id).all();

      return Response.json({
        session,
        messages: messages.results || []
      });
    }

    return Response.json({ session: null, messages: [] });
  }

  if (action === 'load') {
    const sessionId = url.searchParams.get('id');
    if (!sessionId) return Response.json({ error: 'id required' }, { status: 400 });

    const session = await db.prepare(
      `SELECT * FROM chat_sessions WHERE id = ?`
    ).bind(sessionId).first();

    const messages = await db.prepare(`
      SELECT role, content, created_at
      FROM chat_messages
      WHERE session_id = ?
      ORDER BY created_at ASC
    `).bind(sessionId).all();

    return Response.json({
      session,
      messages: messages.results || []
    });
  }

  // Default: list recent sessions
  const limit = parseInt(url.searchParams.get('limit') || '20');
  const sessions = await db.prepare(`
    SELECT id, started_at, ended_at, summary, message_count, last_message_at
    FROM chat_sessions
    ORDER BY last_message_at DESC
    LIMIT ?
  `).bind(limit).all();

  return Response.json({ sessions: sessions.results || [] });
};

// POST /api/chat-sessions
export const onRequestPost: PagesFunction<Env> = async (context) => {
  if (!checkAuth(context.request, context.env)) {
    return new Response('Unauthorized', { status: 401 });
  }

  const body = await context.request.json() as Record<string, unknown>;
  const action = body.action as string;
  const db = context.env.DB;

  // Create a new session
  if (action === 'create') {
    const result = await db.prepare(`
      INSERT INTO chat_sessions (started_at, last_message_at)
      VALUES (CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id, started_at
    `).first();

    return Response.json({ session: result });
  }

  // Save a message to a session
  if (action === 'message') {
    const sessionId = body.session_id as number;
    const role = body.role as string;
    const content = body.content as string;

    if (!sessionId || !role || !content) {
      return Response.json({ error: 'session_id, role, content required' }, { status: 400 });
    }

    await db.prepare(`
      INSERT INTO chat_messages (session_id, role, content)
      VALUES (?, ?, ?)
    `).bind(sessionId, role, content).run();

    await db.prepare(`
      UPDATE chat_sessions
      SET message_count = message_count + 1,
          last_message_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(sessionId).run();

    return Response.json({ saved: true });
  }

  // Save both user + assistant messages in one call (more efficient)
  if (action === 'exchange') {
    const sessionId = body.session_id as number;
    const userMsg = body.user_message as string;
    const assistantMsg = body.assistant_message as string;

    if (!sessionId || !userMsg || !assistantMsg) {
      return Response.json({ error: 'session_id, user_message, assistant_message required' }, { status: 400 });
    }

    await db.batch([
      db.prepare(`INSERT INTO chat_messages (session_id, role, content) VALUES (?, 'user', ?)`).bind(sessionId, userMsg),
      db.prepare(`INSERT INTO chat_messages (session_id, role, content) VALUES (?, 'assistant', ?)`).bind(sessionId, assistantMsg),
      db.prepare(`UPDATE chat_sessions SET message_count = message_count + 2, last_message_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(sessionId),
    ]);

    return Response.json({ saved: true });
  }

  // End session + generate summary
  if (action === 'end') {
    const sessionId = body.session_id as number;
    if (!sessionId) return Response.json({ error: 'session_id required' }, { status: 400 });

    // Get all messages for this session
    const messages = await db.prepare(`
      SELECT role, content FROM chat_messages
      WHERE session_id = ?
      ORDER BY created_at ASC
    `).bind(sessionId).all();

    if (!messages.results?.length) {
      return Response.json({ error: 'no messages in session' }, { status: 400 });
    }

    // Build a condensed version for summary generation
    const condensed = (messages.results as Array<{role: string, content: string}>)
      .map(m => `${m.role}: ${m.content.slice(0, 200)}`)
      .join('\n');

    let summary = `Chat session with ${messages.results.length} messages`;

    // Try to generate a summary using Workers AI
    if (context.env.AI) {
      try {
        const aiResult = await context.env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
          messages: [
            { role: 'system', content: 'Summarize this conversation in 1-2 sentences. Focus on the key topics discussed and any decisions made. Be concise.' },
            { role: 'user', content: condensed.slice(0, 3000) }
          ],
          max_tokens: 150,
          temperature: 0.3
        });
        if (aiResult?.response) {
          summary = aiResult.response.trim();
        }
      } catch (err) {
        console.error('Summary generation failed:', err);
      }
    }

    // Update session with summary and end time
    await db.prepare(`
      UPDATE chat_sessions
      SET ended_at = CURRENT_TIMESTAMP,
          summary = ?
      WHERE id = ?
    `).bind(summary, sessionId).run();

    // Vectorize the summary for semantic search
    if (context.env.VECTORIZE && context.env.AI) {
      try {
        const embeddingResult = await context.env.AI.run('@cf/baai/bge-base-en-v1.5', {
          text: [summary]
        }) as { data: number[][] };

        await context.env.VECTORIZE.upsert([{
          id: `chat-session-${sessionId}`,
          values: embeddingResult.data[0],
          metadata: {
            source: 'chat_session',
            session_id: String(sessionId),
            content: summary.slice(0, 500),
            message_count: String(messages.results.length)
          }
        }]);

        await db.prepare(`
          UPDATE chat_sessions SET summary_vectorized = 1 WHERE id = ?
        `).bind(sessionId).run();
      } catch (err) {
        console.error('Vectorize failed:', err);
      }
    }

    return Response.json({ ended: true, summary });
  }

  return Response.json({ error: 'unknown action' }, { status: 400 });
};
