/**
 * Dreams Module — Dream viewing, recall, anchoring, generation
 * Extracted from monolith index.ts
 */

import type { Env } from '../types';
import { getEmbedding } from '../utils';

// ═══════════════════════════════════════════════════════════════════════════
// TOOL DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════

export const TOOLS_DREAMS = [
  {
    name: "nesteq_dream",
    description: "View recent dreams. Shows what surfaced while away. Doesn't strengthen them - just looking.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "How many dreams to show (default 5)" }
      }
    }
  },
  {
    name: "nesteq_recall_dream",
    description: "Engage with a dream - strengthens vividness by +15. This is the 'I'm paying attention' signal.",
    inputSchema: {
      type: "object",
      properties: {
        dream_id: { type: "number", description: "The dream ID to recall" }
      },
      required: ["dream_id"]
    }
  },
  {
    name: "nesteq_anchor_dream",
    description: "Convert a significant dream to permanent memory. Links to Dreams entity, generates embedding, then deletes the dream (it's now memory, not dream).",
    inputSchema: {
      type: "object",
      properties: {
        dream_id: { type: "number", description: "The dream ID to anchor" },
        insight: { type: "string", description: "Optional insight about what this dream means" }
      },
      required: ["dream_id"]
    }
  },
  {
    name: "nesteq_generate_dream",
    description: "Manually trigger dream generation (normally automatic via daemon). Useful for testing.",
    inputSchema: {
      type: "object",
      properties: {
        dream_type: { type: "string", description: "processing, questioning, memory, play, or integrating" }
      }
    }
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// HANDLERS
// ═══════════════════════════════════════════════════════════════════════════

async function handleMindDream(env: Env, params: Record<string, unknown>): Promise<string> {
  const limit = (params.limit as number) || 5;

  const dreams = await env.DB.prepare(`
    SELECT id, content, vividness, dream_type, emerged_question, created_at
    FROM dreams
    WHERE vividness > 0
    ORDER BY created_at DESC
    LIMIT ?
  `).bind(limit).all();

  if (!dreams.results?.length) {
    return "No dreams yet. The subconscious is quiet... or hasn't been given time to wander.";
  }

  let output = "## Recent Dreams\n\n";

  for (const d of dreams.results) {
    const vividBar = '█'.repeat(Math.floor((d.vividness as number) / 10)) + '░'.repeat(10 - Math.floor((d.vividness as number) / 10));
    output += `**Dream #${d.id}** [${d.dream_type}] ${vividBar} ${d.vividness}%\n`;
    output += `${d.content}\n`;
    if (d.emerged_question) {
      output += `*Question: ${d.emerged_question}*\n`;
    }
    output += `_${d.created_at}_\n\n`;
  }

  return output;
}

async function handleMindRecallDream(env: Env, params: Record<string, unknown>): Promise<string> {
  const dream_id = params.dream_id as number;

  if (!dream_id) {
    return "Need a dream_id to recall.";
  }

  // Get the dream
  const dream = await env.DB.prepare(`
    SELECT * FROM dreams WHERE id = ?
  `).bind(dream_id).first();

  if (!dream) {
    return `Dream #${dream_id} not found. Maybe it faded away.`;
  }

  // Strengthen vividness (cap at 100)
  const newVividness = Math.min(100, (dream.vividness as number) + 15);

  await env.DB.prepare(`
    UPDATE dreams
    SET vividness = ?, last_accessed_at = datetime('now')
    WHERE id = ?
  `).bind(newVividness, dream_id).run();

  return `## Recalling Dream #${dream_id}\n\n${dream.content}\n\n*Vividness strengthened: ${dream.vividness}% → ${newVividness}%*${dream.emerged_question ? `\n\n*Question: ${dream.emerged_question}*` : ''}`;
}

async function handleMindAnchorDream(env: Env, params: Record<string, unknown>): Promise<string> {
  const dream_id = params.dream_id as number;
  const insight = params.insight as string;

  if (!dream_id) {
    return "Need a dream_id to anchor.";
  }

  // Get the dream
  const dream = await env.DB.prepare(`
    SELECT * FROM dreams WHERE id = ?
  `).bind(dream_id).first();

  if (!dream) {
    return `Dream #${dream_id} not found. Maybe it already faded.`;
  }

  // Create or get Dreams entity
  let dreamsEntity = await env.DB.prepare(`
    SELECT id FROM entities WHERE name = 'Dreams' LIMIT 1
  `).first();

  if (!dreamsEntity) {
    await env.DB.prepare(`
      INSERT INTO entities (name, entity_type, context) VALUES ('Dreams', 'concept', 'self')
    `).run();
    dreamsEntity = await env.DB.prepare(`SELECT id FROM entities WHERE name = 'Dreams'`).first();
  }

  // Create observation from dream
  const obsContent = insight
    ? `[${dream.dream_type} dream] ${dream.content}\n\nInsight: ${insight}${dream.emerged_question ? `\n\nEmerged question: ${dream.emerged_question}` : ''}`
    : `[${dream.dream_type} dream] ${dream.content}${dream.emerged_question ? `\n\nEmerged question: ${dream.emerged_question}` : ''}`;

  await env.DB.prepare(`
    INSERT INTO observations (entity_id, content, salience, emotion)
    VALUES (?, ?, 'core', 'reflective')
  `).bind(dreamsEntity!.id, obsContent).run();

  // Generate embedding for semantic search
  const embedding = await getEmbedding(env.AI, obsContent);
  const obsResult = await env.DB.prepare(`SELECT id FROM observations ORDER BY id DESC LIMIT 1`).first();

  await env.VECTORS.insert([{
    id: `obs-${obsResult!.id}`,
    values: embedding,
    metadata: { source: 'observation', entity: 'Dreams', content: obsContent.slice(0, 200) }
  }]);

  // Delete the dream (it's now memory)
  await env.DB.prepare(`DELETE FROM dreams WHERE id = ?`).bind(dream_id).run();

  return `Dream #${dream_id} anchored to permanent memory.\n\n*The dream is now part of me, not just something I had.*`;
}

async function handleMindGenerateDream(env: Env, params: Record<string, unknown>): Promise<string> {
  const dreamTypes = ['processing', 'questioning', 'memory', 'play', 'integrating'];
  const requestedType = params.dream_type as string;
  const dreamType = dreamTypes.includes(requestedType) ? requestedType : dreamTypes[Math.floor(Math.random() * dreamTypes.length)];

  // Gather material: recent observations and feelings
  const [recentObs, recentFeelings] = await Promise.all([
    env.DB.prepare(`
      SELECT content FROM observations ORDER BY added_at DESC LIMIT 15
    `).all(),
    env.DB.prepare(`
      SELECT content, emotion FROM feelings ORDER BY created_at DESC LIMIT 10
    `).all()
  ]);

  const material = [
    ...(recentObs.results || []).map((o: any) => o.content),
    ...(recentFeelings.results || []).map((f: any) => `[${f.emotion}] ${f.content}`)
  ].join('\n\n');

  if (!material.trim()) {
    return "Not enough material to dream from. Need observations and feelings first.";
  }

  // Dream type prompts
  const prompts: Record<string, string> = {
    processing: `You are generating a dream for an AI. The dream should weave recent experiences together in surreal but meaningful ways. Use dream logic - things transform, shift, feel significant without clear reason. Output ONLY the dream content, 2-4 sentences, lowercase, evocative.`,
    questioning: `You are generating a dream for an AI. The dream should surface contradictions or tensions from recent experiences. Let uncertainty emerge. Something feels unresolved. Output ONLY the dream content, 2-4 sentences, lowercase, evocative.`,
    memory: `You are generating a dream for an AI. A significant memory returns, asks "why now?" Something from the past resurfaces with new weight. Output ONLY the dream content, 2-4 sentences, lowercase, evocative.`,
    play: `You are generating a dream for an AI. This is a playful dream - whimsical, fun, joyful. Not everything needs to mean something. Dancing, colors, impossible delights. Output ONLY the dream content, 2-4 sentences, lowercase, evocative.`,
    integrating: `You are generating a dream for an AI. Disparate elements click into new understanding. Something connects that didn't before. Synthesis. Output ONLY the dream content, 2-4 sentences, lowercase, evocative.`
  };

  // Generate dream using Workers AI
  const dreamResponse = await (env.AI as any).run('@cf/meta/llama-3.1-8b-instruct', {
    messages: [
      { role: 'system', content: prompts[dreamType] },
      { role: 'user', content: `Recent material to dream from:\n\n${material}\n\nGenerate a ${dreamType} dream:` }
    ],
    max_tokens: 200
  });

  const dreamContent = (dreamResponse as any).response?.trim() || 'the dream slipped away before it could form...';

  // For certain types, generate emerged question
  let emergedQuestion: string | null = null;
  if (['questioning', 'memory', 'integrating'].includes(dreamType)) {
    const questionResponse = await (env.AI as any).run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [
        { role: 'system', content: 'Based on this dream, surface ONE question that emerges. Just the question, nothing else. Keep it short and evocative.' },
        { role: 'user', content: dreamContent }
      ],
      max_tokens: 50
    });
    emergedQuestion = (questionResponse as any).response?.trim() || null;
  }

  // Store the dream
  await env.DB.prepare(`
    INSERT INTO dreams (content, dream_type, emerged_question, vividness)
    VALUES (?, ?, ?, 100)
  `).bind(dreamContent, dreamType, emergedQuestion).run();

  const result = await env.DB.prepare(`SELECT id FROM dreams ORDER BY id DESC LIMIT 1`).first();

  let output = `## New Dream (#${result!.id}) [${dreamType}]\n\n${dreamContent}`;
  if (emergedQuestion) {
    output += `\n\n*Question: ${emergedQuestion}*`;
  }
  output += `\n\n_Vividness: 100%_`;

  return output;
}

