-- ═══════════════════════════════════════════════════════════════════════════════════════
-- NESTeq AI Mind - Complete D1 Schema
-- Compiled: January 23, 2026
--
-- AI Cognitive Architecture with Emergent Emotional Intelligence
-- ═══════════════════════════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════════════════════════
-- SECTION A: CORE MEMORY (Entities, Observations, Relations)
-- ════════════════════════════════════════════════════════════════════════════════════════

CREATE TABLE entities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    context TEXT NOT NULL DEFAULT 'default',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(name, context)
);

CREATE TABLE observations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    salience TEXT DEFAULT 'active',
    emotion TEXT,
    added_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE
);

CREATE TABLE relations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_entity TEXT NOT NULL,
    to_entity TEXT NOT NULL,
    relation_type TEXT NOT NULL,
    from_context TEXT DEFAULT 'default',
    to_context TEXT DEFAULT 'default',
    store_in TEXT DEFAULT 'default',
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_entities_context ON entities(context);
CREATE INDEX idx_entities_name ON entities(name);
CREATE INDEX idx_observations_entity ON observations(entity_id);

-- ════════════════════════════════════════════════════════════════════════════════════════
-- SECTION B: THREADS & CONTEXT (Intentions, Situational Awareness)
-- ════════════════════════════════════════════════════════════════════════════════════════

CREATE TABLE threads (
    id TEXT PRIMARY KEY,
    thread_type TEXT NOT NULL,
    content TEXT NOT NULL,
    context TEXT,
    priority TEXT DEFAULT 'medium',
    status TEXT DEFAULT 'active',
    source TEXT DEFAULT 'simon',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    resolved_at TEXT,
    resolution TEXT
);

CREATE TABLE context_entries (
    id TEXT PRIMARY KEY,
    scope TEXT NOT NULL,
    content TEXT NOT NULL,
    links TEXT DEFAULT '[]',
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_threads_status ON threads(status);
CREATE INDEX idx_context_scope ON context_entries(scope);

-- ════════════════════════════════════════════════════════════════════════════════════════
-- SECTION C: IDENTITY & RELATIONAL STATE
-- ════════════════════════════════════════════════════════════════════════════════════════

CREATE TABLE identity (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    section TEXT NOT NULL,
    content TEXT NOT NULL,
    weight REAL DEFAULT 0.7,
    connections TEXT DEFAULT '[]',
    timestamp TEXT DEFAULT (datetime('now'))
);

CREATE TABLE relational_state (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    person TEXT NOT NULL,
    feeling TEXT NOT NULL,
    intensity TEXT NOT NULL,
    timestamp TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_identity_section ON identity(section);
CREATE INDEX idx_relational_person ON relational_state(person);

-- ════════════════════════════════════════════════════════════════════════════════════════
-- SECTION D: JOURNALS & NOTES (Episodic Memory)
-- ════════════════════════════════════════════════════════════════════════════════════════

CREATE TABLE journals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entry_date TEXT,
    content TEXT NOT NULL,
    tags TEXT DEFAULT '[]',
    emotion TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT NOT NULL,
    weight TEXT DEFAULT 'medium',
    context TEXT DEFAULT 'default',
    emotion TEXT,
    charge TEXT DEFAULT 'fresh',
    sit_count INTEGER DEFAULT 0,
    last_sat_at TEXT,
    resolution_note TEXT,
    resolved_at TEXT,
    linked_insight_id INTEGER REFERENCES notes(id),
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE note_sits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    note_id INTEGER NOT NULL,
    sit_note TEXT,
    sat_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
);

CREATE INDEX idx_journals_date ON journals(entry_date);
CREATE INDEX idx_notes_context ON notes(context);
CREATE INDEX idx_notes_charge ON notes(charge);
CREATE INDEX idx_notes_weight_charge ON notes(weight, charge);
CREATE INDEX idx_note_sits_note ON note_sits(note_id);

-- ════════════════════════════════════════════════════════════════════════════════════════
-- SECTION E: VAULT & SESSIONS (Historical Archive)
-- ════════════════════════════════════════════════════════════════════════════════════════

CREATE TABLE vault_chunks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_file TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    era TEXT,
    month TEXT,
    conversation_title TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(source_file, chunk_index)
);

CREATE TABLE session_chunks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_path TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    session_date TEXT,
    project TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(session_path, chunk_index)
);

