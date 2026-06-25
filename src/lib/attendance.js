import { supabase } from './supabase'

// Haversine formula — returns distance in whole metres
export function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)))
}

function deriveStatus(isoTime) {
  const d = new Date(isoTime)
  const h = d.getHours()
  const m = d.getMinutes()
  return h < 10 || (h === 10 && m <= 30) ? 'present' : 'late'
}

export async function getTodayAttendance(tenantId, userId) {
  const today = new Date().toISOString().split('T')[0]
  const { data, error } = await supabase
    .from('attendance')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .eq('attendance_date', today)
    .maybeSingle()
  return { data, error }
}

export async function checkIn(userId, tenantId, lat, lng, shopLat, shopLng, geoRadius) {
  const distance = calculateDistance(lat, lng, shopLat, shopLng)
  if (distance > geoRadius) {
    return {
      error: {
        message: `You are ${distance}m away from the shop. Check in within ${geoRadius}m of the shop.`,
      },
    }
  }

  const now = new Date()
  const checkInTime = now.toISOString()
  const today = now.toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('attendance')
    .insert({
      tenant_id: tenantId,
      user_id: userId,
      attendance_date: today,
      check_in_time: checkInTime,
      check_in_lat: lat,
      check_in_lng: lng,
      distance_from_shop: distance,
      status: deriveStatus(checkInTime),
      is_geo_verified: true,
    })
    .select()
    .single()
  return { data, error }
}

export async function checkOut(tenantId, attendanceId, lat, lng, shopLat, shopLng, geoRadius, checkInTime) {
  const distance = calculateDistance(lat, lng, shopLat, shopLng)
  if (distance > geoRadius) {
    return {
      error: {
        message: `You are ${distance}m away from the shop. Check out within ${geoRadius}m of the shop.`,
      },
    }
  }

  const now = new Date()
  const checkOutTime = now.toISOString()
  const totalSecs = (now - new Date(checkInTime)) / 1000
  const totalHours = parseFloat(Math.max(0, totalSecs / 3600).toFixed(2))

  const { data, error } = await supabase
    .from('attendance')
    .update({ check_out_time: checkOutTime, check_out_lat: lat, check_out_lng: lng, total_hours: totalHours })
    .eq('tenant_id', tenantId)
    .eq('id', attendanceId)
    .select()
    .maybeSingle()
  return { data, error }
}

export async function getAttendanceByUser(tenantId, userId, year, month) {
  const pad = (n) => String(n).padStart(2, '0')
  const from = `${year}-${pad(month)}-01`
  const to = `${year}-${pad(month)}-${new Date(year, month, 0).getDate()}`
  const { data, error } = await supabase
    .from('attendance')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .gte('attendance_date', from)
    .lte('attendance_date', to)
    .order('attendance_date', { ascending: true })
  return { data: data ?? [], error }
}

export async function getAttendanceByTenant(tenantId, date) {
  const { data, error } = await supabase
    .from('attendance')
    .select(`*, users(full_name, phone, role)`)
    .eq('tenant_id', tenantId)
    .eq('attendance_date', date)
    .order('check_in_time', { ascending: true, nullsFirst: false })
  return { data: data ?? [], error }
}

export async function getMonthlyAttendanceByTenant(tenantId, year, month) {
  const pad = (n) => String(n).padStart(2, '0')
  const from = `${year}-${pad(month)}-01`
  const to = `${year}-${pad(month)}-${new Date(year, month, 0).getDate()}`
  const { data, error } = await supabase
    .from('attendance')
    .select(`*, users(id, full_name, role)`)
    .eq('tenant_id', tenantId)
    .gte('attendance_date', from)
    .lte('attendance_date', to)
    .order('attendance_date', { ascending: true })
  return { data: data ?? [], error }
}

export async function overrideAttendance(tenantId, attendanceId, status, overrideReason) {
  const { data, error } = await supabase
    .from('attendance')
    .update({ status, override_reason: overrideReason })
    .eq('tenant_id', tenantId)
    .eq('id', attendanceId)
    .select()
    .maybeSingle()
  return { data, error }
}

export async function createManualAttendance(tenantId, userId, date, status, overrideReason) {
  const { data, error } = await supabase
    .from('attendance')
    .insert({
      tenant_id: tenantId,
      user_id: userId,
      attendance_date: date,
      status,
      is_geo_verified: false,
      override_reason: overrideReason,
    })
    .select()
    .single()
  return { data, error }
}
