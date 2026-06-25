import { supabase } from './supabase'

export async function getCustomers(tenantId, { customerType, searchTerm, page = 1, pageSize = 50 } = {}) {
  const from = (page - 1) * pageSize
  const to   = from + pageSize - 1

  let query = supabase
    .from('customers')
    .select('*', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('last_visit_date', { ascending: false, nullsFirst: false })
    .range(from, to)

  if (customerType && customerType !== 'all') {
    query = query.eq('customer_type', customerType)
  }

  if (searchTerm?.trim()) {
    query = query.or(
      `full_name.ilike.%${searchTerm}%,company_name.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%`
    )
  }

  const { data, error, count } = await query
  return { data: data ?? [], error, count: count ?? 0 }
}

// Lightweight query for the birthday widget — only fetches customers with a DOB set
export async function getBirthdayCustomers(tenantId) {
  const { data, error } = await supabase
    .from('customers')
    .select('id, full_name, date_of_birth')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .eq('customer_type', 'individual')
    .not('date_of_birth', 'is', null)
    .limit(500)
  return { data: data ?? [], error }
}

export async function getCustomerByPhone(tenantId, phone) {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('phone', phone)
    .eq('is_active', true)
    .maybeSingle()
  return { data, error }
}

export async function getCustomerById(tenantId, id) {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .single()
  return { data, error }
}

export async function createCustomer(customerData) {
  const { data, error } = await supabase
    .from('customers')
    .insert(customerData)
    .select()
    .single()
  return { data, error }
}

export async function updateCustomer(tenantId, id, customerData) {
  const { data, error } = await supabase
    .from('customers')
    .update({ ...customerData, updated_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .select()
    .single()
  return { data, error }
}

export async function deleteCustomer(tenantId, id) {
  const { error } = await supabase
    .from('customers')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('id', id)
  return { error }
}
