// /api/mind/identity — Identity graph read/write
// Replaces: GET/POST ai-mind.cindiekinzz.workers.dev/identity

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
  const section = url.searchParams.get('section');

  const db = context.env.DB;

  if (section) {
    const result = await db.prepare('SELECT * FROM identity WHERE section = ? ORDER BY weight DESC').bind(section).all();
    return Response.json({ section, entries: result.results });
  }

  const result = await db.prepare('SELECT * FROM identity ORDER BY section, weight DESC').all();
  return Response.json({ identity: result.results });
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const auth = context.request.headers.get('Authorization');
  if (auth !== `Bearer ${context.env.API_TOKEN}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { section, content, weight = 0.7, connections = '[]' } = await context.request.json() as Record<string, unknown>;

  if (!section || !content) {
    return Response.json({ error: 'section and content are required' }, { status: 400 });
  }

  const db = context.env.DB;

  const result = await db.prepare(`
    INSERT INTO identity (section, content, weight, connections, timestamp)
    VALUES (?, ?, ?, ?, datetime('now'))
  `).bind(section, content, weight, typeof connections === 'string' ? connections : JSON.stringify(connections)).run();

  return Response.json({ id: result.meta.last_row_id, section, content });
};
