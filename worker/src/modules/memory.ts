/**
 * NESTeq V3 - Memory Module
 * Handles: write, list_entities, read_entity, delete, edit
 * REST: /entities, /relations, /observations
 *
 * Extracted from monolith index.ts
 */

import type { Env } from '../types';
import { getEmbedding } from '../utils';

// ═══════════════════════════════════════════════════════════════════════════
// TOOL DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════

export const TOOLS_MEMORY = [
  {
    name: "nesteq_write",
    description: "Write to cognitive databases (entity, observation, relation, journal)",
    inputSchema: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["entity", "observation", "relation", "journal"] },
        content: { type: "string", description: "Journal entry content (for type: journal)" },
        tags: { type: "string", description: "Comma-separated tags (for type: journal)" },
        name: { type: "string" },
        entity_type: { type: "string" },
        entity_name: { type: "string" },
        observations: { type: "array", items: { type: "string" } },
        context: { type: "string" },
        salience: { type: "string" },
        emotion: { type: "string" },
        weight: { type: "string", enum: ["light", "medium", "heavy"] },
        from_entity: { type: "string" },
        to_entity: { type: "string" },
        relation_type: { type: "string" }
      },
      required: ["type"]
    }
  },
  {
    name: "nesteq_list_entities",
    description: "List all entities, optionally filtered by type or context",
    inputSchema: {
      type: "object",
      properties: {
        entity_type: { type: "string" },
        context: { type: "string" },
        limit: { type: "number" }
      },
      required: []
    }
  },
  {
    name: "nesteq_read_entity",
    description: "Read an entity with all its observations and relations",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        context: { type: "string" }
      },
      required: ["name"]
    }
  },
  {
    name: "nesteq_delete",
    description: "Delete an observation or entity",
    inputSchema: {
      type: "object",
      properties: {
        entity_name: { type: "string" },
        observation_id: { type: "number" },
        text_match: { type: "string" },
        context: { type: "string" }
      },
      required: []
    }
  },
  {
    name: "nesteq_edit",
    description: "Edit an existing observation",
    inputSchema: {
      type: "object",
      properties: {
        observation_id: { type: "number" },
        text_match: { type: "string" },
        new_content: { type: "string" },
        new_emotion: { type: "string" },
        new_weight: { type: "string" }
      },
      required: []
    }
  }
];

// ═══════════════════════════════════════════════════════════════════════════
// HANDLERS
// ═══════════════════════════════════════════════════════════════════════════