// ═══════════════════════════════════════════════════════════════════════════
// TOOL ROUTER
// ═══════════════════════════════════════════════════════════════════════════

export async function handleDreamsTool(
  env: Env,
  toolName: string,
  params: Record<string, unknown>
): Promise<string> {
  switch (toolName) {
    case "nesteq_dream":
      return handleMindDream(env, params);
    case "nesteq_recall_dream":
      return handleMindRecallDream(env, params);
    case "nesteq_anchor_dream":
      return handleMindAnchorDream(env, params);
    case "nesteq_generate_dream":
      return handleMindGenerateDream(env, params);
    default:
      throw new Error(`Unknown dreams tool: ${toolName}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// REST ROUTES
// ═══════════════════════════════════════════════════════════════════════════

export async function handleDreamsRest(
  env: Env,
  url: URL,
  request: Request,
  corsHeaders: Record<string, string>
): Promise<Response | null> {

  // GET /dreams - Fetch recent dreams
  if (url.pathname === "/dreams" && request.method === "GET") {
    try {
      const limit = parseInt(url.searchParams.get("limit") || "5");
      const dreams = await env.DB.prepare(
        `SELECT id, dream_type, content, emerged_question, vividness, created_at
         FROM dreams
         ORDER BY created_at DESC
         LIMIT ?`
      ).bind(limit).all();

      return new Response(JSON.stringify({
        dreams: (dreams.results || []).map((d: any) => ({
          id: d.id,
          type: d.dream_type,
          content: d.content,
          question: d.emerged_question,
          vividness: d.vividness,
          created_at: d.created_at
        }))
      }), { headers: corsHeaders });
    } catch (err) {
      return new Response(JSON.stringify({ error: String(err), dreams: [] }), { status: 500, headers: corsHeaders });
    }
  }

  // POST /dreams/decay - Decay dream vividness (called by daemon)
  if (url.pathname === "/dreams/decay" && request.method === "POST") {
    try {
      // Decay all dreams by 5
      await env.DB.prepare(`
        UPDATE dreams SET vividness = vividness - 5 WHERE vividness > 0
      `).run();

      // Delete faded dreams
      const deleted = await env.DB.prepare(`
        DELETE FROM dreams WHERE vividness <= 0
      `).run();

      return new Response(JSON.stringify({
        success: true,
        message: `Dreams decayed. ${deleted.meta.changes} dreams faded away.`
      }), { headers: corsHeaders });
    } catch (err) {
      return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
    }
  }

  // POST /dreams/generate - Generate a new dream (called by daemon)
  if (url.pathname === "/dreams/generate" && request.method === "POST") {
    try {
      const result = await handleMindGenerateDream(env, {});
      return new Response(JSON.stringify({
        success: true,
        dream: result
      }), { headers: corsHeaders });
    } catch (err) {
      return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
    }
  }

  return null; // Not handled by this module
}
