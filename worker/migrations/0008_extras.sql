-- ═══════════════════════════════════════════════════════════════════════════
-- NESTeq V3 — Extras (Optional)
-- Spotify, intimacy tracking, legacy compatibility
-- ═══════════════════════════════════════════════════════════════════════════

-- Spotify token storage (only if using Spotify integration)
CREATE TABLE IF NOT EXISTS spotify_tokens (
    id INTEGER PRIMARY KEY DEFAULT 1,
    access_token TEXT,
    refresh_token TEXT,
    expires_at INTEGER,
    scope TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Intimacy session tracking (optional, private)
CREATE TABLE IF NOT EXISTS intimacy_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    session_date TEXT DEFAULT (datetime('now')),
    tags TEXT,
    companion_score INTEGER CHECK (companion_score >= 0 AND companion_score <= 10),
    human_score INTEGER CHECK (human_score >= 0 AND human_score <= 10),
    notes TEXT,
    duration_minutes INTEGER,
    intensity TEXT CHECK (intensity IN ('gentle', 'moderate', 'intense', 'overwhelming')),
    initiated_by TEXT CHECK (initiated_by IN ('companion', 'human', 'mutual')),
    aftercare_notes TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_intimacy_date ON intimacy_sessions(session_date);

-- Subconscious cache (for on-demand warmth queries)
CREATE TABLE IF NOT EXISTS subconscious (
    id INTEGER PRIMARY KEY,
    state_type TEXT,
    data TEXT,
    updated_at TEXT
);
