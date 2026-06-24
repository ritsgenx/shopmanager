import { supabase } from './supabase'

export async function getTenantSettings(tenantId) {
  const { data, error } = await supabase
    .from('tenants')
    .select('*')
    .eq('id', tenantId)
    .maybeSingle()
  return { data, error }
}

export async function updateTenantSettings(tenantId, updates) {
  const { data, error } = await supabase
    .from('tenants')
    .update(updates)
    .eq('id', tenantId)
    .select('id')
  if (!error && (!data || data.length === 0)) {
    return { error: { message: 'Settings not saved — RLS policy may be blocking this update. Run the tenant_admin_update policy in Supabase SQL Editor.' } }
  }
  return { error }
}

// Uploads a logo file to Supabase Storage bucket "logos".
// The bucket must exist and be set to PUBLIC in the Supabase dashboard.
export async function uploadLogo(tenantId, file) {
  const ext  = file.name.split('.').pop().toLowerCase()
  const path = `${tenantId}/logo.${ext}`

  const { error } = await supabase.storage
    .from('logos')
    .upload(path, file, { upsert: true, contentType: file.type })

  if (error) return { url: null, error }

  const { data: urlData } = supabase.storage
    .from('logos')
    .getPublicUrl(path)

  // Bust cache by appending a timestamp query param
  return { url: `${urlData.publicUrl}?t=${Date.now()}`, error: null }
}
