import { supabase } from './supabase'

const COMMISSION_RATE = 0.20

function monthRange(month) {
  const [y, m] = month.split('-').map(Number)
  const days = new Date(y, m, 0).getDate()
  return {
    from: `${month}-01`,
    to: `${month}-${String(days).padStart(2, '0')}`,
  }
}

// Returns one row per active employee with their total profit + commission for the month.
// Paid status is read from the commissions table.
export async function getCommissionSummary(tenantId, month) {
  const { from, to } = monthRange(month)

  const [
    { data: employees, error: empErr },
    { data: sales, error: salesErr },
    { data: commRows },
  ] = await Promise.all([
    supabase
      .from('users')
      .select('id, full_name, phone')
      .eq('tenant_id', tenantId)
      .eq('role', 'employee')
      .eq('is_active', true),
    supabase
      .from('sales')
      .select('id, employee_id, sale_items ( quantity, unit_price, discount_amount, inventory ( purchase_price ) )')
      .eq('tenant_id', tenantId)
      .gte('sale_date', from)
      .lte('sale_date', to)
      .not('employee_id', 'is', null),
    supabase
      .from('commissions')
      .select('user_id, status, paid_at')
      .eq('tenant_id', tenantId)
      .eq('month', month),
  ])

  if (empErr) return { data: [], error: empErr }
  if (salesErr) return { data: [], error: salesErr }

  const paidMap = {}
  for (const c of commRows ?? []) paidMap[c.user_id] = c

  // Group sales by employee
  const byEmp = {}
  for (const sale of sales ?? []) {
    if (!byEmp[sale.employee_id]) byEmp[sale.employee_id] = []
    byEmp[sale.employee_id].push(sale)
  }

  const data = (employees ?? []).map(emp => {
    let totalProfit = 0
    let salesCount = 0
    for (const sale of byEmp[emp.id] ?? []) {
      salesCount++
      for (const item of sale.sale_items ?? []) {
        const cost = (item.inventory?.purchase_price ?? 0) * item.quantity
        const revenue = item.unit_price * item.quantity - (item.discount_amount ?? 0)
        totalProfit += revenue - cost
      }
    }
    const totalCommission = parseFloat((Math.max(0, totalProfit) * COMMISSION_RATE).toFixed(2))
    const paid = paidMap[emp.id]
    return {
      employee_id: emp.id,
      full_name: emp.full_name,
      phone: emp.phone,
      sales_count: salesCount,
      total_profit: parseFloat(totalProfit.toFixed(2)),
      total_commission: totalCommission,
      status: paid?.status ?? 'pending',
      paid_at: paid?.paid_at ?? null,
    }
  })

  return { data, error: null }
}

// Returns all sales by one employee for a month, with per-item purchase/sell/profit/commission.
export async function getEmployeeSalesBreakdown(tenantId, employeeId, month) {
  const { from, to } = monthRange(month)

  const { data: sales, error } = await supabase
    .from('sales')
    .select(`
      id, invoice_number, sale_date, grand_total,
      sale_items (
        id, quantity, unit_price, discount_amount,
        products ( brand, model, variant, color ),
        inventory ( purchase_price )
      )
    `)
    .eq('tenant_id', tenantId)
    .eq('employee_id', employeeId)
    .gte('sale_date', from)
    .lte('sale_date', to)
    .order('sale_date', { ascending: true })

  if (error) return { data: [], totals: { total_profit: 0, total_commission: 0 }, error }

  let grandProfit = 0
  let grandCommission = 0

  const data = (sales ?? []).map(sale => {
    let saleProfit = 0
    const items = (sale.sale_items ?? []).map(item => {
      const purchasePrice = item.inventory?.purchase_price ?? 0
      const qty = item.quantity
      const revenue = item.unit_price * qty - (item.discount_amount ?? 0)
      const cost = purchasePrice * qty
      const profit = revenue - cost
      const commission = parseFloat((Math.max(0, profit) * COMMISSION_RATE).toFixed(2))
      saleProfit += profit
      return { ...item, purchase_price: purchasePrice, profit: parseFloat(profit.toFixed(2)), commission }
    })
    const saleCommission = parseFloat((Math.max(0, saleProfit) * COMMISSION_RATE).toFixed(2))
    grandProfit += saleProfit
    grandCommission += saleCommission
    return { ...sale, sale_items: items, sale_profit: parseFloat(saleProfit.toFixed(2)), sale_commission: saleCommission }
  })

  return {
    data,
    totals: {
      total_profit: parseFloat(grandProfit.toFixed(2)),
      total_commission: parseFloat(grandCommission.toFixed(2)),
    },
    error: null,
  }
}

export async function markMonthCommissionPaid(tenantId, employeeId, month) {
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('commissions')
    .upsert(
      { tenant_id: tenantId, user_id: employeeId, month, status: 'paid', paid_at: now, updated_at: now },
      { onConflict: 'tenant_id,user_id,month' }
    )
  return { error }
}

export async function markAllMonthCommissionsPaid(tenantId, month, employeeIds) {
  const now = new Date().toISOString()
  const rows = employeeIds.map(id => ({
    tenant_id: tenantId, user_id: id, month,
    status: 'paid', paid_at: now, updated_at: now,
  }))
  const { error } = await supabase
    .from('commissions')
    .upsert(rows, { onConflict: 'tenant_id,user_id,month' })
  return { error }
}

// Employee's own commission view — last 12 months
export async function getMyCommissionHistory(tenantId, userId) {
  const months = []
  const now = new Date()
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  const results = await Promise.all(
    months.map(async month => {
      const { from, to } = monthRange(month)
      const [{ data: sales }, { data: commRow }] = await Promise.all([
        supabase
          .from('sales')
          .select('id, sale_items ( quantity, unit_price, discount_amount, inventory ( purchase_price ) )')
          .eq('tenant_id', tenantId)
          .eq('employee_id', userId)
          .gte('sale_date', from)
          .lte('sale_date', to),
        supabase
          .from('commissions')
          .select('status, paid_at')
          .eq('tenant_id', tenantId)
          .eq('user_id', userId)
          .eq('month', month)
          .maybeSingle(),
      ])

      let totalProfit = 0
      let salesCount = 0
      for (const sale of sales ?? []) {
        salesCount++
        for (const item of sale.sale_items ?? []) {
          const cost = (item.inventory?.purchase_price ?? 0) * item.quantity
          const revenue = item.unit_price * item.quantity - (item.discount_amount ?? 0)
          totalProfit += revenue - cost
        }
      }
      const totalCommission = parseFloat((Math.max(0, totalProfit) * COMMISSION_RATE).toFixed(2))
      return {
        month,
        sales_count: salesCount,
        total_profit: parseFloat(totalProfit.toFixed(2)),
        total_commission: totalCommission,
        status: commRow?.status ?? 'pending',
        paid_at: commRow?.paid_at ?? null,
      }
    })
  )

  return { data: results.filter(r => r.sales_count > 0), error: null }
}