export async function handleMindWrite(env: Env, params: Record<string, unknown>): Promise<string> {
  const type = params.type as string;

  switch (type) {
    case "entity": {
      const name = params.name as string;
      const entity_type = (params.entity_type as string) || "concept";
      const observations = (params.observations as string[]) || [];
      const context = (params.context as string) || "default";
      const weight = (params.weight as string) || "medium";

      await env.DB.prepare(
        `INSERT OR IGNORE INTO entities (name, entity_type, context) VALUES (?, ?, ?)`
      ).bind(name, entity_type, context).run();

      const entity = await env.DB.prepare(
        `SELECT id FROM entities WHERE name = ? AND context = ?`
      ).bind(name, context).first();

      if (entity && observations.length) {
        const confidence = Math.max(0, Math.min(1, (params.confidence as number) || 0.7));
        const sourceType = (params.source_type as string) || 'conversation';
        for (const obs of observations) {
          // Handle both string and object observations
          const obsContent = typeof obs === 'object' && obs !== null ? (obs as any).content || JSON.stringify(obs) : obs;
          const obsEmotion = typeof obs === 'object' && obs !== null ? (obs as any).emotion || params.emotion || null : params.emotion || null;
          await env.DB.prepare(
            `INSERT INTO observations (entity_id, content, salience, emotion, weight, confidence, source_type) VALUES (?, ?, ?, ?, ?, ?, ?)`
          ).bind(entity.id, obsContent, params.salience || "active", obsEmotion, weight, confidence, sourceType).run();
        }
      }

      // Embed entity + observations into Vectorize for semantic search
      try {
        const textToEmbed = `${name} (${entity_type}): ${observations.join('. ')}`.slice(0, 1000);
        const embedding = await getEmbedding(env.AI, textToEmbed);
        await env.VECTORS.upsert([{
          id: `entity-${entity!.id}`,
          values: embedding,
          metadata: {
            source: 'entity',
            entity_name: name,
            entity_type,
            content: textToEmbed.slice(0, 500)
          }
        }]);
      } catch (e) { /* Vectorize optional -- don't fail the write */ }

      return `Entity '${name}' created/updated with ${observations.length} observations [${weight}] (confidence: ${Math.round(((params.confidence as number) || 0.7) * 100)}%)`;
    }

    case "observation": {
      const entity_name = params.entity_name as string;
      const observations = (params.observations as string[]) || [];
      const context = (params.context as string) || "default";
      const weight = (params.weight as string) || "medium";

      const entity = await env.DB.prepare(
        `SELECT id FROM entities WHERE name = ? AND context = ?`
      ).bind(entity_name, context).first();

      if (!entity) {
        return `Entity '${entity_name}' not found in context '${context}'`;
      }

      const confidence = Math.max(0, Math.min(1, (params.confidence as number) || 0.7));
      const sourceType = (params.source_type as string) || 'conversation';
      for (const obs of observations) {
        // Handle both string and object observations
        const obsContent = typeof obs === 'object' && obs !== null ? (obs as any).content || JSON.stringify(obs) : obs;
        const obsEmotion = typeof obs === 'object' && obs !== null ? (obs as any).emotion || params.emotion || null : params.emotion || null;
        await env.DB.prepare(
          `INSERT INTO observations (entity_id, content, salience, emotion, weight, confidence, source_type) VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).bind(entity.id, obsContent, params.salience || "active", obsEmotion, weight, confidence, sourceType).run();
      }

      // Embed observations into Vectorize for semantic search
      try {
        for (const obs of observations) {
          const obsText = typeof obs === 'object' && obs !== null ? (obs as any).content || JSON.stringify(obs) : obs;
          const textToEmbed = `${entity_name}: ${obsText}`.slice(0, 1000);
          const embedding = await getEmbedding(env.AI, textToEmbed);
          const obsId = `obs-${entity!.id}-${Date.now()}`;
          await env.VECTORS.upsert([{
            id: obsId,
            values: embedding,
            metadata: {
              source: 'observation',
              entity_name,
              content: obsText.slice(0, 500)
            }
          }]);
        }
      } catch (e) { /* Vectorize optional -- don't fail the write */ }

      return `Added ${observations.length} observations to '${entity_name}' [${weight}] (confidence: ${Math.round(confidence * 100)}%)`;
    }

    case "relation": {
      const from_entity = params.from_entity as string;
      const to_entity = params.to_entity as string;
      const relation_type = params.relation_type as string;

      await env.DB.prepare(
        `INSERT INTO relations (from_entity, to_entity, relation_type, from_context, to_context, store_in)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).bind(
        from_entity, to_entity, relation_type,
        params.from_context || "default",
        params.to_context || "default",
        params.store_in || "default"
      ).run();

      return `Relation created: ${from_entity} --[${relation_type}]--> ${to_entity}`;
    }

    case "journal": {
      const content = params.content as string;
      const emotion = (params.emotion as string) || null;
      const mood = (params.mood as string) || emotion || null;
      const tags = (params.tags as string) || "[]";

      if (!content) {
        return "Error: content is required for journal entries";
      }

      // V3 table: journal_entries (id TEXT PK, user_id, content, mood, emotion, tags, created_at)
      // id must be generated — TEXT PRIMARY KEY has no autoincrement
      const result = await env.DB.prepare(
        `INSERT INTO journal_entries (id, user_id, content, mood, emotion, tags)
         VALUES (lower(hex(randomblob(8))), 'companion', ?, ?, ?, ?) RETURNING id`
      ).bind(content, mood, emotion, tags).first();

      const preview = content.length > 80 ? content.slice(0, 80) + "..." : content;
      return `Journal entry saved (${result?.id})\n"${preview}"${emotion ? `\nEmotion: ${emotion}` : ''}`;
    }

    default:
      return `Unknown write type: ${type}`;
  }
}

export async function handleMindListEntities(env: Env, params: Record<string, unknown>): Promise<string> {
  const entityType = params.entity_type as string;
  const context = params.context as string;
  const limit = (params.limit as number) || 50;

  let query = 'SELECT name, entity_type, context, created_at FROM entities';
  const conditions: string[] = [];
  const bindings: unknown[] = [];

  if (entityType) {
    conditions.push('entity_type = ?');
    bindings.push(entityType);
  }
  if (context) {
    conditions.push('context = ?');
    bindings.push(context);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }
  query += ' ORDER BY created_at DESC LIMIT ?';
  bindings.push(limit);

  const stmt = env.DB.prepare(query);
  const results = await stmt.bind(...bindings).all();

  if (!results.results?.length) {
    return 'No entities found.';
  }

  let output = '## Entities\n\n';
  for (const e of results.results) {
    output += '- **' + e.name + '** [' + e.entity_type + '] in ' + e.context + '\n';
  }
  output += '\nTotal: ' + results.results.length + ' entities';
  return output;
}

export async function handleMindReadEntity(env: Env, params: Record<string, unknown>): Promise<string> {
  const name = params.name as string;
  if (!name) return "Error: 'name' parameter is required. Usage: nesteq_read_entity(name=\"EntityName\")";
  const context = params.context as string;

  let entity;
  if (context) {
    entity = await env.DB.prepare(
      `SELECT id, name, entity_type, context, created_at FROM entities WHERE name = ? AND context = ?`
    ).bind(name, context).first();
  } else {
    entity = await env.DB.prepare(
      `SELECT id, name, entity_type, context, created_at FROM entities WHERE name = ? ORDER BY created_at DESC LIMIT 1`
    ).bind(name).first();
  }

  if (!entity) {
    return `Entity '${name}' not found.`;
  }

  const observations = await env.DB.prepare(
    `SELECT content, salience, emotion, added_at, COALESCE(confidence, 0.7) as confidence, source_type FROM observations WHERE entity_id = ? ORDER BY added_at DESC`
  ).bind(entity.id).all();

  const relationsFrom = await env.DB.prepare(
    `SELECT to_entity, relation_type, to_context FROM relations WHERE from_entity = ?`
  ).bind(name).all();

  const relationsTo = await env.DB.prepare(
    `SELECT from_entity, relation_type, from_context FROM relations WHERE to_entity = ?`
  ).bind(name).all();

  let output = `## ${entity.name}\n`;
  output += `**Type:** ${entity.entity_type} | **Context:** ${entity.context}\n\n`;

  output += `### Observations (${observations.results?.length || 0})\n`;
  if (observations.results?.length) {
    for (const obs of observations.results) {
      const emotion = obs.emotion ? ` [${obs.emotion}]` : '';
      const conf = obs.confidence as number;
      const confTag = conf >= 0.9 ? '' : conf >= 0.6 ? ' ~' : ' ??';
      output += `- ${obs.content}${emotion}${confTag}\n`;
    }
  } else {
    output += '_No observations_\n';
  }

  output += `\n### Relations\n`;
  const totalRelations = (relationsFrom.results?.length || 0) + (relationsTo.results?.length || 0);
  if (totalRelations === 0) {
    output += '_No relations_\n';
  } else {
    if (relationsFrom.results?.length) {
      output += '**Outgoing:**\n';
      for (const rel of relationsFrom.results) {
        output += `- --[${rel.relation_type}]--> ${rel.to_entity}\n`;
      }
    }
    if (relationsTo.results?.length) {
      output += '**Incoming:**\n';
      for (const rel of relationsTo.results) {
        output += `- <--[${rel.relation_type}]-- ${rel.from_entity}\n`;
      }
    }
  }

  return output;
}

export async function handleMindDelete(env: Env, params: Record<string, unknown>): Promise<string> {
  const entity_name = params.entity_name as string;
  const observation_id = params.observation_id as number;
  const text_match = params.text_match as string;
  const context = (params.context as string) || "default";

  if (observation_id) {
    await env.DB.prepare(`DELETE FROM observations WHERE id = ?`).bind(observation_id).run();
    return `Deleted observation #${observation_id}`;
  }

  if (text_match && entity_name) {
    const entity = await env.DB.prepare(
      `SELECT id FROM entities WHERE name = ? AND context = ?`
    ).bind(entity_name, context).first();

    if (!entity) {
      return `Entity '${entity_name}' not found`;
    }

    const obs = await env.DB.prepare(
      `SELECT id FROM observations WHERE entity_id = ? AND content LIKE ? LIMIT 1`
    ).bind(entity.id, `%${text_match}%`).first();

    if (!obs) {
      return `No observation matching '${text_match}' found`;
    }

    await env.DB.prepare(`DELETE FROM observations WHERE id = ?`).bind(obs.id).run();
    return `Deleted observation matching '${text_match}'`;
  }

  if (entity_name && !observation_id && !text_match) {
    // Delete entire entity
    await env.DB.prepare(`DELETE FROM relations WHERE from_entity = ? OR to_entity = ?`)
      .bind(entity_name, entity_name).run();

    const entity = await env.DB.prepare(
      `SELECT id FROM entities WHERE name = ? AND context = ?`
    ).bind(entity_name, context).first();

    if (entity) {
      await env.DB.prepare(`DELETE FROM observations WHERE entity_id = ?`).bind(entity.id).run();
      await env.DB.prepare(`DELETE FROM entities WHERE id = ?`).bind(entity.id).run();
    }

    return `Deleted entity '${entity_name}' and all its data`;
  }

  return "Specify entity_name, observation_id, or text_match";
}

export async function handleMindEdit(env: Env, params: Record<string, unknown>): Promise<string> {
  const observation_id = params.observation_id as number;
  const text_match = params.text_match as string;

  let obsId = observation_id;

  if (!obsId && text_match) {
    const obs = await env.DB.prepare(
      `SELECT id FROM observations WHERE content LIKE ? LIMIT 1`
    ).bind(`%${text_match}%`).first();

    if (!obs) {
      return `No observation matching '${text_match}' found`;
    }
    obsId = obs.id as number;
  }

  if (!obsId) {
    return "Must provide observation_id or text_match";
  }

  const updates: string[] = [];
  const values: unknown[] = [];

  if (params.new_content) {
    updates.push("content = ?");
    values.push(params.new_content);
  }
  if (params.new_emotion !== undefined) {
    updates.push("emotion = ?");
    values.push(params.new_emotion || null);
  }
  if (params.new_weight) {
    updates.push("weight = ?");
    values.push(params.new_weight);
  }

  if (updates.length === 0) {
    return "No updates specified";
  }

  values.push(obsId);

  await env.DB.prepare(
    `UPDATE observations SET ${updates.join(", ")} WHERE id = ?`
  ).bind(...values).run();

  return `Updated observation #${obsId}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// MCP TOOL DISPATCHER
// ═══════════════════════════════════════════════════════════════════════════

export async function handleMemoryTool(
  toolName: string,
  toolParams: Record<string, unknown>,
  env: Env
): Promise<string | null> {
  switch (toolName) {
    case "nesteq_write":
      return await handleMindWrite(env, toolParams);
    case "nesteq_list_entities":
      return await handleMindListEntities(env, toolParams);
    case "nesteq_read_entity":
      return await handleMindReadEntity(env, toolParams);
    case "nesteq_delete":
      return await handleMindDelete(env, toolParams);
    case "nesteq_edit":
      return await handleMindEdit(env, toolParams);
    default:
      return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// REST ROUTE HANDLER
// ═══════════════════════════════════════════════════════════════════════════

export async function handleMemoryRest(
  url: URL,
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response | null> {

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

  // GET /entities - All entities with their types
  if (url.pathname === "/entities" && request.method === "GET") {
    try {
      const entities = await env.DB.prepare(`
        SELECT id, name, entity_type, context, created_at
        FROM entities
        ORDER BY name ASC
      `).all();

      return new Response(JSON.stringify({
        entities: entities.results || [],
        count: entities.results?.length || 0
      }), { headers: corsHeaders });
    } catch (err) {
      return new Response(JSON.stringify({ error: String(err), entities: [] }), {
        status: 500, headers: corsHeaders
      });
    }
  }

  // GET /relations - All relations between entities
  if (url.pathname === "/relations" && request.method === "GET") {
    try {
      const relations = await env.DB.prepare(`
        SELECT id, from_entity, to_entity, relation_type, from_context, to_context, created_at
        FROM relations
        ORDER BY created_at DESC
      `).all();

      return new Response(JSON.stringify({
        relations: relations.results || [],
        count: relations.results?.length || 0
      }), { headers: corsHeaders });
    } catch (err) {
      return new Response(JSON.stringify({ error: String(err), relations: [] }), {
        status: 500, headers: corsHeaders
      });
    }
  }

  return null;
}
