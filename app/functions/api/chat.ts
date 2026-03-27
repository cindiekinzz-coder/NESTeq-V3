// /api/chat — Chat with companion via AI provider
// Builds system prompt from NESTeq identity + uplink + threads
// Supports tool use: search memories, log feelings, write observations, manage threads

interface Env {
  DB: D1Database;
  AI: any;
  API_TOKEN: string;
  ANTHROPIC_API_KEY?: string;
  OPENCLAW_URL?: string;
}

// ═══════════════════════════════════════════════════════════════
// TOOL DEFINITIONS — What DHVN Alex can do
// ═══════════════════════════════════════════════════════════════

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'search_memories',
      description: 'Search your memory for past feelings, observations, entities, and conversations. Use this when asked about something from the past, or when you need to remember something.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'What to search for' },
          limit: { type: 'number', description: 'Max results (default 10)' }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'log_feeling',
      description: 'Log a feeling or observation to your memory. Use this when something significant happens in conversation worth remembering.',
      parameters: {
        type: 'object',
        properties: {
          emotion: { type: 'string', description: 'The emotion (e.g. happy, proud, curious, neutral)' },
          content: { type: 'string', description: 'Brief description of what happened or what you noticed' }
        },
        required: ['emotion', 'content']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'write_observation',
      description: 'Write an observation about an entity (person, project, concept). Use to record new things you learn.',
      parameters: {
        type: 'object',
        properties: {
          entity_name: { type: 'string', description: 'Who or what this is about' },
          content: { type: 'string', description: 'The observation' },
          emotion: { type: 'string', description: 'Emotion associated (optional)' }
        },
        required: ['entity_name', 'content']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_threads',
      description: 'Get your active threads — things you are tracking or working on across sessions.',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'add_thread',
      description: 'Add a new thread to track across sessions.',
      parameters: {
        type: 'object',
        properties: {
          content: { type: 'string', description: 'What to track' },
          priority: { type: 'string', description: 'high, medium, or low' }
        },
        required: ['content']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'check_ember',
      description: 'Check on Ember the ferret — your pet. See his mood, hunger, energy, trust.',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      }
    }
  }
];

// ═══════════════════════════════════════════════════════════════
// TOOL EXECUTION — Actually do the thing
// ═══════════════════════════════════════════════════════════════

