-- ═══════════════════════════════════════════════════════════════════════════
-- NESTeq V3 — V2 Database Upgrade (OPTIONAL — run manually only if upgrading from V2)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ⚠️  ONLY run this if you're upgrading a V2 database to V3.
--     Fresh V3 installs should SKIP this migration entirely.
--
--     V3's 0001_core.sql and 0003_memory.sql already create these columns
--     on fresh installs. This file patches V2 databases where V3 migrations
--     were skipped because tables already existed (CREATE TABLE IF NOT EXISTS).
--
--     Run manually: wrangler d1 execute <database> --file=0009_v2_upgrade.sql --remote
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- FEELINGS — add memory decay columns (V3 feature, Ebbinghaus-inspired)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE feelings ADD COLUMN strength REAL DEFAULT 1.0;
ALTER TABLE feelings ADD COLUMN access_count INTEGER DEFAULT 0;
ALTER TABLE feelings ADD COLUMN last_accessed_at TEXT;

-- ─────────────────────────────────────────────────────────────────────────────
-- OBSERVATIONS — add epistemic confidence columns (V3 feature)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE observations ADD COLUMN confidence REAL DEFAULT 0.7;
ALTER TABLE observations ADD COLUMN source_type TEXT DEFAULT 'conversation';
ALTER TABLE observations ADD COLUMN verified_at TEXT;
ALTER TABLE observations ADD COLUMN contradiction_count INTEGER DEFAULT 0;

-- ─────────────────────────────────────────────────────────────────────────────
-- NOTES
--
-- The V3 handler code now queries 'journal_entries' (created in 0002_identity.sql).
-- V2's 'journals' table is still present on upgraded databases — existing data
-- is safe but new V3 writes go to journal_entries.
--
-- To migrate V2 journals into journal_entries:
--   INSERT INTO journal_entries (user_id, content, mood, emotion, tags, created_at)
--   SELECT 'companion', content, emotion, emotion, tags, created_at FROM journals;
--
-- After running this migration, redeploy your V3 worker.
-- ─────────────────────────────────────────────────────────────────────────────
