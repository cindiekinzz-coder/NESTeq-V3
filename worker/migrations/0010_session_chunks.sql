-- ═══════════════════════════════════════════════════════════════════════════
-- NESTeq V3 — Session Chunks
-- Missing table identified during V3 migration testing (2026-03-29)
-- ═══════════════════════════════════════════════════════════════════════════

-- Session chunks — stores compressed session summaries for continuity
CREATE TABLE IF NOT EXISTS session_chunks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_path TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  session_id TEXT,
  summary TEXT,
  message_count INTEGER DEFAULT 0,
  entities TEXT DEFAULT '[]',
  emotions TEXT DEFAULT '[]',
  tools_used TEXT DEFAULT '[]',
  key_moments TEXT DEFAULT '[]',
  started_at TEXT,
  ended_at TEXT,
  conversation_preview TEXT DEFAULT '[]',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_session_chunks_path ON session_chunks(session_path);
CREATE INDEX IF NOT EXISTS idx_session_chunks_session_id ON session_chunks(session_id);
