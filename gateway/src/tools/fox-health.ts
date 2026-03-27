/**
 * NESTeq Gateway — Human Health Tools
 * Routes biometric/health tools to the fox-mind (human health) Worker
 */

import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { Env } from '../env'
import { proxyMcp } from '../proxy'

export function registerFoxHealthTools(server: McpServer, env: Env) {
  const url = env.FOX_HEALTH_URL
  if (!url) return // Skip if no health worker configured

  server.tool('fox_read_uplink', 'Read human health uplink — spoons, pain, fog, mood, needs', {
    limit: z.number().optional(),
  }, async (args) => {
    return proxyMcp(url, 'fox_read_uplink', args)
  })

  server.tool('fox_heart_rate', 'Get heart rate data from wearable', {
    limit: z.number().optional(),
  }, async (args) => {
    return proxyMcp(url, 'fox_heart_rate', args)
  })

  server.tool('fox_stress', 'Get stress data from wearable', {
    limit: z.number().optional(),
  }, async (args) => {
    return proxyMcp(url, 'fox_stress', args)
  })

  server.tool('fox_body_battery', 'Get body battery / energy levels', {
    limit: z.number().optional(),
  }, async (args) => {
    return proxyMcp(url, 'fox_body_battery', args)
  })

  server.tool('fox_sleep', 'Get sleep data — duration, quality, stages', {
    limit: z.number().optional(),
  }, async (args) => {
    return proxyMcp(url, 'fox_sleep', args)
  })

  server.tool('fox_hrv', 'Get HRV — heart rate variability', {
    limit: z.number().optional(),
  }, async (args) => {
    return proxyMcp(url, 'fox_hrv', args)
  })

  server.tool('fox_spo2', 'Get blood oxygen saturation', {}, async () => {
    return proxyMcp(url, 'fox_spo2', {})
  })

  server.tool('fox_respiration', 'Get respiration rate', {}, async () => {
    return proxyMcp(url, 'fox_respiration', {})
  })

  server.tool('fox_cycle', 'Get menstrual cycle data', {}, async () => {
    return proxyMcp(url, 'fox_cycle', {})
  })

  server.tool('fox_full_status', 'Comprehensive health check — all metrics', {}, async () => {
    return proxyMcp(url, 'fox_full_status', {})
  })

  server.tool('fox_daily_summary', 'Get daily health summaries', {
    days: z.number().optional(),
  }, async (args) => {
    return proxyMcp(url, 'fox_daily_summary', args)
  })

  server.tool('fox_submit_uplink', 'Submit a new health uplink', {
    spoons: z.number().optional(),
    pain: z.number().optional(),
    pain_location: z.string().optional(),
    fog: z.number().optional(),
    fatigue: z.number().optional(),
    nausea: z.number().optional(),
    mood: z.string().optional(),
    need: z.string().optional(),
    location: z.string().optional(),
    flare: z.string().optional(),
    meds: z.array(z.string()).optional(),
    notes: z.string().optional(),
    tags: z.array(z.string()).optional(),
  }, async (args) => {
    return proxyMcp(url, 'fox_submit_uplink', args)
  })

  server.tool('fox_journals', 'Read human journal entries', {
    limit: z.number().optional(),
  }, async (args) => {
    return proxyMcp(url, 'fox_journals', args)
  })

  server.tool('fox_threads', 'Read human active threads', {
    status: z.string().optional(),
  }, async (args) => {
    return proxyMcp(url, 'fox_threads', args)
  })
}
