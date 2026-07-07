import { supabase } from './supabase'

// Prices attach to brand + model + variant — never to color or to a unit.
// variant is stored as '' (not null) in model_prices; normalize here.
export const priceKey = (brand, model, variant) =>
  `${brand}|${model}|${variant || ''}`

// Latest price row per model+variant, as a Map keyed by priceKey.
// Also returns the raw rows (with the setter's name resolved).
export async function getCurrentPrices(tenantId) {
  const { data, error } = await supabase
    .from('current_model_prices')
    .select('*')
    .eq('tenant_id', tenantId)

  if (error) return { data: [], map: new Map(), error }

  const rows = await attachUserNames(data ?? [])
  const map = new Map()
  for (const row of rows) map.set(priceKey(row.brand, row.model, row.variant), row)
  return { data: rows, map, error: null }
}

export async function getCurrentPriceFor(tenantId, brand, model, variant) {
  const { data, error } = await supabase
    .from('current_model_prices')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('brand', brand)
    .eq('model', model)
    .eq('variant', variant || '')
    .maybeSingle()
  return { data, error }
}

// Full history for one model+variant, oldest first (for the graph).
export async function getPriceHistory(tenantId, brand, model, variant) {
  const { data, error } = await supabase
    .from('model_prices')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('brand', brand)
    .eq('model', model)
    .eq('variant', variant || '')
    .order('created_at', { ascending: true })

  if (error) return { data: [], error }
  return { data: await attachUserNames(data ?? []), error: null }
}

// Bulk insert price updates (append-only — one history row per entry).
// entries: [{ brand, model, variant, mop, finance_price, oc_price }]
export async function addPriceEntries(tenantId, userId, entries) {
  const rows = entries.map((e) => ({
    tenant_id: tenantId,
    brand: e.brand,
    model: e.model,
    variant: e.variant || '',
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
    .select('quantity_remaining, stock_source, products ( brand, model, variant )')
    .eq('tenant_id', tenantId)
    .eq('stock_source', 'official')
    .gt('quantity_remaining', 0)

  if (error) return { data: [], error }

  const missing = new Map()
  for (const inv of data ?? []) {
    const p = inv.products
    if (!p) continue
    const key = priceKey(p.brand, p.model, p.variant)
    const price = priceMap.get(key)
    if (!price || price.finance_price == null || price.oc_price == null) {
      const cur = missing.get(key) ?? { brand: p.brand, model: p.model, variant: p.variant || '', units: 0 }
      cur.units += inv.quantity_remaining ?? 0
      missing.set(key, cur)
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
