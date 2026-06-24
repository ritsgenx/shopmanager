import { supabase } from './supabase'

export async function getTenantUsers(tenantId) {
  const { data, error } = await supabase
    .from('users')
    .select('id, full_name, role, email')
    .eq('tenant_id', tenantId)
    .order('full_name')
  return { data: data ?? [], error }
}
