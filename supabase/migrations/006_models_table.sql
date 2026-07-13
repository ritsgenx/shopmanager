-- ============================================================
-- Models Table Normalization ("Solution 1")
-- Run this once in your Supabase SQL Editor (after 001–005).
--
-- Promotes "model" to a first-class entity so renames can never
-- detach price history (model_prices was keyed by brand+model+
-- variant TEXT until now).
--
-- 1. models              — one row per brand + name + variant
-- 2. Backfill            — from distinct products groups
-- 3. products.model_id   — products become color rows
-- 4. model_prices.model_id — prices keyed by id, not text
-- 5. current_model_prices — view rebuilt on model_id
-- 6. Conflict report     — groups whose colors disagreed on
--                          GST/HSN/category (backfill picked the
--                          oldest row's value; review the output)
--
-- The legacy text columns are kept (nullable) until you run
-- 007_drop_model_text_columns.sql after verifying the app.
-- ============================================================


-- ════════════════════════════════════════════════════════════
-- 1. MODELS
-- The UNIQUE key doubles as the duplicate guard that until now
-- lived only in the Add Model dialog's JavaScript.
-- variant uses '' (not NULL) so the uniqueness is well-defined,
-- same convention model_prices already used.
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.models (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  brand      text NOT NULL,
  name       text NOT NULL,
  variant    text NOT NULL DEFAULT '',
  category   text,
  hsn_code   text,
  gst_rate   numeric(5,2),
  is_active  boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, brand, name, variant)
);

ALTER TABLE public.models ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "models_select" ON public.models;
DROP POLICY IF EXISTS "models_write"  ON public.models;

CREATE POLICY "models_select" ON public.models
  FOR SELECT USING (tenant_id = current_tenant_id());

CREATE POLICY "models_write" ON public.models
  FOR ALL USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());


-- ════════════════════════════════════════════════════════════
-- 2. BACKFILL — one models row per brand+model+variant group.
-- Where colors of a group disagree on category/HSN/GST, the
-- OLDEST row's value wins (see the conflict report in step 6).
-- A group is active if ANY of its color rows is active — the
-- same rule the Models page used for its toggle.
-- ════════════════════════════════════════════════════════════
INSERT INTO public.models
  (tenant_id, brand, name, variant, category, hsn_code, gst_rate, is_active, created_by, created_at)
SELECT
  tenant_id,
  brand,
  model,
  coalesce(variant, ''),
  (array_agg(category   ORDER BY created_at) FILTER (WHERE category   IS NOT NULL))[1],
  (array_agg(hsn_code   ORDER BY created_at) FILTER (WHERE hsn_code   IS NOT NULL))[1],
  (array_agg(gst_rate   ORDER BY created_at) FILTER (WHERE gst_rate   IS NOT NULL))[1],
  bool_or(coalesce(is_active, true)),
  (array_agg(created_by ORDER BY created_at) FILTER (WHERE created_by IS NOT NULL))[1],
  min(created_at)
FROM public.products
GROUP BY tenant_id, brand, model, coalesce(variant, '')
ON CONFLICT (tenant_id, brand, name, variant) DO NOTHING;

-- Price history may reference a model whose product rows were
-- deleted — create models for those too so no history is orphaned.
INSERT INTO public.models (tenant_id, brand, name, variant)
SELECT DISTINCT mp.tenant_id, mp.brand, mp.model, mp.variant
FROM public.model_prices mp
LEFT JOIN public.models m
  ON  m.tenant_id = mp.tenant_id
  AND m.brand     = mp.brand
  AND m.name      = mp.model
  AND m.variant   = mp.variant
WHERE m.id IS NULL
ON CONFLICT (tenant_id, brand, name, variant) DO NOTHING;


-- ════════════════════════════════════════════════════════════
-- 3. PRODUCTS → color rows pointing at a model
-- ════════════════════════════════════════════════════════════
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS model_id uuid REFERENCES public.models(id);

UPDATE public.products p
SET model_id = m.id
FROM public.models m
WHERE p.model_id IS NULL
  AND m.tenant_id = p.tenant_id
  AND m.brand     = p.brand
  AND m.name      = p.model
  AND m.variant   = coalesce(p.variant, '');

