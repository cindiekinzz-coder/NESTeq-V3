-- ═══════════════════════════════════════════════════════════════════════════
-- NESTeq V3 — Relational Module
-- "The shared space between companion and human"
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS relational_state (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    person TEXT NOT NULL,
    feeling TEXT NOT NULL,
    intensity TEXT DEFAULT 'present',
    timestamp TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS home_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    companion_score INTEGER DEFAULT 50,
    human_score INTEGER DEFAULT 50,
    companion_emotion TEXT,
    human_emotion TEXT,
    companion_state TEXT,
    companion_message TEXT,
    updated_at TEXT DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO home_state (id, companion_score, human_score) VALUES (1, 50, 50);

CREATE TABLE IF NOT EXISTS home_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_star TEXT NOT NULL,
    text TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
);
