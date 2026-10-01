-- English class name for i18n (/me TH/EN).
-- `name` (Thai) stays the canonical key; `name_en` is optional display text.
-- When name_en is NULL/empty the UI falls back to `name`.
ALTER TABLE class
  ADD COLUMN IF NOT EXISTS name_en text;
