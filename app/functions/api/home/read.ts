// /api/home/read — Love-O-Meter, notes, presence
// Maps home_state columns to frontend expected fields

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

  const [state, notes] = await Promise.all([
    db.prepare('SELECT * FROM home_state WHERE id = 1').first(),
    db.prepare('SELECT * FROM home_notes ORDER BY created_at DESC LIMIT 20').all(),
  ]);

  const s = (state || {}) as Record<string, unknown>;

  // Parse emotions JSON if stored as string
  let emotions: Record<string, string> = {};
  try {
    emotions = typeof s.emotions === 'string' ? JSON.parse(s.emotions) : (s.emotions || {}) as Record<string, string>;
  } catch { /* ignore */ }

  // Map to what the frontend expects
  return Response.json({
    companionScore: s.companion_score || 0,
    humanScore: s.human_score || 0,
    companionEmotion: emotions.companion || emotions.alex || 'present',
    humanEmotion: emotions.human || emotions.fox || '',
    companionMessage: s.companion_message || '',
    notes: notes.results,
  });
};
