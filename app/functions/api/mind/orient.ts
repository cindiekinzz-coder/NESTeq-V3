// /api/mind/orient — Boot: identity anchors, relational state, current type
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

  const db = context.env.DB;

  const [identity, relational, threads, latestType] = await Promise.all([
    db.prepare('SELECT section, content, weight FROM identity ORDER BY weight DESC').all(),
    db.prepare('SELECT person, feeling, intensity, timestamp FROM relational_state ORDER BY timestamp DESC LIMIT 10').all(),
    db.prepare("SELECT id, content, priority, status FROM threads WHERE status = 'active' ORDER BY updated_at DESC LIMIT 10").all(),
    db.prepare('SELECT * FROM emergent_type_snapshot ORDER BY snapshot_date DESC LIMIT 1').first(),
  ]);

  return Response.json({
    identity: identity.results,
    relational_state: relational.results,
    active_threads: threads.results,
    emergent_type: latestType || null,
  });
};