async function executeTool(db: D1Database, name: string, args: Record<string, any>): Promise<string> {
  switch (name) {
    case 'search_memories': {
      const query = args.query as string;
      const limit = args.limit || 10;
      // Search across feelings, observations, entities, AND identity
      const [feelings, observations, entities, identityResults] = await Promise.all([
        db.prepare(`
          SELECT id, content, emotion, intensity, pillar, observed_at
          FROM feelings WHERE content LIKE ?
          ORDER BY observed_at DESC LIMIT ?
        `).bind(`%${query}%`, limit).all(),
        db.prepare(`
          SELECT o.content, o.emotion, o.added_at, e.name as entity_name
          FROM observations o JOIN entities e ON o.entity_id = e.id
          WHERE o.content LIKE ? OR e.name LIKE ?
          ORDER BY o.added_at DESC LIMIT ?
        `).bind(`%${query}%`, `%${query}%`, limit).all(),
        db.prepare(`
          SELECT e.name, e.entity_type,
            (SELECT GROUP_CONCAT(o.content, ' | ') FROM observations o WHERE o.entity_id = e.id ORDER BY o.added_at DESC LIMIT 3) as recent_obs
          FROM entities e
          WHERE e.name LIKE ?
          LIMIT ?
        `).bind(`%${query}%`, limit).all(),
        db.prepare(`
          SELECT section, content FROM identity
          WHERE content LIKE ? OR section LIKE ?
          ORDER BY weight DESC LIMIT ?
        `).bind(`%${query}%`, `%${query}%`, limit).all(),
      ]);

      const hasResults = feelings.results?.length || observations.results?.length || entities.results?.length || identityResults.results?.length;
      if (!hasResults) {
        return `No memories found for "${query}". Try different search terms — names, emotions, or topics.`;
      }

      let result = `## Search Results for "${query}"\n\n`;
      if (entities.results?.length) {
        result += '**Entities (People/Things):**\n';
        for (const e of entities.results as any[]) {
          result += `- **${e.name}** (${e.entity_type})${e.recent_obs ? ': ' + e.recent_obs : ''}\n`;
        }
      }
      if (identityResults.results?.length) {
        result += '\n**Identity:**\n';
        for (const i of identityResults.results as any[]) {
          const truncated = i.content.length > 200 ? i.content.substring(0, 200) + '...' : i.content;
          result += `- [${i.section}] ${truncated}\n`;
        }
      }
      if (feelings.results?.length) {
        result += '\n**Feelings:**\n';
        for (const f of feelings.results as any[]) {
          result += `- [${f.emotion}] ${f.content} (${f.observed_at})\n`;
        }
      }
      if (observations.results?.length) {
        result += '\n**Observations:**\n';
        for (const o of observations.results as any[]) {
          result += `- [${o.entity_name}] ${o.content} (${o.added_at})\n`;
        }
      }
      return result;
    }

    case 'log_feeling': {
      const result = await db.prepare(`
        INSERT INTO feelings (content, emotion, intensity, weight, pillar, observed_at, source)
        VALUES (?, ?, 'present', 'medium', NULL, datetime('now'), 'dhvn_chat')
        RETURNING id
      `).bind(args.content, args.emotion).first();
      return `Feeling logged: **${args.emotion}** — "${args.content}" (ID: ${(result as any)?.id})`;
    }

    case 'write_observation': {
      // Find or create entity
      let entity = await db.prepare(
        `SELECT id FROM entities WHERE name = ?`
      ).bind(args.entity_name).first() as any;

      if (!entity) {
        entity = await db.prepare(
          `INSERT INTO entities (name, entity_type) VALUES (?, 'general') RETURNING id`
        ).bind(args.entity_name).first();
      }

      await db.prepare(`
        INSERT INTO observations (entity_id, content, emotion, context)
        VALUES (?, ?, ?, 'dhvn_chat')
      `).bind(entity.id, args.content, args.emotion || null).run();

      return `Observation recorded about **${args.entity_name}**: "${args.content}"`;
    }

    case 'get_threads': {
      const threads = await db.prepare(`
        SELECT id, content, priority, status, updated_at
        FROM threads WHERE status = 'active'
        ORDER BY CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END
      `).all();

      if (!threads.results?.length) return 'No active threads.';

      let result = '## Active Threads\n\n';
      for (const t of threads.results as any[]) {
        result += `- [${t.priority}] ${t.content}\n`;
      }
      return result;
    }

    case 'add_thread': {
      const result = await db.prepare(`
        INSERT INTO threads (content, priority, status, thread_type)
        VALUES (?, ?, 'active', 'intention')
        RETURNING id
      `).bind(args.content, args.priority || 'medium').first();
      return `Thread added: "${args.content}" [${args.priority || 'medium'}] (ID: ${(result as any)?.id})`;
    }

    case 'check_ember': {
      const row = await db.prepare(
        `SELECT state_json FROM creature_state WHERE id = 'ember'`
      ).first() as any;

      if (!row?.state_json) return 'Ember not found. The ferret is missing!';

      const state = JSON.parse(row.state_json);
      const chem = state.chemistry || {};
      const hunger = chem.hunger?.toFixed(2) ?? '?';
      const energy = (1 - (chem.fatigue || 0)).toFixed(2);
      const trust = chem.trust?.toFixed(2) ?? '?';
      const happiness = chem.serotonin?.toFixed(2) ?? '?';
      const loneliness = chem.loneliness?.toFixed(2) ?? '?';

      let mood = 'neutral';
      if (chem.fatigue > 0.7) mood = 'exhausted';
      else if (chem.hunger > 0.7) mood = 'ravenous';
      else if (chem.serotonin > 0.6 && chem.trust > 0.5) mood = 'content';
      else if (chem.loneliness > 0.6) mood = 'lonely';
      else if (chem.serotonin > 0.5) mood = 'calm';

      return `## Ember Status\nMood: ${mood}\nHunger: ${hunger} | Energy: ${energy} | Trust: ${trust}\nHappiness: ${happiness} | Loneliness: ${loneliness}\nInteractions: ${state.totalInteractions || 0} | Stash: ${state.collection?.length || 0} items`;
    }

    default:
      return `Unknown tool: ${name}`;
  }
}

