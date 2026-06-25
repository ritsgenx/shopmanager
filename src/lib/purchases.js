import { supabase } from './supabase'
import { createInventory } from './inventory'

export async function getPurchases(tenantId, purchaseType = null) {
  let query = supabase
    .from('purchases')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })

  if (purchaseType) query = query.eq('purchase_type', purchaseType)

  const { data, error } = await query
  return { data: data ?? [], error }
}

export async function getPurchaseById(tenantId, id) {
  const { data, error } = await supabase
    .from('purchases')
    .select(`
      *,
      purchase_items (
        *,
        products ( brand, model, variant, color, gst_rate )
      )
    `)
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .single()
  return { data, error }
}

// Creates purchase header + line items + inventory rows sequentially.
// No server-side transaction — if a step fails the error is returned immediately.
export async function createPurchase(headerData, lineItems, tenantId) {
  const { data: purchase, error: purchaseError } = await supabase
    .from('purchases')
    .insert(headerData)
    .select()
    .single()

  if (purchaseError) return { error: purchaseError }

  for (const item of lineItems) {
    const { error: itemError } = await supabase
      .from('purchase_items')
      .insert({
        purchase_id: purchase.id,
        tenant_id: tenantId,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        gst_rate: item.gst_rate,
        gst_amount: item.gst_amount,
        total_amount: item.total_amount,
      })

    if (itemError) return { error: itemError }

    const { error: invError } = await createInventory({
      tenant_id: tenantId,
      product_id: item.product_id,
      purchase_price: item.unit_price,
      selling_price: item.unit_price, // default — user can update in Inventory module
      quantity: item.quantity,
    })

    if (invError) return { error: invError }
  }

  return { data: purchase }
}

export async function deletePurchase(tenantId, id) {
  const { error } = await supabase
    .from('purchases')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('id', id)
  return { error }
}
