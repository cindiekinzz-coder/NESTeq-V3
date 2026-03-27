// /api/mind/search — Semantic search across memories via Vectorize
// Replaces: POST ai-mind.cindiekinzz.workers.dev/search

interface Env {
  DB: D1Database;
  VECTORIZE: VectorizeIndex;
  API_TOKEN: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const auth = context.request.headers.get('Authorization');
  if (auth !== `Bearer ${context.env.API_TOKEN}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { query, limit = 10 } = await context.request.json() as Record<string, unknown>;

  if (!query || typeof query !== 'string') {
    return Response.json({ error: 'query string is required' }, { status: 400 });
  }

  // For now, fall back to SQL LIKE search until Vectorize embeddings are set up
  // TODO: Replace with actual vector search once embeddings pipeline is running
  const db = context.env.DB;

  const [feelings, entities, observations] = await Promise.all([
    db.prepare(`
      SELECT id, content, emotion, intensity, pillar, observed_at
      FROM feelings
      WHERE content LIKE ?
      ORDER BY observed_at DESC
      LIMIT ?
    `).bind(`%${query}%`, limit).all(),
    db.prepare(`
      SELECT id, name, entity_type, created_at
      FROM entities
      WHERE name LIKE ?
      ORDER BY updated_at DESC
      LIMIT ?
    `).bind(`%${query}%`, limit).all(),
    db.prepare(`
      SELECT o.id, o.content, o.emotion, o.added_at, e.name as entity_name
      FROM observations o
      JOIN entities e ON o.entity_id = e.id
      WHERE o.content LIKE ?
      ORDER BY o.added_at DESC
      LIMIT ?
    `).bind(`%${query}%`, limit).all(),
  ]);

  return Response.json({
    query,
    results: {
      feelings: feelings.results,
      entities: entities.results,
      observations: observations.results,
    },
    total: (feelings.results?.length || 0) + (entities.results?.length || 0) + (observations.results?.length || 0),
  });
};
