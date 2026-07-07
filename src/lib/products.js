import { supabase } from './supabase'

export async function getProducts(tenantId) {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('brand', { ascending: true })
  return { data: data ?? [], error }
}

export async function createProduct(productData) {
  const { data, error } = await supabase
    .from('products')
    .insert(productData)
    .select()
    .single()
  return { data, error }
}

export async function updateProduct(tenantId, id, productData) {
  const { data, error } = await supabase
    .from('products')
    .update(productData)
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .select()
    .single()
  return { data, error }
}

// Activate/discontinue a whole model group (all color rows share the flag)
export async function setProductsActive(tenantId, ids, isActive) {
  const { data, error } = await supabase
    .from('products')
    .update({ is_active: isActive })
    .eq('tenant_id', tenantId)
    .in('id', ids)
    .select()
  return { data: data ?? [], error }
}

export async function deleteProduct(tenantId, id) {
  const { error } = await supabase
    .from('products')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('id', id)
  return { error }
}
