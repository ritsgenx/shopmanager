import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Plus, Search, UserCheck, UserX, Edit2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/context/AuthContext'
import {
  getEmployees, getEmployeeById,
  deactivateEmployee, reactivateEmployee, updatePermissions,
} from '@/lib/employees'
import { getAttendanceByUser } from '@/lib/attendance'
import EmployeeFormDialog from '@/components/employees/EmployeeFormDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
const fmtCurrency = (n) => (n != null ? `₹${Number(n).toLocaleString('en-IN')}` : '—')
const fmt12 = (isoStr) => {
  if (!isoStr) return '—'
  const d = new Date(isoStr)
  const h = d.getHours()
  const m = d.getMinutes()
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

const ROLE_BADGE = {
  admin:    'text-purple-400 border-purple-400/40',
  manager:  'text-blue-400 border-blue-400/40',
  employee: 'text-slate-400 border-slate-400/40',
  owner:    'text-amber-400 border-amber-400/40',
}

const STATUS_BADGE = {
  present: 'text-emerald-400 border-emerald-400/40',
  late:    'text-amber-400 border-amber-400/40',
  absent:  'text-red-400 border-red-400/40',
}

const PERM_GROUPS = [
  { label: 'Sales', perms: [
    { key: 'can_create_sale',      label: 'Create Sales' },
    { key: 'can_apply_discount',   label: 'Apply Discounts' },
    { key: 'can_view_all_sales',   label: 'View All Sales' },
    { key: 'can_delete_sale',      label: 'Delete Sales' },
    { key: 'can_generate_invoice', label: 'Generate Invoice' },
  ]},
  { label: 'Inventory', perms: [
    { key: 'can_access_purchases',    label: 'Access Purchases' },
    { key: 'can_add_stock',           label: 'Add Stock' },
    { key: 'can_edit_stock',          label: 'Edit Stock' },
    { key: 'can_view_purchase_price', label: 'View Purchase Price' },
  ]},
  { label: 'Customers', perms: [
    { key: 'can_add_customer',    label: 'Add Customers' },
    { key: 'can_edit_customer',   label: 'Edit Customers' },
    { key: 'can_delete_customer', label: 'Delete Customers' },
  ]},
  { label: 'Communication', perms: [
    { key: 'can_send_whatsapp', label: 'Send WhatsApp' },
    { key: 'can_send_sms',      label: 'Send SMS' },
  ]},
  { label: 'Reports & Attendance', perms: [
    { key: 'can_view_reports',    label: 'View Reports' },
    { key: 'can_view_attendance', label: 'View Attendance' },
  ]},
]
const ALL_PERM_KEYS = PERM_GROUPS.flatMap((g) => g.perms.map((p) => p.key))

// ── Employee detail dialog ────────────────────────────────────────────────────
function EmployeeDetailDialog({ employeeId, open, onOpenChange, onEdit, onStatusChange, tenantId }) {
  const [emp, setEmp] = useState(null)
  const [loading, setLoading] = useState(true)
  const [attendance, setAttendance] = useState([])
  const [perms, setPerms] = useState({})
  const [savingPerms, setSavingPerms] = useState(false)
  const [toggling, setToggling] = useState(false)

  const now = new Date()

  const load = useCallback(async () => {
    if (!employeeId) return
    setLoading(true)
    const [{ data: empData }, { data: attData }] = await Promise.all([
      getEmployeeById(tenantId, employeeId),
      getAttendanceByUser(tenantId, employeeId, now.getFullYear(), now.getMonth() + 1),
    ])
    if (empData) {
      setEmp(empData)
      const p = empData.employee_permissions ?? {}
      setPerms(ALL_PERM_KEYS.reduce((acc, k) => ({ ...acc, [k]: Boolean(p[k]) }), {}))
    }
    setAttendance(attData ?? [])
    setLoading(false)
  }, [employeeId])

  useEffect(() => { if (open) load() }, [open, load])

  const handleSavePerms = async () => {
    setSavingPerms(true)
    const { error } = await updatePermissions(employeeId, tenantId, perms)
    setSavingPerms(false)
    if (error) { toast.error(error.message ?? 'Failed to save permissions'); return }
    toast.success('Permissions updated')
  }

  const handleToggleActive = async () => {
    if (!emp) return
    setToggling(true)
    const fn = emp.is_active ? deactivateEmployee : reactivateEmployee
    const { error } = await fn(tenantId, employeeId)
    setToggling(false)
    if (error) { toast.error(error.message ?? 'Action failed'); return }
    toast.success(emp.is_active ? 'Employee deactivated' : 'Employee reactivated')
    onStatusChange?.()
    load()
  }

  const d = emp?.employee_details ?? {}

  const attSummary = {
    present: attendance.filter((a) => a.status === 'present').length,
    late:    attendance.filter((a) => a.status === 'late').length,
    absent:  attendance.filter((a) => a.status === 'absent').length,
    hours:   attendance.reduce((s, a) => s + (Number(a.total_hours) || 0), 0).toFixed(1),
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-full max-h-[90vh] overflow-y-auto" onInteractOutside={(e) => e.preventDefault()}>
        {loading || !emp ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">Loading…</div>
        ) : (
          <>
            <div className="px-6 pt-6 pb-3">
              <DialogHeader>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <DialogTitle className="text-xl">{emp.full_name}</DialogTitle>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge variant="outline" className={`text-xs capitalize ${ROLE_BADGE[emp.role] ?? ''}`}>
                        {emp.role}
                      </Badge>
                      <Badge variant="outline" className={`text-xs ${emp.is_active ? 'text-emerald-400 border-emerald-400/40' : 'text-red-400 border-red-400/40'}`}>
                        {emp.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => { onOpenChange(false); onEdit(emp) }}>
                      <Edit2 className="w-3.5 h-3.5 mr-1" />Edit
                    </Button>
                    <Button
                      size="sm" variant="outline" disabled={toggling}
                      className={emp.is_active
                        ? 'text-red-400 border-red-400/40 hover:bg-red-400/10'
                        : 'text-emerald-400 border-emerald-400/40 hover:bg-emerald-400/10'}
                      onClick={handleToggleActive}
                    >
                      {emp.is_active
                        ? <><UserX className="w-3.5 h-3.5 mr-1" />Deactivate</>
                        : <><UserCheck className="w-3.5 h-3.5 mr-1" />Reactivate</>}
                    </Button>
                  </div>
                </div>
              </DialogHeader>
            </div>

            <div className="px-6 pb-6">
              <Tabs defaultValue="profile">
                <TabsList className="w-full grid grid-cols-4 mb-1">
                  <TabsTrigger value="profile">Profile</TabsTrigger>
                  <TabsTrigger value="permissions">Permissions</TabsTrigger>
                  <TabsTrigger value="bank">Bank</TabsTrigger>
                  <TabsTrigger value="attendance">Attendance</TabsTrigger>
                </TabsList>

                {/* Profile */}
                <TabsContent value="profile">
                  <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
                    <InfoRow label="Email" value={emp.email} />
                    <InfoRow label="Phone" value={emp.phone} />
                    <InfoRow label="Joined" value={fmtDate(emp.date_of_joining)} />
                    <InfoRow label="Date of Birth" value={fmtDate(emp.date_of_birth)} />
                    <InfoRow label="Monthly Salary" value={fmtCurrency(d.monthly_salary)} />
                    <InfoRow label="Commission" value={
                      d.commission_type === 'flat' ? `₹${d.commission_value} per sale`
                      : d.commission_type === 'percentage' ? `${d.commission_percentage}%`
                      : 'None'
                    } />
                    {emp.address && (
                      <div className="col-span-2">
                        <InfoRow label="Address" value={emp.address} />
                      </div>
                    )}
                  </div>
                </TabsContent>

                {/* Permissions */}
                <TabsContent value="permissions" className="space-y-4">
                  {PERM_GROUPS.map((group) => (
                    <div key={group.label}>
                      <p className="text-xs font-semibold text-muted-foreground mb-2.5">{group.label}</p>
                      <div className="space-y-3">
                        {group.perms.map(({ key, label }) => (
                          <div key={key} className="flex items-center justify-between">
                            <Label className="text-sm font-normal cursor-pointer">{label}</Label>
                            <Switch
                              checked={Boolean(perms[key])}
                              onCheckedChange={(v) => setPerms((p) => ({ ...p, [key]: v }))}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  <Button
                    onClick={handleSavePerms}
                    disabled={savingPerms}
                    className="w-full bg-indigo-500 hover:bg-indigo-600 text-white"
                  >
                    {savingPerms ? 'Saving…' : 'Save Permissions'}
                  </Button>
                </TabsContent>

                {/* Bank */}
                <TabsContent value="bank">
                  <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
                    <InfoRow label="Bank Name" value={d.bank_name} />
                    <InfoRow label="Account Number" value={d.bank_account} mono />
                    <InfoRow label="IFSC Code" value={d.bank_ifsc} mono />
                    <InfoRow label="Emergency Contact" value={d.emergency_contact} />
                    <InfoRow label="ID Proof Type" value={d.id_proof_type?.replace('_', ' ')} capitalize />
                    <InfoRow label="ID Proof Number" value={d.id_proof_number} mono />
                  </div>
                </TabsContent>

                {/* Attendance */}
                <TabsContent value="attendance" className="space-y-4">
                  <div className="grid grid-cols-4 gap-3">
                    {[
                      { label: 'Present', value: attSummary.present, color: 'text-emerald-400' },
                      { label: 'Late',    value: attSummary.late,    color: 'text-amber-400' },
                      { label: 'Absent',  value: attSummary.absent,  color: 'text-red-400' },
                      { label: 'Hours',   value: attSummary.hours,   color: 'text-blue-400' },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="text-center bg-muted/30 rounded-lg p-3">
                        <p className={`text-xl font-bold ${color}`}>{value}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
                      </div>
                    ))}
                  </div>
                  {attendance.length === 0 ? (
                    <p className="text-sm text-center text-muted-foreground py-4">No records this month</p>
                  ) : (
                    <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                      {attendance.map((a) => (
                        <div key={a.id} className="flex items-center justify-between text-sm bg-muted/20 rounded-lg px-3 py-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={`text-xs capitalize ${STATUS_BADGE[a.status] ?? ''}`}>
                              {a.status}
                            </Badge>
                            <span className="text-xs text-muted-foreground">{fmtDate(a.attendance_date)}</span>
                          </div>
                          <div className="flex gap-3 text-xs text-muted-foreground">
                            <span>In: {fmt12(a.check_in_time)}</span>
                            {a.check_out_time && <span>Out: {fmt12(a.check_out_time)}</span>}
                            {a.total_hours != null && <span className="font-medium text-foreground">{a.total_hours}h</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function InfoRow({ label, value, mono, capitalize }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-sm font-medium mt-0.5 ${mono ? 'font-mono' : ''} ${capitalize ? 'capitalize' : ''}`}>
        {value || '—'}
      </p>
    </div>
  )
}

// ── Main Employees page ───────────────────────────────────────────────────────
export default function Employees() {
  const { currentUser, currentTenant } = useAuth()
  const navigate = useNavigate()
  const tenantId = currentTenant?.id

  const [employees, setEmployees]   = useState([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [formOpen, setFormOpen]     = useState(false)
  const [editEmployee, setEditEmployee] = useState(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedId, setSelectedId] = useState(null)

  // Redirect employees (non-admin)
  useEffect(() => {
    if (currentUser && currentUser.role === 'employee') {
      navigate('/dashboard', { replace: true })
    }
  }, [currentUser, navigate])

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    const { data } = await getEmployees(tenantId)
    setEmployees(data)
    setLoading(false)
  }, [tenantId])

  useEffect(() => { load() }, [load])

  const filtered = employees.filter((e) => {
    const q = search.toLowerCase()
    const matchSearch = !q || e.full_name?.toLowerCase().includes(q)
      || e.email?.toLowerCase().includes(q) || e.phone?.includes(q)
    const matchActive = showInactive ? !e.is_active : e.is_active
    return matchSearch && matchActive
  })

  const stats = {
    total:    employees.length,
    active:   employees.filter((e) => e.is_active).length,
    inactive: employees.filter((e) => !e.is_active).length,
  }

  const openAdd  = () => { setEditEmployee(null); setFormOpen(true) }
  const openEdit = (emp) => { setEditEmployee(emp); setFormOpen(true) }
  const openDetail = (id) => { setSelectedId(id); setDetailOpen(true) }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="p-4 md:p-6 max-w-7xl mx-auto space-y-5"
    >
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Employees</h1>
          <p className="text-sm text-muted-foreground">Manage staff profiles, permissions and attendance</p>
        </div>
        <Button onClick={openAdd} className="bg-indigo-500 hover:bg-indigo-600 text-white">
          <Plus className="w-4 h-4 mr-2" />Add Employee
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Staff', value: stats.total,    color: 'text-indigo-400' },
          { label: 'Active',      value: stats.active,   color: 'text-emerald-400' },
          { label: 'Inactive',    value: stats.inactive, color: 'text-red-400' },
        ].map(({ label, value, color }) => (
          <Card key={label}>
            <CardContent className="p-4 text-center">
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4 flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, email or phone…"
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Switch id="show-inactive" checked={showInactive} onCheckedChange={setShowInactive} />
            <Label htmlFor="show-inactive" className="cursor-pointer">Show inactive</Label>
          </div>
          <Button variant="ghost" size="icon" onClick={load} title="Refresh">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="text-center py-12 text-muted-foreground text-sm">Loading employees…</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              {search
                ? 'No employees match your search.'
                : showInactive
                ? 'No inactive employees.'
                : 'No employees yet. Click "Add Employee" to get started.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground text-xs uppercase">
                    <th className="px-4 py-3 text-left">Name</th>
                    <th className="px-4 py-3 text-left">Role</th>
                    <th className="px-4 py-3 text-left">Phone</th>
                    <th className="px-4 py-3 text-left">Joined</th>
                    <th className="px-4 py-3 text-right">Monthly Salary</th>
                    <th className="px-4 py-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((emp) => (
                    <tr
                      key={emp.id}
                      onClick={() => openDetail(emp.id)}
                      className="hover:bg-muted/30 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium">{emp.full_name}</p>
                        <p className="text-xs text-muted-foreground">{emp.email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={`text-xs capitalize ${ROLE_BADGE[emp.role] ?? ''}`}>
                          {emp.role}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{emp.phone ?? '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{fmtDate(emp.date_of_joining)}</td>
                      <td className="px-4 py-3 text-right font-medium">
                        {fmtCurrency(emp.employee_details?.monthly_salary)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge
                          variant="outline"
                          className={`text-xs ${emp.is_active ? 'text-emerald-400 border-emerald-400/40' : 'text-red-400 border-red-400/40'}`}
                        >
                          {emp.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <EmployeeDetailDialog
        employeeId={selectedId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onEdit={openEdit}
        onStatusChange={load}
        tenantId={tenantId}
      />

      <EmployeeFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        employee={editEmployee}
        onSuccess={load}
      />
    </motion.div>
  )
}
