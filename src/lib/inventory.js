import { supabase } from './supabase'
import { PRODUCT_EMBED, flattenProduct } from './products'

// Inventory rows come back with the products embed nested through models —
// flatten each so pages keep reading item.products.brand / .model / etc.
const withFlatProducts = (rows) =>
  (rows ?? []).map((r) => ({ ...r, products: flattenProduct(r.products) }))

// Resolve product ids for a brand (and optionally model name / search term)
// through the models table, since brand/model now live there.
async function getProductIdsForModels(tenantId, { brand, model, searchTerm } = {}) {
  let query = supabase.from('models').select('id').eq('tenant_id', tenantId)
  if (brand) query = query.eq('brand', brand)
  if (model) query = query.eq('name', model)
  if (searchTerm) query = query.or(`brand.ilike.%${searchTerm}%,name.ilike.%${searchTerm}%`)
  const { data: mods } = await query
  const modelIds = mods?.map((m) => m.id) ?? []
  if (modelIds.length === 0) return []

  const { data: prods } = await supabase
    .from('products')
    .select('id')
    .eq('tenant_id', tenantId)
    .in('model_id', modelIds)
  return prods?.map((p) => p.id) ?? []
}

// threshold: units at or below which a model counts as low stock (see
// getLowStockThreshold in settings.js — the app-wide single definition).
// Also returns lowModels/outModels detail lists for the tappable stat cards.
export async function getBrandSummary(tenantId, threshold = 3) {
  const { data, error } = await supabase
    .from('inventory')
    .select('quantity_remaining, purchase_price, stock_source, approval_status, products(models(brand, name))')
    .eq('tenant_id', tenantId)
    .limit(10000)

  if (error) return { data: [], lowModels: [], outModels: [], error }

  // First pass: accumulate totals per brand and per model
  const brands = {}
  const modelTotals = {}  // key: "brand|model" -> qty

  for (const item of data ?? []) {
    const brand = item.products?.models?.brand ?? 'Unknown'
    const model = item.products?.models?.name ?? 'Unknown'
    if (!brands[brand]) {
      brands[brand] = {
        brand,
        totalUnits: 0,
        inventoryValue: 0,
        modelsInStock: new Set(),
        lowStockCount: 0,
        outOfStockCount: 0,
        officialUnits: 0,
        unofficialUnits: 0,
        manualUnits: 0,
        pendingCount: 0,
      }
    }
    const b = brands[brand]
    const qty = item.quantity_remaining ?? 0
    const src = item.stock_source ?? 'manual'
    b.totalUnits += qty
    b.inventoryValue += (item.purchase_price ?? 0) * qty
    if (qty > 0) b.modelsInStock.add(model)
    if (src === 'official')        b.officialUnits   += qty
    else if (src === 'unofficial') b.unofficialUnits += qty
    else                           b.manualUnits     += qty
    if (item.approval_status === 'pending') b.pendingCount++

    const mk = `${brand}|${model}`
    modelTotals[mk] = (modelTotals[mk] ?? 0) + qty
  }

  // Second pass: count low stock and out-of-stock at model level
  const lowModels = []
  const outModels = []
  for (const [mk, qty] of Object.entries(modelTotals)) {
    const sep = mk.indexOf('|')
    const brand = mk.slice(0, sep)
    const model = mk.slice(sep + 1)
    const b = brands[brand]
    if (!b) continue
    if (qty === 0) {
      b.outOfStockCount++
      outModels.push({ brand, model, qty })
    } else if (qty <= threshold) {
      b.lowStockCount++
      lowModels.push({ brand, model, qty })
    }
  }
  lowModels.sort((a, b) => a.qty - b.qty || a.brand.localeCompare(b.brand))
  outModels.sort((a, b) => a.brand.localeCompare(b.brand) || a.model.localeCompare(b.model))

  const result = Object.values(brands)
    .map(b => ({ ...b, modelsInStock: b.modelsInStock.size }))
    .sort((a, b) => b.totalUnits - a.totalUnits)

  return { data: result, lowModels, outModels, error: null }
}

export async function getInventoryForModel(tenantId, brand, model) {
  const productIds = await getProductIdsForModels(tenantId, { brand, model })
  if (productIds.length === 0) return { data: [], error: null }

  const { data, error } = await supabase
    .from('inventory')
    .select(`*, ${PRODUCT_EMBED}, purchases ( bill_number, purchase_type )`)
    .eq('tenant_id', tenantId)
    .in('product_id', productIds)
    .order('created_at', { ascending: false })
  return { data: withFlatProducts(data), error }
}

export async function getInventoryForBrand(tenantId, brand) {
  const productIds = await getProductIdsForModels(tenantId, { brand })
  if (productIds.length === 0) return { data: [], error: null }

  const { data, error } = await supabase
    .from('inventory')
    .select(`*, ${PRODUCT_EMBED}`)
    .eq('tenant_id', tenantId)
    .in('product_id', productIds)
    .order('created_at', { ascending: false })
  return { data: withFlatProducts(data), error }
}

