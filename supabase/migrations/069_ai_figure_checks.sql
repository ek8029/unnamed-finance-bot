-- 069: a log of figures an LLM wrote that trace to nothing it was given.
--
-- lib/number-verify.ts flags these at request time and console.warn was the
-- only record, which means nobody can answer "what is the hallucination rate on
-- /analyze this week". One row per failed check, never per success, so a clean
-- week writes nothing at all.
--
-- Deliberately stores the figures, not the surrounding prose: the value of the
-- row is the number and its nearest real fact, and the prose is where any
-- personal detail would live.

CREATE TABLE IF NOT EXISTS ai_figure_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  surface TEXT NOT NULL,          -- 'analyze' | 'research_chat'
  ref TEXT,                       -- ticker for analyze, null for chat
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  model TEXT,

  figures_checked INT NOT NULL,
  unverified_count INT NOT NULL,
  unverified JSONB NOT NULL,      -- [{ figure, nearest, delta }]

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_figure_checks_surface
  ON ai_figure_checks(surface, created_at DESC);

COMMENT ON TABLE ai_figure_checks IS
  'Figures emitted by an LLM that no fact in its own context could account for. Written only on failure.';

-- Service-role only: nothing here is user-facing.
ALTER TABLE ai_figure_checks ENABLE ROW LEVEL SECURITY;