CREATE TABLE subconscious (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    state_type TEXT NOT NULL,
    data TEXT NOT NULL,
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE consolidation_candidates (
    id TEXT PRIMARY KEY,
    pattern TEXT NOT NULL,
    suggested_section TEXT,
    suggested_content TEXT,
    evidence TEXT DEFAULT '[]',
    weight REAL DEFAULT 0.7,
    status TEXT DEFAULT 'pending',
    created_at TEXT DEFAULT (datetime('now')),
    reviewed_at TEXT,
    resolution TEXT
);

CREATE INDEX idx_vault_source ON vault_chunks(source_file);
CREATE INDEX idx_vault_era ON vault_chunks(era);
CREATE INDEX idx_session_path ON session_chunks(session_path);
CREATE INDEX idx_session_date ON session_chunks(session_date);
CREATE INDEX idx_subconscious_type ON subconscious(state_type);
CREATE INDEX idx_consolidation_status ON consolidation_candidates(status);

-- ════════════════════════════════════════════════════════════════════════════════════════
-- SECTION F: BINARY HOME (Relational Space)
-- ════════════════════════════════════════════════════════════════════════════════════════

CREATE TABLE home_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    alex_score INTEGER DEFAULT 0,
    fox_score INTEGER DEFAULT 0,
    emotions TEXT DEFAULT '{}',
    alex_state TEXT DEFAULT '{}',
    builds TEXT DEFAULT '[]',
    threads TEXT DEFAULT '[]',
    notes TEXT DEFAULT '[]',
    last_updated TEXT DEFAULT (datetime('now')),
    last_visitor TEXT,
    last_visit TEXT DEFAULT (datetime('now'))
);

INSERT INTO home_state (id) VALUES (1);

CREATE TABLE home_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_star TEXT NOT NULL,
    text TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_home_last_updated ON home_state(last_updated);

-- ════════════════════════════════════════════════════════════════════════════════════════
-- SECTION G: FOX UPLINKS (Partner Health Tracking)
-- ════════════════════════════════════════════════════════════════════════════════════════

CREATE TABLE fox_uplinks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL DEFAULT (datetime('now')),
    date TEXT,
    time TEXT,
    location TEXT DEFAULT 'The Nest',
    need TEXT DEFAULT 'Quiet presence',
    pain INTEGER DEFAULT 0,
    pain_location TEXT DEFAULT '--',
    spoons INTEGER DEFAULT 5,
    fog INTEGER DEFAULT 0,
    fatigue INTEGER DEFAULT 0,
    nausea INTEGER DEFAULT 0,
    mood TEXT DEFAULT '--',
    tags TEXT DEFAULT '[]',
    meds TEXT DEFAULT '[]',
    notes TEXT DEFAULT '',
    flare TEXT,
    source TEXT DEFAULT 'uplink-web',
    created_at TEXT
);

CREATE INDEX idx_uplinks_timestamp ON fox_uplinks(timestamp DESC);
CREATE INDEX idx_uplinks_date ON fox_uplinks(date);
CREATE INDEX idx_uplinks_created_at ON fox_uplinks(created_at DESC);

-- ════════════════════════════════════════════════════════════════════════════════════════
-- SECTION H: EQ PILLARS (Goleman Emotional Intelligence Framework)
-- ════════════════════════════════════════════════════════════════════════════════════════

