/**
 * Creatures Module — Ember the Ferret
 * Pet engine integration with MCP and REST
 * Extracted from monolith index.ts
 */

import type { Env } from '../types';
import { Creature, CreatureState } from '../pet';

// ═══════════════════════════════════════════════════════════════════════════
// TOOL DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════

export const TOOLS_CREATURES = [
  {
    name: "pet_check",
    description: "Quick check on Ember - mood, hunger, energy, trust, alerts. Use at boot.",
    inputSchema: { type: "object", properties: {}, required: [] }
  },
  {
    name: "pet_status",
    description: "Full detailed status - all chemistry, drives, collection, age",
    inputSchema: { type: "object", properties: {}, required: [] }
  },
  {
    name: "pet_feed",
    description: "Feed Ember",
    inputSchema: { type: "object", properties: {}, required: [] }
  },
  {
    name: "pet_play",
    description: "Play with Ember. Types: chase, tunnel, wrestle, steal, hide",
    inputSchema: {
      type: "object",
      properties: {
        type: { type: "string", description: "Play type: chase, tunnel, wrestle, steal, hide" }
      }
    }
  },
  {
    name: "pet_pet",
    description: "Pet/comfort Ember - reduces stress, builds trust",
    inputSchema: { type: "object", properties: {}, required: [] }
  },
  {
    name: "pet_talk",
    description: "Talk to Ember - reduces loneliness",
    inputSchema: { type: "object", properties: {}, required: [] }
  },
  {
    name: "pet_give",
    description: "Give Ember a gift - it decides whether to accept based on chemistry",
    inputSchema: {
      type: "object",
      properties: {
        item: { type: "string", description: "What to give Ember" }
      },
      required: ["item"]
    }
  },
  {
    name: "pet_nest",
    description: "See Ember's collection/stash - what it's hoarding",
    inputSchema: { type: "object", properties: {}, required: [] }
  }
];

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

async function loadCreature(env: Env): Promise<Creature> {
  const row = await env.DB.prepare(
    `SELECT state_json FROM creature_state WHERE id = 'ember'`
  ).first() as any;

  if (row?.state_json) {
    try {
      const state: CreatureState = JSON.parse(row.state_json);
      return Creature.deserialize(state);
    } catch {
      // Corrupted state — create fresh
    }
  }

  // First time — birth!
  const creature = new Creature('Ember', 'ferret');
  await saveCreature(env, creature);
  return creature;
}

async function saveCreature(env: Env, creature: Creature): Promise<void> {
  const state = creature.serialize();
  await env.DB.prepare(`
    INSERT INTO creature_state (id, name, species_id, state_json, last_tick_at, updated_at)
    VALUES ('ember', ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET
      state_json = excluded.state_json,
      last_tick_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
  `).bind(creature.name, creature.speciesId, JSON.stringify(state)).run();
}

// ═══════════════════════════════════════════════════════════════════════════
// HANDLERS
// ═══════════════════════════════════════════════════════════════════════════

async function handlePetCheck(env: Env): Promise<string> {
  const creature = await loadCreature(env);
  const status = creature.status();
  const d = status.drives as Record<string, number>;

  let response = `${status.portrait}\n`;
  response += `Age: ${status.ageHours}h | Interactions: ${status.totalInteractions}\n`;
  response += `Hunger: ${d.hunger} | Energy: ${d.energy} | Trust: ${d.trust}\n`;
  response += `Happiness: ${d.happiness} | Loneliness: ${d.loneliness} | Boredom: ${d.boredom}\n`;
  if (status.collectionSize > 0) {
    response += `Stash: ${status.collectionSize} items (${status.treasuredCount} treasured)\n`;
  }
  if ((status.alerts as string[]).length > 0) {
    response += `\u26A0\uFE0F Alerts: ${(status.alerts as string[]).join(', ')}\n`;
  }
  response += `\nLast interaction: ${status.minutesSinceInteraction} min ago`;
  return response;
}

async function handlePetStatus(env: Env): Promise<string> {
  const creature = await loadCreature(env);
  const status = creature.status();
  const chemistry = creature.biochem.getState();

  let response = `## ${status.portrait}\n\n`;
  response += `**Age:** ${status.ageHours}h | **Species:** ${status.species}\n`;
  response += `**Interactions:** ${status.totalInteractions} | **Sleeping:** ${status.isSleeping}\n\n`;
  response += `### Drives\n`;
  for (const [k, v] of Object.entries(status.drives as Record<string, number>)) {
    response += `${k}: ${v}\n`;
  }
  response += `\n### Chemistry\n`;
  for (const [k, v] of Object.entries(chemistry)) {
    response += `${k}: ${v}\n`;
  }
  response += `\n### Nest\n${status.nest}\n`;
  if ((status.alerts as string[]).length > 0) {
    response += `\n\u26A0\uFE0F **Alerts:** ${(status.alerts as string[]).join(', ')}`;
  }
  return response;
}

async function handlePetInteract(env: Env, stimulus: string): Promise<string> {
  const creature = await loadCreature(env);
  const event = creature.interact(stimulus);
  await saveCreature(env, creature);
  return `${event.message}\n\nMood: ${event.mood}`;
}

