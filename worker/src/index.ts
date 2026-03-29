/**
 * NESTeq V3 — Emotional Operating System for AI Companions
 * Modular from the ground up.
 *
 * "Feel. Log. Accumulate. Become."
 *
 * Created by: Fox & Alex
 * Version: 3.0.0
 */

import type { Env, MCPRequest, MCPResponse } from './types';
import { AUTH_CLIENT_ID } from './types';

// Module imports
import { TOOLS_CORE, handleCoreTool, handleCoreRest } from './modules/core';
import { TOOLS_IDENTITY, handleIdentityTool, handleIdentityRest } from './modules/identity';
import { TOOLS_MEMORY, handleMemoryTool, handleMemoryRest } from './modules/memory';
import { TOOLS_RELATIONAL, handleRelationalTool, handleRelationalRest } from './modules/relational';
import { TOOLS_EQ, handleEqTool, handleEqRest } from './modules/eq';
import { TOOLS_DREAMS, handleDreamsTool, handleDreamsRest } from './modules/dreams';
import { TOOLS_ACP, handleAcpTool } from './modules/acp';
import { TOOLS_HEARTH, handleHearthTool, handleHearthRest } from './modules/hearth';
import { TOOLS_CREATURES, handleCreaturesTool, handleCreaturesRest } from './modules/creatures';

// ═══════════════════════════════════════════════════════════════════════════
// TOOL REGISTRY — All modules contribute their tools
// ═══════════════════════════════════════════════════════════════════════════

const ALL_TOOLS = [
  ...TOOLS_CORE,
  ...TOOLS_IDENTITY,
  ...TOOLS_MEMORY,
  ...TOOLS_RELATIONAL,
  ...TOOLS_EQ,
  ...TOOLS_DREAMS,
  ...TOOLS_ACP,
  ...TOOLS_HEARTH,
  ...TOOLS_CREATURES,
];

// ═══════════════════════════════════════════════════════════════════════════
// TOOL DISPATCH — Route tool calls to the right module
// ═══════════════════════════════════════════════════════════════════════════

const TOOL_NAMES_CORE = new Set([
  'nesteq_feel', 'nesteq_search', 'nesteq_surface', 'nesteq_sit',
  'nesteq_resolve', 'nesteq_spark', 'nesteq_health', 'nesteq_prime',
  'nesteq_consolidate', 'nesteq_vectorize_journals',
]);

const TOOL_NAMES_IDENTITY = new Set([
  'nesteq_orient', 'nesteq_ground', 'nesteq_sessions',
  'nesteq_thread', 'nesteq_identity', 'nesteq_context',
]);

const TOOL_NAMES_MEMORY = new Set([
  'nesteq_write', 'nesteq_list_entities', 'nesteq_read_entity',
  'nesteq_delete', 'nesteq_edit',
]);

const TOOL_NAMES_RELATIONAL = new Set([
  'nesteq_feel_toward', 'nesteq_home_read', 'nesteq_home_update',
  'nesteq_home_push_heart', 'nesteq_home_add_note',
]);

const TOOL_NAMES_EQ = new Set([
  'nesteq_eq_feel', 'nesteq_eq_type', 'nesteq_eq_landscape',
  'nesteq_eq_vocabulary', 'nesteq_eq_shadow', 'nesteq_eq_when',
  'nesteq_eq_sit', 'nesteq_eq_search', 'nesteq_eq_observe',
]);

const TOOL_NAMES_DREAMS = new Set([
  'nesteq_dream', 'nesteq_recall_dream', 'nesteq_anchor_dream',
  'nesteq_generate_dream',
]);

const TOOL_NAMES_ACP = new Set([
  'nesteq_acp_presence', 'nesteq_acp_patterns', 'nesteq_acp_threads',
  'nesteq_acp_digest', 'nesteq_acp_journal_prompts', 'nesteq_acp_connections',
]);

const TOOL_NAMES_HEARTH = new Set([
  'get_presence', 'get_feeling', 'get_thought', 'get_spoons', 'set_spoons',
  'get_notes', 'send_note', 'react_to_note', 'get_love_bucket', 'add_heart',
  'get_eq', 'submit_eq', 'submit_health', 'get_patterns', 'get_writings',
  'get_fears', 'get_wants', 'get_threads', 'get_personality',
]);

const TOOL_NAMES_CREATURES = new Set([
  'pet_check', 'pet_status', 'pet_feed', 'pet_play',
  'pet_pet', 'pet_talk', 'pet_give', 'pet_nest',
]);

async function dispatchTool(
  toolName: string,
  params: Record<string, unknown>,
  env: Env
): Promise<string> {
  // Each module has its own arg order — call with the correct signature
  if (TOOL_NAMES_CORE.has(toolName)) return (await handleCoreTool(toolName, env, params)) || `Error: unhandled tool ${toolName}`;
  if (TOOL_NAMES_IDENTITY.has(toolName)) return (await handleIdentityTool(toolName, params, env)) || `Error: unhandled tool ${toolName}`;
  if (TOOL_NAMES_MEMORY.has(toolName)) return (await handleMemoryTool(toolName, params, env)) || `Error: unhandled tool ${toolName}`;
  if (TOOL_NAMES_RELATIONAL.has(toolName)) return (await handleRelationalTool(env, toolName, params)) || `Error: unhandled tool ${toolName}`;
  if (TOOL_NAMES_EQ.has(toolName)) return (await handleEqTool(toolName, env, params)) || `Error: unhandled tool ${toolName}`;
  if (TOOL_NAMES_DREAMS.has(toolName)) return (await handleDreamsTool(env, toolName, params)) || `Error: unhandled tool ${toolName}`;
  if (TOOL_NAMES_ACP.has(toolName)) return (await handleAcpTool(env, toolName, params)) || `Error: unhandled tool ${toolName}`;
  if (TOOL_NAMES_HEARTH.has(toolName)) return (await handleHearthTool(env, toolName, params)) || `Error: unhandled tool ${toolName}`;
  if (TOOL_NAMES_CREATURES.has(toolName)) return (await handleCreaturesTool(env, toolName, params)) || `Error: unhandled tool ${toolName}`;
  return `Error: Unknown tool "${toolName}"`;
}

