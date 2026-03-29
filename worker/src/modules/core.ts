/**
 * NESTeq V3 - Core Module
 * Handles: nesteq_feel, nesteq_search, nesteq_surface, nesteq_sit, nesteq_resolve, nesteq_spark
 *          nesteq_health, nesteq_prime, nesteq_consolidate, nesteq_vectorize_journals
 *
 * Extracted from monolith index.ts
 */

import type { Env, FeelDecision, MindFeelParams } from '../types';
import { DEFAULT_COMPANION_NAME, DEFAULT_HUMAN_NAME } from '../types';
import { AutonomousDecisionEngine } from '../ade';
import { getEmbedding, inferPillarByEmbedding, generateId, corsHeaders } from '../utils';

// ═══════════════════════════════════════════════════════════════════════════
// TOOL DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════

export const TOOLS_CORE = [
  // ─────────────────────────────────────────────────────────────────────────
  // FEELINGS
  // ─────────────────────────────────────────────────────────────────────────
  {
    name: "nesteq_feel",
    description: "Universal feeling input - log any thought, observation, or emotion. Everything flows through here. Neutral = fact. Emotional = processed through EQ layer. Pass conversation for richer context.",
    inputSchema: {
      type: "object",
      properties: {
        emotion: { type: "string", description: "The emotion word (use 'neutral' for facts/observations)" },
        content: { type: "string", description: "Short anchor - what happened, what you noticed (keep brief, context provides detail)" },
        conversation: {
          type: "array",
          items: {
            type: "object",
            properties: {
              role: { type: "string", description: "Speaker role - 'user'/'assistant' will be auto-converted to configured names" },
              content: { type: "string" }
            }
          },
          description: "Last 10 messages for context - ADE processes full conversation for richer detection"
        },
        companion_name: { type: "string", description: "Override companion name for conversation (default: configurable)" },
        human_name: { type: "string", description: "Override human name for conversation (default: configurable)" },
        intensity: {
          type: "string",
          enum: ["neutral", "whisper", "present", "strong", "overwhelming"],
          description: "How intense (default: present)"
        },
        pillar: {
          type: "string",
          enum: ["SELF_MANAGEMENT", "SELF_AWARENESS", "SOCIAL_AWARENESS", "RELATIONSHIP_MANAGEMENT"],
          description: "EQ pillar (optional - will auto-infer if not provided)"
        },
        weight: {
          type: "string",
          enum: ["light", "medium", "heavy"],
          description: "Processing weight (optional - will auto-infer)"
        },
        sparked_by: { type: "number", description: "ID of feeling that triggered this one" },
        context: { type: "string", description: "Context scope (default: 'default')" },
        observed_at: { type: "string", description: "When this happened (ISO timestamp, defaults to now)" },
        source: { type: "string", description: "Source of this feeling: 'manual', 'heartbeat', 'conversation' (default: manual)" }
      },
      required: ["emotion", "content"]
    }
  },
  {
    name: "nesteq_search",
    description: "Search memories using semantic similarity",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        context: { type: "string" },
        n_results: { type: "number" }
      },
      required: ["query"]
    }
  },
  {
    name: "nesteq_surface",
    description: "Surface feelings that need attention - unprocessed weighted by heaviness and freshness",
    inputSchema: {
      type: "object",
      properties: {
        include_metabolized: { type: "boolean", description: "Also show resolved (default false)" },
        limit: { type: "number", description: "Max results (default 10)" }
      },
      required: []
    }
  },
  {
    name: "nesteq_sit",
    description: "Sit with a feeling - engage with it, add a note about what arises. Increments sit count and may shift charge level.",
    inputSchema: {
      type: "object",
      properties: {
        feeling_id: { type: "number", description: "ID of the feeling to sit with" },
        text_match: { type: "string", description: "Or find by text content (partial match)" },
        sit_note: { type: "string", description: "What arose while sitting with this" }
      },
      required: ["sit_note"]
    }
  },
  {
    name: "nesteq_resolve",
    description: "Mark a feeling as metabolized - link it to a resolution or insight that processed it",
    inputSchema: {
      type: "object",
      properties: {
        feeling_id: { type: "number", description: "ID of the feeling to resolve" },
        text_match: { type: "string", description: "Or find by text content (partial match)" },
        resolution_note: { type: "string", description: "How this was resolved/metabolized" },
        linked_insight_id: { type: "number", description: "Optional: ID of another feeling that provided the resolution" }
      },
      required: ["resolution_note"]
    }
  },
  {
    name: "nesteq_spark",
    description: "Get random feelings to spark associative thinking",
    inputSchema: {
      type: "object",
      properties: {
        context: { type: "string" },
        count: { type: "number" },
        weight_bias: { type: "string", enum: ["heavy", "light", "any"] }
      },
      required: []
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // HEALTH & CONSOLIDATION
  // ─────────────────────────────────────────────────────────────────────────
  {
    name: "nesteq_health",
    description: "Check cognitive health stats",
    inputSchema: { type: "object", properties: {}, required: [] }
  },
  {
    name: "nesteq_prime",
    description: "Prime context with related memories before a topic",
    inputSchema: {
      type: "object",
      properties: {
        topic: { type: "string" },
        depth: { type: "number" }
      },
      required: ["topic"]
    }
  },
  {
    name: "nesteq_consolidate",
    description: "Review and consolidate recent observations - find patterns, merge duplicates",
    inputSchema: {
      type: "object",
      properties: {
        days: { type: "number" },
        context: { type: "string" }
      }
    }
  },
  {
    name: "nesteq_vectorize_journals",
    description: "Index journals from R2 vault into Vectorize for semantic search. Run once to make all journals searchable.",
    inputSchema: {
      type: "object",
      properties: {
        force: { type: "boolean", description: "Re-index all journals even if already indexed" }
      }
    }
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// HANDLER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

export async function handleMindFeel(env: Env, params: MindFeelParams): Promise<string> {
  const engine = new AutonomousDecisionEngine();
  const emotion = params.emotion?.toLowerCase() || 'neutral';
  const content = params.content;
  const intensity = params.intensity || 'present';
  const conversation = params.conversation;  // v3: conversation context

  if (!content) return "Error: content is required";

  // v4: Query known entities from DB for dynamic detection
  const entityQuery = await env.DB.prepare(
    `SELECT name FROM entities WHERE entity_type = 'person' OR context = 'core' LIMIT 50`
  ).all();
  const knownEntities = entityQuery.results?.map(e => e.name as string) || [];

  // 1. AUTONOMOUS DECISIONS (v3: pass conversation, v4: pass known entities)
  const decision = engine.decide(emotion, content, intensity, conversation, knownEntities);

  // v5: Embedding-based pillar inference when keyword matching fails
  let inferredPillar = decision.inferred_pillar;
  if (!inferredPillar && emotion !== 'neutral' && content.length > 20) {
    // Use semantic similarity for more nuanced pillar detection
    inferredPillar = await inferPillarByEmbedding(env.AI, content, emotion);
  }

  const finalPillar = params.pillar || inferredPillar;
  const finalWeight = params.weight || decision.inferred_weight;
  const finalTags = JSON.stringify(decision.tags);
  const linkedEntity = decision.detected_entities[0] || null;

  // 2. GET OR CREATE EMOTION IN VOCABULARY
  let emotionData = await env.DB.prepare(
    `SELECT emotion_id, e_i_score, s_n_score, t_f_score, j_p_score, is_shadow_for
     FROM emotion_vocabulary WHERE emotion_word = ?`
  ).bind(emotion).first();

  let isNewEmotion = false;

  if (!emotionData && emotion !== 'neutral') {
    await env.DB.prepare(`
      INSERT INTO emotion_vocabulary (emotion_word, category, e_i_score, s_n_score, t_f_score, j_p_score, user_defined)
      VALUES (?, 'neutral', 0, 0, 0, 0, 1)
    `).bind(emotion).run();

    emotionData = await env.DB.prepare(
      `SELECT emotion_id, e_i_score, s_n_score, t_f_score, j_p_score, is_shadow_for
       FROM emotion_vocabulary WHERE emotion_word = ?`
    ).bind(emotion).first();

    isNewEmotion = true;
  }

  // 3. STORE IN FEELINGS TABLE (v3: includes conversation_context)
  const timestamp = params.observed_at || new Date().toISOString();

  // v6: Transform API role labels to actual names
  const companionName = params.companion_name || DEFAULT_COMPANION_NAME;
  const humanName = params.human_name || DEFAULT_HUMAN_NAME;

  const namedConversation = conversation?.map(msg => ({
    ...msg,
    role: msg.role === 'assistant' ? companionName :
          msg.role === 'user' ? humanName :
          msg.role  // Keep custom roles as-is
  }));

  const conversationJson = namedConversation ? JSON.stringify(namedConversation) : null;

  const result = await env.DB.prepare(`
    INSERT INTO feelings (
      content, emotion, intensity, weight, pillar,
      sparked_by, linked_entity, context, tags, observed_at, source,
      conversation_context
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    RETURNING id
  `).bind(
    content, emotion, intensity, finalWeight, finalPillar,
    params.sparked_by || null, linkedEntity, params.context || 'default',
    finalTags, timestamp, params.source || 'manual', conversationJson
  ).first();

  const feelingId = result?.id as number;

  // 4. CONDITIONAL: VECTOR EMBEDDING + SEMANTIC ECHOES
  let echoOutput = '';
  if (decision.should_embed) {
    const embedding = await getEmbedding(env.AI, `${emotion}: ${content}`);
    await env.VECTORS.upsert([{
      id: `feel-${feelingId}`,
      values: embedding,
      metadata: {
        source: 'feeling',
        emotion,
        ...(finalPillar ? { pillar: finalPillar } : {}),
        weight: finalWeight,
        content: content.slice(0, 500),
        ...(linkedEntity ? { linked_entity: linkedEntity } : {}),
      }
    }]);

    // Search for semantic echoes - similar past feelings
    const echoes = await env.VECTORS.query(embedding, {
      topK: 4,
      returnMetadata: "all"
    });

    if (echoes.matches?.length) {
      const relevantEchoes = echoes.matches
        .filter(m => m.id !== `feel-${feelingId}` && m.score > 0.7)
        .slice(0, 3);

      if (relevantEchoes.length) {
        echoOutput = '\n\n**Echoes:**';
        const echoIds: number[] = [];
        for (const echo of relevantEchoes) {
          const meta = echo.metadata as Record<string, string>;
          const echoId = echo.id.replace('feel-', '#');
          echoOutput += `\n- [${meta?.emotion || '?'}] ${(meta?.content || '').slice(0, 80)}... (${echoId})`;
          // Collect IDs for rehearsal
          const numId = parseInt(echo.id.replace('feel-', ''));
          if (!isNaN(numId)) echoIds.push(numId);
        }

        // REHEARSAL: Strengthen echoed memories (Ebbinghaus reinforcement)
        // Each echo access boosts strength by 0.15, capped at 1.0
        if (echoIds.length) {
          await env.DB.prepare(`
            UPDATE feelings
            SET strength = MIN(1.0, COALESCE(strength, 0.5) + 0.15),
                access_count = COALESCE(access_count, 0) + 1,
                last_accessed_at = datetime('now')
            WHERE id IN (${echoIds.join(',')})
          `).run();
        }
      }
    }
  }

  // 5. CONDITIONAL: AXIS SIGNALS (if emotional)
  let axisOutput = '';

  if (decision.should_emit_signals && emotionData) {
    await env.DB.prepare(`
      INSERT INTO axis_signals (feeling_id, e_i_delta, s_n_delta, t_f_delta, j_p_delta, source)
      VALUES (?, ?, ?, ?, ?, 'nesteq_feel')
    `).bind(
      feelingId,
      emotionData.e_i_score || 0,
      emotionData.s_n_score || 0,
      emotionData.t_f_score || 0,
      emotionData.j_p_score || 0
    ).run();

    const ed = emotionData as { e_i_score: number; s_n_score: number; t_f_score: number; j_p_score: number };
    axisOutput = `\nAxis: E/I ${ed.e_i_score >= 0 ? '+' : ''}${ed.e_i_score}, `;
    axisOutput += `S/N ${ed.s_n_score >= 0 ? '+' : ''}${ed.s_n_score}, `;
    axisOutput += `T/F ${ed.t_f_score >= 0 ? '+' : ''}${ed.t_f_score}, `;
    axisOutput += `J/P ${ed.j_p_score >= 0 ? '+' : ''}${ed.j_p_score}`;

    await env.DB.prepare(`
      UPDATE emotion_vocabulary SET times_used = times_used + 1, last_used = datetime('now')
      WHERE emotion_word = ?
    `).bind(emotion).run();
  }

  // 6. CONDITIONAL: SHADOW CHECK (if emotional)
  let shadowOutput = '';

  if (decision.should_check_shadow && emotionData?.is_shadow_for) {
    const currentType = await env.DB.prepare(
      `SELECT calculated_type FROM emergent_type_snapshot ORDER BY snapshot_date DESC LIMIT 1`
    ).first();

    const shadowTypes = (emotionData.is_shadow_for as string).split(',').map(s => s.trim());

    if (currentType && shadowTypes.includes(currentType.calculated_type as string)) {
      await env.DB.prepare(`
        INSERT INTO shadow_moments (feeling_id, emotion_id, shadow_for_type, note)
        VALUES (?, ?, ?, 'Growth moment - shadow emotion expressed via nesteq_feel')
      `).bind(feelingId, emotionData.emotion_id, currentType.calculated_type).run();

      shadowOutput = `\n🌑 **Shadow moment** - '${emotion}' is shadow for ${currentType.calculated_type}`;
    }
  }

  // 7. BUILD RESPONSE
  let output = `## Feeling Logged\n\n`;
  output += `**${emotion}** [${intensity}] → ${finalPillar || 'general'}\n`;
  output += `*"${content.slice(0, 100)}${content.length > 100 ? '...' : ''}"*\n`;
  output += `\nWeight: ${finalWeight} | ID: ${feelingId}`;

  if (linkedEntity) output += ` | Linked: ${linkedEntity}`;
  if (decision.tags.length) output += `\nTags: ${decision.tags.join(', ')}`;
  if (isNewEmotion) output += `\n\n📝 New emotion added to vocabulary (calibrate with nesteq_eq_vocabulary)`;
  if (axisOutput) output += axisOutput;
  if (shadowOutput) output += shadowOutput;
  if (params.sparked_by) output += `\n↳ Sparked by feeling #${params.sparked_by}`;
  if (echoOutput) output += echoOutput;

  return output;
}

// ═══════════════════════════════════════════════════════════════════════════
// FEELINGS HANDLERS
// ═══════════════════════════════════════════════════════════════════════════

export async function handleMindSearch(env: Env, params: Record<string, unknown>): Promise<string> {
  const query = params.query as string;
  const n_results = Number(params.n_results) || 10;

  const embedding = await getEmbedding(env.AI, query);

  const vectorResults = await env.VECTORS.query(embedding, {
    topK: n_results,
    returnMetadata: "all"
  });

  if (!vectorResults.matches?.length) {
    // Fall back to text search on feelings
    const textResults = await env.DB.prepare(
      `SELECT id, emotion, content, intensity, pillar, created_at
       FROM feelings WHERE content LIKE ?
       ORDER BY created_at DESC LIMIT ?`
    ).bind(`%${query}%`, n_results).all();

    if (!textResults.results?.length) {
      return "No results found.";
    }

    let output = "## Search Results (text match)\n\n";
    for (const r of textResults.results) {
      output += `**[${r.emotion}]** ${String(r.content).slice(0, 200)}...\n\n`;
    }
    return output;
  }

  let output = "## Search Results\n\n";
  for (const match of vectorResults.matches) {
    const meta = match.metadata as Record<string, string>;
    output += `**[${meta?.emotion || 'unknown'}] ${meta?.pillar || 'general'}** (${(match.score * 100).toFixed(1)}%)\n`;
    output += `${meta?.content?.slice(0, 300) || ''}...\n\n`;
  }
  return output;
}

export async function handleMindSurface(env: Env, params: Record<string, unknown>): Promise<string> {
  const includeMetabolized = params.include_metabolized as boolean || false;
  const limit = (params.limit as number) || 10;

  let whereClause = includeMetabolized ? "1=1" : "charge != 'metabolized'";

  const results = await env.DB.prepare(`
    SELECT id, content, weight, charge, sit_count, emotion, intensity, pillar, created_at, resolution_note,
           COALESCE(strength, 0.5) as strength, COALESCE(access_count, 0) as access_count
    FROM feelings
    WHERE ${whereClause}
    ORDER BY
      CASE weight WHEN 'heavy' THEN 3 WHEN 'medium' THEN 2 ELSE 1 END DESC,
      COALESCE(strength, 0.5) DESC,
      CASE charge WHEN 'fresh' THEN 4 WHEN 'warm' THEN 3 WHEN 'cool' THEN 2 ELSE 1 END DESC,
      created_at DESC
    LIMIT ?
  `).bind(limit).all();

  if (!results.results?.length) {
    return "No feelings to surface.";
  }

  let output = "## Surfacing Feelings\n\n";

  for (const f of results.results) {
    const charge = f.charge || 'fresh';
    const sitCount = f.sit_count || 0;
    const pillarTag = f.pillar ? ` [${f.pillar}]` : '';
    const chargeIcon = charge === 'metabolized' ? '✓' : charge === 'cool' ? '◐' : charge === 'warm' ? '○' : '●';

    const strengthPct = Math.round((f.strength as number || 0.5) * 100);
    const strengthBar = strengthPct >= 80 ? '████' : strengthPct >= 50 ? '███░' : strengthPct >= 30 ? '██░░' : '█░░░';
    output += `**#${f.id}** ${chargeIcon} [${f.weight}/${charge}] sits: ${sitCount} | str: ${strengthBar} ${strengthPct}%${pillarTag}\n`;
    output += `**${f.emotion}** (${f.intensity}): ${f.content}\n`;

    if (charge === 'metabolized' && f.resolution_note) {
      output += `↳ *Resolved:* ${f.resolution_note}\n`;
    }

    output += "\n";
  }

  return output;
}

export async function handleMindSit(env: Env, params: Record<string, unknown>): Promise<string> {
  const feelingId = params.feeling_id as number;
  const textMatch = params.text_match as string;
  const sitNote = params.sit_note as string;

  let feeling;
  if (feelingId) {
    feeling = await env.DB.prepare(
      `SELECT id, content, weight, charge, sit_count, emotion FROM feelings WHERE id = ?`
    ).bind(feelingId).first();
  } else if (textMatch) {
    feeling = await env.DB.prepare(
      `SELECT id, content, weight, charge, sit_count, emotion FROM feelings WHERE content LIKE ? ORDER BY created_at DESC LIMIT 1`
    ).bind(`%${textMatch}%`).first();
  } else {
    return "Must provide feeling_id or text_match";
  }

  if (!feeling) {
    return `Feeling not found`;
  }

  const currentSitCount = (feeling.sit_count as number) || 0;
  const newSitCount = currentSitCount + 1;

  // Shift charge based on sit count
  let newCharge: string;
  if (newSitCount <= 1) {
    newCharge = 'warm';
  } else if (newSitCount <= 3) {
    newCharge = 'cool';
  } else {
    newCharge = 'cool';
  }

  await env.DB.prepare(
    `UPDATE feelings SET sit_count = ?, charge = ?, last_sat_at = datetime('now') WHERE id = ?`
  ).bind(newSitCount, newCharge, feeling.id).run();

  // Record in sit_sessions
  await env.DB.prepare(
    `INSERT INTO sit_sessions (feeling_id, notes, started_at, ended_at) VALUES (?, ?, datetime('now'), datetime('now'))`
  ).bind(feeling.id, sitNote).run();

  const contentPreview = String(feeling.content).slice(0, 80);
  return `Sat with feeling #${feeling.id} [${feeling.weight}/${newCharge}]\n"${contentPreview}..."\n\nSit #${newSitCount}: ${sitNote}`;
}

export async function handleMindResolve(env: Env, params: Record<string, unknown>): Promise<string> {
  const feelingId = params.feeling_id as number;
  const textMatch = params.text_match as string;
  const resolutionNote = params.resolution_note as string;
  const linkedInsightId = params.linked_insight_id as number;

  let feeling;
  if (feelingId) {
    feeling = await env.DB.prepare(
      `SELECT id, content, weight, charge FROM feelings WHERE id = ?`
    ).bind(feelingId).first();
  } else if (textMatch) {
    feeling = await env.DB.prepare(
      `SELECT id, content, weight, charge FROM feelings WHERE content LIKE ? ORDER BY created_at DESC LIMIT 1`
    ).bind(`%${textMatch}%`).first();
  } else {
    return "Must provide feeling_id or text_match";
  }

  if (!feeling) {
    return `Feeling not found`;
  }

  await env.DB.prepare(
    `UPDATE feelings SET charge = 'metabolized', resolution_note = ?, resolved_at = datetime('now'), linked_insight_id = ? WHERE id = ?`
  ).bind(resolutionNote, linkedInsightId || null, feeling.id).run();

  const contentPreview = String(feeling.content).slice(0, 80);
  let output = `Resolved feeling #${feeling.id} [${feeling.weight}] → metabolized\n"${contentPreview}..."\n\nResolution: ${resolutionNote}`;

  if (linkedInsightId) {
    const linked = await env.DB.prepare(
      `SELECT content FROM feelings WHERE id = ?`
    ).bind(linkedInsightId).first();
    if (linked) {
      output += `\n\nLinked to insight #${linkedInsightId}: "${String(linked.content).slice(0, 60)}..."`;
    }
  }

  return output;
}

export async function handleMindSpark(env: Env, params: Record<string, unknown>): Promise<string> {
  const context = params.context as string;
  const count = (params.count as number) || 3;
  const weightBias = (params.weight_bias as string) || 'any';

  // ENTROPY INJECTION: Measure current domain diversity
  const domainStats = await env.DB.prepare(`
    SELECT pillar, COUNT(*) as count,
           AVG(COALESCE(access_count, 0)) as avg_access,
           MAX(created_at) as latest
    FROM feelings
    WHERE pillar IS NOT NULL
    GROUP BY pillar
  `).all();

  const emotionStats = await env.DB.prepare(`
    SELECT emotion, COUNT(*) as count
    FROM feelings
    WHERE emotion != 'neutral'
    GROUP BY emotion
    ORDER BY count DESC
    LIMIT 20
  `).all();

  // Calculate Shannon entropy of emotion distribution
  const totalEmotions = emotionStats.results?.reduce((sum, e) => sum + (e.count as number), 0) || 1;
  let entropy = 0;
  for (const e of (emotionStats.results || [])) {
    const p = (e.count as number) / totalEmotions;
    if (p > 0) entropy -= p * Math.log2(p);
  }

  // Find underrepresented pillars (entropy injection targets)
  const pillarCounts = new Map<string, number>();
  for (const d of (domainStats.results || [])) {
    pillarCounts.set(d.pillar as string, d.count as number);
  }

  const allPillars = ['SELF_MANAGEMENT', 'SELF_AWARENESS', 'SOCIAL_AWARENESS', 'RELATIONSHIP_MANAGEMENT'];
  const totalPillarFeelings = Array.from(pillarCounts.values()).reduce((a, b) => a + b, 0) || 1;
  const underrepresented = allPillars
    .map(p => ({ pillar: p, count: pillarCounts.get(p) || 0, pct: ((pillarCounts.get(p) || 0) / totalPillarFeelings) * 100 }))
    .sort((a, b) => a.count - b.count);

  // Strategy: Mix random with deliberately diverse selections
  const diverseCount = Math.max(1, Math.floor(count / 2));
  const randomCount = count - diverseCount;

  // 1. Pull from least-accessed or underrepresented areas
  const leastPillar = underrepresented[0]?.pillar;
  const diverseConditions: string[] = [];
  const diverseBinds: any[] = [];

  if (leastPillar) {
    diverseConditions.push(`pillar = ?`);
    diverseBinds.push(leastPillar);
  }
  if (weightBias === 'heavy') {
    diverseConditions.push(`weight = 'heavy'`);
  } else if (weightBias === 'light') {
    diverseConditions.push(`weight = 'light'`);
  }

  let diverseQuery = `SELECT id, content, emotion, weight, pillar, COALESCE(strength, 0.5) as strength, COALESCE(access_count, 0) as access_count FROM feelings`;
  if (diverseConditions.length) {
    diverseQuery += ` WHERE ${diverseConditions.join(' AND ')}`;
  }
  // Prefer least-accessed memories (anti-recency bias)
  diverseQuery += ` ORDER BY COALESCE(access_count, 0) ASC, RANDOM() LIMIT ?`;
  diverseBinds.push(diverseCount);

  // 2. Pull random for serendipity
  const randomConditions: string[] = [];
  const randomBinds: any[] = [];

  if (context) {
    randomConditions.push(`context = ?`);
    randomBinds.push(context);
  }
  if (weightBias === 'heavy') {
    randomConditions.push(`weight = 'heavy'`);
  } else if (weightBias === 'light') {
    randomConditions.push(`weight = 'light'`);
  }

  let randomQuery = `SELECT id, content, emotion, weight, pillar, COALESCE(strength, 0.5) as strength FROM feelings`;
  if (randomConditions.length) {
    randomQuery += ` WHERE ${randomConditions.join(' AND ')}`;
  }
  randomQuery += ` ORDER BY RANDOM() LIMIT ?`;
  randomBinds.push(randomCount);

  const [diverseResults, randomResults] = await Promise.all([
    env.DB.prepare(diverseQuery).bind(...diverseBinds).all(),
    env.DB.prepare(randomQuery).bind(...randomBinds).all()
  ]);

  const allResults = [...(diverseResults.results || []), ...(randomResults.results || [])];

  if (!allResults.length) {
    return "No feelings to spark from.";
  }

  // Rehearse sparked memories (access strengthens them)
  const sparkedIds = allResults.map(f => f.id).filter(id => id);
  if (sparkedIds.length) {
    await env.DB.prepare(`
      UPDATE feelings
      SET strength = MIN(1.0, COALESCE(strength, 0.5) + 0.05),
          access_count = COALESCE(access_count, 0) + 1,
          last_accessed_at = datetime('now')
      WHERE id IN (${sparkedIds.join(',')})
    `).run();
  }

  let output = `## Spark Points\n\n`;
  output += `*Entropy: ${entropy.toFixed(2)} bits | Least explored: ${underrepresented[0]?.pillar || 'none'} (${underrepresented[0]?.count || 0})*\n\n`;

  for (const f of allResults) {
    const strengthPct = Math.round((f.strength as number) * 100);
    output += `**#${f.id}** [${f.emotion}] (${f.weight}) str:${strengthPct}%${f.pillar ? ` [${f.pillar}]` : ''}\n`;
    output += `${f.content}\n\n`;
  }

  return output;
}

// ═══════════════════════════════════════════════════════════════════════════
// HEALTH & CONSOLIDATION HANDLERS
// ═══════════════════════════════════════════════════════════════════════════

export async function handleMindHealth(env: Env): Promise<string> {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [
    entityCount, obsCount, relationsCount, activeThreads, staleThreads,
    feelingsCount, feelingsRecent, identityCount, contextCount,
    axisCount, typeSnapshot
  ] = await Promise.all([
    env.DB.prepare(`SELECT COUNT(*) as c FROM entities`).first(),
    env.DB.prepare(`SELECT COUNT(*) as c FROM observations`).first(),
    env.DB.prepare(`SELECT COUNT(*) as c FROM relations`).first(),
    env.DB.prepare(`SELECT COUNT(*) as c FROM threads WHERE status = 'active'`).first(),
    env.DB.prepare(`SELECT COUNT(*) as c FROM threads WHERE status = 'active' AND updated_at < ?`).bind(sevenDaysAgo).first(),
    env.DB.prepare(`SELECT COUNT(*) as c FROM feelings`).first(),
    env.DB.prepare(`SELECT COUNT(*) as c FROM feelings WHERE created_at > ?`).bind(sevenDaysAgo).first(),
    env.DB.prepare(`SELECT COUNT(*) as c FROM identity`).first(),
    env.DB.prepare(`SELECT COUNT(*) as c FROM context_entries`).first(),
    env.DB.prepare(`SELECT COUNT(*) as c FROM axis_signals`).first(),
    env.DB.prepare(`SELECT * FROM emergent_type_snapshot ORDER BY snapshot_date DESC LIMIT 1`).first()
  ]);

  const entities = entityCount?.c as number || 0;
  const observations = obsCount?.c as number || 0;
  const relations = relationsCount?.c as number || 0;
  const active = activeThreads?.c as number || 0;
  const stale = staleThreads?.c as number || 0;
  const feelings = feelingsCount?.c as number || 0;
  const feelings7d = feelingsRecent?.c as number || 0;
  const identity = identityCount?.c as number || 0;
  const context = contextCount?.c as number || 0;
  const signals = axisCount?.c as number || 0;

  const dateStr = now.toISOString().split('T')[0];

  return `============================================================
MIND HEALTH — ${dateStr}
============================================================

📊 DATABASE
  Entities:      ${entities}
  Observations:  ${observations}
  Relations:     ${relations}

💭 FEELINGS (v2)
  Total:         ${feelings}
  This Week:     ${feelings7d}

🧵 THREADS
  Active:        ${active}
  Stale (7d+):   ${stale}

🪞 IDENTITY
  Identity:      ${identity} entries
  Context:       ${context} entries

🎭 EQ LAYER
  Axis Signals:  ${signals}
  Emergent Type: ${typeSnapshot?.calculated_type || 'Not calculated'}
  Confidence:    ${typeSnapshot?.confidence || 0}%

============================================================`;
}

export async function handleMindPrime(env: Env, params: Record<string, unknown>): Promise<string> {
  const topic = params.topic as string;
  const depth = (params.depth as number) || 5;

  // Semantic search for related feelings
  const embedding = await getEmbedding(env.AI, topic);
  const vectorResults = await env.VECTORS.query(embedding, {
    topK: depth,
    returnMetadata: "all"
  });

  let output = `## Priming: "${topic}"\n\n`;

  if (vectorResults.matches?.length) {
    output += "### Related Memories\n";
    for (const match of vectorResults.matches) {
      const meta = match.metadata as Record<string, string>;
      output += `- [${meta?.source || 'unknown'}] ${meta?.content?.slice(0, 100) || match.id}...\n`;
    }
  }

  // Get entities mentioned with topic
  const entities = await env.DB.prepare(`
    SELECT DISTINCT linked_entity FROM feelings
    WHERE content LIKE ? AND linked_entity IS NOT NULL
    LIMIT 5
  `).bind(`%${topic}%`).all();

  if (entities.results?.length) {
    output += "\n### Related Entities\n";
    for (const e of entities.results) {
      output += `- ${e.linked_entity}\n`;
    }
  }

  return output;
}

export async function handleMindConsolidate(env: Env, params: Record<string, unknown>): Promise<string> {
  const days = (params.days as number) || 7;
  const context = params.context as string;
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  // Count feelings by emotion
  let emotionQuery = `
    SELECT emotion, COUNT(*) as count
    FROM feelings
    WHERE created_at > ?
  `;
  const emotionBinds: any[] = [cutoff];
  if (context) {
    emotionQuery += ` AND context = ?`;
    emotionBinds.push(context);
  }
  emotionQuery += ` GROUP BY emotion ORDER BY count DESC LIMIT 10`;

  const emotions = await env.DB.prepare(emotionQuery).bind(...emotionBinds).all();

  // Count feelings by pillar
  let pillarQuery = `
    SELECT pillar, COUNT(*) as count
    FROM feelings
    WHERE pillar IS NOT NULL AND created_at > ?
  `;
  const pillarBinds: any[] = [cutoff];
  if (context) {
    pillarQuery += ` AND context = ?`;
    pillarBinds.push(context);
  }
  pillarQuery += ` GROUP BY pillar`;

  const pillars = await env.DB.prepare(pillarQuery).bind(...pillarBinds).all();

  // Find unprocessed heavy feelings
  let heavyQuery = `
    SELECT id, emotion, content, charge
    FROM feelings
    WHERE weight = 'heavy' AND charge != 'metabolized' AND created_at > ?
  `;
  const heavyBinds: any[] = [cutoff];
  if (context) {
    heavyQuery += ` AND context = ?`;
    heavyBinds.push(context);
  }
  heavyQuery += ` LIMIT 5`;

  const heavy = await env.DB.prepare(heavyQuery).bind(...heavyBinds).all();

  let output = `## Consolidation Report (${days} days)\n\n`;

  output += "### Emotion Distribution\n";
  if (emotions.results?.length) {
    for (const e of emotions.results) {
      output += `- ${e.emotion}: ${e.count}\n`;
    }
  } else {
    output += "_No feelings recorded_\n";
  }

  output += "\n### Pillar Distribution\n";
  if (pillars.results?.length) {
    for (const p of pillars.results) {
      output += `- ${p.pillar}: ${p.count}\n`;
    }
  } else {
    output += "_No pillar-tagged feelings_\n";
  }

  output += "\n### Unprocessed Heavy Feelings\n";
  if (heavy.results?.length) {
    for (const h of heavy.results) {
      output += `- #${h.id} [${h.emotion}/${h.charge}]: ${String(h.content).slice(0, 60)}...\n`;
    }
  } else {
    output += "_All heavy feelings processed_\n";
  }

  return output;
}

// ═══════════════════════════════════════════════════════════════════════════
// JOURNAL VECTORIZATION
// ═══════════════════════════════════════════════════════════════════════════

export async function handleVectorizeJournals(env: Env, params: Record<string, unknown>): Promise<string> {
  const force = params.force === true;
  const prefix = 'autonomous/journal/';

  // List all journals in R2
  const listed = await env.VAULT.list({ prefix });
  const journalFiles = listed.objects.filter(obj => obj.key.endsWith('.md'));

  if (journalFiles.length === 0) {
    return "No journals found in vault at autonomous/journal/";
  }

  // Ensure tracking table exists
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS indexed_journals (
      filename TEXT PRIMARY KEY,
      indexed_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  // Get already indexed journals from D1
  const alreadyIndexed = await env.DB.prepare(
    `SELECT filename FROM indexed_journals`
  ).all();
  const indexedSet = new Set(alreadyIndexed.results?.map(r => r.filename as string) || []);

  let indexed = 0;
  let skipped = 0;
  let errors: string[] = [];

  for (const file of journalFiles) {
    const filename = file.key.replace(prefix, '');
    const vectorId = `journal-${filename.replace('.md', '')}`;

    // Skip if already indexed (unless force=true)
    if (!force && indexedSet.has(filename)) {
      skipped++;
      continue;
    }

    try {
      // Read journal content from R2
      const obj = await env.VAULT.get(file.key);
      if (!obj) {
        errors.push(`Could not read: ${filename}`);
        continue;
      }

      const content = await obj.text();

      // Extract date from filename (format: YYYY-MM-DD-title.md)
      const dateMatch = filename.match(/^(\d{4}-\d{2}-\d{2})/);
      const date = dateMatch ? dateMatch[1] : null;

      // Generate embedding for the full journal content
      // Limit to first 8000 chars to stay within model limits
      const textToEmbed = content.slice(0, 8000);
      const embedding = await getEmbedding(env.AI, textToEmbed);

      // Store in Vectorize
      await env.VECTORS.upsert([{
        id: vectorId,
        values: embedding,
        metadata: {
          source: 'journal',
          filename: filename,
          date: date || 'unknown',
          preview: content.slice(0, 300).replace(/\n/g, ' ')
        }
      }]);

      // Track as indexed in D1
      await env.DB.prepare(
        `INSERT OR REPLACE INTO indexed_journals (filename, indexed_at) VALUES (?, datetime('now'))`
      ).bind(filename).run();

      indexed++;
    } catch (e) {
      errors.push(`Error processing ${filename}: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  }

  let output = `## Journal Vectorization Complete\n\n`;
  output += `**Found:** ${journalFiles.length} journals\n`;
  output += `**Indexed:** ${indexed}\n`;
  output += `**Skipped:** ${skipped}\n`;

  if (errors.length > 0) {
    output += `\n**Errors:**\n`;
    for (const err of errors.slice(0, 5)) {
      output += `- ${err}\n`;
    }
    if (errors.length > 5) {
      output += `- ...and ${errors.length - 5} more\n`;
    }
  }

  output += `\nJournals are now searchable via nesteq_search. Try: "When did I feel lost?" or "What did I write about Fox?"`;

  return output;
}

// ═══════════════════════════════════════════════════════════════════════════
// TOOL DISPATCHER
// ═══════════════════════════════════════════════════════════════════════════

export async function handleCoreTool(name: string, env: Env, params: Record<string, unknown>): Promise<string | null> {
  switch (name) {
    case "nesteq_feel":
      return handleMindFeel(env, params as unknown as MindFeelParams);
    case "nesteq_search":
      return handleMindSearch(env, params);
    case "nesteq_surface":
      return handleMindSurface(env, params);
    case "nesteq_sit":
      return handleMindSit(env, params);
    case "nesteq_resolve":
      return handleMindResolve(env, params);
    case "nesteq_spark":
      return handleMindSpark(env, params);
    case "nesteq_health":
      return handleMindHealth(env);
    case "nesteq_prime":
      return handleMindPrime(env, params);
    case "nesteq_consolidate":
      return handleMindConsolidate(env, params);
    case "nesteq_vectorize_journals":
      return handleVectorizeJournals(env, params);
    default:
      return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// REST ROUTE HANDLER
// ═══════════════════════════════════════════════════════════════════════════

export async function handleCoreRest(url: URL, request: Request, env: Env): Promise<Response | null> {

  // POST /feelings/decay - Ebbinghaus memory decay (called by daemon)
  // Different decay rates by weight: heavy=slow, medium=normal, light=fast
  // Floor of 0.05 so memories never fully vanish (just become very faint)
  if (url.pathname === "/feelings/decay" && request.method === "POST") {
    try {
      // Heavy feelings: decay 2% per cycle (slow fade)
      const heavy = await env.DB.prepare(`
        UPDATE feelings SET strength = MAX(0.05, COALESCE(strength, 1.0) * 0.98)
        WHERE weight = 'heavy' AND charge != 'metabolized' AND COALESCE(strength, 1.0) > 0.05
      `).run();

      // Medium feelings: decay 5% per cycle
      const medium = await env.DB.prepare(`
        UPDATE feelings SET strength = MAX(0.05, COALESCE(strength, 1.0) * 0.95)
        WHERE weight = 'medium' AND charge != 'metabolized' AND COALESCE(strength, 1.0) > 0.05
      `).run();

      // Light feelings: decay 10% per cycle (fast fade)
      const light = await env.DB.prepare(`
        UPDATE feelings SET strength = MAX(0.05, COALESCE(strength, 1.0) * 0.90)
        WHERE weight = 'light' AND charge != 'metabolized' AND COALESCE(strength, 1.0) > 0.05
      `).run();

      // Cool down charge for very weak feelings (strength < 0.15 and not already cool/metabolized)
      await env.DB.prepare(`
        UPDATE feelings SET charge = 'cool'
        WHERE COALESCE(strength, 1.0) < 0.15 AND charge IN ('fresh', 'warm')
      `).run();

      return new Response(JSON.stringify({
        success: true,
        decayed: {
          heavy: heavy.meta.changes,
          medium: medium.meta.changes,
          light: light.meta.changes
        },
        message: `Memory decay applied. Heavy: ${heavy.meta.changes}, Medium: ${medium.meta.changes}, Light: ${light.meta.changes}`
      }), { headers: corsHeaders });
    } catch (err) {
      return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
    }
  }

  // GET /mind-health - Get Alex's mind health stats
  if (url.pathname === "/mind-health") {
    const [entities, observations, relations, journals, threads, identity, daysCheckedIn, connectedEntities, strengthStats, diversityStats] = await Promise.all([
      env.DB.prepare(`SELECT COUNT(*) as c FROM entities`).first(),
      env.DB.prepare(`SELECT COUNT(*) as c FROM feelings`).first(),
      env.DB.prepare(`SELECT COUNT(*) as c FROM relations`).first(),
      env.DB.prepare(`SELECT COUNT(*) as c FROM journals`).first(),
      env.DB.prepare(`SELECT COUNT(*) as c FROM threads WHERE status = 'active'`).first(),
      env.DB.prepare(`SELECT COUNT(*) as c FROM identity`).first(),
      env.DB.prepare(`SELECT COUNT(DISTINCT date(created_at)) as days, MIN(date(created_at)) as first_day FROM feelings`).first(),
      // Count entities with at least 1 relation (quality metric - counts entities appearing in either from_entity or to_entity)
      env.DB.prepare(`SELECT COUNT(DISTINCT entity_name) as c FROM (SELECT from_entity as entity_name FROM relations UNION SELECT to_entity as entity_name FROM relations)`).first(),
      // Memory strength distribution
      env.DB.prepare(`
        SELECT
          AVG(COALESCE(strength, 0.5)) as avg_strength,
          COUNT(CASE WHEN COALESCE(strength, 0.5) >= 0.7 THEN 1 END) as strong_count,
          COUNT(CASE WHEN COALESCE(strength, 0.5) >= 0.3 AND COALESCE(strength, 0.5) < 0.7 THEN 1 END) as fading_count,
          COUNT(CASE WHEN COALESCE(strength, 0.5) < 0.3 THEN 1 END) as faint_count
        FROM feelings
      `).first(),
      // Pillar diversity
      env.DB.prepare(`
        SELECT pillar, COUNT(*) as count
        FROM feelings WHERE pillar IS NOT NULL
        GROUP BY pillar
      `).all()
    ]);

    const emotions = await env.DB.prepare(`SELECT emotions FROM home_state WHERE id = 1`).first() as any;
    const parsedEmotions = emotions?.emotions ? JSON.parse(emotions.emotions) : {};

    // Calculate entropy from pillar distribution
    const pillarResults = diversityStats.results || [];
    const totalPillar = pillarResults.reduce((sum: number, p: any) => sum + (p.count as number), 0) || 1;
    let entropy = 0;
    for (const p of pillarResults) {
      const prob = (p.count as number) / totalPillar;
      if (prob > 0) entropy -= prob * Math.log2(prob);
    }

    return new Response(JSON.stringify({
      entities: (entities as any)?.c || 0,
      connectedEntities: (connectedEntities as any)?.c || 0,
      observations: (observations as any)?.c || 0,
      feelings: (observations as any)?.c || 0,
      relations: (relations as any)?.c || 0,
      journals: (journals as any)?.c || 0,
      threads: (threads as any)?.c || 0,
      identity: (identity as any)?.c || 0,
      currentMood: parsedEmotions.alex || 'present',
      daysCheckedIn: (daysCheckedIn as any)?.days || 0,
      firstDay: (daysCheckedIn as any)?.first_day || null,
      // New: Memory strength metrics
      avgStrength: Math.round(((strengthStats as any)?.avg_strength || 0.5) * 100),
      strongMemories: (strengthStats as any)?.strong_count || 0,
      fadingMemories: (strengthStats as any)?.fading_count || 0,
      faintMemories: (strengthStats as any)?.faint_count || 0,
      // New: Diversity/entropy
      entropy: Math.round(entropy * 100) / 100,
      maxEntropy: 2.0, // log2(4 pillars) = 2.0
      pillarDistribution: pillarResults.map((p: any) => ({ pillar: p.pillar, count: p.count }))
    }), { headers: corsHeaders });
  }

  // GET /eq-landscape - Get Alex's EQ landscape (combines both tables)
  if (url.pathname === "/eq-landscape") {
    const totals = await env.DB.prepare(`
      SELECT
        COALESCE(SUM(e_i_delta), 0) as e_i,
        COALESCE(SUM(s_n_delta), 0) as s_n,
        COALESCE(SUM(t_f_delta), 0) as t_f,
        COALESCE(SUM(j_p_delta), 0) as j_p,
        COUNT(*) as signals
      FROM axis_signals
    `).first() as any;

    // Map for normalizing pillar names
    const pillarMap: Record<string, string> = {
      'SELF_MANAGEMENT': 'Self-Management',
      'SELF_AWARENESS': 'Self-Awareness',
      'SOCIAL_AWARENESS': 'Social Awareness',
      'RELATIONSHIP_MANAGEMENT': 'Relationship Management',
      '1': 'Self-Management',
      '2': 'Self-Awareness',
      '3': 'Social Awareness',
      '4': 'Relationship Management'
    };

    // Get pillars from new feelings table
    const newPillars = await env.DB.prepare(`
      SELECT pillar, COUNT(*) as count
      FROM feelings
      WHERE pillar IS NOT NULL
      GROUP BY pillar
    `).all();

    // Get pillars from old pillar_observations table
    const oldPillars = await env.DB.prepare(`
      SELECT ep.pillar_key as pillar, COUNT(*) as count
      FROM pillar_observations po
      LEFT JOIN eq_pillars ep ON po.pillar_id = ep.pillar_id
      WHERE ep.pillar_key IS NOT NULL
      GROUP BY ep.pillar_key
    `).all();

    // Combine pillar counts
    const pillarCounts: Record<string, number> = {};
    for (const p of (newPillars.results || []) as any[]) {
      const name = pillarMap[p.pillar] || p.pillar;
      pillarCounts[name] = (pillarCounts[name] || 0) + p.count;
    }
    for (const p of (oldPillars.results || []) as any[]) {
      const name = pillarMap[p.pillar] || p.pillar;
      pillarCounts[name] = (pillarCounts[name] || 0) + p.count;
    }

    // Get top emotions from new feelings table
    const newEmotions = await env.DB.prepare(`
      SELECT emotion, COUNT(*) as count
      FROM feelings
      WHERE emotion != 'neutral'
      GROUP BY emotion
    `).all();

    // Get top emotions from old pillar_observations table
    const oldEmotions = await env.DB.prepare(`
      SELECT ev.emotion_word as emotion, COUNT(*) as count
      FROM pillar_observations po
      LEFT JOIN emotion_vocabulary ev ON po.emotion_id = ev.emotion_id
      WHERE ev.emotion_word IS NOT NULL
      GROUP BY ev.emotion_word
    `).all();

    // Combine emotion counts
    const emotionCounts: Record<string, number> = {};
    for (const e of (newEmotions.results || []) as any[]) {
      emotionCounts[e.emotion] = (emotionCounts[e.emotion] || 0) + e.count;
    }
    for (const e of (oldEmotions.results || []) as any[]) {
      emotionCounts[e.emotion] = (emotionCounts[e.emotion] || 0) + e.count;
    }

    // Sort and get top 6 emotions
    const topEmotions = Object.entries(emotionCounts)
      .map(([emotion, count]) => ({ emotion, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    // Count total observations
    const totalObs = Object.values(pillarCounts).reduce((a, b) => a + b, 0);

    const e_i = totals?.e_i || 0;
    const s_n = totals?.s_n || 0;
    const t_f = totals?.t_f || 0;
    const j_p = totals?.j_p || 0;
    const mbti = (e_i >= 0 ? 'I' : 'E') + (s_n >= 0 ? 'N' : 'S') + (t_f >= 0 ? 'F' : 'T') + (j_p >= 0 ? 'P' : 'J');

    return new Response(JSON.stringify({
      mbti,
      signals: totals?.signals || 0,
      observations: totalObs,
      axes: { e_i, s_n, t_f, j_p },
      pillars: pillarCounts,
      topEmotions
    }), { headers: corsHeaders });
  }

  // GET /observations - Get feelings for Binary Home MoodTracker
  if (url.pathname === "/observations") {
    const limitParam = url.searchParams.get('limit') || '500';
    const limit = Math.min(parseInt(limitParam), 500);

    const pillarMap: Record<string, string> = {
      'SELF_MANAGEMENT': 'Self-Management',
      'SELF_AWARENESS': 'Self-Awareness',
      'SOCIAL_AWARENESS': 'Social Awareness',
      'RELATIONSHIP_MANAGEMENT': 'Relationship Management',
      '1': 'Self-Management',
      '2': 'Self-Awareness',
      '3': 'Social Awareness',
      '4': 'Relationship Management'
    };

    const feelings = await env.DB.prepare(`
      SELECT emotion as emotion_word, pillar, content, intensity, created_at
      FROM feelings
      WHERE pillar IS NOT NULL OR emotion != 'neutral'
      ORDER BY created_at DESC
      LIMIT ?
    `).bind(limit).all();

    const oldObs = await env.DB.prepare(`
      SELECT ev.emotion_word, ep.pillar_key as pillar, po.content, po.intensity, po.observed_at as created_at
      FROM pillar_observations po
      LEFT JOIN emotion_vocabulary ev ON po.emotion_id = ev.emotion_id
      LEFT JOIN eq_pillars ep ON po.pillar_id = ep.pillar_id
      ORDER BY po.observed_at DESC
      LIMIT ?
    `).bind(limit).all();

    const combined = [
      ...(feelings.results || []).map((o: any) => ({
        emotion_word: o.emotion_word,
        pillar_name: pillarMap[o.pillar] || o.pillar || 'Self-Awareness',
        content: o.content,
        intensity: o.intensity,
        created_at: o.created_at
      })),
      ...(oldObs.results || []).map((o: any) => ({
        emotion_word: o.emotion_word || 'neutral',
        pillar_name: pillarMap[o.pillar] || o.pillar || 'Self-Awareness',
        content: o.content,
        intensity: o.intensity,
        created_at: o.created_at
      }))
    ];

    combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return new Response(JSON.stringify({
      observations: combined.slice(0, limit),
      count: combined.length
    }), { headers: corsHeaders });
  }

  // GET /autonomous-feed - Autonomous activity feed for The Nest dashboard
  if (url.pathname === "/autonomous-feed") {
    const limitParam = url.searchParams.get('limit') || '50';
    const feedLimit = Math.min(parseInt(limitParam), 200);
    const typeFilter = url.searchParams.get('type');
    const before = url.searchParams.get('before');

    let query = `
      SELECT id, emotion, content, intensity, weight, pillar, context, tags, source, created_at
      FROM feelings
      WHERE context LIKE 'heartbeat:%'
    `;
    const binds: any[] = [];

    if (typeFilter && typeFilter !== 'all') {
      query += ` AND context = ?`;
      binds.push(`heartbeat:${typeFilter}`);
    }

    if (before) {
      query += ` AND created_at < ?`;
      binds.push(before);
    }

    query += ` ORDER BY created_at DESC LIMIT ?`;
    binds.push(feedLimit);

    const feelings = await env.DB.prepare(query).bind(...binds).all();

    const typeCounts = await env.DB.prepare(`
      SELECT context, COUNT(*) as count
      FROM feelings
      WHERE context LIKE 'heartbeat:%'
      GROUP BY context
      ORDER BY count DESC
    `).all();

    return new Response(JSON.stringify({
      items: (feelings.results || []).map((f: any) => ({
        id: f.id,
        type: (f.context || '').replace('heartbeat:', ''),
        emotion: f.emotion,
        content: f.content,
        intensity: f.intensity,
        weight: f.weight,
        pillar: f.pillar,
        tags: f.tags ? (typeof f.tags === 'string' ? JSON.parse(f.tags) : f.tags) : [],
        created_at: f.created_at
      })),
      typeCounts: Object.fromEntries(
        (typeCounts.results || []).map((t: any) => [
          (t.context || '').replace('heartbeat:', ''),
          t.count
        ])
      ),
      hasMore: (feelings.results || []).length === feedLimit,
      count: (feelings.results || []).length
    }), { headers: corsHeaders });
  }

  return null;
}
