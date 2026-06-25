import { supabase } from './supabase'

export async function getEmployees(tenantId) {
  const { data, error } = await supabase
    .from('users')
    .select(`
      id, tenant_id, full_name, email, phone, role,
      date_of_joining, is_active, created_at,
      employee_details ( monthly_salary, commission_type )
    `)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
  return { data: data ?? [], error }
}

export async function getEmployeeById(tenantId, id) {
  const { data, error } = await supabase
    .from('users')
    .select(`*, employee_details(*), employee_permissions(*)`)
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .single()
  return { data, error }
}

export async function createEmployee(profileData, detailsData, permissionsData) {
  // Save the current admin session so we can restore it if signUp() displaces it.
  // (This happens when Supabase "Confirm Email" is disabled — signUp creates an
  //  active session for the new user, replacing the admin's session.)
  const { data: { session: adminSession } } = await supabase.auth.getSession()

  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: profileData.email,
    password: profileData.temp_password,
    options: { data: { full_name: profileData.full_name } },
  })
  if (authError) return { error: authError }

  const userId = authData.user?.id
  if (!userId) return { error: { message: 'Could not obtain auth user ID from Supabase.' } }

  // Restore admin session if it was displaced (confirmation disabled case)
  if (authData.session && adminSession) {
    await supabase.auth.setSession({
      access_token: adminSession.access_token,
      refresh_token: adminSession.refresh_token,
    })
  }

  const { error: profileError } = await supabase.from('users').insert({
    id: userId,
    tenant_id: profileData.tenant_id,
    full_name: profileData.full_name,
    email: profileData.email,
    phone: profileData.phone || null,
    address: profileData.address || null,
    role: profileData.role || 'employee',
    date_of_birth: profileData.date_of_birth || null,
    date_of_joining: profileData.date_of_joining || null,
    is_active: true,
  })
  if (profileError) return { error: profileError }

  const { error: detailsError } = await supabase.from('employee_details').insert({
    tenant_id: profileData.tenant_id,
    user_id: userId,
    monthly_salary: detailsData.monthly_salary || null,
    commission_type: detailsData.commission_type || null,
    commission_value: detailsData.commission_value || null,
    commission_percentage: detailsData.commission_percentage || null,
    bank_name: detailsData.bank_name || null,
    bank_account: detailsData.bank_account || null,
    bank_ifsc: detailsData.bank_ifsc || null,
    emergency_contact: detailsData.emergency_contact || null,
    id_proof_type: detailsData.id_proof_type || null,
    id_proof_number: detailsData.id_proof_number || null,
  })
  if (detailsError) return { error: detailsError }

  const { error: permError } = await supabase.from('employee_permissions').insert({
    tenant_id: profileData.tenant_id,
    user_id: userId,
    ...permissionsData,
  })
  if (permError) return { error: permError }

  return { data: { userId }, error: null }
}

export async function updateEmployee(userId, tenantId, profileData, detailsData, permissionsData) {
  const { error: profileError } = await supabase
    .from('users')
    .update({
      full_name: profileData.full_name,
      phone: profileData.phone || null,
      address: profileData.address || null,
      role: profileData.role,
      date_of_birth: profileData.date_of_birth || null,
      date_of_joining: profileData.date_of_joining || null,
      updated_at: new Date().toISOString(),
    })
    .eq('tenant_id', tenantId)
    .eq('id', userId)
  if (profileError) return { error: profileError }

  const { error: detailsError } = await supabase.from('employee_details').upsert(
    {
      user_id: userId,
      tenant_id: tenantId,
      monthly_salary: detailsData.monthly_salary || null,
      commission_type: detailsData.commission_type || null,
      commission_value: detailsData.commission_value || null,
      commission_percentage: detailsData.commission_percentage || null,
      bank_name: detailsData.bank_name || null,
      bank_account: detailsData.bank_account || null,
      bank_ifsc: detailsData.bank_ifsc || null,
      emergency_contact: detailsData.emergency_contact || null,
      id_proof_type: detailsData.id_proof_type || null,
      id_proof_number: detailsData.id_proof_number || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  )
  if (detailsError) return { error: detailsError }

  const { error: permError } = await supabase.from('employee_permissions').upsert(
    {
      user_id: userId,
      tenant_id: tenantId,
      ...permissionsData,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  )
  if (permError) return { error: permError }

  return { error: null }
}

export async function updatePermissions(userId, tenantId, permissionsData) {
  const { error } = await supabase.from('employee_permissions').upsert(
    { user_id: userId, tenant_id: tenantId, ...permissionsData, updated_at: new Date().toISOString() },
    { onConflict: 'user_id' }
  )
  return { error }
}

export async function deactivateEmployee(tenantId, id) {
  const { error } = await supabase
    .from('users')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('id', id)
  return { error }
}

export async function reactivateEmployee(tenantId, id) {
  const { error } = await supabase
    .from('users')
    .update({ is_active: true, updated_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('id', id)
  return { error }
}
