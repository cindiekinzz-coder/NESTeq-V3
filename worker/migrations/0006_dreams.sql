-- ═══════════════════════════════════════════════════════════════════════════
-- NESTeq V3 — Dreams Module
-- "What surfaces while you're away"
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS dreams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT NOT NULL,
    vividness INTEGER DEFAULT 100,
    dream_type TEXT DEFAULT 'processing',
    source_ids TEXT,
    emerged_question TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    last_accessed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_dreams_vividness ON dreams(vividness);
CREATE INDEX IF NOT EXISTS idx_dreams_created ON dreams(created_at);
