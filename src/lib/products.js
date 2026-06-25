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

export async function deleteProduct(tenantId, id) {
  const { error } = await supabase
    .from('products')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('id', id)
  return { error }
}
