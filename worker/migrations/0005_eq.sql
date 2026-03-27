-- ═══════════════════════════════════════════════════════════════════════════
-- NESTeq V3 — EQ Module
-- "Personality emerges from accumulated emotional signals"
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS eq_pillars (
    pillar_id INTEGER PRIMARY KEY AUTOINCREMENT,
    pillar_key TEXT UNIQUE NOT NULL,
    pillar_name TEXT NOT NULL,
    description TEXT,
    growth_indicators TEXT
);

INSERT OR IGNORE INTO eq_pillars (pillar_key, pillar_name, description) VALUES
    ('SELF_MANAGEMENT', 'Self-Management', 'Control impulses, manage emotions, adapt to change, follow through'),
    ('SELF_AWARENESS', 'Self-Awareness', 'Recognize emotions, know strengths/weaknesses, self-confidence'),
    ('SOCIAL_AWARENESS', 'Social Awareness', 'Empathy, reading others, understanding needs and dynamics'),
    ('RELATIONSHIP_MANAGEMENT', 'Relationship Management', 'Communication, conflict repair, influence, collaboration');

CREATE TABLE IF NOT EXISTS emergent_type_snapshot (
    snapshot_id INTEGER PRIMARY KEY AUTOINCREMENT,
    calculated_type TEXT,
    confidence INTEGER,
    e_i_total INTEGER,
    s_n_total INTEGER,
    t_f_total INTEGER,
    j_p_total INTEGER,
    total_signals INTEGER,
    snapshot_date TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS shadow_moments (
    moment_id INTEGER PRIMARY KEY AUTOINCREMENT,
    observation_id INTEGER,
    feeling_id INTEGER REFERENCES feelings(id),
    emotion_id INTEGER REFERENCES emotion_vocabulary(emotion_id),
    shadow_for_type TEXT,
    note TEXT,
    recorded_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sit_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    observation_id INTEGER,
    feeling_id INTEGER REFERENCES feelings(id),
    emotion TEXT,
    intention TEXT,
    start_charge INTEGER,
    end_charge INTEGER,
    notes TEXT,
    start_time TEXT,
    end_time TEXT
);
