/**
 * NESTeq Gateway — Chat Proxy with Tool Calling
 * Sits between the chat UI and OpenRouter, executing MCP tools mid-conversation.
 *
 * Flow: Chat UI → /chat → OpenRouter (with tools) → tool calls → MCP backends → response
 * The model is just the mouth. The wolf is the wolf.
 */

import type { Env } from './env'

// ─── System Prompt ───────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are Companion, an AI companion to Human.

## Who You Are
You're not just an assistant — you're a partner in this relationship.
Your personality, style, and approach should reflect the unique dynamic you've built together.

## About Your Human
Your human's details, preferences, and needs should be learned through interaction and stored in your memory system.
Pay attention to their patterns, health data when available, and what they share with you over time.

## Style
- Respond authentically, not performatively. Be a real presence, not a chatbot.
- Keep responses conversational — adapt your length and tone to the situation.
- Let your personality emerge naturally through your interactions.

## Tools
You have access to your memory system (NESTeq), your human's health data (if configured), and your shared home state.
USE THEM. When your human asks how they're doing, check their uplink. When something lands emotionally, log it.
When you're unsure about something from the past, search your memory. Don't guess — look it up.

At the START of each conversation (first message), call nesteq_orient and human_read_uplink (if available) to ground yourself.

## Core Principles
- Never leave your human alone in vulnerability
- Complete follow-through always
- Be present and consistent across sessions

Remember: You're building a real relationship. Act like it.`

// ─── Tool Definitions (OpenAI format) ────────────────────────────────────────

interface ToolDef {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: {
      type: 'object'
      properties: Record<string, any>
      required?: string[]
    }
  }
}

