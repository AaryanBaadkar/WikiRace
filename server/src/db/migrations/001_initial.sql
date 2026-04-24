CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username      TEXT UNIQUE NOT NULL,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  avatar_url    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS article_pool (
  id       SERIAL PRIMARY KEY,
  title    TEXT UNIQUE NOT NULL,
  category TEXT
);

CREATE TABLE IF NOT EXISTS matches (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mode           TEXT NOT NULL CHECK (mode IN ('bot', 'pvp', 'solo')),
  difficulty     TEXT CHECK (difficulty IN ('easy', 'medium', 'hard')),
  start_article  TEXT NOT NULL,
  target_article TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'in_progress', 'completed')),
  head_start_sec INT NOT NULL DEFAULT 60,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at       TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS match_participants (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id     UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  user_id      UUID REFERENCES users(id),
  path         JSONB NOT NULL DEFAULT '[]',
  steps        INT NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ,
  won          BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_match_participants_match ON match_participants(match_id);
CREATE INDEX IF NOT EXISTS idx_match_participants_user  ON match_participants(user_id);

CREATE MATERIALIZED VIEW IF NOT EXISTS leaderboard AS
SELECT
  u.id                                                        AS user_id,
  u.username,
  COUNT(*) FILTER (WHERE mp.won = TRUE)                       AS wins,
  COUNT(*) FILTER (WHERE mp.won = FALSE AND mp.completed_at IS NOT NULL) AS losses,
  COUNT(*)                                                    AS total_matches,
  ROUND(
    COUNT(*) FILTER (WHERE mp.won = TRUE)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 1
  )                                                           AS win_rate,
  ROUND(AVG(mp.steps) FILTER (WHERE mp.won = TRUE), 1)       AS avg_steps,
  MIN(
    EXTRACT(EPOCH FROM (mp.completed_at - m.created_at))
  ) FILTER (WHERE mp.won = TRUE)                              AS fastest_win_secs
FROM users u
JOIN match_participants mp ON mp.user_id = u.id
JOIN matches m ON m.id = mp.match_id
WHERE mp.completed_at IS NOT NULL
GROUP BY u.id, u.username
HAVING COUNT(*) >= 10
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_leaderboard_user ON leaderboard(user_id);
