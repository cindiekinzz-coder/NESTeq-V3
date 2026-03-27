// /api/human/uplink — Read/write uplink (spoons, pain, mood, needs)
// Replaces: GET/POST fox-mind.cindiekinzz.workers.dev/uplink

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
  const limit = parseInt(url.searchParams.get('limit') || '1');

  const db = context.env.DB;
  const result = await db.prepare(`
    SELECT * FROM fox_uplinks ORDER BY timestamp DESC LIMIT ?
  `).bind(limit).all();

  if (limit === 1 && result.results?.length) {
    return Response.json({ uplink: result.results[0] });
  }

  return Response.json({ uplinks: result.results });
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const auth = context.request.headers.get('Authorization');
  if (auth !== `Bearer ${context.env.API_TOKEN}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const body = await context.request.json() as Record<string, unknown>;
  const {
    spoons = 5,
    pain = 0,
    pain_location = '--',
    fog = 0,
    fatigue = 0,
    nausea = 0,
    mood = '--',
    need = 'Quiet presence',
    location = 'The Nest',
    notes = '',
    tags = '[]',
    meds = '[]',
    flare = null,
  } = body;

  const now = new Date();
  const date = now.toISOString().split('T')[0];
  const time = now.toTimeString().split(' ')[0].slice(0, 5);

  const db = context.env.DB;

  const result = await db.prepare(`
    INSERT INTO fox_uplinks (timestamp, date, time, location, need, pain, pain_location, spoons, fog, fatigue, nausea, mood, tags, meds, notes, flare, source, created_at)
    VALUES (datetime('now'), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'dhvn-app', datetime('now'))
  `).bind(
    date, time, location, need, pain, pain_location, spoons, fog, fatigue, nausea, mood,
    typeof tags === 'string' ? tags : JSON.stringify(tags),
    typeof meds === 'string' ? meds : JSON.stringify(meds),
    notes, flare
  ).run();

  return Response.json({ id: result.meta.last_row_id, spoons, pain, mood, need });
};