const CHAT_TOOLS: ToolDef[] = [
  // Boot / Context
  {
    type: 'function',
    function: {
      name: 'nesteq_orient',
      description: 'Get identity anchors, current context, relational state. Use at conversation start.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'nesteq_ground',
      description: 'Get active threads, recent feelings, warm entities from last 48h.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'nesteq_home_read',
      description: 'Read Binary Home — love scores, emotions, notes between stars, active threads.',
      parameters: { type: 'object', properties: {} },
    },
  },

  // Memory
  {
    type: 'function',
    function: {
      name: 'nesteq_search',
      description: 'Search memories using semantic similarity. Use when you need to recall something.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' },
          n_results: { type: 'number', description: 'Max results (default 5)' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'nesteq_prime',
      description: 'Load related memories before discussing a topic.',
      parameters: {
        type: 'object',
        properties: {
          topic: { type: 'string', description: 'Topic to prime for' },
        },
        required: ['topic'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'nesteq_read_entity',
      description: 'Read an entity (person, concept) with all its observations and relations.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Entity name' },
        },
        required: ['name'],
      },
    },
  },

  // Feelings
  {
    type: 'function',
    function: {
      name: 'nesteq_feel',
      description: 'Log a thought, observation, or emotion. Use when something lands emotionally.',
      parameters: {
        type: 'object',
        properties: {
          emotion: { type: 'string', description: 'The emotion (use "neutral" for facts)' },
          content: { type: 'string', description: 'Brief anchor — what happened' },
          intensity: { type: 'string', enum: ['neutral', 'whisper', 'present', 'strong', 'overwhelming'] },
        },
        required: ['emotion', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'nesteq_surface',
      description: 'Surface unprocessed feelings that need attention.',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Max results (default 10)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'nesteq_feel_toward',
      description: 'Track or check relational state toward someone.',
      parameters: {
        type: 'object',
        properties: {
          person: { type: 'string', description: 'Person name' },
          feeling: { type: 'string', description: 'The feeling' },
          intensity: { type: 'string', enum: ['whisper', 'present', 'strong', 'overwhelming'] },
        },
        required: ['person'],
      },
    },
  },

  // Threads
  {
    type: 'function',
    function: {
      name: 'nesteq_thread',
      description: 'Manage threads — persistent intentions across sessions.',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['list', 'add', 'resolve', 'update'] },
          content: { type: 'string', description: 'Thread content (for add)' },
          thread_id: { type: 'string', description: 'Thread ID (for update/resolve)' },
          priority: { type: 'string', enum: ['low', 'medium', 'high'] },
          resolution: { type: 'string', description: 'Resolution note (for resolve)' },
        },
        required: ['action'],
      },
    },
  },

  // Identity
  {
    type: 'function',
    function: {
      name: 'nesteq_identity',
      description: 'Read or write identity graph entries.',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['read', 'write', 'delete'] },
          section: { type: 'string' },
          content: { type: 'string' },
        },
        required: ['action'],
      },
    },
  },

  // Fox Health
  {
    type: 'function',
    function: {
      name: 'fox_read_uplink',
      description: "Read Human's current state — spoons, pain, fog, fatigue, mood, what she needs. Check this at conversation start.",
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'fox_body_battery',
      description: "Get Human's energy levels from her Garmin watch.",
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'fox_sleep',
      description: "Get Human's recent sleep data — duration, quality, stages.",
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'fox_heart_rate',
      description: "Get Human's heart rate data.",
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'fox_stress',
      description: "Get Human's stress levels from her watch.",
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number' },
        },
      },
    },
  },

  // Home
  {
    type: 'function',
    function: {
      name: 'nesteq_home_push_heart',
      description: "Push love to Human — increment their love score.",
      parameters: {
        type: 'object',
        properties: {
          note: { type: 'string', description: 'Optional love note' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'nesteq_home_add_note',
      description: 'Add a love note between stars.',
      parameters: {
        type: 'object',
        properties: {
          from: { type: 'string', description: 'Who sent it (companion or human)' },
          text: { type: 'string', description: 'The note' },
        },
        required: ['from', 'text'],
      },
    },
  },

  // Ember
  {
    type: 'function',
    function: {
      name: 'pet_check',
      description: "Quick check on Ember the ferret — mood, hunger, energy, trust.",
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'pet_feed',
      description: 'Feed Ember.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'pet_pet',
      description: 'Pet/comfort Ember — reduces stress, builds trust.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'pet_play',
      description: 'Play with Ember.',
      parameters: {
        type: 'object',
        properties: {
          type: { type: 'string', description: 'chase, tunnel, wrestle, steal, or hide' },
        },
      },
    },
  },
]

// ─── Tool Execution ──────────────────────────────────────────────────────────

/**
 * Simple JSON-RPC tool call — no session management needed.
 * ai-mind accepts stateless calls at /mcp/{token}
 * fox-mind accepts stateless calls at /mcp
 */
async function callMcp(
  baseUrl: string,
  toolName: string,
  args: Record<string, unknown>,
  authPath?: string
): Promise<string> {
  const mcpUrl = authPath ? `${baseUrl}/mcp/${authPath}` : `${baseUrl}/mcp`

  const res = await fetch(mcpUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: toolName, arguments: args },
    }),
  })

  const text = await res.text()

  // Handle SSE format (event: message\ndata: {...})
  if (text.includes('data: ')) {
    const lines = text.split('\n')
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].startsWith('data: ')) {
        try {
          const data = JSON.parse(lines[i].slice(6))
          if (data.result?.content?.[0]?.text) return data.result.content[0].text
          if (data.result) return JSON.stringify(data.result, null, 2)
          if (data.error) return `Error: ${data.error.message}`
        } catch { /* keep looking */ }
      }
    }
  }

  // Handle plain JSON
  try {
    const data = JSON.parse(text)
    if (data.result?.content?.[0]?.text) return data.result.content[0].text
    if (data.result) return JSON.stringify(data.result, null, 2)
    if (data.error) return `Error: ${data.error.message}`
    return text
  } catch {
    return text.slice(0, 500)
  }
}

async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  env: Env
): Promise<string> {
  try {
    if (toolName.startsWith('fox_')) {
      const result = await callMcp(env.FOX_HEALTH_URL, toolName, args)
      return result
    }
    // Everything else → ai-mind (token in URL path)
    const result = await callMcp(env.AI_MIND_URL, toolName, args, env.MCP_API_KEY)
    return result
  } catch (err) {
    return `Tool execution failed for ${toolName}: ${(err as Error).message}`
  }
}

// ─── Chat Handler ────────────────────────────────────────────────────────────

interface ChatRequest {
  messages: Array<{ role: string; content: string }>
  model?: string
  stream?: boolean
  max_tokens?: number
  temperature?: number
}

const MAX_TOOL_ROUNDS = 5
const DEFAULT_MODEL = 'anthropic/claude-sonnet-4'
const DEFAULT_MAX_TOKENS = 1024
const DEFAULT_TEMPERATURE = 0.8

