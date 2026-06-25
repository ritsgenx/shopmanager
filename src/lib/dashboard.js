import { supabase } from './supabase'

function todayDate() {
  return new Date().toISOString().split('T')[0]
}

function monthRange(offset = 0) {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth() + offset
  const start = new Date(y, m, 1).toISOString().split('T')[0]
  const end = new Date(y, m + 1, 0).toISOString().split('T')[0]
  return { start, end }
}

export async function getDashboardStats(tenantId) {
  const today = todayDate()
  const thisMonth = monthRange(0)
  const lastMonth = monthRange(-1)

  const [
    { data: todaySalesData },
    { data: thisMonthSalesData },
    { data: lastMonthSalesData },
    { data: thisMonthExpensesData },
    { count: totalCustomers },
    { count: newCustomersCount },
    { data: topBuyerData },
    { count: totalInventory },
    { count: lowStockCount },
  ] = await Promise.all([
    supabase.from('sales').select('id, grand_total').eq('tenant_id', tenantId).eq('sale_date', today),
    supabase.from('sales').select('grand_total').eq('tenant_id', tenantId).gte('sale_date', thisMonth.start).lte('sale_date', thisMonth.end),
    supabase.from('sales').select('grand_total').eq('tenant_id', tenantId).gte('sale_date', lastMonth.start).lte('sale_date', lastMonth.end),
    supabase.from('purchases').select('grand_total').eq('tenant_id', tenantId).gte('created_at', thisMonth.start + 'T00:00:00').lte('created_at', thisMonth.end + 'T23:59:59'),
    supabase.from('customers').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId),
    supabase.from('customers').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).gte('created_at', thisMonth.start + 'T00:00:00'),
    supabase.from('customers').select('full_name, total_purchases').eq('tenant_id', tenantId).order('total_purchases', { ascending: false }).limit(1),
    supabase.from('inventory').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId),
    supabase.from('inventory').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).in('status', ['low_stock', 'sold']),
  ])

  const todayRevenue = (todaySalesData ?? []).reduce((s, r) => s + (r.grand_total || 0), 0)
  const thisMonthRevenue = (thisMonthSalesData ?? []).reduce((s, r) => s + (r.grand_total || 0), 0)
  const lastMonthRevenue = (lastMonthSalesData ?? []).reduce((s, r) => s + (r.grand_total || 0), 0)
  const thisMonthExpenses = (thisMonthExpensesData ?? []).reduce((s, r) => s + (r.grand_total || 0), 0)
  const revenueChange = lastMonthRevenue > 0
    ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
    : 0

  return {
    today: { revenue: todayRevenue, count: (todaySalesData ?? []).length },
    monthly: { revenue: thisMonthRevenue, lastRevenue: lastMonthRevenue, change: revenueChange },
    cashFlow: { income: thisMonthRevenue, expenses: thisMonthExpenses, net: thisMonthRevenue - thisMonthExpenses },
    customers: { total: totalCustomers ?? 0, newThisMonth: newCustomersCount ?? 0, topBuyer: topBuyerData?.[0] ?? null },
    inventory: { total: totalInventory ?? 0, lowStock: lowStockCount ?? 0 },
  }
}

export async function getRevenueChart(tenantId) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    return d.toISOString().split('T')[0]
  })

  const { data } = await supabase
    .from('sales')
    .select('sale_date, grand_total')
    .eq('tenant_id', tenantId)
    .gte('sale_date', days[0])
    .lte('sale_date', days[6])

  const byDay = Object.fromEntries(days.map(d => [d, 0]))
  for (const sale of data ?? []) {
    if (byDay[sale.sale_date] !== undefined) byDay[sale.sale_date] += sale.grand_total || 0
  }

  return days.map(d => ({
    date: d,
    label: new Date(d + 'T12:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' }),
    revenue: Math.round(byDay[d]),
  }))
}

export async function getLowStockItems(tenantId, limit = 8) {
  const { data } = await supabase
    .from('inventory')
    .select('id, quantity, quantity_sold, status, products(brand, model, variant, color)')
    .eq('tenant_id', tenantId)
    .in('status', ['low_stock', 'sold'])
    .order('status', { ascending: true })
    .limit(limit)
  return data ?? []
}

export async function getEmployeeLeaderboard(tenantId) {
  const { start, end } = monthRange(0)
  const { data: sales } = await supabase
    .from('sales')
    .select('employee_id, grand_total')
    .eq('tenant_id', tenantId)
    .gte('sale_date', start)
    .lte('sale_date', end)
    .not('employee_id', 'is', null)

  if (!sales?.length) return []

  const map = {}
  for (const s of sales) {
    if (!map[s.employee_id]) map[s.employee_id] = { id: s.employee_id, total: 0, count: 0 }
    map[s.employee_id].total += s.grand_total || 0
    map[s.employee_id].count++
  }

  const top3 = Object.values(map).sort((a, b) => b.total - a.total).slice(0, 3)
  const { data: users } = await supabase
    .from('users')
    .select('id, full_name')
    .in('id', top3.map(e => e.id))

  const nameMap = Object.fromEntries((users ?? []).map(u => [u.id, u.full_name]))
  return top3.map((e, i) => ({ rank: i + 1, name: nameMap[e.id] ?? 'Unknown', total: Math.round(e.total), count: e.count }))
}

