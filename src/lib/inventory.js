import { supabase } from './supabase'

export async function getInventory(tenantId) {
  const { data, error } = await supabase
    .from('inventory')
    .select(`
      *,
      products ( brand, model, variant, color, category, hsn_code, gst_rate )
    `)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
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
