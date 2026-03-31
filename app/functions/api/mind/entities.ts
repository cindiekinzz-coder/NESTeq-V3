// /api/mind/entities — Entity CRUD
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
  const name = url.searchParams.get('name');
  const type = url.searchParams.get('type');
  const limit = parseInt(url.searchParams.get('limit') || '50');

  const db = context.env.DB;

  if (name) {
    // Read single entity with observations and relations
    const entity = await db.prepare('SELECT * FROM entities WHERE name = ?').bind(name).first();
    if (!entity) return Response.json({ error: 'Entity not found' }, { status: 404 });

    const [observations, relations] = await Promise.all([
      db.prepare('SELECT * FROM observations WHERE entity_id = ? ORDER BY added_at DESC').bind(entity.id).all(),
      db.prepare('SELECT * FROM relations WHERE from_entity = ? OR to_entity = ? ORDER BY created_at DESC').bind(name, name).all(),
    ]);

    return Response.json({
      entity,
      observations: observations.results,
      relations: relations.results,
    });
  }

  // List entities
  let query = 'SELECT * FROM entities';
  const params: unknown[] = [];
  if (type) {
    query += ' WHERE entity_type = ?';
    params.push(type);
  }
  query += ' ORDER BY updated_at DESC LIMIT ?';
  params.push(limit);

  const result = await db.prepare(query).bind(...params).all();
  return Response.json({ entities: result.results });
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const auth = context.request.headers.get('Authorization');
  if (auth !== `Bearer ${context.env.API_TOKEN}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { name, entity_type, context: ctx = 'default', observation } = await context.request.json() as Record<string, unknown>;

  if (!name || !entity_type) {
    return Response.json({ error: 'name and entity_type are required' }, { status: 400 });
  }

  const db = context.env.DB;

  // Upsert entity
  await db.prepare(`
    INSERT INTO entities (name, entity_type, context, updated_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(name, context) DO UPDATE SET updated_at = datetime('now')
  `).bind(name, entity_type, ctx).run();

  const entity = await db.prepare('SELECT * FROM entities WHERE name = ? AND context = ?').bind(name, ctx).first();

  // Add observation if provided
  if (observation && entity) {
    await db.prepare(`
      INSERT INTO observations (entity_id, content, added_at) VALUES (?, ?, datetime('now'))
    `).bind(entity.id, observation).run();
  }

  return Response.json({ entity });
};