export async function getRecentActivity(tenantId, limit = 8) {
  const [{ data: sales }, { data: purchases }] = await Promise.all([
    supabase.from('sales').select('id, invoice_number, grand_total, created_at, customers(full_name), users!employee_id(full_name)').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(limit),
    supabase.from('purchases').select('id, reference_number, grand_total, created_at').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(limit),
  ])

  const events = [
    ...(sales ?? []).map(s => ({ id: `s-${s.id}`, type: 'sale', label: s.invoice_number, sub: s.customers?.full_name ?? '—', salesman: s.users?.full_name ?? null, amount: s.grand_total, at: s.created_at })),
    ...(purchases ?? []).map(p => ({ id: `p-${p.id}`, type: 'purchase', label: p.reference_number ?? 'Purchase', sub: 'Stock Purchase', salesman: null, amount: p.grand_total, at: p.created_at })),
  ]

  return events.sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, limit)
}

// ─── Employee-specific functions ─────────────────────────────────────────────

export async function getMyStats(tenantId, employeeId) {
  const today = todayDate()
  const thisMonth = monthRange(0)
  const lastMonth = monthRange(-1)

  const [
    { data: todaySales },
    { data: thisMonthSales },
    { data: lastMonthSales },
  ] = await Promise.all([
    supabase.from('sales').select('id, grand_total').eq('tenant_id', tenantId).eq('employee_id', employeeId).eq('sale_date', today),
    supabase.from('sales').select('grand_total').eq('tenant_id', tenantId).eq('employee_id', employeeId).gte('sale_date', thisMonth.start).lte('sale_date', thisMonth.end),
    supabase.from('sales').select('grand_total').eq('tenant_id', tenantId).eq('employee_id', employeeId).gte('sale_date', lastMonth.start).lte('sale_date', lastMonth.end),
  ])

  const todayRevenue = (todaySales ?? []).reduce((s, r) => s + (r.grand_total || 0), 0)
  const thisMonthRevenue = (thisMonthSales ?? []).reduce((s, r) => s + (r.grand_total || 0), 0)
  const lastMonthRevenue = (lastMonthSales ?? []).reduce((s, r) => s + (r.grand_total || 0), 0)
  const change = lastMonthRevenue > 0 ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100 : 0

  return {
    today: { revenue: todayRevenue, count: (todaySales ?? []).length },
    monthly: { revenue: thisMonthRevenue, lastRevenue: lastMonthRevenue, change },
  }
}

export async function getMyCommission(tenantId, employeeId) {
  const now = new Date()
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const { start, end } = monthRange(0)

  const [{ data: sales }, { data: commRow }] = await Promise.all([
    supabase.from('sales')
      .select('id, sale_items(quantity, unit_price, discount_amount, inventory(purchase_price))')
      .eq('tenant_id', tenantId)
      .eq('employee_id', employeeId)
      .gte('sale_date', start)
      .lte('sale_date', end),
    supabase.from('commissions')
      .select('status, paid_at')
      .eq('tenant_id', tenantId)
      .eq('user_id', employeeId)
      .eq('month', month)
      .maybeSingle(),
  ])

  let totalProfit = 0
  for (const sale of sales ?? []) {
    for (const item of sale.sale_items ?? []) {
      const cost = (item.inventory?.purchase_price ?? 0) * item.quantity
      const revenue = item.unit_price * item.quantity - (item.discount_amount ?? 0)
      totalProfit += revenue - cost
    }
  }

  return {
    amount: parseFloat((Math.max(0, totalProfit) * 0.20).toFixed(2)),
    profit: parseFloat(totalProfit.toFixed(2)),
    status: commRow?.status ?? 'pending',
    paid_at: commRow?.paid_at ?? null,
  }
}

export async function getMyAttendance(tenantId, employeeId) {
  const today = todayDate()
  const { start, end } = monthRange(0)

  const { data } = await supabase
    .from('attendance')
    .select('attendance_date, status, check_in_time, check_out_time, total_hours')
    .eq('tenant_id', tenantId)
    .eq('user_id', employeeId)
    .gte('attendance_date', start)
    .lte('attendance_date', end)
    .order('attendance_date', { ascending: true })

  const records = data ?? []
  const todayRecord = records.find(r => r.attendance_date === today) ?? null
  return {
    present: records.filter(r => r.status === 'present').length,
    late: records.filter(r => r.status === 'late').length,
    totalDays: records.length,
    today: todayRecord,
  }
}

export async function getMySales(tenantId, employeeId, limit = 8) {
  const { data } = await supabase
    .from('sales')
    .select('id, invoice_number, grand_total, sale_date, payment_method, payment_status, customers(full_name, company_name, customer_type)')
    .eq('tenant_id', tenantId)
    .eq('employee_id', employeeId)
    .order('created_at', { ascending: false })
    .limit(limit)
  return data ?? []
}

export async function getMyRevenueChart(tenantId, employeeId) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    return d.toISOString().split('T')[0]
  })

  const { data } = await supabase
    .from('sales')
    .select('sale_date, grand_total')
    .eq('tenant_id', tenantId)
    .eq('employee_id', employeeId)
    .gte('sale_date', days[0])
    .lte('sale_date', days[6])

  const byDay = Object.fromEntries(days.map(d => [d, 0]))
  for (const sale of data ?? []) {
    if (byDay[sale.sale_date] !== undefined) byDay[sale.sale_date] += sale.grand_total || 0
  }

  return days.map(d => ({
    date: d,
    label: new Date(d + 'T12:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' }),
    revenue: Math.round(byDay[d]),
  }))
}

export async function getDashboardSettings(tenantId) {
  const { data } = await supabase.from('tenants').select('settings').eq('id', tenantId).single()
  return data?.settings?.dashboard ?? {}
}

export async function saveDashboardSettings(tenantId, widgetSettings) {
  const { data: current } = await supabase.from('tenants').select('settings').eq('id', tenantId).single()
  const merged = { ...(current?.settings ?? {}), dashboard: widgetSettings }
  const { error } = await supabase.from('tenants').update({ settings: merged }).eq('id', tenantId)
  return { error }
}
