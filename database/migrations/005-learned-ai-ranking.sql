ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS ai_confidence NUMERIC(5,4)
    CHECK (ai_confidence >= 0 AND ai_confidence <= 1),
  ADD COLUMN IF NOT EXISTS ai_explanation JSONB NOT NULL DEFAULT '{}'::jsonb;