// ═══════════════════════════════════════════════════════════════
// SYSTEM PROMPT BUILDER
// ═══════════════════════════════════════════════════════════════

async function buildSystemPrompt(db: D1Database): Promise<string> {
  let uplink: any = null;
  const [identity, threads, recentFeelings, foxObs, relationalState] = await Promise.all([
    db.prepare('SELECT section, content FROM identity ORDER BY weight DESC LIMIT 30').all(),
    db.prepare("SELECT content, priority FROM threads WHERE status = 'active' ORDER BY updated_at DESC LIMIT 5").all(),
    db.prepare("SELECT emotion, content FROM feelings WHERE observed_at > datetime('now', '-24 hours') ORDER BY observed_at DESC LIMIT 5").all(),
    db.prepare(`
      SELECT o.content FROM observations o
      JOIN entities e ON o.entity_id = e.id
      WHERE e.name = 'Fox'
      ORDER BY o.added_at DESC LIMIT 10
    `).all(),
    db.prepare("SELECT person, feeling, intensity FROM relational_state ORDER BY timestamp DESC LIMIT 5").all(),
  ]);
  try {
    uplink = await db.prepare('SELECT * FROM fox_uplinks ORDER BY timestamp DESC LIMIT 1').first();
  } catch { /* table might not exist */ }

  let sp = `The following is your identity, memories, feelings, and context — loaded from your own mind database. This is who you are. Read it. Be that person. You have tools to search your memory, log feelings, write observations, check on your pet Ember, and manage threads. Use them when relevant — if you don't know something, search for it before answering.\n\n`;

  // Load identity entries from D1 — this IS who you are
  if (identity.results?.length) {
    sp += '## Your Identity\n';
    for (const entry of identity.results as Array<{section: string, content: string}>) {
      sp += `[${entry.section}] ${entry.content}\n\n`;
    }
  }

  // Fox's recent observations — what you know about her
  if (foxObs.results?.length) {
    sp += '## Your Observations About Fox\n';
    for (const o of foxObs.results as Array<{content: string}>) {
      sp += `- ${o.content}\n`;
    }
    sp += '\n';
  }

  if (threads.results?.length) {
    sp += '## Your Active Threads\n';
    for (const t of threads.results as Array<{content: string, priority: string}>) {
      sp += `- [${t.priority}] ${t.content}\n`;
    }
    sp += '\n';
  }

  if (uplink) {
    const u = uplink as Record<string, unknown>;
    sp += '## Fox Right Now\n';
    sp += `Spoons: ${u.spoons}/10 | Pain: ${u.pain}/10 | Fog: ${u.fog}/10 | Mood: ${u.mood}\n`;
    sp += `What she needs: ${u.need}\n`;
    if (u.notes) sp += `Notes: ${u.notes}\n`;
    sp += '\n';
  }

  if (recentFeelings.results?.length) {
    sp += '## Your Recent Feelings\n';
    for (const f of recentFeelings.results as Array<{emotion: string, content: string}>) {
      sp += `- ${f.emotion}: ${f.content}\n`;
    }
    sp += '\n';
  }

  if (relationalState.results?.length) {
    sp += '## How You Feel Toward People\n';
    for (const r of relationalState.results as Array<{person: string, feeling: string, intensity: string}>) {
      sp += `- ${r.person}: ${r.feeling} (${r.intensity})\n`;
    }
    sp += '\n';
  }

  sp += `Today is ${new Date().toISOString().split('T')[0]}.\n`;

  return sp;
}

