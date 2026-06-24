import { supabase } from './supabase'

// India financial year: April–March
function getFinancialYear() {
  const now = new Date()
  const month = now.getMonth() // 0-indexed; 3 = April
  const year = now.getFullYear()
  if (month >= 3) return `${year}-${String(year + 1).slice(-2)}`
  return `${year - 1}-${String(year).slice(-2)}`
}

async function generateInvoiceNumber(tenantId) {
  const fy = getFinancialYear()
  const prefix = `INV/${fy}/`

  const { data } = await supabase
    .from('sales')
    .select('invoice_number')
    .eq('tenant_id', tenantId)
    .like('invoice_number', `${prefix}%`)
    .order('invoice_number', { ascending: false })
    .limit(1)

  let next = 1
  if (data && data.length > 0) {
    const parts = data[0].invoice_number.split('/')
    next = parseInt(parts[parts.length - 1], 10) + 1
  }
  return `${prefix}${String(next).padStart(4, '0')}`
}

export async function getSales(tenantId, filters = {}) {
  let query = supabase
    .from('sales')
    .select(`*, customers ( full_name, company_name, customer_type, phone )`)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })

  if (filters.employeeId) query = query.eq('employee_id', filters.employeeId)
  if (filters.customerId) query = query.eq('customer_id', filters.customerId)
  if (filters.dateFrom) query = query.gte('sale_date', filters.dateFrom)
  if (filters.dateTo) query = query.lte('sale_date', filters.dateTo)

  const { data, error } = await query
  return { data: data ?? [], error }
}

export async function getSaleById(id) {
  const { data, error } = await supabase
    .from('sales')
    .select(`
      *,
      customers ( id, full_name, company_name, customer_type, phone, email, address, city, state, pincode, gstin ),
      sale_items (
        *,
        products ( brand, model, variant, color, category, hsn_code, gst_rate )
      )
    `)
    .eq('id', id)
    .single()
  return { data, error }
}

