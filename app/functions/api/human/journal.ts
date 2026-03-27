// /api/human/journal — Human's journal entries
// Replaces: GET/POST fox-mind.cindiekinzz.workers.dev/journal

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
  const limit = parseInt(url.searchParams.get('limit') || '20');
  const includePrivate = url.searchParams.get('private') === 'true';

  const db = context.env.DB;

  let query = 'SELECT * FROM journal_entries';
  if (!includePrivate) query += ' WHERE private = 0';
  query += ' ORDER BY created_at DESC LIMIT ?';

  const result = await db.prepare(query).bind(limit).all();
  return Response.json({ entries: result.results });
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const auth = context.request.headers.get('Authorization');
  if (auth !== `Bearer ${context.env.API_TOKEN}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const body = await context.request.json() as Record<string, unknown>;
  const { content, mood, emotion, sub_emotion, tags = '[]', private: isPrivate = false } = body;

  if (!content) {
    return Response.json({ error: 'content is required' }, { status: 400 });
  }

  const db = context.env.DB;
  const id = `journal_${Date.now()}`;

  await db.prepare(`
    INSERT INTO journal_entries (id, user_id, content, mood, emotion, sub_emotion, tags, private, created_at)
    VALUES (?, 'human', ?, ?, ?, ?, ?, ?, datetime('now'))
  `).bind(
    id, content, mood || null, emotion || null, sub_emotion || null,
    typeof tags === 'string' ? tags : JSON.stringify(tags),
    isPrivate ? 1 : 0
  ).run();

  return Response.json({ id, content });
};
