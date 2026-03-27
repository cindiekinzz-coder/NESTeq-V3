// /api/admin/health — System health check
// Table counts, database status, connectivity

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

  const tables = ['feelings', 'entities', 'observations', 'relations', 'identity', 'threads', 'fox_uplinks', 'journal_entries', 'home_notes', 'dreams', 'emotion_vocabulary'];

  const counts: Record<string, number> = {};
  for (const table of tables) {
    try {
      const result = await db.prepare(`SELECT COUNT(*) as count FROM ${table}`).first();
      counts[table] = (result as Record<string, number>)?.count || 0;
    } catch {
      counts[table] = -1; // table doesn't exist
    }
  }

  return Response.json({
    status: 'healthy',
    database: 'connected',
    tables: counts,
    timestamp: new Date().toISOString(),
  });
};
