import React, { useState, useEffect, useCallback } from 'react'
import { MapPin, Loader2, CheckCircle2, Clock, LogIn, LogOut, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/context/AuthContext'
import { getTodayAttendance, checkIn, checkOut } from '@/lib/attendance'
import { getTenantSettings } from '@/lib/settings'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

const STATUS_STYLES = {
  present: 'text-emerald-400 border-emerald-400/40',
  late:    'text-amber-400 border-amber-400/40',
  absent:  'text-red-400 border-red-400/40',
}

function fmt12(isoStr) {
  if (!isoStr) return '—'
  const d = new Date(isoStr)
  const h = d.getHours()
  const m = d.getMinutes()
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
}

export default function AttendanceWidget() {
  const { currentUser, currentTenant } = useAuth()
  const [record, setRecord] = useState(null)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)

  // Fetch geo config fresh from DB — AuthContext value is loaded at login
  // and may not reflect coordinates the admin set after this session started.
  const [shopLat,   setShopLat]   = useState(null)
  const [shopLng,   setShopLng]   = useState(null)
  const [geoRadius, setGeoRadius] = useState(150)

  const fetchToday = useCallback(async () => {
    if (!currentUser?.id || !currentTenant?.id) return
    setLoading(true)
    const [{ data: att }, { data: tenant, error: tenantError }] = await Promise.all([
      getTodayAttendance(currentUser.id),
      getTenantSettings(currentTenant.id),
    ])
    setRecord(att)
    if (tenantError) console.error('[AttendanceWidget] tenant fetch error:', tenantError)
    // Use fresh DB row; fall back to AuthContext copy if fetch fails (e.g. RLS, network)
    const src = tenant ?? currentTenant
    console.log('[AttendanceWidget] tenant source:', tenant ? 'db-fresh' : 'auth-cached', src)
    if (src) {
      setShopLat(src.shop_lat ?? null)
      setShopLng(src.shop_lng ?? null)
      setGeoRadius(src.geo_fence_radius ?? 150)
    }
    setLoading(false)
  }, [currentUser?.id, currentTenant?.id, currentTenant])

  useEffect(() => { fetchToday() }, [fetchToday])

  const getPosition = () =>
    new Promise((resolve, reject) =>
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      })
    )

  const handleCheckIn = async () => {
    if (!locationReady) {
      toast.error('Shop location not configured. Contact admin.')
      return
    }
    setActing(true)
    try {
      const pos = await getPosition()
      const { latitude: lat, longitude: lng } = pos.coords
      const { data, error } = await checkIn(
        currentUser.id, currentTenant.id, lat, lng, shopLat, shopLng, geoRadius
      )
      if (error) { toast.error(error.message); return }
      setRecord(data)
      toast.success(`Checked in at ${fmt12(data.check_in_time)}`)
    } catch (err) {
      if (err.code === 1) {
        toast.error('Location permission denied. Please allow location access in your browser settings.')
      } else if (err.code === 2) {
        toast.error('Location unavailable. Please check your GPS / network connection.')
      } else {
        toast.error('Could not get your location. Please try again.')
      }
    } finally {
      setActing(false)
    }
  }

  const handleCheckOut = async () => {
    if (!record) return
    if (!locationReady) {
      toast.error('Shop location not configured. Contact admin.')
      return
    }
    setActing(true)
    try {
      const pos = await getPosition()
      const { latitude: lat, longitude: lng } = pos.coords
      const { data, error } = await checkOut(
        record.id, lat, lng, shopLat, shopLng, geoRadius, record.check_in_time
      )
      if (error) { toast.error(error.message); return }
      setRecord(data)
      toast.success(`Checked out at ${fmt12(data.check_out_time)} — ${data.total_hours}h logged`)
    } catch (err) {
      if (err.code === 1) {
        toast.error('Location permission denied. Please allow location access in your browser settings.')
      } else {
        toast.error('Could not get your location. Please try again.')
      }
    } finally {
      setActing(false)
    }
  }

  const locationReady = shopLat != null && shopLng != null
  const checkedIn  = Boolean(record?.check_in_time)
  const checkedOut = Boolean(record?.check_out_time)

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="w-4 h-4 text-indigo-400" />
            Today's Attendance
          </CardTitle>
          {record?.status && (
            <Badge variant="outline" className={`text-xs capitalize ${STATUS_STYLES[record.status] ?? ''}`}>
              {record.status}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading…
          </div>
        ) : (
          <>
            {/* Status display */}
            <div className="grid grid-cols-2 gap-3">
              <div className={`rounded-lg px-3 py-2.5 border ${checkedIn ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-muted/40 border-border'}`}>
                <p className="text-xs text-muted-foreground mb-0.5">Check In</p>
                <p className={`font-semibold text-sm ${checkedIn ? 'text-emerald-400' : 'text-muted-foreground'}`}>
                  {checkedIn ? fmt12(record.check_in_time) : '—'}
                </p>
                {record?.is_geo_verified && (
                  <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    {record.distance_from_shop}m from shop
                  </p>
                )}
              </div>

              <div className={`rounded-lg px-3 py-2.5 border ${checkedOut ? 'bg-blue-500/10 border-blue-500/20' : 'bg-muted/40 border-border'}`}>
                <p className="text-xs text-muted-foreground mb-0.5">Check Out</p>
                <p className={`font-semibold text-sm ${checkedOut ? 'text-blue-400' : 'text-muted-foreground'}`}>
                  {checkedOut ? fmt12(record.check_out_time) : '—'}
                </p>
                {checkedOut && record.total_hours != null && (
                  <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {record.total_hours}h total
                  </p>
                )}
              </div>
            </div>

            {/* Geo-fence notice */}
            {!locationReady && (
              <div className="flex items-start gap-2 text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-lg px-3 py-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                Shop location not configured. Ask admin to set shop_lat/shop_lng in settings.
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-2">
              {!checkedIn && (
                <Button
                  onClick={handleCheckIn}
                  disabled={acting || !locationReady}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {acting
                    ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Getting location…</>
                    : <><LogIn className="w-4 h-4 mr-2" />Check In</>
                  }
                </Button>
              )}

              {checkedIn && !checkedOut && (
                <Button
                  onClick={handleCheckOut}
                  disabled={acting || !locationReady}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {acting
                    ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Getting location…</>
                    : <><LogOut className="w-4 h-4 mr-2" />Check Out</>
                  }
                </Button>
              )}

              {checkedIn && checkedOut && (
                <div className="flex-1 flex items-center gap-2 text-sm text-muted-foreground justify-center py-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Attendance complete for today
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