ALTER TABLE public.products ALTER COLUMN model_id SET NOT NULL;

-- The app now inserts products without the legacy text columns —
-- relax their NOT NULLs until 007 drops them entirely.
ALTER TABLE public.products ALTER COLUMN brand    DROP NOT NULL;
ALTER TABLE public.products ALTER COLUMN model    DROP NOT NULL;
ALTER TABLE public.products ALTER COLUMN category DROP NOT NULL;
ALTER TABLE public.products ALTER COLUMN gst_rate DROP NOT NULL;
ALTER TABLE public.products ALTER COLUMN hsn_code DROP NOT NULL;

CREATE INDEX IF NOT EXISTS products_model_idx
  ON public.products (tenant_id, model_id);

-- One row per color within a model ('' groups the no-color rows)
CREATE UNIQUE INDEX IF NOT EXISTS products_model_color_key
  ON public.products (tenant_id, model_id, coalesce(color, ''));


-- ════════════════════════════════════════════════════════════
-- 4. MODEL_PRICES → keyed by model_id
-- History rows stay append-only and untouched except for the
-- new id column. Matching by text works cleanly here precisely
-- because no rename has ever happened yet.
-- ════════════════════════════════════════════════════════════
ALTER TABLE public.model_prices
  ADD COLUMN IF NOT EXISTS model_id uuid REFERENCES public.models(id);

UPDATE public.model_prices mp
SET model_id = m.id
FROM public.models m
WHERE mp.model_id IS NULL
  AND m.tenant_id = mp.tenant_id
  AND m.brand     = mp.brand
  AND m.name      = mp.model
  AND m.variant   = mp.variant;

ALTER TABLE public.model_prices ALTER COLUMN model_id SET NOT NULL;

-- New price entries no longer carry the text key
ALTER TABLE public.model_prices ALTER COLUMN brand   DROP NOT NULL;
ALTER TABLE public.model_prices ALTER COLUMN model   DROP NOT NULL;
ALTER TABLE public.model_prices ALTER COLUMN variant DROP NOT NULL;
ALTER TABLE public.model_prices ALTER COLUMN variant DROP DEFAULT;

CREATE INDEX IF NOT EXISTS model_prices_model_idx
  ON public.model_prices (tenant_id, model_id, created_at DESC);


-- ════════════════════════════════════════════════════════════
-- 5. CURRENT_MODEL_PRICES — latest row per model_id
-- DROP+CREATE (not REPLACE) because the column list changes.
-- ════════════════════════════════════════════════════════════
DROP VIEW IF EXISTS public.current_model_prices;

CREATE VIEW public.current_model_prices
WITH (security_invoker = true) AS
SELECT DISTINCT ON (tenant_id, model_id)
  id, tenant_id, model_id,
  mop, finance_price, oc_price, created_at, created_by
FROM public.model_prices
ORDER BY tenant_id, model_id, created_at DESC;


-- ════════════════════════════════════════════════════════════
-- 6. CONFLICT REPORT — review this output!
-- Lists model groups whose color rows disagreed on GST/HSN/
-- category. The backfill kept the oldest row's value; if a row
-- appears here, check the model in the app and correct it.
-- (No rows = nothing to review.)
-- ════════════════════════════════════════════════════════════
SELECT
  p.brand,
  p.model,
  coalesce(p.variant, '')                                   AS variant,
  string_agg(DISTINCT coalesce(p.gst_rate::text, 'null'), ', ') AS gst_values,
  string_agg(DISTINCT coalesce(p.hsn_code, 'null'), ', ')       AS hsn_values,
  string_agg(DISTINCT coalesce(p.category, 'null'), ', ')       AS category_values
FROM public.products p
GROUP BY p.tenant_id, p.brand, p.model, coalesce(p.variant, '')
HAVING count(DISTINCT coalesce(p.gst_rate, -1)) > 1
    OR count(DISTINCT coalesce(p.hsn_code, ''))  > 1
    OR count(DISTINCT coalesce(p.category, ''))  > 1;
