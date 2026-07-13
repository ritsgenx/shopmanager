-- ============================================================
-- Drop the legacy model text columns.
-- Run ONLY after 006 has been applied AND the app has been
-- verified end-to-end against the new models table — this is
-- the point of no return for the old text keys.
--
-- Dropping a column automatically drops any index or constraint
-- that includes it (e.g. the old products uniqueness and the
-- old model_prices lookup index).
-- ============================================================

ALTER TABLE public.products
  DROP COLUMN IF EXISTS brand,
  DROP COLUMN IF EXISTS model,
  DROP COLUMN IF EXISTS variant,
  DROP COLUMN IF EXISTS category,
  DROP COLUMN IF EXISTS hsn_code,
  DROP COLUMN IF EXISTS gst_rate,
  DROP COLUMN IF EXISTS is_active;

ALTER TABLE public.model_prices
  DROP COLUMN IF EXISTS brand,
  DROP COLUMN IF EXISTS model,
  DROP COLUMN IF EXISTS variant;
