import React, { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, RefreshCw, AlertCircle, Check, Clock, X } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/context/AuthContext'
import {
  getAttendanceByUser,
  getAttendanceByTenant,
  getMonthlyAttendanceByTenant,
  overrideAttendance,
  createManualAttendance,
} from '@/lib/attendance'
import { getEmployees } from '@/lib/employees'
import AttendanceWidget from '@/components/employees/AttendanceWidget'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

// ── Helpers ───────────────────────────────────────────────────────────────────
const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

const STATUS_STYLES = {
  present: 'text-emerald-400 border-emerald-400/40 bg-emerald-400/10',
  late:    'text-amber-400  border-amber-400/40  bg-amber-400/10',
  absent:  'text-red-400    border-red-400/40    bg-red-400/10',
}

const STATUS_ICON = {
  present: <Check className="w-3 h-3" />,
  late:    <Clock className="w-3 h-3" />,
  absent:  <X className="w-3 h-3" />,
}

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

const fmt12 = (isoStr) => {
  if (!isoStr) return '—'
  const d = new Date(isoStr)
  const h = d.getHours()
  const m = d.getMinutes()
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate()
}

// ── Override dialog ───────────────────────────────────────────────────────────
function OverrideDialog({ open, onOpenChange, record, userId, tenantId, onSuccess, currentUserId }) {
  const [status, setStatus]   = useState('present')
  const [reason, setReason]   = useState('')
  const [saving, setSaving]   = useState(false)

  useEffect(() => {
    if (open) { setStatus(record?.status ?? 'present'); setReason('') }
  }, [open, record])

  const handleSave = async () => {
    if (!reason.trim()) { toast.error('Override reason is required'); return }
    setSaving(true)

    let result
    if (record?.id) {
      result = await overrideAttendance(record.id, status, reason.trim())
    } else {
      // Create a new manual attendance row for this date
      result = await createManualAttendance(tenantId, userId, record?.date, status, reason.trim())
    }

    setSaving(false)
    if (result.error) { toast.error(result.error.message ?? 'Failed to save'); return }
    toast.success('Attendance updated')
    onSuccess?.()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm w-full">
        <div className="px-6 pt-6 pb-2">
          <DialogHeader>
            <DialogTitle>Override Attendance</DialogTitle>
          </DialogHeader>
        </div>
        <div className="px-6 pb-6 space-y-4">
          <div className="text-xs text-muted-foreground">
            {record?.name && <p className="font-medium text-foreground">{record.name}</p>}
            <p>{fmtDate(record?.date)}</p>
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="present">Present</SelectItem>
                <SelectItem value="late">Late</SelectItem>
                <SelectItem value="absent">Absent</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Override Reason <span className="text-red-400">*</span></Label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Medical leave, official duty…"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">Cancel</Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 bg-indigo-500 hover:bg-indigo-600 text-white"
            >
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── My Attendance view (all users) ───────────────────────────────────────────
function MyAttendanceView({ userId }) {
  const now = new Date()
  const [year, setYear]   = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await getAttendanceByUser(userId, year, month)
    setRecords(data ?? [])
    setLoading(false)
  }, [userId, year, month])

  useEffect(() => { if (userId) load() }, [load])

  const prevMonth = () => { if (month === 1) { setYear((y) => y - 1); setMonth(12) } else setMonth((m) => m - 1) }
  const nextMonth = () => {
    const n = new Date(); if (year > n.getFullYear() || (year === n.getFullYear() && month >= n.getMonth() + 1)) return
    if (month === 12) { setYear((y) => y + 1); setMonth(1) } else setMonth((m) => m + 1)
  }

  const byDate = Object.fromEntries(records.map((r) => [r.attendance_date, r]))
  const totalDays = daysInMonth(year, month)
  const workDays  = Array.from({ length: totalDays }, (_, i) => {
    const d = new Date(year, month - 1, i + 1)
    return d.getDay() !== 0 // exclude Sundays; adjust if needed
  }).filter(Boolean).length

  const summary = {
    present: records.filter((r) => r.status === 'present').length,
    late:    records.filter((r) => r.status === 'late').length,
    absent:  records.filter((r) => r.status === 'absent').length,
    hours:   records.reduce((s, r) => s + (Number(r.total_hours) || 0), 0).toFixed(1),
  }

  return (
    <div className="space-y-4">
      {/* Month nav */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={prevMonth}><ChevronLeft className="w-4 h-4" /></Button>
        <span className="font-semibold">{MONTHS[month - 1]} {year}</span>
        <Button variant="ghost" size="icon" onClick={nextMonth}><ChevronRight className="w-4 h-4" /></Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Present', value: summary.present, color: 'text-emerald-400' },
          { label: 'Late',    value: summary.late,    color: 'text-amber-400' },
          { label: 'Absent',  value: summary.absent,  color: 'text-red-400' },
          { label: 'Hours',   value: summary.hours,   color: 'text-blue-400' },
        ].map(({ label, value, color }) => (
          <Card key={label}>
            <CardContent className="p-3 text-center">
              <p className={`text-xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Day-by-day list */}
      {loading ? (
        <p className="text-sm text-center text-muted-foreground py-6">Loading…</p>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y divide-border max-h-80 overflow-y-auto">
              {Array.from({ length: totalDays }, (_, i) => {
                const day = i + 1
                const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`
                const rec = byDate[dateStr]
                const dow = new Date(year, month - 1, day).getDay()
                const isSunday = dow === 0
                const isFuture = new Date(dateStr) > now

                return (
                  <div key={dateStr} className={`flex items-center justify-between px-4 py-2.5 text-sm ${isSunday ? 'opacity-40' : ''}`}>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-8">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][dow]}</span>
                      <span className="font-medium">{day} {MONTHS[month-1].slice(0,3)}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      {rec ? (
                        <>
                          <Badge variant="outline" className={`text-xs capitalize gap-1 ${STATUS_STYLES[rec.status] ?? ''}`}>
                            {STATUS_ICON[rec.status]}
                            {rec.status}
                          </Badge>
                          <span className="text-muted-foreground">{fmt12(rec.check_in_time)}</span>
                          {rec.check_out_time && <span className="text-muted-foreground">→ {fmt12(rec.check_out_time)}</span>}
                          {rec.total_hours != null && <span className="font-medium">{rec.total_hours}h</span>}
                          {rec.override_reason && <AlertCircle className="w-3.5 h-3.5 text-amber-400" title={`Override: ${rec.override_reason}`} />}
                        </>
                      ) : isSunday ? (
                        <span className="text-muted-foreground">Day Off</span>
                      ) : isFuture ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <Badge variant="outline" className="text-xs text-red-400 border-red-400/40 bg-red-400/10">
                          Absent
                        </Badge>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ── Admin Attendance overview ─────────────────────────────────────────────────
function AdminAttendanceView({ tenantId, currentUserId }) {
  const now = new Date()
  const [year, setYear]   = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [date, setDate]   = useState(now.toISOString().split('T')[0])
  const [tab, setTab]     = useState('daily')

  // Daily state
  const [dailyRecords, setDailyRecords]   = useState([])
  const [employees, setEmployees]         = useState([])
  const [loadingDaily, setLoadingDaily]   = useState(false)

  // Monthly state
  const [monthlyRecords, setMonthlyRecords] = useState([])
  const [loadingMonthly, setLoadingMonthly] = useState(false)

  // Override dialog
  const [overrideOpen, setOverrideOpen] = useState(false)
  const [overrideCtx, setOverrideCtx]   = useState(null)

  const loadDaily = useCallback(async () => {
    setLoadingDaily(true)
    const [{ data: att }, { data: emps }] = await Promise.all([
      getAttendanceByTenant(tenantId, date),
      getEmployees(tenantId),
    ])
    setDailyRecords(att ?? [])
    setEmployees(emps ?? [])
    setLoadingDaily(false)
  }, [tenantId, date])

  const loadMonthly = useCallback(async () => {
    setLoadingMonthly(true)
    const { data } = await getMonthlyAttendanceByTenant(tenantId, year, month)
    setMonthlyRecords(data ?? [])
    setLoadingMonthly(false)
  }, [tenantId, year, month])

  useEffect(() => { if (tab === 'daily') loadDaily() }, [loadDaily, tab])
  useEffect(() => { if (tab === 'monthly') loadMonthly() }, [loadMonthly, tab])

  const prevMonth = () => { if (month === 1) { setYear((y)=>y-1); setMonth(12) } else setMonth((m)=>m-1) }
  const nextMonth = () => {
    if (year > now.getFullYear() || (year === now.getFullYear() && month >= now.getMonth()+1)) return
    if (month === 12) { setYear((y)=>y+1); setMonth(1) } else setMonth((m)=>m+1)
  }

  const openOverride = (employeeId, employeeName, recDate, existing) => {
    setOverrideCtx({ id: existing?.id, userId: employeeId, name: employeeName, date: recDate, status: existing?.status })
    setOverrideOpen(true)
  }

  // Build per-employee monthly summary
  const monthlySummary = (() => {
    const map = {}
    const totalDays = daysInMonth(year, month)
    const workDays = Array.from({ length: totalDays }, (_, i) =>
      new Date(year, month-1, i+1).getDay() !== 0
    ).filter(Boolean).length

    monthlyRecords.forEach((r) => {
      const uid = r.user_id
      if (!map[uid]) map[uid] = { name: r.users?.full_name, present: 0, late: 0, absent: 0, hours: 0 }
      if (r.status === 'present') map[uid].present++
      else if (r.status === 'late') map[uid].late++
      else if (r.status === 'absent') map[uid].absent++
      map[uid].hours += Number(r.total_hours) || 0
    })
    return { rows: Object.entries(map), workDays }
  })()

  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="daily">Daily View</TabsTrigger>
          <TabsTrigger value="monthly">Monthly Summary</TabsTrigger>
        </TabsList>

        {/* ── Daily ── */}
        <TabsContent value="daily" className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <Input
              type="date"
              value={date}
              max={now.toISOString().split('T')[0]}
              onChange={(e) => setDate(e.target.value)}
              className="w-44"
            />
            <Button variant="ghost" size="icon" onClick={loadDaily}><RefreshCw className="w-4 h-4" /></Button>
          </div>

          {loadingDaily ? (
            <p className="text-sm text-center text-muted-foreground py-6">Loading…</p>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground text-xs uppercase">
                        <th className="px-4 py-3 text-left">Employee</th>
                        <th className="px-4 py-3 text-center">Status</th>
                        <th className="px-4 py-3 text-center">Check In</th>
                        <th className="px-4 py-3 text-center">Check Out</th>
                        <th className="px-4 py-3 text-center">Hours</th>
                        <th className="px-4 py-3 text-center">Geo</th>
                        <th className="px-4 py-3 text-center">Override</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {employees.filter((e) => e.is_active).map((emp) => {
                        const rec = dailyRecords.find((r) => r.user_id === emp.id)
                        return (
                          <tr key={emp.id} className="hover:bg-muted/20">
                            <td className="px-4 py-3">
                              <p className="font-medium">{emp.full_name}</p>
                              <p className="text-xs text-muted-foreground capitalize">{emp.role}</p>
                            </td>
                            <td className="px-4 py-3 text-center">
                              {rec ? (
                                <Badge variant="outline" className={`text-xs capitalize ${STATUS_STYLES[rec.status] ?? ''}`}>
                                  {rec.status}
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-xs text-red-400 border-red-400/40 bg-red-400/10">
                                  Absent
                                </Badge>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center text-xs">{fmt12(rec?.check_in_time)}</td>
                            <td className="px-4 py-3 text-center text-xs">{fmt12(rec?.check_out_time)}</td>
                            <td className="px-4 py-3 text-center text-xs">{rec?.total_hours != null ? `${rec.total_hours}h` : '—'}</td>
                            <td className="px-4 py-3 text-center">
                              {rec?.is_geo_verified
                                ? <span className="text-emerald-400 text-xs">✓ {rec.distance_from_shop}m</span>
                                : rec ? <span className="text-amber-400 text-xs">Manual</span>
                                : <span className="text-muted-foreground text-xs">—</span>
                              }
                            </td>
                            <td className="px-4 py-3 text-center">
                              <Button
                                size="sm" variant="ghost"
                                className="text-xs h-7"
                                onClick={() => openOverride(emp.id, emp.full_name, date, rec)}
                              >
                                {rec ? 'Edit' : 'Mark'}
                              </Button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Monthly ── */}
        <TabsContent value="monthly" className="space-y-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={prevMonth}><ChevronLeft className="w-4 h-4" /></Button>
            <span className="font-semibold">{MONTHS[month - 1]} {year}</span>
            <Button variant="ghost" size="icon" onClick={nextMonth}><ChevronRight className="w-4 h-4" /></Button>
          </div>

          {loadingMonthly ? (
            <p className="text-sm text-center text-muted-foreground py-6">Loading…</p>
          ) : monthlySummary.rows.length === 0 ? (
            <p className="text-sm text-center text-muted-foreground py-6">No attendance records for this month</p>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground text-xs uppercase">
                        <th className="px-4 py-3 text-left">Employee</th>
                        <th className="px-4 py-3 text-center">Present</th>
                        <th className="px-4 py-3 text-center">Late</th>
                        <th className="px-4 py-3 text-center">Absent</th>
                        <th className="px-4 py-3 text-center">Attendance %</th>
                        <th className="px-4 py-3 text-center">Total Hours</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {monthlySummary.rows.map(([uid, s]) => {
                        const attended = s.present + s.late
                        const pct = monthlySummary.workDays > 0
                          ? Math.round((attended / monthlySummary.workDays) * 100)
                          : 0
                        return (
                          <tr key={uid} className="hover:bg-muted/20">
                            <td className="px-4 py-3 font-medium">{s.name}</td>
                            <td className="px-4 py-3 text-center text-emerald-400 font-semibold">{s.present}</td>
                            <td className="px-4 py-3 text-center text-amber-400 font-semibold">{s.late}</td>
                            <td className="px-4 py-3 text-center text-red-400 font-semibold">{s.absent}</td>
                            <td className="px-4 py-3 text-center">
                              <span className={`font-semibold ${pct >= 80 ? 'text-emerald-400' : pct >= 60 ? 'text-amber-400' : 'text-red-400'}`}>
                                {pct}%
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center text-muted-foreground">{s.hours.toFixed(1)}h</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <OverrideDialog
        open={overrideOpen}
        onOpenChange={setOverrideOpen}
        record={overrideCtx}
        userId={overrideCtx?.userId}
        tenantId={tenantId}
        currentUserId={currentUserId}
        onSuccess={() => { loadDaily(); loadMonthly() }}
      />
    </div>
  )
}

// ── Main Attendance page ──────────────────────────────────────────────────────
export default function Attendance() {
  const { currentUser, currentTenant } = useAuth()
  const isAdmin = currentUser?.role !== 'employee'

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="p-4 md:p-6 max-w-7xl mx-auto space-y-5"
    >
      <div>
        <h1 className="text-2xl font-bold">Attendance</h1>
        <p className="text-sm text-muted-foreground">
          {isAdmin ? 'Manage staff attendance and view reports' : 'Your attendance records and daily check-in'}
        </p>
      </div>

      {/* Geo-fence check-in widget — always at top */}
      <div className="max-w-sm">
        <AttendanceWidget />
      </div>

      {isAdmin ? (
        <div className="space-y-2">
          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="mine">My Attendance</TabsTrigger>
              <TabsTrigger value="overview">All Staff</TabsTrigger>
            </TabsList>
            <TabsContent value="mine">
              <MyAttendanceView userId={currentUser?.id} />
            </TabsContent>
            <TabsContent value="overview">
              <AdminAttendanceView tenantId={currentTenant?.id} currentUserId={currentUser?.id} />
            </TabsContent>
          </Tabs>
        </div>
      ) : (
        <MyAttendanceView userId={currentUser?.id} />
      )}
    </motion.div>
  )
}
