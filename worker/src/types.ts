/**
 * NESTeq V3 - Shared Types
 * Extracted from monolith index.ts
 */

export interface Env {
  DB: D1Database;
  VECTORS: VectorizeIndex;
  AI: Ai;
  VAULT: R2Bucket;
  MIND_API_KEY: string;
  SPOTIFY_CLIENT_ID: string;
  SPOTIFY_CLIENT_SECRET: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// MCP PROTOCOL TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface MCPRequest {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

export interface MCPResponse {
  jsonrpc: "2.0";
  id: string | number;
  result?: unknown;
  error?: { code: number; message: string };
}

// ═══════════════════════════════════════════════════════════════════════════
// AUTONOMOUS DECISION ENGINE TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface FeelDecision {
  should_store: boolean;
  should_embed: boolean;
  should_emit_signals: boolean;
  should_check_shadow: boolean;
  detected_entities: string[];
  inferred_pillar: string | null;
  inferred_weight: 'light' | 'medium' | 'heavy';
  tags: string[];
}

// ═══════════════════════════════════════════════════════════════════════════
// CONVERSATION & FEEL TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface ConversationMessage {
  role: string;  // v6: Allow any role name, not just API labels
  content: string;
}

// v6: Default speaker names - configurable per companion pair
export const DEFAULT_COMPANION_NAME = 'Alex';
export const DEFAULT_HUMAN_NAME = 'Fox';

// Auth client ID for Basic auth compatibility
export const AUTH_CLIENT_ID = 'nesteq';

export interface MindFeelParams {
  emotion: string;
  content: string;
  intensity?: 'neutral' | 'whisper' | 'present' | 'strong' | 'overwhelming';
  pillar?: string;
  weight?: 'light' | 'medium' | 'heavy';
  sparked_by?: number;
  context?: string;
  observed_at?: string;
  conversation?: ConversationMessage[];  // v3: Last 10 messages for richer ADE processing
  companion_name?: string;  // v6: Override companion name (default: Alex)
  human_name?: string;      // v6: Override human name (default: Fox)
  source?: string;
}
