import { supabase } from './supabase'

export async function getCustomers(tenantId, { customerType, searchTerm } = {}) {
  let query = supabase
    .from('customers')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (customerType && customerType !== 'all') {
    query = query.eq('customer_type', customerType)
  }

  if (searchTerm) {
    query = query.or(
      `full_name.ilike.%${searchTerm}%,company_name.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%`
    )
  }

  const { data, error } = await query
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

export async function getCustomerById(id) {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
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

export async function updateCustomer(id, customerData) {
  const { data, error } = await supabase
    .from('customers')
    .update({ ...customerData, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  return { data, error }
}

export async function deleteCustomer(id) {
  const { error } = await supabase
    .from('customers')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id)
  return { error }
}
