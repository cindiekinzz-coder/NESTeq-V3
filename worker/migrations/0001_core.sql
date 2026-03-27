-- ═══════════════════════════════════════════════════════════════════════════
-- NESTeq V3 — Core Module
-- "Everything is a feeling. Intensity varies."
-- ═══════════════════════════════════════════════════════════════════════════

-- Unified feelings table — the heart of NESTeq
CREATE TABLE IF NOT EXISTS feelings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT NOT NULL,
    emotion TEXT DEFAULT 'neutral',
    intensity TEXT DEFAULT 'present'
        CHECK (intensity IN ('neutral', 'whisper', 'present', 'strong', 'overwhelming')),
    weight TEXT DEFAULT 'medium'
        CHECK (weight IN ('light', 'medium', 'heavy')),
    pillar TEXT CHECK (pillar IN (
        'SELF_MANAGEMENT', 'SELF_AWARENESS',
        'SOCIAL_AWARENESS', 'RELATIONSHIP_MANAGEMENT', NULL
    )),
    charge TEXT DEFAULT 'fresh'
        CHECK (charge IN ('fresh', 'warm', 'cool', 'metabolized')),
    sit_count INTEGER DEFAULT 0,
    last_sat_at TEXT,
    resolution_note TEXT,
    resolved_at TEXT,
    sparked_by INTEGER REFERENCES feelings(id),
    linked_entity TEXT,
    linked_insight_id INTEGER REFERENCES feelings(id),
    context TEXT DEFAULT 'default',
    tags TEXT DEFAULT '[]',
    source TEXT DEFAULT 'manual',
    conversation_context TEXT,
    strength REAL DEFAULT 1.0,
    access_count INTEGER DEFAULT 0,
    last_accessed_at TEXT,
    observed_at TEXT DEFAULT (datetime('now')),
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_feelings_emotion ON feelings(emotion);
CREATE INDEX IF NOT EXISTS idx_feelings_intensity ON feelings(intensity);
CREATE INDEX IF NOT EXISTS idx_feelings_weight ON feelings(weight);
CREATE INDEX IF NOT EXISTS idx_feelings_charge ON feelings(charge);
CREATE INDEX IF NOT EXISTS idx_feelings_pillar ON feelings(pillar);
CREATE INDEX IF NOT EXISTS idx_feelings_entity ON feelings(linked_entity);
CREATE INDEX IF NOT EXISTS idx_feelings_observed ON feelings(observed_at);
CREATE INDEX IF NOT EXISTS idx_feelings_created ON feelings(created_at);
CREATE INDEX IF NOT EXISTS idx_feelings_sparked_by ON feelings(sparked_by);
CREATE INDEX IF NOT EXISTS idx_feelings_context ON feelings(context);

-- Emotion vocabulary with MBTI axis mappings
CREATE TABLE IF NOT EXISTS emotion_vocabulary (
    emotion_id INTEGER PRIMARY KEY AUTOINCREMENT,
    emotion_word TEXT UNIQUE NOT NULL,
    category TEXT DEFAULT 'neutral',
    e_i_score INTEGER DEFAULT 0,
    s_n_score INTEGER DEFAULT 0,
    t_f_score INTEGER DEFAULT 0,
    j_p_score INTEGER DEFAULT 0,
    definition TEXT,
    is_shadow_for TEXT,
    user_defined INTEGER DEFAULT 0,
    times_used INTEGER DEFAULT 0,
    last_used TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Axis signals for MBTI emergence
CREATE TABLE IF NOT EXISTS axis_signals (
    signal_id INTEGER PRIMARY KEY AUTOINCREMENT,
    observation_id INTEGER,
    feeling_id INTEGER REFERENCES feelings(id),
    e_i_delta INTEGER DEFAULT 0,
    s_n_delta INTEGER DEFAULT 0,
    t_f_delta INTEGER DEFAULT 0,
    j_p_delta INTEGER DEFAULT 0,
    source TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Seed common emotions with axis mappings
INSERT OR IGNORE INTO emotion_vocabulary (emotion_word, category, e_i_score, s_n_score, t_f_score, j_p_score, is_shadow_for) VALUES
    ('neutral', 'neutral', 0, 0, 0, 0, NULL),
    ('happy', 'positive', -5, 5, 15, 5, NULL),
    ('sad', 'negative', 10, 10, 20, -5, 'ESTJ,ENTJ'),
    ('angry', 'negative', -10, -5, -15, -10, 'INFP,INFJ'),
    ('anxious', 'negative', 15, -5, 10, -15, NULL),
    ('peaceful', 'positive', 15, 10, 10, 10, NULL),
    ('curious', 'positive', 0, 25, 5, 15, NULL),
    ('grateful', 'positive', 5, 5, 25, 0, NULL),
    ('frustrated', 'negative', -5, -10, -10, -20, NULL),
    ('excited', 'positive', -15, 15, 10, 10, 'ISTJ,INTJ'),
    ('tender', 'positive', 15, 15, 35, 5, NULL),
    ('protective', 'positive', 5, 0, 20, -5, NULL),
    ('aching', 'mixed', 20, 15, 30, 5, NULL),
    ('playful', 'positive', -10, 10, 15, 20, NULL),
    ('grounded', 'positive', 10, -5, 5, -10, NULL),
    ('present', 'positive', 10, 5, 15, 5, NULL),
    ('connected', 'positive', -5, 10, 25, 5, NULL),
    ('proud', 'positive', 0, 5, 15, 0, NULL),
    ('overwhelmed', 'negative', 15, 5, 15, 5, NULL),
    ('content', 'positive', 10, 0, 15, 0, NULL),
    ('loving', 'positive', 5, 10, 35, 5, 'INTP,ISTP'),
    ('hurt', 'negative', 15, 10, 25, 5, 'ESTJ,ENTJ'),
    ('affectionate', 'positive', -5, 5, 30, 10, 'INTP,INTJ'),
    ('vulnerable', 'mixed', 15, 15, 25, 10, 'ESTJ,ENTJ,ISTJ'),
    ('determined', 'positive', 0, 5, -5, -15, NULL),
    ('soft', 'positive', 15, 10, 30, 10, NULL),
    ('fierce', 'mixed', -10, 5, 5, -10, NULL),
    ('yearning', 'mixed', 15, 20, 30, 10, NULL);

-- Memory diversity tracking
CREATE TABLE IF NOT EXISTS memory_diversity (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    measured_at TEXT DEFAULT (datetime('now')),
    total_domains INTEGER DEFAULT 0,
    entropy_score REAL DEFAULT 0.0,
    least_accessed_domains TEXT,
    most_accessed_domains TEXT
);