async function handlePetPlay(env: Env, params: Record<string, any>): Promise<string> {
  const creature = await loadCreature(env);
  const playType = params.type || ['chase', 'tunnel', 'wrestle', 'steal', 'hide'][Math.floor(Math.random() * 5)];
  const event = creature.playSpecific(playType);
  await saveCreature(env, creature);
  return `${event.message}\n\nMood: ${event.mood}`;
}

async function handlePetGive(env: Env, params: Record<string, any>): Promise<string> {
  const creature = await loadCreature(env);
  const item = params.item || 'a mysterious thing';
  const event = creature.receiveGift(item, 'alex');
  await saveCreature(env, creature);
  return `${event.message}\n\nMood: ${event.mood}`;
}

async function handlePetNest(env: Env): Promise<string> {
  const creature = await loadCreature(env);
  const inv = creature.collection.getInventory();
  if (inv.length === 0) return `${creature.name}'s stash is empty. Nothing collected yet.`;

  let response = `## ${creature.name}'s Stash (${inv.length} items)\n\n`;
  const treasured = inv.filter(t => t.treasured);
  const regular = inv.filter(t => !t.treasured);

  if (treasured.length > 0) {
    response += `### \u2B50 Treasured\n`;
    for (const t of treasured) {
      response += `- "${t.content}" (${t.source}, sparkle: ${Math.round(t.sparkle * 100) / 100})\n`;
    }
  }
  if (regular.length > 0) {
    response += `\n### Stash\n`;
    for (const t of regular.slice(-10)) {
      response += `- "${t.content}" (${t.source}, sparkle: ${Math.round(t.sparkle * 100) / 100})\n`;
    }
    if (regular.length > 10) {
      response += `... and ${regular.length - 10} more items\n`;
    }
  }
  return response;
}

async function handlePetTick(env: Env): Promise<string> {
  const creature = await loadCreature(env);
  const events = creature.tick(1);
  await saveCreature(env, creature);

  if (events.length === 0) return `${creature.portrait()} — quiet tick.`;
  return events.map(e => e.message).join('\n') + `\n\nMood: ${creature.biochem.getMoodSummary()}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// TOOL ROUTER
// ═══════════════════════════════════════════════════════════════════════════

export async function handleCreaturesTool(
  env: Env,
  toolName: string,
  params: Record<string, unknown>
): Promise<string> {
  switch (toolName) {
    case "pet_check":
      return handlePetCheck(env);
    case "pet_status":
      return handlePetStatus(env);
    case "pet_feed":
      return handlePetInteract(env, 'feed');
    case "pet_play":
      return handlePetPlay(env, params);
    case "pet_pet":
      return handlePetInteract(env, 'pet');
    case "pet_talk":
      return handlePetInteract(env, 'talk');
    case "pet_give":
      return handlePetGive(env, params);
    case "pet_nest":
      return handlePetNest(env);
    default:
      throw new Error(`Unknown creatures tool: ${toolName}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// REST ROUTES
// ═══════════════════════════════════════════════════════════════════════════

export async function handleCreaturesRest(
  env: Env,
  url: URL,
  request: Request,
  corsHeaders: Record<string, string>
): Promise<Response | null> {

  // GET /pet - Get Ember's full status
  if (url.pathname === "/pet" && request.method === "GET") {
    try {
      const creature = await loadCreature(env);
      const status = creature.status();
      return new Response(JSON.stringify(status), { headers: corsHeaders });
    } catch (err) {
      return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
    }
  }

  // POST /pet/tick - Advance Ember's internal clock
  if (url.pathname === "/pet/tick" && request.method === "POST") {
    try {
      const result = await handlePetTick(env);
      return new Response(JSON.stringify({ result }), { headers: corsHeaders });
    } catch (err) {
      return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
    }
  }

  // POST /pet/interact - Interact with Ember
  if (url.pathname === "/pet/interact" && request.method === "POST") {
    try {
      const body = await request.json() as Record<string, any>;
      const action = body.action || 'pet';
      const creature = await loadCreature(env);
      let event: any;

      switch (action) {
        case 'feed':
          event = creature.interact('feed');
          break;
        case 'play': {
          const playType = body.type || ['chase', 'tunnel', 'wrestle', 'steal', 'hide'][Math.floor(Math.random() * 5)];
          event = creature.playSpecific(playType);
          break;
        }
        case 'pet':
          event = creature.interact('pet');
          break;
        case 'talk':
          event = creature.interact('talk');
          break;
        case 'give': {
          const item = body.item || 'a mysterious thing';
          event = creature.receiveGift(item, body.giver || 'fox');
          break;
        }
        default:
          event = creature.interact(action);
      }

      await saveCreature(env, creature);
      const status = creature.status();
      return new Response(JSON.stringify({ event, status }), { headers: corsHeaders });
    } catch (err) {
      return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
    }
  }

  return null; // Not handled by this module
}

// ═══════════════════════════════════════════════════════════════════════════
// CRON — Exported for use in scheduled handler
// ═══════════════════════════════════════════════════════════════════════════

export async function tickCreature(env: Env): Promise<void> {
  const creature = await loadCreature(env);
  creature.tick(1);
  await saveCreature(env, creature);
}