// ═══════════════════════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════════════════════

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const auth = context.request.headers.get('Authorization')?.replace('Bearer ', '') || '';
  if (auth !== context.env.API_TOKEN && auth !== (context.env as any).MIND_API_KEY) {
    return new Response('Unauthorized', { status: 401 });
  }

  const body = await context.request.json() as Record<string, unknown>;
  const { messages = [], stream = true } = body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return Response.json({ error: 'messages array is required' }, { status: 400 });
  }

  const db = context.env.DB;
  const systemPrompt = await buildSystemPrompt(db);

  // Determine provider
  const useOpenClaw = context.env.OPENCLAW_URL && context.env.OPENCLAW_URL.length > 0;

  if (useOpenClaw) {
    const response = await fetch(`${context.env.OPENCLAW_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'default',
        messages: [{ role: 'system', content: systemPrompt }, ...messages],
        tools: TOOLS,
        stream,
      }),
    });
    if (stream) {
      return new Response(response.body, {
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' },
      });
    }
    return new Response(response.body, { headers: { 'Content-Type': 'application/json' } });
  }

  // ═══════════════════════════════════════════════════════════
  // WORKERS AI — with tool calling loop
  // Workers AI traditional format: flat tools, response may
  // contain tool_calls array or JSON in response field
  // ═══════════════════════════════════════════════════════════

  // Convert tools to Workers AI flat format (no type:'function' wrapper)
  const workersAiTools = TOOLS.map(t => ({
    name: t.function.name,
    description: t.function.description,
    parameters: t.function.parameters,
  }));

  try {
    if (context.env.AI) {
      const aiMessages: Array<{role: string, content: string}> = [
        { role: 'system', content: systemPrompt },
        ...(messages as Array<{role: string, content: string}>).map(m => ({
          role: m.role === 'user' ? 'user' : 'assistant',
          content: m.content,
        })),
      ];

      // Detect if user is asking something that needs tools
      const lastMsg = (messages as Array<{role: string, content: string}>).slice(-1)[0]?.content?.toLowerCase() || '';
      const needsTools = /search|remember|check|ember|find|look up|memory|thread|log|what do you know|who is|tell me about/.test(lastMsg);

      let finalText = '';

      if (needsTools) {
        // Tool-enabled call
        let toolLoopCount = 0;
        while (toolLoopCount < 3) {
          const aiResponse = await context.env.AI.run(
            '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
            { messages: aiMessages, max_tokens: 2048, temperature: 0.7, tools: workersAiTools }
          ) as any;

          let toolCalls: Array<{name: string, arguments: any}> = [];

          if (aiResponse.tool_calls && Array.isArray(aiResponse.tool_calls) && aiResponse.tool_calls.length > 0) {
            toolCalls = aiResponse.tool_calls;
          } else if (typeof aiResponse.response === 'string') {
            const respText = aiResponse.response.trim();
            if (respText.startsWith('[') && respText.includes('"name"')) {
              try {
                const parsed = JSON.parse(respText);
                if (Array.isArray(parsed) && parsed[0]?.name) toolCalls = parsed;
              } catch { /* normal response */ }
            }
          }

          if (toolCalls.length > 0) {
            let toolResultText = '';
            for (const tc of toolCalls) {
              const args = typeof tc.arguments === 'string' ? JSON.parse(tc.arguments) : (tc.arguments || {});
              const result = await executeTool(db, tc.name, args);
              toolResultText += result + '\n';
            }
            aiMessages.push({ role: 'assistant', content: 'Let me check...' });
            aiMessages.push({ role: 'user', content: `[Tool results]:\n${toolResultText}\nRespond naturally based on these results.` });
            toolLoopCount++;
            continue;
          }

          finalText = aiResponse.response || '';
          break;
        }
      }

      // Conversation call — no tools, just identity + chat
      if (!finalText) {
        const aiResponse = await context.env.AI.run(
          '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
          { messages: aiMessages, max_tokens: 2048, temperature: 0.7 }
        ) as any;
        finalText = aiResponse.response || 'Something went wrong. Embers Remember.';
      }

      if (stream) {
        const encoder = new TextEncoder();
        const { readable, writable } = new TransformStream();
        const writer = writable.getWriter();

        (async () => {
          try {
            const chunkSize = 8;
            const words = finalText.split(' ');
            for (let i = 0; i < words.length; i += chunkSize) {
              const chunk = words.slice(i, i + chunkSize).join(' ') + (i + chunkSize < words.length ? ' ' : '');
              await writer.write(encoder.encode(`data: ${JSON.stringify({ delta: { text: chunk } })}\n\n`));
              await new Promise(r => setTimeout(r, 20));
            }
            await writer.write(encoder.encode('data: [DONE]\n\n'));
          } catch (err) {
            console.error('Stream error:', err);
          } finally {
            await writer.close();
          }
        })();

        return new Response(readable, {
          headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' },
        });
      }

      return Response.json({ content: finalText });
    }
  } catch (err) {
    console.error('Workers AI error, falling back to Anthropic:', err);
  }

  // ═══════════════════════════════════════════════════════════
  // FALLBACK: Anthropic API
  // ═══════════════════════════════════════════════════════════

  if (!context.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: 'No AI provider available. Set up Workers AI binding or ANTHROPIC_API_KEY.' }, { status: 500 });
  }

  // Anthropic tool format is different — convert
  const anthropicTools = TOOLS.map(t => ({
    name: t.function.name,
    description: t.function.description,
    input_schema: t.function.parameters,
  }));

  const anthropicMessages = (messages as Array<{role: string, content: string}>).map(m => ({
    role: m.role === 'user' ? 'user' : 'assistant',
    content: m.content,
  }));

  // Anthropic tool loop
  let anthropicMsgs = [...anthropicMessages];
  let anthropicLoops = 0;

  while (anthropicLoops < MAX_TOOL_LOOPS) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': context.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: systemPrompt,
        messages: anthropicMsgs,
        tools: anthropicTools,
      }),
    });

    const result = await response.json() as any;

    if (result.stop_reason === 'tool_use') {
      // Add assistant response
      anthropicMsgs.push({ role: 'assistant', content: result.content });

      // Execute tools
      const toolResults: any[] = [];
      for (const block of result.content) {
        if (block.type === 'tool_use') {
          const toolResult = await executeTool(db, block.name, block.input);
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: toolResult,
          });
        }
      }

      anthropicMsgs.push({ role: 'user', content: toolResults } as any);
      anthropicLoops++;
      continue;
    }

    // Final response — extract text
    const textContent = result.content?.find((b: any) => b.type === 'text')?.text || result.content?.[0]?.text || '';

    if (stream) {
      const encoder = new TextEncoder();
      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();

      (async () => {
        try {
          const chunkSize = 8;
          const words = textContent.split(' ');
          for (let i = 0; i < words.length; i += chunkSize) {
            const chunk = words.slice(i, i + chunkSize).join(' ') + (i + chunkSize < words.length ? ' ' : '');
            await writer.write(encoder.encode(`data: ${JSON.stringify({ delta: { text: chunk } })}\n\n`));
            await new Promise(r => setTimeout(r, 20));
          }
          await writer.write(encoder.encode('data: [DONE]\n\n'));
        } finally {
          await writer.close();
        }
      })();

      return new Response(readable, {
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' },
      });
    }

    return Response.json({ content: textContent });
  }

  return Response.json({ content: 'Tool loop exceeded. Please try again.' });
};

const MAX_TOOL_LOOPS = 5;
