import { supabase } from './supabase'

// A model (brand + name + variant) is a first-class row in the models table;
// products are its color rows. UI code everywhere still thinks in flat product
// objects, so every query embeds the model and flattens it back to the legacy
// shape: { id, model_id, brand, model, variant, color, category, hsn_code,
// gst_rate, is_active, ... }.

export const MODEL_EMBED =
  'models ( id, brand, name, variant, is_active, tax_category_id, tax_categories ( id, name, hsn_code, gst_rate ) )'

export const PRODUCT_EMBED = `products ( id, model_id, color, ${MODEL_EMBED} )`

export function flattenProduct(p) {
  if (!p) return p
  const { models: m = {}, ...rest } = p
  const tc = m.tax_categories ?? {}
  return {
    ...rest,
    model_id: p.model_id ?? m.id,
    brand: m.brand,
    model: m.name,
    variant: m.variant || null, // legacy shape used null for "no variant"
    // category/HSN/GST resolve through the model's tax category — the
    // tenant-level single source of truth maintained in Settings
    tax_category_id: m.tax_category_id ?? tc.id,
    category: tc.name,
    hsn_code: tc.hsn_code,
    gst_rate: tc.gst_rate,
    is_active: m.is_active,
  }
}

export async function getProducts(tenantId) {
  const { data, error } = await supabase
    .from('products')
    .select(`id, tenant_id, model_id, color, created_by, created_at, ${MODEL_EMBED}`)
    .eq('tenant_id', tenantId)

  const rows = (data ?? []).map(flattenProduct).sort(
    (a, b) =>
      (a.brand ?? '').localeCompare(b.brand ?? '') ||
      (a.model ?? '').localeCompare(b.model ?? '') ||
      (a.variant ?? '').localeCompare(b.variant ?? '') ||
      (a.color ?? '').localeCompare(b.color ?? '')
  )
  return { data: rows, error }
}

// Find-or-create the model row, then add one color row per entry.
// colors: array of names; an empty array creates a single colorless row.
// Colors the model already has are skipped, so re-submitting an existing
// model simply attaches the new colors.
// Returns { model_id, modelExisted, added, skipped }.
export async function createCatalogEntry({
  tenant_id, brand, model, variant, colors = [], tax_category_id, created_by,
}) {
  const { data: existing, error: findError } = await supabase
    .from('models')
    .select('id')
    .eq('tenant_id', tenant_id)
    .eq('brand', brand)
    .eq('name', model)
    .eq('variant', variant || '')
    .maybeSingle()
  if (findError) return { data: null, error: findError }

  let modelId = existing?.id
  if (!modelId) {
    const { data: created, error: createError } = await supabase
      .from('models')
      .insert({
        tenant_id,
        brand,
        name: model,
        variant: variant || '',
        tax_category_id,
        created_by: created_by ?? null,
      })
      .select('id')
      .single()
    if (createError) return { data: null, error: createError }
    modelId = created.id
  }

  const { data: existingRows, error: rowsError } = await supabase
    .from('products')
    .select('color')
    .eq('tenant_id', tenant_id)
    .eq('model_id', modelId)
  if (rowsError) return { data: null, error: rowsError }
  const existingColors = new Set((existingRows ?? []).map((r) => (r.color ?? '').toLowerCase()))

  const wanted = colors.length > 0 ? colors : [null]
  const toInsert = wanted
    .filter((c) => !existingColors.has((c ?? '').toLowerCase()))
    .map((c) => ({
      tenant_id,
      model_id: modelId,
      color: c,
      created_by: created_by ?? null,
    }))

  if (toInsert.length > 0) {
    const { error: insertError } = await supabase.from('products').insert(toInsert)
    if (insertError) return { data: null, error: insertError }
  }

  return {
    data: {
      model_id: modelId,
      modelExisted: !!existing,
      added: toInsert.length,
      skipped: wanted.length - toInsert.length,
    },
    error: null,
  }
}

// Color rows referenced by stock, purchases or sales must never be deleted —
// history points at them. Returns the set of product ids that are in use.
async function getReferencedProductIds(tenantId, productIds) {
  const referenced = new Set()
  if (productIds.length === 0) return referenced
  for (const table of ['inventory', 'purchase_items', 'sale_items']) {
    const { data } = await supabase
      .from(table)
      .select('product_id')
      .eq('tenant_id', tenantId)
      .in('product_id', productIds)
    for (const row of data ?? []) referenced.add(row.product_id)
  }
  return referenced
}

// Edit a model in place. Stock, sales and price history all key on ids, so a
// rename propagates everywhere automatically. Color removals are refused for
// rows that history references; those come back in `blocked`.
// fields: { brand, name, variant, tax_category_id }
// removeProducts: [{ id, color }]
export async function updateCatalogEntry({
  tenantId, modelId, fields, addColors = [], removeProducts = [], createdBy,
}) {
  const { error: modelError } = await supabase
    .from('models')
    .update({ ...fields, variant: fields.variant || '' })
    .eq('tenant_id', tenantId)
    .eq('id', modelId)
  if (modelError) return { data: null, error: modelError }

  if (addColors.length > 0) {
    const { data: existingRows } = await supabase
      .from('products')
      .select('color')
      .eq('tenant_id', tenantId)
      .eq('model_id', modelId)
    const have = new Set((existingRows ?? []).map((r) => (r.color ?? '').toLowerCase()))
    const rows = addColors
      .filter((c) => !have.has(c.toLowerCase()))
      .map((c) => ({ tenant_id: tenantId, model_id: modelId, color: c, created_by: createdBy ?? null }))
    if (rows.length > 0) {
      const { error } = await supabase.from('products').insert(rows)
      if (error) return { data: null, error }
    }
  }

  const blocked = []
  if (removeProducts.length > 0) {
    const referenced = await getReferencedProductIds(tenantId, removeProducts.map((r) => r.id))
    for (const r of removeProducts) {
      if (referenced.has(r.id)) {
        blocked.push(r.color ?? '(no color)')
        continue
      }
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('tenant_id', tenantId)
        .eq('id', r.id)
      if (error) blocked.push(r.color ?? '(no color)')
    }
  }

  return { data: { blocked }, error: null }
}

// Activate/discontinue a model — all its color rows share the flag
export async function setModelActive(tenantId, modelId, isActive) {
  const { data, error } = await supabase
    .from('models')
    .update({ is_active: isActive })
    .eq('tenant_id', tenantId)
    .eq('id', modelId)
    .select()
  return { data: data ?? [], error }
}
