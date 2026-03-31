// /api/mind/feel — Log a feeling to D1
// Legacy endpoint compatibility

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

  const body = await context.request.json() as Record<string, unknown>;
  const {
    emotion = 'neutral',
    content,
    intensity = 'present',
    weight = 'medium',
    pillar = null,
    tags = '[]',
    linked_entity = null,
    context: ctx = 'default',
    source = 'dhvn-app',
    conversation_context = null,
  } = body;

  if (!content) {
    return Response.json({ error: 'content is required' }, { status: 400 });
  }

  const db = context.env.DB;

  const result = await db.prepare(`
    INSERT INTO feelings (content, emotion, intensity, weight, pillar, tags, linked_entity, context, source, conversation_context, observed_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `).bind(
    content, emotion, intensity, weight, pillar,
    typeof tags === 'string' ? tags : JSON.stringify(tags),
    linked_entity, ctx, source,
    conversation_context ? JSON.stringify(conversation_context) : null
  ).run();

  const feelingId = result.meta.last_row_id;

  // Update emotion vocabulary usage count
  await db.prepare(`
    UPDATE emotion_vocabulary
    SET times_used = times_used + 1, last_used = datetime('now')
    WHERE emotion_word = ?
  `).bind(emotion).run();

  return Response.json({
    id: feelingId,
    emotion,
    content,
    intensity,
    weight,
    pillar,
  });
};