export async function getInventory(tenantId, { searchTerm, brand, page = 1, pageSize = 50 } = {}) {
  const from = (page - 1) * pageSize
  const to   = from + pageSize - 1

  let productIds = null

  if (brand || searchTerm?.trim()) {
    let brandIds = null
    let searchIds = null

    if (brand) {
      brandIds = await getProductIdsForModels(tenantId, { brand })
    }

    if (searchTerm?.trim()) {
      searchIds = await getProductIdsForModels(tenantId, { searchTerm: searchTerm.trim() })
    }

    if (brandIds !== null && searchIds !== null) {
      productIds = brandIds.filter(id => searchIds.includes(id))
    } else {
      productIds = brandIds ?? searchIds
    }

    if (productIds !== null && productIds.length === 0) return { data: [], error: null, count: 0 }
  }

  let query = supabase
    .from('inventory')
    .select(`*, ${PRODUCT_EMBED}`, { count: 'exact' })
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (productIds !== null) query = query.in('product_id', productIds)

  const { data, error, count } = await query
  return { data: withFlatProducts(data), error, count: count ?? 0 }
}

export async function getImeisByPurchase(tenantId, purchaseId, productId) {
  let query = supabase
    .from('inventory')
    .select('imei_number, status, approval_status')
    .eq('tenant_id', tenantId)
    .eq('purchase_id', purchaseId)
    .order('created_at', { ascending: true })
  if (productId) query = query.eq('product_id', productId)
  const { data, error } = await query
  return { data: data ?? [], error }
}

export async function createInventory(inventoryData) {
  const { data, error } = await supabase
    .from('inventory')
    .insert(inventoryData)
    .select()
    .single()
  return { data, error }
}

export async function updateInventory(tenantId, id, inventoryData) {
  const { data, error } = await supabase
    .from('inventory')
    .update(inventoryData)
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .select()
    .single()
  return { data, error }
}

export async function deleteInventory(tenantId, id) {
  const { error } = await supabase
    .from('inventory')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('id', id)
  return { error }
}

export async function getProductByImei(tenantId, imei) {
  const { data, error } = await supabase
    .from('inventory')
    .select(`
      id, imei_number, purchase_price, selling_price, status,
      approval_status, stock_source, purchase_id, product_id,
      ${PRODUCT_EMBED}
    `)
    .eq('tenant_id', tenantId)
    .eq('imei_number', imei)
    .limit(1)
    .maybeSingle()
  if (data) return { data: { ...data, products: flattenProduct(data.products) }, error }
  return { data, error }
}

export async function getPendingApprovals(tenantId) {
  const { data: rawItems, error } = await supabase
    .from('inventory')
    .select(`*, ${PRODUCT_EMBED}`)
    .eq('tenant_id', tenantId)
    .eq('approval_status', 'pending')
    .order('created_at', { ascending: false })

  if (error) return { data: [], error }
  const items = withFlatProducts(rawItems)
  if (!items.length) return { data: [], error: null }

  const userIds = [...new Set(items.map(i => i.submitted_by).filter(Boolean))]
  let userMap = {}
  if (userIds.length > 0) {
    const { data: users } = await supabase
      .from('users')
      .select('id, full_name, phone')
      .in('id', userIds)
    for (const u of users ?? []) userMap[u.id] = u
  }

  return {
    data: items.map(item => ({ ...item, submitter: userMap[item.submitted_by] ?? null })),
    error: null,
  }
}

export async function approveInventory(tenantId, id, approvedBy) {
  const { data, error } = await supabase
    .from('inventory')
    .update({
      approval_status: 'approved',
      approved_by: approvedBy,
      approved_at: new Date().toISOString(),
    })
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .select()
    .single()
  return { data, error }
}

export async function bulkApproveInventory(tenantId, ids, approvedBy) {
  const { data, error } = await supabase
    .from('inventory')
    .update({
      approval_status: 'approved',
      approved_by: approvedBy,
      approved_at: new Date().toISOString(),
    })
    .eq('tenant_id', tenantId)
    .in('id', ids)
    .select()
  return { data, error }
}

export async function rejectInventory(tenantId, id, rejectedBy, reason) {
  const base = {
    approval_status: 'rejected',
    approved_by: rejectedBy,
    approved_at: new Date().toISOString(),
  }
  if (reason?.trim()) {
    const { data, error } = await supabase
      .from('inventory')
      .update({ ...base, rejection_reason: reason.trim() })
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .select()
      .single()
    if (!error) return { data, error: null }
    if (error.code !== '42703') return { data: null, error }
  }
  const { data, error } = await supabase
    .from('inventory')
    .update(base)
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .select()
    .single()
  return { data, error }
}