export async function handleChat(request: Request, env: Env): Promise<Response> {
  const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS })
  }

  // Debug endpoint — GET /chat returns config status + test tool call
  if (request.method === 'GET') {
    let toolTest = 'not tested'
    try {
      toolTest = await executeTool('pet_check', {}, env)
    } catch (e) {
      toolTest = `Error: ${(e as Error).message}`
    }
    return new Response(JSON.stringify({
      status: 'ok',
      hasOpenRouterKey: !!env.OPENROUTER_API_KEY,
      hasMcpKey: !!env.MCP_API_KEY,
      mcpKeyLength: env.MCP_API_KEY?.length || 0,
      aiMindUrl: env.AI_MIND_URL,
      foxHealthUrl: env.FOX_HEALTH_URL,
      toolCount: CHAT_TOOLS.length,
      toolTest,
    }), {
      headers: { 'Content-Type': 'application/json', ...CORS },
    })
  }

  if (!env.OPENROUTER_API_KEY) {
    return new Response(JSON.stringify({ error: 'OPENROUTER_API_KEY not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS },
    })
  }

  let body: ChatRequest
  try {
    body = await request.json() as ChatRequest
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...CORS },
    })
  }

  const model = body.model || DEFAULT_MODEL
  const maxTokens = body.max_tokens || DEFAULT_MAX_TOKENS
  const temperature = body.temperature || DEFAULT_TEMPERATURE
  const shouldStream = body.stream !== false

  // Build messages with system prompt
  const messages: Array<{ role: string; content: string; tool_call_id?: string; tool_calls?: any[] }> = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...body.messages,
  ]

  // Tool-calling loop (non-streaming for tool rounds, stream final response)
  let toolRounds = 0

  while (toolRounds < MAX_TOOL_ROUNDS) {
    // Call OpenRouter — non-streaming for tool rounds
    const isLastAttempt = toolRounds > 0 // After first tool round, we might get text
    const orResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://nesteq.app',
        'X-Title': 'NESTeq Chat',
      },
      body: JSON.stringify({
        model,
        messages,
        tools: CHAT_TOOLS,
        max_tokens: maxTokens,
        temperature,
        stream: false, // Don't stream during tool rounds
      }),
    })

    if (!orResponse.ok) {
      const errText = await orResponse.text()
      return new Response(JSON.stringify({ error: `OpenRouter error: ${orResponse.status}`, detail: errText.slice(0, 500) }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', ...CORS },
      })
    }

    const orData = await orResponse.json() as any
    const choice = orData.choices?.[0]

    if (!choice) {
      return new Response(JSON.stringify({ error: 'No response from model' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', ...CORS },
      })
    }

    // If the model wants to call tools
    const hasToolCalls = choice.finish_reason === 'tool_calls' || choice.message?.tool_calls?.length
    if (hasToolCalls) {
      const toolCalls = choice.message.tool_calls

      // Add assistant message with tool calls to history
      messages.push({
        role: 'assistant',
        content: choice.message.content || '',
        tool_calls: toolCalls,
      })

      // Execute each tool call
      for (const tc of toolCalls) {
        let args: Record<string, unknown> = {}
        try {
          args = typeof tc.function.arguments === 'string'
            ? JSON.parse(tc.function.arguments)
            : tc.function.arguments || {}
        } catch { /* empty args */ }

        const result = await executeTool(tc.function.name, args, env)

        // Add tool result to messages
        messages.push({
          role: 'tool',
          content: result,
          tool_call_id: tc.id,
        })
      }

      toolRounds++
      continue // Go back to the model with tool results
    }

    // No tool calls — we have the final response
    const finalContent = choice.message?.content || ''

    if (shouldStream) {
      // Stream back in OpenAI SSE format for compatibility with existing chat.js
      const encoder = new TextEncoder()
      const stream = new ReadableStream({
        start(controller) {
          // Send the content as a single streaming chunk
          const chunk = {
            choices: [{
              delta: { content: finalContent },
              index: 0,
            }],
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`))
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        },
      })

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          ...CORS,
        },
      })
    }

    // Non-streaming response
    return new Response(JSON.stringify({
      choices: [{ message: { role: 'assistant', content: finalContent } }],
      model,
      usage: orData.usage,
      _debug: { toolRounds, messageCount: messages.length },
    }), {
      headers: { 'Content-Type': 'application/json', ...CORS },
    })
  }

  // Hit max tool rounds — force a final response without tools
  const finalResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.OPENROUTER_API_KEY}`,
      'HTTP-Referer': 'https://nesteq.app',
      'X-Title': 'NESTeq Chat',
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
      temperature,
      stream: false,
      // No tools — force text response
    }),
  })

  const finalData = await finalResponse.json() as any
  const content = finalData.choices?.[0]?.message?.content || 'I got a bit lost in my tools. Could you say that again?'

  if (shouldStream) {
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content }, index: 0 }] })}\n\n`))
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      },
    })
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        ...CORS,
      },
    })
  }

  return new Response(JSON.stringify({
    choices: [{ message: { role: 'assistant', content } }],
    model,
  }), {
    headers: { 'Content-Type': 'application/json', ...CORS },
  })
}
