import { supabase } from './supabase'

function countWorkingDays(year, month) {
  const days = new Date(year, month, 0).getDate()
  let count = 0
  for (let d = 1; d <= days; d++) {
    if (new Date(year, month - 1, d).getDay() !== 0) count++
  }
  return count
}

export async function generateMonthlyCommissions(tenantId, month) {
  const [y, m] = month.split('-').map(Number)
  const daysInMonth = new Date(y, m, 0).getDate()
  const from = `${month}-01`
  const to   = `${month}-${String(daysInMonth).padStart(2, '0')}`
  const workingDays = countWorkingDays(y, m)

  const { data: employees, error: empErr } = await supabase
    .from('users')
    .select('id, full_name')
    .eq('tenant_id', tenantId)
    .eq('role', 'employee')
    .eq('is_active', true)

  if (empErr) return { count: 0, error: empErr }
  if (!employees?.length) return { count: 0, error: null }

  const failed = []
  let processed = 0

  for (const emp of employees) {
    const [
      { data: details },
      { data: salesRows },
      { data: attRows },
    ] = await Promise.all([
      supabase.from('employee_details')
        .select('monthly_salary, commission_type, commission_value, commission_percentage')
        .eq('user_id', emp.id)
        .maybeSingle(),
      supabase.from('sales')
        .select('grand_total')
        .eq('tenant_id', tenantId)
        .eq('employee_id', emp.id)
        .gte('sale_date', from)
        .lte('sale_date', to),
      supabase.from('attendance')
        .select('status')
        .eq('tenant_id', tenantId)
        .eq('user_id', emp.id)
        .gte('attendance_date', from)
        .lte('attendance_date', to)
        .in('status', ['present', 'late', 'half_day']),
    ])

    const totalSalesCount      = salesRows?.length ?? 0
    const totalSalesValue      = salesRows?.reduce((s, r) => s + (r.grand_total ?? 0), 0) ?? 0
    const daysPresent          = attRows?.length ?? 0
    const monthlySalary        = details?.monthly_salary        ?? 0
    const commissionType       = details?.commission_type       ?? 'flat'
    const commissionValue      = details?.commission_value      ?? 0
    const commissionPercentage = details?.commission_percentage ?? 0

    const proratedSalary =
      workingDays > 0
        ? parseFloat(((monthlySalary / workingDays) * daysPresent).toFixed(2))
        : 0

    const grossCommission =
      commissionType === 'percentage'
        ? parseFloat((totalSalesValue * commissionPercentage / 100).toFixed(2))
        : parseFloat((totalSalesCount * commissionValue).toFixed(2))

    const deductions      = 0
    const finalCommission = parseFloat((grossCommission - deductions).toFixed(2))
    const totalPayout     = parseFloat((proratedSalary + finalCommission).toFixed(2))
    const commissionRate  = commissionType === 'percentage' ? commissionPercentage : commissionValue

    const { error: upsertErr } = await supabase
      .from('commissions')
      .upsert({
        tenant_id:         tenantId,
        user_id:           emp.id,
        month,
        total_sales_count: totalSalesCount,
        total_sales_value: totalSalesValue,
        commission_type:   commissionType,
        commission_rate:   commissionRate,
        gross_commission:  grossCommission,
        deductions,
        final_commission:  finalCommission,
        working_days:      workingDays,
        days_present:      daysPresent,
        monthly_salary:    monthlySalary,
        prorated_salary:   proratedSalary,
        total_payout:      totalPayout,
        status:            'pending',
        updated_at:        new Date().toISOString(),
      }, { onConflict: 'tenant_id,user_id,month' })

    if (upsertErr) failed.push(emp.full_name)
    else processed++
  }

  return {
    count: processed,
    error: failed.length ? { message: `Failed for: ${failed.join(', ')}` } : null,
  }
}

export async function getCommissions(tenantId, month) {
  const { data, error } = await supabase
    .from('commissions')
    .select('*, users(full_name, phone)')
    .eq('tenant_id', tenantId)
    .eq('month', month)
    .order('total_payout', { ascending: false })
  return { data: data ?? [], error }
}

export async function approveCommission(id, approvedByUserId) {
  const { data, error } = await supabase
    .from('commissions')
    .update({
      status:      'approved',
      approved_by: approvedByUserId,
      approved_at: new Date().toISOString(),
      updated_at:  new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .maybeSingle()
  return { data, error }
}

export async function markCommissionPaid(id) {
  const { data, error } = await supabase
    .from('commissions')
    .update({
      status:     'paid',
      paid_at:    new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .maybeSingle()
  return { data, error }
}

export async function getMyCommissions(userId) {
  const { data, error } = await supabase
    .from('commissions')
    .select('*')
    .eq('user_id', userId)
    .order('month', { ascending: false })
    .limit(12)
  return { data: data ?? [], error }
}
