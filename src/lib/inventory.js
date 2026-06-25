import { supabase } from './supabase'

export async function getInventory(tenantId, { searchTerm, page = 1, pageSize = 50 } = {}) {
  const from = (page - 1) * pageSize
  const to   = from + pageSize - 1

  // Brand/model live on the products table — resolve matching IDs first when searching
  let productIds = null
  if (searchTerm?.trim()) {
    const { data: prods } = await supabase
      .from('products')
      .select('id')
      .eq('tenant_id', tenantId)
      .or(`brand.ilike.%${searchTerm}%,model.ilike.%${searchTerm}%`)
    productIds = prods?.map(p => p.id) ?? []
    if (productIds.length === 0) return { data: [], error: null, count: 0 }
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
