import { supabase } from './supabase'

// Tenant-level GST/HSN settings. One row per commodity group (HSN); models
// point at a row via tax_category_id. RLS allows only the owner to write —
// employees pick categories but can never change a rate.

export async function getTaxCategories(tenantId) {
  const { data, error } = await supabase
    .from('tax_categories')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('name', { ascending: true })
  return { data: data ?? [], error }
}

// Model count per category — used to warn on rate edits and block deletes.
export async function getTaxCategoryUsage(tenantId) {
  const { data, error } = await supabase
    .from('models')
    .select('tax_category_id')
    .eq('tenant_id', tenantId)
  if (error) return { data: {}, error }
  const usage = {}
  for (const row of data ?? []) {
    usage[row.tax_category_id] = (usage[row.tax_category_id] ?? 0) + 1
  }
  return { data: usage, error: null }
}

export async function createTaxCategory(tenantId, { name, hsn_code, gst_rate }) {
  const { data, error } = await supabase
    .from('tax_categories')
    .insert({
      tenant_id: tenantId,
      name: name.trim().toLowerCase(),
      hsn_code: hsn_code?.trim() || null,
      gst_rate: Number(gst_rate),
    })
    .select()
    .single()
  return { data, error }
}

export async function updateTaxCategory(tenantId, id, { name, hsn_code, gst_rate }) {
  const { data, error } = await supabase
    .from('tax_categories')
    .update({
      name: name.trim().toLowerCase(),
      hsn_code: hsn_code?.trim() || null,
      gst_rate: Number(gst_rate),
      updated_at: new Date().toISOString(),
    })
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .select()
    .single()
  return { data, error }
}

export async function deleteTaxCategory(tenantId, id) {
  const { count } = await supabase
    .from('models')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('tax_category_id', id)
  if (count > 0) {
    return { error: { message: `Cannot delete — ${count} model${count > 1 ? 's' : ''} use${count > 1 ? '' : 's'} this category. Reassign them first.` } }
  }
  const { error } = await supabase
    .from('tax_categories')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('id', id)
  return { error }
}
