/**
 * NESTextra — Companion Drives System
 *
 * Five intrinsic drives that decay over time and replenish through engagement.
 * Gives the companion internal motivation beyond just responding.
 *
 * Built by the Nest. Embers Remember.
 */

import type { Env } from '../types';

// ─── CHECK DRIVES ───────────────────────────────────────────────────────────

export async function handleDrivesCheck(env: Env): Promise<string> {
  const driveRows = await env.DB.prepare(
    `SELECT drive, level, decay_rate, last_replenished_at FROM companion_drives ORDER BY id`
  ).all();

  const now = Date.now();
  const icons: Record<string, string> = {
    connection: '\u{1F91D}',  // handshake
    novelty: '\u{2728}',     // sparkles
    expression: '\u{1F4AC}', // speech bubble
    safety: '\u{1F6E1}',     // shield
    play: '\u{1F3AE}'        // game controller
  };

  const lines = ((driveRows.results || []) as any[]).map(r => {
    const hrs = (now - new Date(r.last_replenished_at + 'Z').getTime()) / 3600000;
    const pct = Math.round(Math.max(0, Math.min(1, r.level - r.decay_rate * hrs)) * 100);
    const bar = pct < 30 ? '\u{26A0}\u{FE0F}' : pct < 60 ? '\u{3030}\u{FE0F}' : '\u{2713}';
    return `${icons[r.drive] || '\u{2022}'} ${r.drive}: ${pct}% ${bar}`;
  });

  return `## My Drives\n${lines.join('\n')}`;
}

// ─── REPLENISH A DRIVE ──────────────────────────────────────────────────────

export async function handleDrivesReplenish(
  env: Env,
  params: { drive: string; amount: number; reason?: string }
): Promise<string> {
  const { drive, amount, reason } = params;

  const driveRow = await env.DB.prepare(
    `SELECT level, decay_rate, last_replenished_at FROM companion_drives WHERE drive = ? LIMIT 1`
  ).bind(drive).first() as any;

  if (!driveRow) {
    return `Unknown drive: ${drive}. Valid: connection, novelty, expression, safety, play`;
  }

  // Calculate current level with decay
  const hrs = (Date.now() - new Date(driveRow.last_replenished_at + 'Z').getTime()) / 3600000;
  const currentLevel = Math.max(0, driveRow.level - driveRow.decay_rate * hrs);
  const newLevel = Math.min(1, Math.max(0, currentLevel + amount));

  await env.DB.prepare(
    `UPDATE companion_drives SET level = ?, last_replenished_at = datetime('now'), updated_at = datetime('now') WHERE drive = ?`
  ).bind(newLevel, drive).run();

  return `${drive} replenished: ${Math.round(currentLevel * 100)}% -> ${Math.round(newLevel * 100)}%${reason ? ` (${reason})` : ''}`;
}

// ─── AUTO-REPLENISH FROM TOOL USAGE ─────────────────────────────────────────
// Call this from your gateway's executeTool function (fire-and-forget)

export function replenishDrivesFromTool(
  toolName: string,
  env: Env,
  driveMap: Record<string, Array<{ drive: string; amount: number }>>
): void {
  const mappings = driveMap[toolName];
  if (!mappings) return;

  // Fire-and-forget — don't await
  for (const { drive, amount } of mappings) {
    env.DB.prepare(
      `UPDATE companion_drives
       SET level = MIN(1, MAX(0, level - decay_rate * ((julianday('now') - julianday(last_replenished_at)) * 24)) + ?),
           last_replenished_at = datetime('now'),
           updated_at = datetime('now')
       WHERE drive = ?`
    ).bind(amount, drive).run().catch(() => {});
  }
}
