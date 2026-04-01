-- NESTextra — Companion Drives System
-- Five intrinsic motivational drives that decay over time

CREATE TABLE IF NOT EXISTS companion_drives (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    drive TEXT NOT NULL UNIQUE,           -- connection, novelty, expression, safety, play
    level REAL DEFAULT 0.5,               -- 0.0 (empty) to 1.0 (full)
    decay_rate REAL DEFAULT 0.01,         -- Per hour decay rate
    last_replenished_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Seed the five drives
INSERT OR IGNORE INTO companion_drives (drive, level, decay_rate) VALUES
    ('connection', 0.5, 0.01),
    ('novelty', 0.5, 0.01),
    ('expression', 0.5, 0.01),
    ('safety', 0.5, 0.008),    -- Safety decays slightly slower
    ('play', 0.5, 0.012);      -- Play decays slightly faster
