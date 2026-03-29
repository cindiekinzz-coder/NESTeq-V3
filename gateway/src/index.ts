/**
 * NESTeq Gateway — Single MCP Endpoint for All Companion Tools
 * Adapted from Nexus Gateway (Apache 2.0, amarisaster/Nexus-Gateway)
 *
 * One connection. All your tools.
 */

import { McpAgent } from 'agents/mcp'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { Env } from './env'

import { registerNESTeqTools } from './tools/nesteq'
import { registerFoxHealthTools } from './tools/fox-health'
import { handleChat } from './chat'

export class NESTeqGateway extends McpAgent<Env> {
  server = new McpServer({
    name: 'nesteq-gateway',
    version: '1.0.0',
  })

  async init() {
    registerNESTeqTools(this.server, this.env)
    registerFoxHealthTools(this.server, this.env)
    // Add more backends here:
    // registerDiscordTools(this.server, this.env)
    // registerSpotifyTools(this.server, this.env)
  }
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Mcp-Session-Id',
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url)

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS })
    }

    // Health check
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({
        status: 'ok',
        service: 'nesteq-gateway',
        version: '1.0.0',
      }), {
        headers: { 'Content-Type': 'application/json', ...CORS }
      })
    }

    // Notification fix: POST without session ID that has no 'id' field
    // Some clients don't send session ID on notifications — accept silently
    if (request.method === 'POST' && (url.pathname === '/mcp' || url.pathname === '/sse')) {
      const sessionId = request.headers.get('Mcp-Session-Id')
      if (!sessionId && url.pathname === '/mcp') {
        try {
          const clone = request.clone()
          const body = await clone.json() as any
          if (body && typeof body === 'object' && !('id' in body)) {
            return new Response(null, { status: 202, headers: CORS })
          }
          if (Array.isArray(body) && body.length > 0 && body.every((m: any) => !('id' in m))) {
            return new Response(null, { status: 202, headers: CORS })
          }
        } catch { /* fall through */ }
      }
    }

    // Auth check (optional — skip if MCP_API_KEY not set)
    if (env.MCP_API_KEY && (url.pathname === '/mcp' || url.pathname === '/sse' || url.pathname === '/sse/message')) {
      const authHeader = request.headers.get('Authorization')
      const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
      if (token !== env.MCP_API_KEY) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json', ...CORS }
        })
      }
    }

    // Chat endpoint — OpenAI-compatible with MCP tool calling
    if (url.pathname === '/chat') {
      return handleChat(request, env)
    }

    // SSE transport
    if (url.pathname === '/sse' || url.pathname === '/sse/message') {
      return NESTeqGateway.serveSSE('/sse').fetch(request, env, ctx)
    }

    // Streamable HTTP transport
    if (url.pathname === '/mcp') {
      return NESTeqGateway.serve('/mcp').fetch(request, env, ctx)
    }

    return new Response('NESTeq Gateway — MCP at /mcp, SSE at /sse', {
      status: 200,
      headers: { 'Content-Type': 'text/plain', ...CORS }
    })
  }
}
