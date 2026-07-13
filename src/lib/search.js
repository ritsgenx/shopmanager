import { supabase } from './supabase'
import { PRODUCT_EMBED, flattenProduct } from './products'
import { getProductByImei } from './inventory'
import { getSaleById, getCustomerSales, getSales } from './sales'
import { getPurchaseById } from './purchases'
import { getCustomers } from './customers'

// ── Search by IMEI ─────────────────────────────────────────────────────────
// Returns the device, and (if sold) the sale it was sold on.
export async function searchByImei(tenantId, imei) {
  const term = imei.trim()
  if (!term) return { data: null, error: null }

  const { data: device, error } = await getProductByImei(tenantId, term)
  if (error) return { data: null, error }
  if (!device) return { data: null, error: null }

  let sale = null
  if (device.status === 'sold') {
    const { data: saleItem } = await supabase
      .from('sale_items')
      .select('sale_id')
      .eq('tenant_id', tenantId)
      .eq('imei_number', term)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (saleItem?.sale_id) {
      const { data: saleData } = await getSaleById(tenantId, saleItem.sale_id)
      sale = saleData
    }
  }

  return { data: { device, sale }, error: null }
}

// ── Search by Invoice / Bill No. ───────────────────────────────────────────
export async function searchByInvoice(tenantId, term) {
  const t = term.trim()
  if (!t) return { data: null, error: null }

  const { data: matches, error } = await supabase
    .from('sales')
    .select('id')
    .eq('tenant_id', tenantId)
    .ilike('invoice_number', `%${t}%`)
    .order('created_at', { ascending: false })
    .limit(1)

  if (error) return { data: null, error }
  if (!matches?.length) return { data: null, error: null }

  return getSaleById(tenantId, matches[0].id)
}

// ── Search by Purchase ID / Bill No. ───────────────────────────────────────
export async function searchByPurchase(tenantId, term) {
  const t = term.trim()
  if (!t) return { data: null, error: null }

  const { data: matches, error } = await supabase
    .from('purchases')
    .select('id')
    .eq('tenant_id', tenantId)
    .ilike('bill_number', `%${t}%`)
    .order('created_at', { ascending: false })
    .limit(1)

  if (error) return { data: null, error }
  if (!matches?.length) return { data: null, error: null }

  const { data: purchase, error: poError } = await getPurchaseById(tenantId, matches[0].id)
  if (poError) return { data: null, error: poError }

  const { data: items } = await supabase
    .from('inventory')
    .select(`
      id, imei_number, status, quantity_remaining, purchase_price,
      ${PRODUCT_EMBED}
    `)
    .eq('tenant_id', tenantId)
    .eq('purchase_id', purchase.id)
    .order('created_at', { ascending: false })

  const flatItems = (items ?? []).map((i) => ({ ...i, products: flattenProduct(i.products) }))
  return { data: { purchase, items: flatItems }, error: null }
}

// ── Search by Customer (name / phone) ──────────────────────────────────────
export async function searchCustomersByTerm(tenantId, term) {
  const { data, error } = await getCustomers(tenantId, { searchTerm: term, pageSize: 20 })
  return { data: data ?? [], error }
}

export async function getCustomerHistory(tenantId, customerId) {
  return getCustomerSales(tenantId, customerId)
}

// ── Search by Employee (name / phone / email) ──────────────────────────────
export async function searchEmployeesByTerm(tenantId, term) {
  const t = term.trim()
  let query = supabase
    .from('users')
    .select('id, full_name, role, email, phone')
    .eq('tenant_id', tenantId)
    .neq('role', 'super_admin')
    .order('full_name')
    .limit(20)

  if (t) query = query.or(`full_name.ilike.%${t}%,phone.ilike.%${t}%,email.ilike.%${t}%`)

  const { data, error } = await query
  return { data: data ?? [], error }
}

export async function getEmployeeActivity(tenantId, userId) {
  const [salesRes, stockRes] = await Promise.all([
    getSales(tenantId, { employeeId: userId, pageSize: 50 }),
    supabase
      .from('inventory')
      .select(`
        id, imei_number, status, purchase_price, created_at,
        ${PRODUCT_EMBED}
      `)
      .eq('tenant_id', tenantId)
      .eq('submitted_by', userId)
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  return {
    sales: salesRes.data ?? [],
    stockAdded: (stockRes.data ?? []).map((i) => ({ ...i, products: flattenProduct(i.products) })),
    error: salesRes.error || stockRes.error || null,
  }
}
