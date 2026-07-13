import { supabase } from './supabase'

// Prices attach to a model (brand + name + variant) through models.id —
// never to a color or a unit. Renaming a model can't detach its prices:
// everything is keyed by model_id, not text.

// Latest price row per model, as a Map keyed by model_id.
// Also returns the raw rows (with the setter's name resolved).
export async function getCurrentPrices(tenantId) {
  const { data, error } = await supabase
    .from('current_model_prices')
    .select('*')
    .eq('tenant_id', tenantId)

  if (error) return { data: [], map: new Map(), error }

  const rows = await attachUserNames(data ?? [])
  const map = new Map()
  for (const row of rows) map.set(row.model_id, row)
  return { data: rows, map, error: null }
}

export async function getCurrentPriceFor(tenantId, modelId) {
  const { data, error } = await supabase
    .from('current_model_prices')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('model_id', modelId)
    .maybeSingle()
  return { data, error }
}

// Full history for one model, oldest first (for the graph).
export async function getPriceHistory(tenantId, modelId) {
  const { data, error } = await supabase
    .from('model_prices')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('model_id', modelId)
    .order('created_at', { ascending: true })

  if (error) return { data: [], error }
  return { data: await attachUserNames(data ?? []), error: null }
}

// Bulk insert price updates (append-only — one history row per entry).
// entries: [{ model_id, mop, finance_price, oc_price }]
export async function addPriceEntries(tenantId, userId, entries) {
  const rows = entries.map((e) => ({
    tenant_id: tenantId,
    model_id: e.model_id,
    mop: e.mop ?? null,
    finance_price: e.finance_price ?? null,
    oc_price: e.oc_price ?? null,
    created_by: userId,
  }))
  const { data, error } = await supabase.from('model_prices').insert(rows).select()
  return { data: data ?? [], error }
}

// Models that have official units in stock but no usable current price
// (missing row, or missing finance/oc value). These block sales.
export async function getMissingPriceModels(tenantId, priceMap) {
  const { data, error } = await supabase
    .from('inventory')
    .select('quantity_remaining, stock_source, products ( model_id, models ( brand, name, variant ) )')
    .eq('tenant_id', tenantId)
    .eq('stock_source', 'official')
    .gt('quantity_remaining', 0)

  if (error) return { data: [], error }

  const missing = new Map()
  for (const inv of data ?? []) {
    const modelId = inv.products?.model_id
    if (!modelId) continue
    const price = priceMap.get(modelId)
    if (!price || price.finance_price == null || price.oc_price == null) {
      const m = inv.products?.models ?? {}
      const cur = missing.get(modelId) ?? {
        model_id: modelId, brand: m.brand, model: m.name, variant: m.variant || '', units: 0,
      }
      cur.units += inv.quantity_remaining ?? 0
      missing.set(modelId, cur)
    }
  }
  return { data: [...missing.values()], error: null }
}

// PostgREST can't embed users through the view, so resolve names manually.
async function attachUserNames(rows) {
  const userIds = [...new Set(rows.map((r) => r.created_by).filter(Boolean))]
  if (userIds.length === 0) return rows
  const { data: users } = await supabase
    .from('users')
    .select('id, full_name')
    .in('id', userIds)
  const nameMap = {}
  for (const u of users ?? []) nameMap[u.id] = u.full_name
  return rows.map((r) => ({ ...r, created_by_name: nameMap[r.created_by] ?? null }))
}
