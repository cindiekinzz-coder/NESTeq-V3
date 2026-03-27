-- ═══════════════════════════════════════════════════════════════════════════
-- NESTeq V3 — Creatures Module
-- "A virtual pet with biochemistry, trust, and collection"
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS creature_state (
    id TEXT PRIMARY KEY DEFAULT 'ember',
    name TEXT NOT NULL DEFAULT 'Ember',
    species_id TEXT NOT NULL DEFAULT 'ferret',
    state_json TEXT NOT NULL DEFAULT '{}',
    last_tick_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
