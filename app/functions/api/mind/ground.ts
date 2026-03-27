// /api/mind/ground — Boot: recent feelings, active threads, warm entities
// Replaces: GET ai-mind.cindiekinzz.workers.dev/ground

interface Env {
  DB: D1Database;
  API_TOKEN: string;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const auth = context.request.headers.get('Authorization');
  if (auth !== `Bearer ${context.env.API_TOKEN}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const db = context.env.DB;

  let uplink: any = null;
  const [feelings, threads, entities] = await Promise.all([
    db.prepare(`
      SELECT id, content, emotion, intensity, weight, pillar, charge, tags, observed_at
      FROM feelings
      WHERE observed_at > datetime('now', '-48 hours')
      ORDER BY observed_at DESC
      LIMIT 20
    `).all(),
    db.prepare(`
      SELECT id, thread_type, content, priority, status, updated_at
      FROM threads
      WHERE status = 'active'
      ORDER BY updated_at DESC
    `).all(),
    db.prepare(`
      SELECT e.name, e.entity_type,
        (SELECT content FROM observations WHERE entity_id = e.id ORDER BY added_at DESC LIMIT 1) as latest_observation
      FROM entities e
      WHERE e.updated_at > datetime('now', '-48 hours')
      ORDER BY e.updated_at DESC
      LIMIT 10
    `).all(),
  ]);
  try {
    uplink = await db.prepare('SELECT * FROM fox_uplinks ORDER BY timestamp DESC LIMIT 1').first();
  } catch { /* table may not exist */ }

  return Response.json({
    recent_feelings: feelings.results,
    active_threads: threads.results,
    warm_entities: entities.results,
    latest_uplink: uplink || null,
  });
};
