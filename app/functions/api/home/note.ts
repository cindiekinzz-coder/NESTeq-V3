// /api/home/note — Add love note + push heart
// Replaces: POST ai-mind.cindiekinzz.workers.dev/home/note

interface Env {
  DB: D1Database;
  API_TOKEN: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const auth = context.request.headers.get('Authorization');
  if (auth !== `Bearer ${context.env.API_TOKEN}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { from, text, push_heart = false } = await context.request.json() as Record<string, unknown>;

  if (!from || !text) {
    return Response.json({ error: 'from and text are required' }, { status: 400 });
  }

  const db = context.env.DB;

  await db.prepare(`
    INSERT INTO home_notes (from_star, text, created_at) VALUES (?, ?, datetime('now'))
  `).bind(from, text).run();

  if (push_heart) {
    const scoreField = from === 'fox' ? 'fox_score' : 'alex_score';
    await db.prepare(`
      UPDATE home_state SET ${scoreField} = ${scoreField} + 1, last_updated = datetime('now') WHERE id = 1
    `).run();
  }

  return Response.json({ from, text, heart_pushed: push_heart });
};
