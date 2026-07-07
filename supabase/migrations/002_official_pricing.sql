-- ============================================================
-- Official Pricing: model-level MOP / Finance / O/C prices
-- Run this once in your Supabase SQL Editor (after 001).
--
-- 1. model_prices        — append-only price history per model
-- 2. current_model_prices — view exposing the latest price row
-- 3. sale_items          — cost snapshot columns (cost_basis)
-- 4. sales               — finance_involved flag
-- 5. products            — catalog columns (is_active, created_by)
-- 6. Backfill            — freeze historical costs from inventory
-- ============================================================


-- ════════════════════════════════════════════════════════════
-- 1. MODEL_PRICES  (append-only history)
-- One row per price update. Never updated in place — the
-- current price is simply the newest row for a model+variant.
-- variant uses '' (empty string) instead of NULL so the
-- uniqueness of the (brand, model, variant) key is well-defined.
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.model_prices (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  brand         text NOT NULL,
  model         text NOT NULL,
  variant       text NOT NULL DEFAULT '',
  mop           numeric(12,2),
  finance_price numeric(12,2),
  oc_price      numeric(12,2),
  created_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid REFERENCES public.users(id)
);

CREATE INDEX IF NOT EXISTS model_prices_lookup_idx
  ON public.model_prices (tenant_id, brand, model, variant, created_at DESC);

ALTER TABLE public.model_prices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "model_prices_select" ON public.model_prices;
DROP POLICY IF EXISTS "model_prices_insert" ON public.model_prices;
DROP POLICY IF EXISTS "model_prices_delete" ON public.model_prices;

-- All staff can read prices (needed to sell + see commission basis)
CREATE POLICY "model_prices_select" ON public.model_prices
  FOR SELECT USING (tenant_id = current_tenant_id());

-- All staff can add a price update (owner + staff both maintain prices)
CREATE POLICY "model_prices_insert" ON public.model_prices
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id());

-- Append-only: no UPDATE policy at all. Admin may delete a bad row.
CREATE POLICY "model_prices_delete" ON public.model_prices
  FOR DELETE USING (tenant_id = current_tenant_id() AND is_admin());


-- ════════════════════════════════════════════════════════════
-- 2. CURRENT_MODEL_PRICES  (latest row per model+variant)
-- security_invoker makes the view respect the caller's RLS.
-- ════════════════════════════════════════════════════════════
CREATE OR REPLACE VIEW public.current_model_prices
WITH (security_invoker = true) AS
SELECT DISTINCT ON (tenant_id, brand, model, variant)
  id, tenant_id, brand, model, variant,
  mop, finance_price, oc_price, created_at, created_by
FROM public.model_prices
ORDER BY tenant_id, brand, model, variant, created_at DESC;


-- ════════════════════════════════════════════════════════════
-- 3. SALE_ITEMS — cost snapshot
-- cost_basis  = per-unit cost frozen at the moment of sale
-- cost_source = 'unit'    (unofficial/manual: inventory purchase_price)
--             | 'finance' (official, finance involved)
--             | 'oc'      (official, full payment)
-- Profit/commission reports read this snapshot so later price
-- revisions never rewrite past profits.
-- ════════════════════════════════════════════════════════════
ALTER TABLE public.sale_items ADD COLUMN IF NOT EXISTS cost_basis  numeric(12,2);
ALTER TABLE public.sale_items ADD COLUMN IF NOT EXISTS cost_source text;


-- ════════════════════════════════════════════════════════════
-- 4. SALES — was finance involved (fully or partially)?
-- Any finance involvement means the Finance price is the basis.
-- ════════════════════════════════════════════════════════════
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS finance_involved boolean NOT NULL DEFAULT false;


-- ════════════════════════════════════════════════════════════
-- 5. PRODUCTS — catalog lifecycle + audit
-- ════════════════════════════════════════════════════════════
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_active  boolean NOT NULL DEFAULT true;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.users(id);
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();


-- ════════════════════════════════════════════════════════════
-- 6. BACKFILL — freeze historical sale costs
-- Existing sales were all costed against the unit's purchase
-- price, so snapshot that value; reports keep working unchanged.
-- ════════════════════════════════════════════════════════════
UPDATE public.sale_items si
SET cost_basis = i.purchase_price,
    cost_source = 'unit'
FROM public.inventory i
WHERE si.inventory_id = i.id
  AND si.cost_basis IS NULL;
