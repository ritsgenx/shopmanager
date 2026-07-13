-- ============================================================
-- Drop the legacy per-model tax columns.
-- Run ONLY after 008 has been applied AND the app has been
-- verified — category, HSN and GST now resolve through
-- tax_categories via models.tax_category_id.
-- ============================================================

ALTER TABLE public.models
  DROP COLUMN IF EXISTS category,
  DROP COLUMN IF EXISTS hsn_code,
  DROP COLUMN IF EXISTS gst_rate;
