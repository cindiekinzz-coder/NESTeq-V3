// /api/mind/threads — Thread CRUD
// Legacy endpoint compatibility

interface Env {
  DB: D1Database;
  API_TOKEN: string;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const auth = context.request.headers.get('Authorization');
  if (auth !== `Bearer ${context.env.API_TOKEN}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const url = new URL(context.request.url);
  const status = url.searchParams.get('status') || 'active';

  const db = context.env.DB;

  const result = await db.prepare(`
    SELECT * FROM threads WHERE status = ? ORDER BY updated_at DESC
  `).bind(status).all();

  return Response.json({ threads: result.results });
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const auth = context.request.headers.get('Authorization');
  if (auth !== `Bearer ${context.env.API_TOKEN}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const body = await context.request.json() as Record<string, unknown>;
  const { action = 'add', id, content, thread_type = 'intention', priority = 'medium', resolution } = body;

  const db = context.env.DB;

  if (action === 'add' && content) {
    const threadId = `thread_${Date.now()}`;
    await db.prepare(`
      INSERT INTO threads (id, thread_type, content, priority, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'active', datetime('now'), datetime('now'))
    `).bind(threadId, thread_type, content, priority).run();

    return Response.json({ id: threadId, content, status: 'active' });
  }

  if (action === 'resolve' && id) {
    await db.prepare(`
      UPDATE threads SET status = 'resolved', resolution = ?, resolved_at = datetime('now'), updated_at = datetime('now')
      WHERE id = ?
    `).bind(resolution || '', id).run();

    return Response.json({ id, status: 'resolved' });
  }

  if (action === 'update' && id && content) {
    await db.prepare(`
      UPDATE threads SET content = ?, updated_at = datetime('now') WHERE id = ?
    `).bind(content, id).run();

    return Response.json({ id, content, status: 'updated' });
  }

  return Response.json({ error: 'Invalid action or missing fields' }, { status: 400 });
};
