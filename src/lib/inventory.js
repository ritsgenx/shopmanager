import { supabase } from './supabase'

export async function getBrandSummary(tenantId) {
  const { data, error } = await supabase
    .from('inventory')
    .select('quantity_remaining, purchase_price, stock_source, approval_status, products(brand, model)')
    .eq('tenant_id', tenantId)
    .limit(10000)

  if (error) return { data: [], error }

  const brands = {}
  for (const item of data ?? []) {
    const brand = item.products?.brand ?? 'Unknown'
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
    if (qty === 0) {
      b.outOfStockCount++
    } else {
      b.modelsInStock.add(item.products?.model)
      if (qty <= 3) b.lowStockCount++
    }
    if (src === 'official')   b.officialUnits   += qty
    else if (src === 'unofficial') b.unofficialUnits += qty
    else                      b.manualUnits     += qty
    if (item.approval_status === 'pending') b.pendingCount++
  }

  const result = Object.values(brands)
    .map(b => ({ ...b, modelsInStock: b.modelsInStock.size }))
    .sort((a, b) => b.totalUnits - a.totalUnits)

  return { data: result, error: null }
}

export async function getInventoryForModel(tenantId, brand, model) {
  const { data: prods } = await supabase
    .from('products').select('id')
    .eq('tenant_id', tenantId).eq('brand', brand).eq('model', model)
  const productIds = prods?.map(p => p.id) ?? []
  if (productIds.length === 0) return { data: [], error: null }

  const { data, error } = await supabase
    .from('inventory')
    .select(`*, products ( brand, model, variant, color, category, hsn_code, gst_rate )`)
    .eq('tenant_id', tenantId)
    .in('product_id', productIds)
    .order('created_at', { ascending: false })
  return { data: data ?? [], error }
}

export async function getInventoryForBrand(tenantId, brand) {
  const { data: prods } = await supabase
    .from('products').select('id')
    .eq('tenant_id', tenantId).eq('brand', brand)
  const productIds = prods?.map(p => p.id) ?? []
  if (productIds.length === 0) return { data: [], error: null }

  const { data, error } = await supabase
    .from('inventory')
    .select(`*, products ( brand, model, variant, color, category, hsn_code, gst_rate )`)
    .eq('tenant_id', tenantId)
    .in('product_id', productIds)
    .order('created_at', { ascending: false })
  return { data: data ?? [], error }
}

export async function getInventory(tenantId, { searchTerm, brand, page = 1, pageSize = 50 } = {}) {
  const from = (page - 1) * pageSize
  const to   = from + pageSize - 1

  let productIds = null

  if (brand || searchTerm?.trim()) {
    let brandIds = null
    let searchIds = null

    if (brand) {
      const { data: prods } = await supabase
        .from('products').select('id')
        .eq('tenant_id', tenantId).eq('brand', brand)
      brandIds = prods?.map(p => p.id) ?? []
    }

    if (searchTerm?.trim()) {
      const { data: prods } = await supabase
        .from('products').select('id')
        .eq('tenant_id', tenantId)
        .or(`brand.ilike.%${searchTerm}%,model.ilike.%${searchTerm}%`)
      searchIds = prods?.map(p => p.id) ?? []
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
    .select(`*, products ( brand, model, variant, color, category, hsn_code, gst_rate )`, { count: 'exact' })
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (productIds !== null) query = query.in('product_id', productIds)

  const { data, error, count } = await query
  return { data: data ?? [], error, count: count ?? 0 }
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
    .select('product_id')
    .eq('tenant_id', tenantId)
    .eq('imei_number', imei)
    .limit(1)
    .maybeSingle()
  return { data, error }
}

export async function getPendingApprovals(tenantId) {
  const { data, error } = await supabase
    .from('inventory')
    .select(`*, products ( brand, model, variant, color, category )`)
    .eq('tenant_id', tenantId)
    .eq('approval_status', 'pending')
    .order('created_at', { ascending: false })
  return { data: data ?? [], error }
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
