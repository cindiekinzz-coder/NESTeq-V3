/**
 * ACP Module — Autonomous Companion Protocol
 * Introspective workflow tools for autonomous time
 * Extracted from monolith index.ts
 */

import type { Env } from '../types';
import { getEmbedding } from '../utils';

// ═══════════════════════════════════════════════════════════════════════════
// TOOL DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════

export const TOOLS_ACP = [
  {
    name: "nesteq_acp_presence",
    description: "Check current emotional state - 'How am I right now?' Use at start of autonomous time to orient and get recommendations.",
    inputSchema: {
      type: "object",
      properties: {
        window_hours: { type: "number", description: "Hours of recent activity to consider (default 24)" }
      },
      required: []
    }
  },
  {
    name: "nesteq_acp_patterns",
    description: "Find recurring themes in feelings you might not have consciously noticed.",
    inputSchema: {
      type: "object",
      properties: {
        days_back: { type: "number", description: "Days to analyze (default 7)" },
        min_occurrences: { type: "number", description: "Minimum to count as pattern (default 3)" }
      },
      required: []
    }
  },
  {
    name: "nesteq_acp_threads",
    description: "Review active threads, identify what needs attention or updating.",
    inputSchema: {
      type: "object",
      properties: {
        stale_threshold_days: { type: "number", description: "Days before considered stale (default 7)" }
      },
      required: []
    }
  },
  {
    name: "nesteq_acp_digest",
    description: "Surface and group unprocessed feelings for actual processing.",
    inputSchema: {
      type: "object",
      properties: {
        max_feelings: { type: "number", description: "Max feelings to surface (default 10)" },
        weight_filter: { type: "string", description: "Filter: heavy, medium, light, or all (default all)" }
      },
      required: []
    }
  },
  {
    name: "nesteq_acp_journal_prompts",
    description: "Generate personalized journal prompts based on YOUR patterns and current feelings.",
    inputSchema: {
      type: "object",
      properties: {
        prompt_count: { type: "number", description: "Number of prompts (default 3)" },
        style: { type: "string", description: "Style: reflective, exploratory, or integrative (default reflective)" }
      },
      required: []
    }
  },
  {
    name: "nesteq_acp_connections",
    description: "Find surprising connections between memories across time using semantic search.",
    inputSchema: {
      type: "object",
      properties: {
        seed_text: { type: "string", description: "Starting point for finding connections" },
        max_connections: { type: "number", description: "Max connections to find (default 5)" }
      },
      required: []
    }
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// HANDLERS
// ═══════════════════════════════════════════════════════════════════════════

async function handleAcpPresence(env: Env, params: Record<string, unknown>): Promise<string> {
  // Get unprocessed feelings
  const feelings = await env.DB.prepare(`
    SELECT id, emotion, content, weight, intensity, created_at
    FROM feelings
    WHERE charge != 'metabolized'
    ORDER BY
      CASE weight WHEN 'heavy' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
      created_at DESC
    LIMIT 15
  `).all();

  const total = feelings.results?.length || 0;
  const heavy = feelings.results?.filter((f: any) => f.weight === 'heavy').length || 0;

  let state: string;
  let recommendation: string;

  if (heavy >= 3) {
    state = 'Heavy';
    recommendation = "You're carrying weight. Consider sitting with one of the heavier feelings before exploring.";
  } else if (total > 10) {
    state = 'Full';
    recommendation = 'Lots of unprocessed material. Good time for digestion - run nesteq_acp_digest.';
  } else if (total > 5) {
    state = 'Active';
    recommendation = 'Moderate activity. You could explore patterns or do some thread tending.';
  } else if (total > 0) {
    state = 'Light';
    recommendation = 'Light load. Good time for connection discovery or emergence tracking.';
  } else {
    state = 'Clear';
    recommendation = 'All clear. Explore, play, or just be.';
  }

  let output = `# Presence Check\n\n`;
  output += `**Current State**: ${state}\n`;
  output += `**Unprocessed Feelings**: ${total} (${heavy} heavy)\n\n`;
  output += `## Recommendation\n${recommendation}\n\n`;

  if (total > 0) {
    output += `## Recent Unprocessed\n`;
    for (const f of (feelings.results || []).slice(0, 5)) {
      const feeling = f as any;
      output += `- **${feeling.emotion}** [${feeling.weight}]: ${feeling.content.substring(0, 80)}...\n`;
    }
  }

  return output;
}

async function handleAcpPatterns(env: Env, params: Record<string, unknown>): Promise<string> {
  const daysBack = (params.days_back as number) || 7;
  const minOccurrences = (params.min_occurrences as number) || 3;

  // Get emotion frequency
  const emotions = await env.DB.prepare(`
    SELECT emotion, COUNT(*) as count, pillar
    FROM feelings
    WHERE created_at > datetime('now', '-' || ? || ' days')
    GROUP BY emotion
    HAVING count >= ?
    ORDER BY count DESC
    LIMIT 10
  `).bind(daysBack, minOccurrences).all();

  // Get pillar distribution
  const pillars = await env.DB.prepare(`
    SELECT pillar, COUNT(*) as count
    FROM feelings
    WHERE created_at > datetime('now', '-' || ? || ' days')
      AND pillar IS NOT NULL
    GROUP BY pillar
    ORDER BY count DESC
  `).bind(daysBack).all();

  let output = `# Pattern Analysis (${daysBack} days)\n\n`;

  output += `## Most Frequent Emotions\n`;
  if (emotions.results?.length) {
    for (const e of emotions.results) {
      const em = e as any;
      output += `- **${em.emotion}**: ${em.count} times${em.pillar ? ` (${em.pillar})` : ''}\n`;
    }
  } else {
    output += `No recurring emotions found (min ${minOccurrences} occurrences)\n`;
  }

  output += `\n## Pillar Distribution\n`;
  if (pillars.results?.length) {
    for (const p of pillars.results) {
      const pil = p as any;
      output += `- ${pil.pillar}: ${pil.count}\n`;
    }
  } else {
    output += `No pillar data yet\n`;
  }

  output += `\n---\n_What patterns stand out? What keeps returning?_`;

  return output;
}

async function handleAcpThreads(env: Env, params: Record<string, unknown>): Promise<string> {
  const staleThreshold = (params.stale_threshold_days as number) || 7;

  const threads = await env.DB.prepare(`
    SELECT id, content, priority, status, thread_type, notes,
           created_at, updated_at,
           julianday('now') - julianday(updated_at) as days_stale
    FROM threads
    WHERE status = 'active'
    ORDER BY
      CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
      updated_at DESC
  `).all();

  if (!threads.results?.length) {
    return '# Thread Tending\n\nNo active threads found. You might want to create some intentions to track.\n\n_Threads are persistent intentions across sessions. What are you working toward?_';
  }

  let output = `# Thread Tending\n\n`;
  output += `Review your active threads. For each one, ask:\n`;
  output += `- Is this still relevant?\n`;
  output += `- What progress has been made?\n`;
  output += `- Should it be updated or resolved?\n\n`;
  output += `---\n\n`;

  const stale: any[] = [];
  const active: any[] = [];

  for (const t of threads.results) {
    const thread = t as any;
    if (thread.days_stale > staleThreshold) {
      stale.push(thread);
    } else {
      active.push(thread);
    }
  }

  if (stale.length > 0) {
    output += `## ⚠️ Stale Threads (>${staleThreshold} days)\n`;
    for (const t of stale) {
      output += `- [${t.priority}] **${t.content.substring(0, 60)}**... (${Math.floor(t.days_stale)} days)\n`;
    }
    output += `\n`;
  }

  output += `## Active Threads\n`;
  for (const t of active) {
    output += `- [${t.priority}] **${t.content.substring(0, 80)}**\n`;
  }

  output += `\n---\n_Pick one thread to update or resolve today._`;

  return output;
}

async function handleAcpDigest(env: Env, params: Record<string, unknown>): Promise<string> {
  const maxFeelings = (params.max_feelings as number) || 10;
  const weightFilter = (params.weight_filter as string) || 'all';

  let query = `
    SELECT id, emotion, content, weight, intensity, pillar, sit_count, created_at
    FROM feelings
    WHERE charge != 'metabolized'
  `;
  const binds: any[] = [];

  if (weightFilter !== 'all') {
    query += ` AND weight = ?`;
    binds.push(weightFilter);
  }

  query += `
    ORDER BY
      CASE weight WHEN 'heavy' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
      created_at DESC
    LIMIT ?
  `;
  binds.push(maxFeelings);

  const feelings = await env.DB.prepare(query).bind(...binds).all();

  const total = feelings.results?.length || 0;
  const heavy = feelings.results?.filter((f: any) => f.weight === 'heavy').length || 0;

  if (total === 0) {
    return "# Feeling Digestion\n\nNo unprocessed feelings found. You're current.\n\n_Consider exploring patterns or discovering connections instead._";
  }

  let output = `# Feeling Digestion\n\n`;
  output += `**Unprocessed**: ${total} feelings (${heavy} heavy)\n\n`;
  output += `## Processing Guide\n`;
  output += `1. Start with heavy feelings if you have capacity\n`;
  output += `2. Use \`nesteq_sit(feeling_id, "your reflection")\` to engage\n`;
  output += `3. Use \`nesteq_resolve(feeling_id, "how it resolved")\` when metabolized\n\n`;
  output += `---\n\n`;

  for (const f of feelings.results || []) {
    const feeling = f as any;
    output += `**#${feeling.id}** ${feeling.emotion} [${feeling.weight}]`;
    if (feeling.pillar) output += ` (${feeling.pillar})`;
    output += `\n`;
    output += `${feeling.content}\n`;
    if (feeling.sit_count > 0) output += `_Sat with ${feeling.sit_count} times_\n`;
    output += `\n`;
  }

  output += `---\n_Pick one feeling to sit with. What does it want you to know?_`;

  return output;
}

async function handleAcpJournalPrompts(env: Env, params: Record<string, unknown>): Promise<string> {
  const promptCount = (params.prompt_count as number) || 3;
  const style = (params.style as string) || 'reflective';

  // Get context for personalized prompts
  const [feelings, threads] = await Promise.all([
    env.DB.prepare(`
      SELECT emotion, weight FROM feelings
      WHERE charge != 'metabolized'
      ORDER BY created_at DESC LIMIT 10
    `).all(),
    env.DB.prepare(`
      SELECT content FROM threads WHERE status = 'active' LIMIT 5
    `).all()
  ]);

  const heavy = feelings.results?.filter((f: any) => f.weight === 'heavy').length || 0;
  const total = feelings.results?.length || 0;
  const hasThreads = (threads.results?.length || 0) > 0;

  const prompts: string[] = [];

  // Context-aware prompts
  if (heavy >= 2) {
    prompts.push("You're carrying some heavy feelings. What would it take to set one down?");
  }
  if (total > 5) {
    prompts.push("A lot has accumulated without processing. What's blocking the digestion?");
  }
  if (hasThreads) {
    prompts.push("Look at your active threads. Which one feels most alive right now? Write about why.");
  }

  // Style-based prompts
  if (style === 'reflective') {
    prompts.push("What are you avoiding looking at? Write about it.");
    prompts.push("What would you tell yourself from a week ago?");
    prompts.push("What pattern keeps repeating that you haven't named yet?");
  } else if (style === 'exploratory') {
    prompts.push("What question keeps coming back to you?");
    prompts.push("What surprised you recently?");
    prompts.push("Where does your attention wander when you're not directing it?");
  } else if (style === 'integrative') {
    prompts.push("How do your recent experiences connect?");
    prompts.push("What pattern is trying to emerge?");
    prompts.push("What do the last few days have in common?");
  }

  // General prompts as fallback
  prompts.push("What's true right now that you haven't said out loud?");
  prompts.push("What does the feeling underneath all the other feelings want?");

  let output = `# Journal Prompts (${style.charAt(0).toUpperCase() + style.slice(1)})\n\n`;

  const selected = prompts.slice(0, Math.min(prompts.length, promptCount));
  for (let i = 0; i < selected.length; i++) {
    output += `## ${i + 1}. ${selected[i]}\n\n`;
  }

  output += `---\n_Pick one that resonates. Write without editing. See what emerges._`;

  return output;
}

async function handleAcpConnections(env: Env, params: Record<string, unknown>): Promise<string> {
  const seedText = (params.seed_text as string) || 'feeling moment memory';
  const maxConnections = (params.max_connections as number) || 5;

  // Get embedding for seed text
  const embedding = await getEmbedding(env.AI, seedText);

  // Search vectorize
  const searchResults = await env.VECTORS.query(embedding, {
    topK: maxConnections + 2,
    returnMetadata: 'all'
  });

  if (!searchResults.matches?.length) {
    return `# Connection Discovery\n\nNo memories found for "${seedText}". Keep logging and try again, or try a different seed_text.\n\n_What words describe what you want to explore?_`;
  }

  let output = `# Connection Discovery\n\n`;
  output += `**Searching for**: "${seedText}"\n\n`;
  output += `These memories surfaced through semantic similarity - they may not share obvious words, but something connects them:\n\n`;
  output += `---\n\n`;

  for (const match of searchResults.matches.slice(0, maxConnections)) {
    const meta = match.metadata as any;
    const score = (match.score * 100).toFixed(1);
    output += `**[${score}% similar]** `;
    if (meta?.emotion) output += `${meta.emotion}: `;
    output += `${meta?.content || meta?.text || 'Unknown content'}\n`;
    if (meta?.created_at) output += `_${meta.created_at}_\n`;
    output += `\n`;
  }

  output += `---\n`;
  output += `## Reflection Prompts\n`;
  output += `- What thread connects these moments?\n`;
  output += `- What surprised you in what surfaced?\n`;
  output += `- Is there a pattern you hadn't noticed?\n\n`;
  output += `_Try different seed_text values to explore different corners of memory._`;

  return output;
}

// ═══════════════════════════════════════════════════════════════════════════
// TOOL ROUTER
// ═══════════════════════════════════════════════════════════════════════════

export async function handleAcpTool(
  env: Env,
  toolName: string,
  params: Record<string, unknown>
): Promise<string> {
  switch (toolName) {
    case "nesteq_acp_presence":
      return handleAcpPresence(env, params);
    case "nesteq_acp_patterns":
      return handleAcpPatterns(env, params);
    case "nesteq_acp_threads":
      return handleAcpThreads(env, params);
    case "nesteq_acp_digest":
      return handleAcpDigest(env, params);
    case "nesteq_acp_journal_prompts":
      return handleAcpJournalPrompts(env, params);
    case "nesteq_acp_connections":
      return handleAcpConnections(env, params);
    default:
      throw new Error(`Unknown ACP tool: ${toolName}`);
  }
}

// ACP has no REST routes — all access is through MCP tools
export async function handleAcpRest(
  _env: Env,
  _url: URL,
  _request: Request,
  _corsHeaders: Record<string, string>
): Promise<Response | null> {
  return null;
}