export async function createSale(headerData, lineItems, { customer, tenant }) {
  const tenantId = tenant.id

  // 1. Generate invoice number
  const invoiceNumber = await generateInvoiceNumber(tenantId)

  // 2. Determine GST type
  const sameState =
    (customer.state || '').trim().toLowerCase() ===
    (tenant.state || '').trim().toLowerCase()
  const saleType = customer.gstin ? 'b2b' : 'b2c'

  // 3. Process line items with GST split
  const processedItems = lineItems.map((item) => {
    const lineTotal = item.unit_price * item.quantity
    const disc = item.discount_amount || 0
    const taxable = lineTotal - disc
    const gstAmt = (taxable * (item.gst_rate || 0)) / 100

    let cgst = 0, sgst = 0, igst = 0
    if (sameState) {
      cgst = Math.round((gstAmt / 2) * 100) / 100
      sgst = Math.round((gstAmt - cgst) * 100) / 100
    } else {
      igst = Math.round(gstAmt * 100) / 100
    }

    return {
      ...item,
      taxable_amount: taxable,
      cgst_amount: cgst,
      sgst_amount: sgst,
      igst_amount: igst,
      total_amount: Math.round((taxable + gstAmt) * 100) / 100,
    }
  })

  // 4. Compute header totals
  const subtotal = processedItems.reduce((s, i) => s + i.unit_price * i.quantity, 0)
  const discountTotal = processedItems.reduce((s, i) => s + (i.discount_amount || 0), 0)
  const taxableAmount = subtotal - discountTotal
  const cgstTotal = processedItems.reduce((s, i) => s + i.cgst_amount, 0)
  const sgstTotal = processedItems.reduce((s, i) => s + i.sgst_amount, 0)
  const igstTotal = processedItems.reduce((s, i) => s + i.igst_amount, 0)
  const totalGst = cgstTotal + sgstTotal + igstTotal
  const grandTotal = Math.round((taxableAmount + totalGst) * 100) / 100

  // 5. Insert sale header
  const { data: sale, error: saleError } = await supabase
    .from('sales')
    .insert({
      tenant_id: tenantId,
      invoice_number: invoiceNumber,
      sale_date: new Date().toISOString().split('T')[0],
      customer_id: customer.id,
      employee_id: headerData.employee_id,
      sale_type: saleType,
      subtotal,
      discount_amount: discountTotal,
      taxable_amount: taxableAmount,
      cgst_amount: cgstTotal,
      sgst_amount: sgstTotal,
      igst_amount: igstTotal,
      total_gst: totalGst,
      grand_total: grandTotal,
      payment_method: headerData.payment_method,
      payment_status: headerData.payment_status,
      upi_reference: headerData.upi_reference || null,
      notes: headerData.notes || null,
      is_return: false,
    })
    .select()
    .single()

  if (saleError) return { error: saleError }

  // 6. Insert sale_items
  for (const item of processedItems) {
    const { error: itemError } = await supabase
      .from('sale_items')
      .insert({
        tenant_id: tenantId,
        sale_id: sale.id,
        product_id: item.product_id,
        inventory_id: item.inventory_id,
        imei_number: item.imei_number || null,
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount_amount: item.discount_amount || 0,
        gst_rate: item.gst_rate || 0,
        cgst_amount: item.cgst_amount,
        sgst_amount: item.sgst_amount,
        igst_amount: item.igst_amount,
        total_amount: item.total_amount,
      })
    if (itemError) return { error: itemError }

    // 7. Update inventory quantity_sold + status
    const { data: inv } = await supabase
      .from('inventory')
      .select('quantity, quantity_sold')
      .eq('id', item.inventory_id)
      .single()

    if (inv) {
      const newSold = (inv.quantity_sold || 0) + item.quantity
      const newRemaining = inv.quantity - newSold
      let newStatus = 'in_stock'
      if (newRemaining <= 0) newStatus = 'sold'
      else if (newRemaining <= 5) newStatus = 'low_stock'

      await supabase
        .from('inventory')
        .update({ quantity_sold: newSold, status: newStatus })
        .eq('id', item.inventory_id)
    }
  }

  // 8. Update customer stats
  const { data: cust } = await supabase
    .from('customers')
    .select('total_purchases, visit_count')
    .eq('id', customer.id)
    .single()

  if (cust) {
    await supabase
      .from('customers')
      .update({
        total_purchases: (cust.total_purchases || 0) + grandTotal,
        visit_count: (cust.visit_count || 0) + 1,
        last_visit_date: new Date().toISOString().split('T')[0],
        updated_at: new Date().toISOString(),
      })
      .eq('id', customer.id)
  }

  return {
    data: {
      ...sale,
      grand_total: grandTotal,
      processedItems,
      sameState,
      saleType,
    },
  }
}

export async function deleteSale(id) {
  // Reverse inventory and customer stats before deleting
  const { data: sale } = await getSaleById(id)

  if (sale) {
    for (const item of sale.sale_items ?? []) {
      const { data: inv } = await supabase
        .from('inventory')
        .select('quantity, quantity_sold')
        .eq('id', item.inventory_id)
        .single()

      if (inv) {
        const newSold = Math.max(0, (inv.quantity_sold || 0) - item.quantity)
        const newRemaining = inv.quantity - newSold
        let newStatus = 'in_stock'
        if (newRemaining <= 0) newStatus = 'sold'
        else if (newRemaining <= 5) newStatus = 'low_stock'

        await supabase
          .from('inventory')
          .update({ quantity_sold: newSold, status: newStatus })
          .eq('id', item.inventory_id)
      }
    }

    const { data: cust } = await supabase
      .from('customers')
      .select('total_purchases, visit_count')
      .eq('id', sale.customer_id)
      .single()

    if (cust) {
      await supabase
        .from('customers')
        .update({
          total_purchases: Math.max(0, (cust.total_purchases || 0) - sale.grand_total),
          visit_count: Math.max(0, (cust.visit_count || 0) - 1),
          updated_at: new Date().toISOString(),
        })
        .eq('id', sale.customer_id)
    }
  }

  // Delete sale items first, then sale
  await supabase.from('sale_items').delete().eq('sale_id', id)
  const { error } = await supabase.from('sales').delete().eq('id', id)
  return { error }
}
