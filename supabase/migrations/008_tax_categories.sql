-- ============================================================
-- Tax Categories: GST rate + HSN code as tenant-level settings
-- Run this once in your Supabase SQL Editor (after 006).
--
-- GST rates are set by the government per commodity (HSN), not
-- per product. This table is the single source of truth per
-- shop: each model points at one tax category; PO / stock /
-- sale / invoice flows resolve rate + HSN through it and never
-- let anyone type a rate. When the government changes a rate,
-- the owner edits ONE row in Settings and every future
-- transaction follows. Past invoices are safe because sale and
-- purchase lines freeze gst_rate at transaction time.
--
-- 1. tax_categories       — name + hsn_code + gst_rate
-- 2. Backfill             — from existing models data
--                           ('Mobile Phone' unified → 'smartphone')
-- 3. models.tax_category_id
-- 4. Report               — categories created + model counts
--
-- models.category / hsn_code / gst_rate stay (unused) until you
-- run 009_drop_tax_columns_from_models.sql after verifying.
-- ============================================================


-- ════════════════════════════════════════════════════════════
-- 1. TAX_CATEGORIES
-- Writes are ADMIN-ONLY: employees pick categories, never edit.
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.tax_categories (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name       text NOT NULL,
  hsn_code   text,
  gst_rate   numeric(5,2) NOT NULL DEFAULT 18,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz,
  UNIQUE (tenant_id, name)
);

ALTER TABLE public.tax_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tax_categories_select" ON public.tax_categories;
DROP POLICY IF EXISTS "tax_categories_write"  ON public.tax_categories;

CREATE POLICY "tax_categories_select" ON public.tax_categories
  FOR SELECT USING (tenant_id = current_tenant_id());

CREATE POLICY "tax_categories_write" ON public.tax_categories
  FOR ALL USING (tenant_id = current_tenant_id() AND is_admin())
  WITH CHECK (tenant_id = current_tenant_id() AND is_admin());


-- ════════════════════════════════════════════════════════════
-- 2. BACKFILL — one category per distinct (normalized) name.
-- Where models of a category disagree on HSN/GST, the most
-- common value wins. Seed data's 'Mobile Phone' is unified
-- with the app's 'smartphone'. Defaults are added afterwards
-- so real data always wins over the canned values.
-- ════════════════════════════════════════════════════════════
WITH normalized AS (
  SELECT
    tenant_id,
    CASE
      WHEN lower(trim(category)) IN ('mobile phone', 'smartphone') THEN 'smartphone'
      ELSE lower(trim(category))
    END AS name,
    hsn_code,
    gst_rate
  FROM public.models
  WHERE category IS NOT NULL AND trim(category) <> ''
)
INSERT INTO public.tax_categories (tenant_id, name, hsn_code, gst_rate)
SELECT
  tenant_id,
  name,
  mode() WITHIN GROUP (ORDER BY hsn_code),
  coalesce(mode() WITHIN GROUP (ORDER BY gst_rate), 18)
FROM normalized
GROUP BY tenant_id, name
ON CONFLICT (tenant_id, name) DO NOTHING;

-- Canonical defaults for every tenant (no-ops where backfill created them)
INSERT INTO public.tax_categories (tenant_id, name, hsn_code, gst_rate)
SELECT id, 'smartphone', '8517', 18 FROM public.tenants
ON CONFLICT (tenant_id, name) DO NOTHING;

INSERT INTO public.tax_categories (tenant_id, name, hsn_code, gst_rate)
SELECT id, 'accessory', NULL, 18 FROM public.tenants
ON CONFLICT (tenant_id, name) DO NOTHING;


-- ════════════════════════════════════════════════════════════
-- 3. MODELS → point at their tax category
-- ════════════════════════════════════════════════════════════
ALTER TABLE public.models
  ADD COLUMN IF NOT EXISTS tax_category_id uuid REFERENCES public.tax_categories(id);

UPDATE public.models m
SET tax_category_id = tc.id
FROM public.tax_categories tc
WHERE m.tax_category_id IS NULL
  AND tc.tenant_id = m.tenant_id
  AND tc.name = CASE
    WHEN lower(trim(coalesce(m.category, ''))) IN ('mobile phone', 'smartphone') THEN 'smartphone'
    ELSE lower(trim(coalesce(m.category, '')))
  END;

-- Models with no/unknown category default to smartphone
UPDATE public.models m
SET tax_category_id = tc.id
FROM public.tax_categories tc
WHERE m.tax_category_id IS NULL
  AND tc.tenant_id = m.tenant_id
  AND tc.name = 'smartphone';

ALTER TABLE public.models ALTER COLUMN tax_category_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS models_tax_category_idx
  ON public.models (tenant_id, tax_category_id);


-- ════════════════════════════════════════════════════════════
-- 4. REPORT — review what was created (per tenant)
-- ════════════════════════════════════════════════════════════
SELECT
  t.shop_name,
  tc.name,
  tc.hsn_code,
  tc.gst_rate,
  (SELECT count(*) FROM public.models m WHERE m.tax_category_id = tc.id) AS models_using_it
FROM public.tax_categories tc
JOIN public.tenants t ON t.id = tc.tenant_id
ORDER BY t.shop_name, tc.name;
