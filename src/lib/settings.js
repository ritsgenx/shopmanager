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

// ── Low-stock threshold ──────────────────────────────────────────────────────
// THE single definition of "low stock" across the app: a model is low when
// its total remaining units are ≤ this number (and "out of stock" at zero).
// Stored per tenant in the tenants.settings jsonb, owner-editable in Settings.
export const DEFAULT_LOW_STOCK_THRESHOLD = 3

export async function getLowStockThreshold(tenantId) {
  const { data } = await supabase
    .from('tenants')
    .select('settings')
    .eq('id', tenantId)
    .maybeSingle()
  const v = Number(data?.settings?.low_stock_threshold)
  return Number.isFinite(v) && v > 0 ? v : DEFAULT_LOW_STOCK_THRESHOLD
}

export async function saveLowStockThreshold(tenantId, value) {
  const { data: current } = await supabase
    .from('tenants')
    .select('settings')
    .eq('id', tenantId)
    .maybeSingle()
  const merged = { ...(current?.settings ?? {}), low_stock_threshold: Number(value) }
  const { error } = await supabase.from('tenants').update({ settings: merged }).eq('id', tenantId)
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
