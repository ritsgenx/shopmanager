import { supabase } from './supabase'

export async function getAllTenants() {
  const { data, error } = await supabase
    .from('tenants')
    .select('id, shop_name, owner_name, owner_email, owner_phone, plan, is_active, subscription_expires_at, created_at')
    .order('created_at', { ascending: false })
  return { data: data ?? [], error }
}

function generateSubdomain(shopName) {
  const base = shopName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const suffix = Math.random().toString(36).slice(2, 6)
  return `${base}-${suffix}`
}

export async function onboardTenant({ shopName, ownerName, ownerEmail, tempPassword, plan, subscriptionExpiresAt }) {
  const { data: { session: superAdminSession } } = await supabase.auth.getSession()

  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: ownerEmail,
    password: tempPassword,
    options: {
      data: { full_name: ownerName },
      emailRedirectTo: `${window.location.origin}/auth/callback`,
    },
  })
  if (authError) return { error: authError }

  const ownerId = authData.user?.id
  if (!ownerId) return { error: { message: 'Failed to create auth account.' } }

  // Restore super_admin session if signUp created a new session (email confirm disabled)
  if (authData.session && superAdminSession) {
    await supabase.auth.setSession({
      access_token: superAdminSession.access_token,
      refresh_token: superAdminSession.refresh_token,
    })
  }

  const { data: tenantData, error: tenantError } = await supabase
    .from('tenants')
    .insert({
      shop_name: shopName,
      owner_name: ownerName,
      owner_email: ownerEmail,
      subdomain: generateSubdomain(shopName),
      plan: plan || 'basic',
      is_active: true,
      subscription_expires_at: subscriptionExpiresAt || null,
    })
    .select('id')
    .single()
  if (tenantError) return { error: tenantError }

  const { error: profileError } = await supabase.from('users').insert({
    id: ownerId,
    tenant_id: tenantData.id,
    full_name: ownerName,
    email: ownerEmail,
    role: 'admin',
    is_active: true,
  })
  if (profileError) return { error: profileError }

  return { data: { tenantId: tenantData.id, ownerId }, error: null }
}

export async function setTenantActive(tenantId, isActive) {
  const { error } = await supabase
    .from('tenants')
    .update({ is_active: isActive })
    .eq('id', tenantId)
  return { error }
}

export async function updateTenantSubscription(tenantId, { plan, subscriptionExpiresAt }) {
  const { error } = await supabase
    .from('tenants')
    .update({ plan, subscription_expires_at: subscriptionExpiresAt || null })
    .eq('id', tenantId)
  return { error }
}
