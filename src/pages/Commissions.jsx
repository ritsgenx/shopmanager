import React, { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  Loader2, RefreshCw, CheckCircle2, DollarSign,
  Banknote, TrendingUp, CalendarDays,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import {
  generateMonthlyCommissions, getCommissions, getMyCommissions,
  approveCommission, markCommissionPaid,
} from '@/lib/commissions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

// ─── Helpers ────────────────────────────────────────────────────────────────

const STATUS_STYLE = {
  pending:  'bg-yellow-500/10 text-yellow-400 border border-yellow-400/30',
  approved: 'bg-blue-500/10   text-blue-400   border border-blue-400/30',
  paid:     'bg-emerald-500/10 text-emerald-400 border border-emerald-400/30',
}

const fmt = (n) =>
  `₹${Number(n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function nowMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(m) {
  if (!m) return ''
  const [y, mo] = m.split('-')
  return new Date(Number(y), Number(mo) - 1, 1)
    .toLocaleString('en-IN', { month: 'long', year: 'numeric' })
}

// ─── Detail Dialog ───────────────────────────────────────────────────────────

function DetailDialog({ row, onClose, currentUserId, onRefresh }) {
  const [approving, setApproving] = useState(false)
  const [paying,    setPaying]    = useState(false)

  if (!row) return null

  const handleApprove = async () => {
    setApproving(true)
    const { error } = await approveCommission(row.id, currentUserId)
    setApproving(false)
    if (error) { toast.error(error.message); return }
    toast.success('Commission approved')
    onRefresh()
    onClose()
  }

  const handlePaid = async () => {
    setPaying(true)
    const { error } = await markCommissionPaid(row.id)
    setPaying(false)
    if (error) { toast.error(error.message); return }
    toast.success('Marked as paid')
    onRefresh()
    onClose()
  }

  return (
    <Dialog open={!!row} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">
            {row.users?.full_name ?? 'Employee'} — {monthLabel(row.month)}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">

          {/* Sales */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Sales Performance
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-muted/40 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Sales Count</p>
                <p className="text-xl font-bold">{row.total_sales_count}</p>
              </div>
              <div className="bg-muted/40 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Sales Value</p>
                <p className="text-lg font-bold">{fmt(row.total_sales_value)}</p>
              </div>
            </div>
          </div>

          {/* Attendance */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Attendance
            </p>
            <div className="bg-muted/40 rounded-lg px-4 py-3 flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Days Present / Working Days</span>
              <span className="font-semibold">{row.days_present} / {row.working_days}</span>
            </div>
          </div>

          {/* Salary */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Salary Calculation
            </p>
            <div className="bg-muted/40 rounded-lg px-4 py-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Monthly Salary</span>
                <span>{fmt(row.monthly_salary)}</span>
              </div>
              <div className="text-xs text-muted-foreground/60">
                ÷ {row.working_days} working days × {row.days_present} days present
              </div>
              <div className="flex justify-between font-semibold border-t border-border pt-2">
                <span>Prorated Salary</span>
                <span className="text-indigo-400">{fmt(row.prorated_salary)}</span>
              </div>
            </div>
          </div>

          {/* Commission */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Commission
            </p>
            <div className="bg-muted/40 rounded-lg px-4 py-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Type</span>
                <span className="capitalize">{row.commission_type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {row.commission_type === 'percentage' ? 'Rate' : '₹ per sale'}
                </span>
                <span>
                  {row.commission_type === 'percentage'
                    ? `${row.commission_rate}%`
                    : fmt(row.commission_rate)}
                </span>
              </div>
              <div className="text-xs text-muted-foreground/60">
                {row.commission_type === 'percentage'
                  ? `${fmt(row.total_sales_value)} × ${row.commission_rate}%`
                  : `${row.total_sales_count} sales × ${fmt(row.commission_rate)}`}
              </div>
              <div className="flex justify-between font-semibold border-t border-border pt-2">
                <span>Gross Commission</span>
                <span className="text-emerald-400">{fmt(row.gross_commission)}</span>
              </div>
              {row.deductions > 0 && (
                <div className="flex justify-between text-red-400">
                  <span>Deductions</span>
                  <span>−{fmt(row.deductions)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Total */}
          <div className="rounded-xl bg-indigo-500/10 border border-indigo-500/20 px-4 py-4">
            <div className="flex justify-between text-sm mb-1 text-muted-foreground">
              <span>Prorated Salary</span>
              <span>{fmt(row.prorated_salary)}</span>
            </div>
            <div className="flex justify-between text-sm mb-3 text-muted-foreground">
              <span>+ Commission</span>
              <span>{fmt(row.final_commission)}</span>
            </div>
            <div className="flex justify-between items-center border-t border-indigo-500/20 pt-3">
              <span className="font-bold">Total Payout</span>
              <span className="text-2xl font-bold text-indigo-400">{fmt(row.total_payout)}</span>
            </div>
          </div>

          {/* Status + actions */}
          <div className="flex items-center justify-between pt-1">
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize ${STATUS_STYLE[row.status]}`}>
              {row.status}
            </span>
            <div className="flex gap-2">
              {row.status === 'pending' && (
                <Button
                  size="sm"
                  onClick={handleApprove}
                  disabled={approving}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {approving
                    ? <Loader2 className="w-3 h-3 animate-spin mr-1" />
                    : <CheckCircle2 className="w-3 h-3 mr-1" />}
                  Approve
                </Button>
              )}
              {row.status === 'approved' && (
                <Button
                  size="sm"
                  onClick={handlePaid}
                  disabled={paying}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {paying
                    ? <Loader2 className="w-3 h-3 animate-spin mr-1" />
                    : <Banknote className="w-3 h-3 mr-1" />}
                  Mark Paid
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Admin View ──────────────────────────────────────────────────────────────

function AdminView({ tenantId, userId }) {
  const [month,      setMonth]      = useState(nowMonth)
  const [rows,       setRows]       = useState([])
  const [loading,    setLoading]    = useState(false)
  const [generating, setGenerating] = useState(false)
  const [selected,   setSelected]   = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await getCommissions(tenantId, month)
    setRows(data)
    setLoading(false)
  }, [tenantId, month])

  useEffect(() => { load() }, [load])

  const handleGenerate = async () => {
    setGenerating(true)
    const id = toast.loading(`Calculating commissions for ${monthLabel(month)}…`)
    const { count, error } = await generateMonthlyCommissions(tenantId, month)
    toast.dismiss(id)
    if (count === 0 && !error) {
      toast.info('No active employees found for this tenant.')
    } else if (error) {
      toast.warning(`Processed ${count} employees — some failed: ${error.message}`)
    } else {
      toast.success(`Generated commissions for ${count} employee${count !== 1 ? 's' : ''}`)
    }
    setGenerating(false)
    load()
  }

  const handleQuickApprove = async (e, row) => {
    e.stopPropagation()
    const { error } = await approveCommission(row.id, userId)
    if (error) { toast.error(error.message); return }
    toast.success('Approved')
    load()
  }

  const handleQuickPaid = async (e, row) => {
    e.stopPropagation()
    const { error } = await markCommissionPaid(row.id)
    if (error) { toast.error(error.message); return }
    toast.success('Marked as paid')
    load()
  }

  const pending  = rows.filter(r => r.status === 'pending').length
  const approved = rows.filter(r => r.status === 'approved').length
  const paid     = rows.filter(r => r.status === 'paid').length
  const total    = rows.reduce((s, r) => s + (r.total_payout ?? 0), 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Commissions</h1>
          <p className="text-sm text-muted-foreground">Monthly commission calculation &amp; payroll</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="month"
            value={month}
            onChange={e => setMonth(e.target.value)}
            className="border border-border rounded-lg px-3 py-1.5 text-sm bg-background text-foreground
                       focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <Button
            onClick={handleGenerate}
            disabled={generating}
            className="bg-indigo-600 hover:bg-indigo-700 text-white shrink-0"
          >
            {generating
              ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Calculating…</>
              : <><RefreshCw className="w-4 h-4 mr-2" />Generate</>}
          </Button>
        </div>
      </div>

      {/* Summary cards — only when data exists */}
      {rows.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Total Payout', value: fmt(total), color: 'text-indigo-400', icon: DollarSign },
            { label: 'Pending',      value: pending,    color: 'text-yellow-400', icon: CalendarDays },
            { label: 'Approved',     value: approved,   color: 'text-blue-400',   icon: CheckCircle2 },
            { label: 'Paid',         value: paid,       color: 'text-emerald-400',icon: Banknote },
          ].map(({ label, value, color, icon: Icon }) => (
            <Card key={label}>
              <CardContent className="pt-5 pb-4 flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">{label}</p>
                  <p className={`text-xl font-bold ${color}`}>{value}</p>
                </div>
                <Icon className={`w-5 h-5 mt-0.5 opacity-40 ${color}`} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" /> Loading…
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground px-4">
              <DollarSign className="w-10 h-10 mb-3 opacity-20" />
              <p className="font-medium">No commissions for {monthLabel(month)}</p>
              <p className="text-sm mt-1">Click Generate to calculate for all active employees</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="text-left    px-4 py-3 font-medium">Employee</th>
                    <th className="text-right   px-4 py-3 font-medium">Sales</th>
                    <th className="text-right   px-4 py-3 font-medium">Sales Value</th>
                    <th className="text-center  px-4 py-3 font-medium">Attendance</th>
                    <th className="text-right   px-4 py-3 font-medium">Prorated Salary</th>
                    <th className="text-right   px-4 py-3 font-medium">Commission</th>
                    <th className="text-right   px-4 py-3 font-medium">Total Payout</th>
                    <th className="text-center  px-4 py-3 font-medium">Status</th>
                    <th className="text-center  px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(row => (
                    <tr
                      key={row.id}
                      onClick={() => setSelected(row)}
                      className="border-b border-border/50 hover:bg-muted/30 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 font-medium whitespace-nowrap">
                        {row.users?.full_name ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-right">{row.total_sales_count}</td>
                      <td className="px-4 py-3 text-right">{fmt(row.total_sales_value)}</td>
                      <td className="px-4 py-3 text-center">
                        {row.days_present}/{row.working_days}
                      </td>
                      <td className="px-4 py-3 text-right">{fmt(row.prorated_salary)}</td>
                      <td className="px-4 py-3 text-right">{fmt(row.final_commission)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-indigo-400">
                        {fmt(row.total_payout)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_STYLE[row.status]}`}>
                          {row.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                        {row.status === 'pending' && (
                          <button
                            onClick={e => handleQuickApprove(e, row)}
                            className="text-xs px-2 py-1 rounded text-blue-400 hover:bg-blue-500/10 transition-colors"
                          >
                            Approve
                          </button>
                        )}
                        {row.status === 'approved' && (
                          <button
                            onClick={e => handleQuickPaid(e, row)}
                            className="text-xs px-2 py-1 rounded text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                          >
                            Mark Paid
                          </button>
                        )}
                        {row.status === 'paid' && (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <DetailDialog
        row={selected}
        onClose={() => setSelected(null)}
        currentUserId={userId}
        onRefresh={load}
      />
    </div>
  )
}

// ─── Employee "My Commissions" View ──────────────────────────────────────────

function EmployeeView({ userId }) {
  const [rows,    setRows]    = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getMyCommissions(userId).then(({ data }) => {
      setRows(data)
      setLoading(false)
    })
  }, [userId])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Commissions</h1>
        <p className="text-sm text-muted-foreground">Your monthly commission &amp; salary earnings</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading…
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
          <TrendingUp className="w-10 h-10 mb-3 opacity-20" />
          <p className="font-medium">No commissions yet</p>
          <p className="text-sm mt-1">Your commission will appear here once admin generates it</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {rows.map((row, i) => (
            <motion.div
              key={row.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <Card className="h-full">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{monthLabel(row.month)}</CardTitle>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_STYLE[row.status]}`}>
                      {row.status}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Sales</p>
                      <p className="font-semibold">{row.total_sales_count} bills</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Sales Value</p>
                      <p className="font-semibold">{fmt(row.total_sales_value)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Attendance</p>
                      <p className="font-semibold">{row.days_present}/{row.working_days} days</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Commission</p>
                      <p className="font-semibold text-emerald-400">{fmt(row.final_commission)}</p>
                    </div>
                  </div>
                  <div className="flex justify-between items-center border-t border-border pt-3">
                    <span className="text-sm text-muted-foreground">Total Payout</span>
                    <span className="text-lg font-bold text-indigo-400">{fmt(row.total_payout)}</span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Page root ───────────────────────────────────────────────────────────────

export default function Commissions() {
  const { currentUser } = useAuth()

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {currentUser?.role === 'admin'
        ? <AdminView tenantId={currentUser.tenant_id} userId={currentUser.id} />
        : <EmployeeView userId={currentUser.id} />
      }
    </div>
  )
}