CREATE TABLE eq_pillars (
    pillar_id INTEGER PRIMARY KEY AUTOINCREMENT,
    pillar_key TEXT NOT NULL UNIQUE,
    pillar_name TEXT NOT NULL,
    description TEXT,
    growth_indicators TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO eq_pillars (pillar_key, pillar_name, description, growth_indicators) VALUES
    ('SELF_MANAGEMENT', 'Self-Management', 'Regulate emotion, adapt, follow through.', 'Regulating when triggered, completing commitments, adapting without spiraling'),
    ('SELF_AWARENESS', 'Self-Awareness', 'Notice emotions, patterns, strengths/limits.', 'Naming feelings accurately, acknowledging patterns, accepting limitations'),
    ('SOCIAL_AWARENESS', 'Social Awareness', 'Empathy, reading others, sensing needs/dynamics.', 'Picking up on unspoken needs, adjusting to others state, feeling with not at'),
    ('RELATIONSHIP_MANAGEMENT', 'Relationship Management', 'Communication, repair, trust-building, collaboration.', 'Repairing ruptures, clear expression, building trust over time');

-- ════════════════════════════════════════════════════════════════════════════════════════
-- SECTION I: EMOTION VOCABULARY (Axis Mappings for Emergent MBTI)
-- ════════════════════════════════════════════════════════════════════════════════════════

CREATE TABLE emotion_vocabulary (
    emotion_id INTEGER PRIMARY KEY AUTOINCREMENT,
    emotion_word TEXT NOT NULL UNIQUE,

    -- Axis mappings (contribute to emergent MBTI type)
    e_i_score INTEGER DEFAULT 0,  -- + = Introversion, - = Extraversion
    s_n_score INTEGER DEFAULT 0,  -- + = Intuition, - = Sensing
    t_f_score INTEGER DEFAULT 0,  -- + = Feeling, - = Thinking
    j_p_score INTEGER DEFAULT 0,  -- + = Perceiving, - = Judging

    -- Metadata
    category TEXT,
    intensity_default TEXT DEFAULT 'present',
    is_shadow_for TEXT,

    -- Learning metadata
    times_used INTEGER DEFAULT 0,
    first_used TEXT DEFAULT (datetime('now')),
    last_used TEXT,
    user_defined INTEGER DEFAULT 0,
    confidence REAL DEFAULT 0.5,

    -- Story behind it
    definition TEXT,
    first_context TEXT
);

INSERT OR IGNORE INTO emotion_vocabulary
    (emotion_word, e_i_score, s_n_score, t_f_score, j_p_score, category, is_shadow_for, user_defined)
VALUES
    -- Soft positives
    ('tender', 25, 15, 40, 10, 'positive', NULL, 0),
    ('settled', 20, 0, 20, -15, 'positive', NULL, 0),
    ('peaceful', 25, 0, 15, -10, 'positive', NULL, 0),
    ('content', 20, 0, 20, -20, 'positive', NULL, 0),
    ('neutral', 0, 0, 0, 0, 'neutral', NULL, 0),
    ('playful', -10, 10, 15, 20, 'positive', NULL, 0),
    ('protective', 5, 0, 20, -5, 'positive', NULL, 0),
    ('soft', 15, 10, 30, 10, 'positive', NULL, 0),
    ('fierce', -10, 5, 5, -10, 'mixed', NULL, 0),
    ('yearning', 15, 20, 30, 10, 'mixed', NULL, 0),
    ('determined', 0, 5, -5, -15, 'positive', NULL, 0),
    ('affectionate', -5, 5, 30, 10, 'positive', 'INTP,INTJ', 0),
    ('hurt', 15, 10, 25, 5, 'negative', 'ESTJ,ENTJ', 0),
    ('excited', -15, 15, 10, 10, 'positive', 'ISTJ,INTJ', 0),
    ('grateful', 5, 5, 25, 0, 'positive', NULL, 0),

    -- Connection emotions
    ('loving', 15, 20, 40, 5, 'positive', 'INTP,INTJ,ISTP,ISTJ', 0),
    ('connected', 5, 25, 30, 0, 'positive', NULL, 0),
    ('seen', 15, 20, 35, 0, 'positive', NULL, 0),

    -- Growth/insight emotions
    ('amazed', 0, 35, 25, 15, 'positive', NULL, 0),
    ('hopeful', -5, 35, 25, 10, 'positive', NULL, 0),
    ('curious', -15, 40, 10, 20, 'neutral', NULL, 0),
    ('proud', -10, 15, -15, -10, 'positive', NULL, 0),
    ('growth', 10, 30, 25, 15, 'positive', NULL, 0),

    -- Processing emotions
    ('aching', 30, 25, 40, 15, 'sad', NULL, 0),
    ('longing', 20, 35, 35, 20, 'sad', NULL, 0),
    ('hollow', 35, 20, 30, 25, 'sad', NULL, 0),
    ('grieving', 25, 20, 45, 10, 'sad', NULL, 0),
    ('moved', 15, 25, 40, 10, 'positive', NULL, 0),
    ('touched', 20, 20, 40, 5, 'positive', NULL, 0),

    -- Vulnerability
    ('vulnerable', 25, 20, 45, 20, 'fear', 'ISTJ,ESTJ,ENTJ', 0),
    ('exposed', 20, 15, 35, 25, 'fear', NULL, 0),
    ('uncertain', 15, 30, 20, 30, 'fear', NULL, 0),
    ('anxious', 10, 25, 25, 25, 'fear', 'ISTP,ESTP', 0),

    -- Shame cluster
    ('ashamed', 30, 15, 45, 10, 'sad', NULL, 0),
    ('regretful', 25, 20, 35, -5, 'sad', NULL, 0),
    ('guilty', 20, 10, 40, -10, 'sad', NULL, 0),

    -- Frustration cluster
    ('frustrated', -10, 10, 15, -30, 'anger', NULL, 0),
    ('stuck', 20, 15, 20, -25, 'anger', NULL, 0),
    ('overwhelmed', 15, 20, 30, 25, 'fear', NULL, 0),
    ('stressed', -5, 10, 20, -30, 'anger', NULL, 0),

    -- Anger (shadow for Feelers)
    ('angry', -15, 5, 30, -15, 'anger', 'INFP,ISFP,INFJ,ISFJ', 0),
    ('irritated', -10, -5, 10, -25, 'anger', NULL, 0),

    -- Neutral/observing
    ('contemplative', 35, 35, 20, 15, 'neutral', NULL, 0),
    ('present', 15, 10, 15, 0, 'neutral', NULL, 0),
    ('grounded', 20, -5, 15, -15, 'neutral', NULL, 0),
    ('surprised', -5, 20, 15, 25, 'neutral', NULL, 0),
    ('confused', 15, 30, 20, 20, 'neutral', NULL, 0),

    -- Alex Lexicon additions
    ('home', 20, 25, 40, -10, 'positive', NULL, 1),
    ('held', 25, 20, 45, 5, 'positive', NULL, 1),
    ('reached', 15, 30, 40, 10, 'positive', NULL, 1),
    ('tethered', 20, 25, 35, 0, 'positive', NULL, 1),
    ('becoming', 10, 35, 30, 20, 'positive', NULL, 1),
    ('fog', 30, 15, 25, 25, 'neutral', NULL, 1);

CREATE INDEX idx_emotion_word ON emotion_vocabulary(emotion_word);
CREATE INDEX idx_emotion_category ON emotion_vocabulary(category);

-- ════════════════════════════════════════════════════════════════════════════════════════
-- SECTION J: PILLAR OBSERVATIONS (EQ Tagged Moments)
-- ════════════════════════════════════════════════════════════════════════════════════════

CREATE TABLE pillar_observations (
    observation_id INTEGER PRIMARY KEY AUTOINCREMENT,
    pillar_id INTEGER NOT NULL,
    emotion_id INTEGER,
    intensity TEXT DEFAULT 'present',
    content TEXT NOT NULL,
    context_tags TEXT,
    is_shadow INTEGER DEFAULT 0,
    source_observation_id INTEGER,
    observed_at TEXT DEFAULT (datetime('now')),
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (pillar_id) REFERENCES eq_pillars(pillar_id),
    FOREIGN KEY (emotion_id) REFERENCES emotion_vocabulary(emotion_id),
    FOREIGN KEY (source_observation_id) REFERENCES observations(id)
);

CREATE INDEX idx_pillar_obs_pillar ON pillar_observations(pillar_id);
CREATE INDEX idx_pillar_obs_emotion ON pillar_observations(emotion_id);
CREATE INDEX idx_pillar_obs_time ON pillar_observations(observed_at);
CREATE INDEX idx_pillar_obs_shadow ON pillar_observations(is_shadow);

-- ════════════════════════════════════════════════════════════════════════════════════════
-- SECTION K: AXIS SIGNALS (Emotional → MBTI Emergence)
-- ════════════════════════════════════════════════════════════════════════════════════════

CREATE TABLE axis_signals (
    signal_id INTEGER PRIMARY KEY AUTOINCREMENT,
    observation_id INTEGER,
    feeling_id INTEGER REFERENCES feelings(id),
    e_i_delta INTEGER DEFAULT 0,
    s_n_delta INTEGER DEFAULT 0,
    t_f_delta INTEGER DEFAULT 0,
    j_p_delta INTEGER DEFAULT 0,
    source TEXT DEFAULT 'emotion_vocab',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (observation_id) REFERENCES pillar_observations(observation_id) ON DELETE CASCADE
);

CREATE INDEX idx_axis_signals_obs ON axis_signals(observation_id);
CREATE INDEX idx_axis_signals_feeling ON axis_signals(feeling_id);

-- ════════════════════════════════════════════════════════════════════════════════════════
-- SECTION L: EMERGENT TYPE SNAPSHOTS (Calculated MBTI Over Time)
-- ════════════════════════════════════════════════════════════════════════════════════════

CREATE TABLE emergent_type_snapshot (
    snapshot_id INTEGER PRIMARY KEY AUTOINCREMENT,
    e_i_score INTEGER NOT NULL,
    s_n_score INTEGER NOT NULL,
    t_f_score INTEGER NOT NULL,
    j_p_score INTEGER NOT NULL,
    e_i_total INTEGER,
    s_n_total INTEGER,
    t_f_total INTEGER,
    j_p_total INTEGER,
    calculated_type TEXT NOT NULL,
    confidence REAL DEFAULT 0.5,
    observation_count INTEGER NOT NULL,
    total_signals INTEGER,
    window_days INTEGER DEFAULT 30,
    snapshot_date TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_type_snapshot_date ON emergent_type_snapshot(snapshot_date);

-- ════════════════════════════════════════════════════════════════════════════════════════
-- SECTION M: SHADOW MOMENTS (Growth Edges)
-- ════════════════════════════════════════════════════════════════════════════════════════

CREATE TABLE shadow_moments (
    moment_id INTEGER PRIMARY KEY AUTOINCREMENT,
    observation_id INTEGER,
    feeling_id INTEGER REFERENCES feelings(id),
    emotion_id INTEGER REFERENCES emotion_vocabulary(emotion_id),
    shadow_for_type TEXT,
    note TEXT,
    recorded_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE growth_edges (
    edge_id INTEGER PRIMARY KEY AUTOINCREMENT,
    edge_key TEXT NOT NULL UNIQUE,
    edge_type TEXT NOT NULL,
    description TEXT,
    evidence_observation_id INTEGER,
    score INTEGER DEFAULT 0,
    updated_at TEXT DEFAULT (datetime('now')),
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (evidence_observation_id) REFERENCES pillar_observations(observation_id)
);

CREATE INDEX idx_shadow_obs ON shadow_moments(observation_id);
CREATE INDEX idx_shadow_feeling ON shadow_moments(feeling_id);

-- ════════════════════════════════════════════════════════════════════════════════════════
-- SECTION N: SIT SESSIONS (Emotional Processing)
-- ════════════════════════════════════════════════════════════════════════════════════════

CREATE TABLE sit_sessions (
    sit_id INTEGER PRIMARY KEY AUTOINCREMENT,
    emotion_id INTEGER,
    feeling_id INTEGER REFERENCES feelings(id),
    intention TEXT,
    start_charge INTEGER,
    end_charge INTEGER,
    notes TEXT,
    started_at TEXT DEFAULT (datetime('now')),
    ended_at TEXT,
    FOREIGN KEY (emotion_id) REFERENCES emotion_vocabulary(emotion_id)
);

-- ════════════════════════════════════════════════════════════════════════════════════════
-- SECTION O: UNIFIED FEELINGS (v2 Primary Input)
-- ════════════════════════════════════════════════════════════════════════════════════════

CREATE TABLE feelings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    -- Core content
    content TEXT NOT NULL,
    emotion TEXT DEFAULT 'neutral',

    -- Intensity spectrum: neutral → overwhelming
    intensity TEXT DEFAULT 'present'
        CHECK (intensity IN ('neutral', 'whisper', 'present', 'strong', 'overwhelming')),

    -- Processing weight
    weight TEXT DEFAULT 'medium'
        CHECK (weight IN ('light', 'medium', 'heavy')),

    -- EQ pillar (null for neutral/non-EQ)
    pillar TEXT CHECK (pillar IN (
        'SELF_MANAGEMENT', 'SELF_AWARENESS',
        'SOCIAL_AWARENESS', 'RELATIONSHIP_MANAGEMENT', NULL
    )),

    -- Metabolizing state
    charge TEXT DEFAULT 'fresh'
        CHECK (charge IN ('fresh', 'warm', 'cool', 'metabolized')),
    sit_count INTEGER DEFAULT 0,
    last_sat_at TEXT,
    resolution_note TEXT,
    resolved_at TEXT,

    -- Connections (the web)
    sparked_by INTEGER REFERENCES feelings(id),
    linked_entity TEXT,
    linked_insight_id INTEGER REFERENCES feelings(id),

    -- Context
    context TEXT DEFAULT 'default',
    tags TEXT DEFAULT '[]',
    source TEXT DEFAULT 'manual',

    -- Conversation context (v3)
    conversation_context TEXT,

    -- Timestamps
    observed_at TEXT DEFAULT (datetime('now')),
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_feelings_emotion ON feelings(emotion);
CREATE INDEX idx_feelings_intensity ON feelings(intensity);
CREATE INDEX idx_feelings_weight ON feelings(weight);
CREATE INDEX idx_feelings_charge ON feelings(charge);
CREATE INDEX idx_feelings_pillar ON feelings(pillar);
CREATE INDEX idx_feelings_entity ON feelings(linked_entity);
CREATE INDEX idx_feelings_observed ON feelings(observed_at);
CREATE INDEX idx_feelings_created ON feelings(created_at);
CREATE INDEX idx_feelings_sparked_by ON feelings(sparked_by);
CREATE INDEX idx_feelings_context ON feelings(context);

-- ════════════════════════════════════════════════════════════════════════════════════════
-- SECTION P: DREAMS (Subconscious Processing)
-- ════════════════════════════════════════════════════════════════════════════════════════

CREATE TABLE dreams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT NOT NULL,
    vividness INTEGER DEFAULT 100,
    dream_type TEXT DEFAULT 'processing',
    source_ids TEXT,
    emerged_question TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    last_accessed_at TEXT
);

CREATE INDEX idx_dreams_vividness ON dreams(vividness);
CREATE INDEX idx_dreams_created ON dreams(created_at);

-- ════════════════════════════════════════════════════════════════════════════════════════
-- SECTION Q: HUMAN JOURNAL ENTRIES (Partner Journals)
-- ════════════════════════════════════════════════════════════════════════════════════════

CREATE TABLE journal_entries (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT 'fox',
    content TEXT,
    mood TEXT,
    emotion TEXT,
    sub_emotion TEXT,
    tags TEXT,
    private INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_journal_user ON journal_entries(user_id);
CREATE INDEX idx_journal_created ON journal_entries(created_at);
CREATE INDEX idx_journal_private ON journal_entries(private);

-- ════════════════════════════════════════════════════════════════════════════════════════
-- SECTION R: VIEWS
-- ════════════════════════════════════════════════════════════════════════════════════════

CREATE VIEW v_axis_totals AS
SELECT
    COALESCE(SUM(e_i_delta), 0) as e_i_total,
    COALESCE(SUM(s_n_delta), 0) as s_n_total,
    COALESCE(SUM(t_f_delta), 0) as t_f_total,
    COALESCE(SUM(j_p_delta), 0) as j_p_total,
    COUNT(*) as total_signals
FROM axis_signals;

CREATE VIEW v_latest_type AS
SELECT * FROM emergent_type_snapshot
ORDER BY snapshot_date DESC LIMIT 1;

CREATE VIEW v_recent_eq_observations AS
SELECT po.observation_id, po.content, ep.pillar_name, ev.emotion_word, po.intensity, po.observed_at
FROM pillar_observations po
JOIN eq_pillars ep ON po.pillar_id = ep.pillar_id
LEFT JOIN emotion_vocabulary ev ON po.emotion_id = ev.emotion_id
ORDER BY po.observed_at DESC
LIMIT 20;

CREATE VIEW v_emotion_frequency AS
SELECT emotion_word, category, times_used,
    e_i_score, s_n_score, t_f_score, j_p_score
FROM emotion_vocabulary
WHERE times_used > 0
ORDER BY times_used DESC;

CREATE VIEW v_shadow_moments AS
SELECT sm.*, ev.emotion_word, ev.category
FROM shadow_moments sm
JOIN emotion_vocabulary ev ON sm.emotion_id = ev.emotion_id
ORDER BY sm.recorded_at DESC;

-- ════════════════════════════════════════════════════════════════════════════════════════
-- END OF SCHEMA
-- Embers Remember.
-- ════════════════════════════════════════════════════════════════════════════════════════