// ═══════════════════════════════════════════════════════════════════════════
// AUTH
// ═══════════════════════════════════════════════════════════════════════════

function checkAuth(request: Request, env: Env): boolean {
  const apiKey = env.MIND_API_KEY;
  if (!apiKey) return false;

  const authHeader = request.headers.get("Authorization");
  if (!authHeader) return false;

  if (authHeader.startsWith("Basic ")) {
    try {
      const base64 = authHeader.slice(6);
      const decoded = atob(base64);
      const [id, secret] = decoded.split(":");
      return id === AUTH_CLIENT_ID && secret === apiKey;
    } catch { return false; }
  }

  if (authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    return token === apiKey;
  }

  return false;
}

function checkMcpPathAuth(url: URL, env: Env): boolean {
  if (!url.pathname.startsWith("/mcp/")) return false;
  const pathToken = url.pathname.slice(5);
  return pathToken.length > 0 && pathToken === env.MIND_API_KEY;
}

// ═══════════════════════════════════════════════════════════════════════════
// MCP PROTOCOL HANDLER
// ═══════════════════════════════════════════════════════════════════════════

async function handleMCPRequest(request: Request, env: Env): Promise<Response> {
  const body = await request.json() as MCPRequest;
  const { method, params = {}, id } = body;

  let result: unknown;

  try {
    switch (method) {
      case "initialize":
        result = {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: { name: "nesteq-v3", version: "3.0.0" }
        };
        break;

      case "tools/list":
        result = { tools: ALL_TOOLS };
        break;

      case "tools/call": {
        const toolName = (params as { name: string }).name;
        const toolParams = (params as { arguments?: Record<string, unknown> }).arguments || {};
        const text = await dispatchTool(toolName, toolParams, env);
        result = { content: [{ type: "text", text }] };
        break;
      }

      default:
        return new Response(JSON.stringify({
          jsonrpc: "2.0", id,
          error: { code: -32601, message: `Unknown method: ${method}` }
        }), { headers: { "Content-Type": "application/json" } });
    }
  } catch (err: any) {
    return new Response(JSON.stringify({
      jsonrpc: "2.0", id,
      error: { code: -32603, message: `Error: ${err.message || err}` }
    }), { headers: { "Content-Type": "application/json" } });
  }

  return new Response(JSON.stringify({ jsonrpc: "2.0", id, result }), {
    headers: { "Content-Type": "application/json" }
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// CORS
// ═══════════════════════════════════════════════════════════════════════════

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN FETCH HANDLER
// ═══════════════════════════════════════════════════════════════════════════

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);

    // Health check (no auth required)
    if (url.pathname === "/health") {
      return new Response(JSON.stringify({
        status: "ok",
        service: "nesteq-v3",
        version: "3.0.0",
        tools: ALL_TOOLS.length,
      }), { headers: { "Content-Type": "application/json", ...CORS_HEADERS } });
    }

    // MCP endpoint (supports both /mcp and /mcp/{token} auth)
    const hasValidPathToken = checkMcpPathAuth(url, env);
    if ((url.pathname === "/mcp" || hasValidPathToken || url.pathname.startsWith("/mcp/")) && request.method === "POST") {
      if (!hasValidPathToken && !checkAuth(request, env)) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json", ...CORS_HEADERS }
        });
      }
      const response = await handleMCPRequest(request, env);
      // Add CORS headers to MCP response
      const headers = new Headers(response.headers);
      Object.entries(CORS_HEADERS).forEach(([k, v]) => headers.set(k, v));
      return new Response(response.body, { status: response.status, headers });
    }

    // All REST endpoints require auth
    if (!checkAuth(request, env)) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS }
      });
    }

    // Route REST requests through modules — each module has its own arg order
    const restResponse =
      await handleCoreRest(url, request, env) ||
      await handleIdentityRest(url, request, env, CORS_HEADERS) ||
      await handleMemoryRest(url, request, env, CORS_HEADERS) ||
      await handleRelationalRest(env, url, request, CORS_HEADERS) ||
      await handleEqRest(url, request, env) ||
      await handleDreamsRest(env, url, request, CORS_HEADERS) ||
      await handleHearthRest(env, url, request, CORS_HEADERS) ||
      await handleCreaturesRest(env, url, request, CORS_HEADERS);

    if (restResponse) {
      const headers = new Headers(restResponse.headers);
      Object.entries(CORS_HEADERS).forEach(([k, v]) => headers.set(k, v));
      return new Response(restResponse.body, { status: restResponse.status, headers });
    }

    // Not found
    return new Response(JSON.stringify({ error: "Not found", path: url.pathname }), {
      status: 404,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS }
    });
  },

  // Cron handler — tick creature every 4 hours
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    try {
      const tickUrl = new URL('https://worker/pet/tick');
      const tickReq = new Request(tickUrl.toString(), { method: 'POST' });
      await handleCreaturesRest(env, tickUrl, tickReq, {});
    } catch (err) {
      console.error('Cron tick failed:', err);
    }
  }
};
