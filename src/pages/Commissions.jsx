import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import {
  Loader2, ChevronLeft, Banknote, TrendingUp, CheckCircle2, DollarSign,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import {
  getCommissionSummary, getEmployeeSalesBreakdown,
  markMonthCommissionPaid, markAllMonthCommissionsPaid,
  getMyCommissionHistory,
} from '@/lib/commissions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

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

// ─── Sales Breakdown (drill-down) ────────────────────────────────────────────

function SalesBreakdown({ tenantId, employee, month, onBack }) {
  const [loading, setLoading] = useState(true)
  const [sales, setSales] = useState([])
  const [totals, setTotals] = useState({ total_profit: 0, total_commission: 0 })

  useEffect(() => {
    setLoading(true)
    getEmployeeSalesBreakdown(tenantId, employee.employee_id, month).then(({ data, totals: t }) => {
      setSales(data)
      setTotals(t)
      setLoading(false)
    })
  }, [tenantId, employee.employee_id, month])

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        <div>
          <h2 className="text-lg font-bold">{employee.full_name}</h2>
          <p className="text-xs text-muted-foreground">{monthLabel(month)}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading…
        </div>
      ) : sales.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
          <TrendingUp className="w-10 h-10 mb-3 opacity-20" />
          <p className="font-medium">No sales this month</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sales.map((sale) => (
            <Card key={sale.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold">{sale.invoice_number}</CardTitle>
                  <span className="text-xs text-muted-foreground">{sale.sale_date}</span>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-y border-border text-xs text-muted-foreground">
                        <th className="text-left px-4 py-2 font-medium">Item</th>
                        <th className="text-right px-4 py-2 font-medium">Qty</th>
                        <th className="text-right px-4 py-2 font-medium">Purchase</th>
                        <th className="text-right px-4 py-2 font-medium">Sell</th>
                        <th className="text-right px-4 py-2 font-medium">Profit</th>
                        <th className="text-right px-4 py-2 font-medium">Commission (20%)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sale.sale_items.map((item) => {
                        const prod = item.products
                        const label = prod
                          ? `${prod.brand} ${prod.model}${prod.variant ? ` ${prod.variant}` : ''}${prod.color ? ` · ${prod.color}` : ''}`
                          : '—'
                        return (
                          <tr key={item.id} className="border-b border-border/40">
                            <td className="px-4 py-2 text-xs">{label}</td>
                            <td className="px-4 py-2 text-right text-xs">{item.quantity}</td>
                            <td className="px-4 py-2 text-right text-xs">{fmt(item.purchase_price)}</td>
                            <td className="px-4 py-2 text-right text-xs">{fmt(item.unit_price)}</td>
                            <td className={`px-4 py-2 text-right text-xs font-medium ${item.profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                              {fmt(item.profit)}
                            </td>
                            <td className="px-4 py-2 text-right text-xs font-semibold text-indigo-400">
                              {fmt(item.commission)}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-muted/20">
                        <td colSpan={4} className="px-4 py-2 text-xs font-semibold text-right text-muted-foreground">
                          Sale total
                        </td>
                        <td className={`px-4 py-2 text-right text-xs font-bold ${sale.sale_profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {fmt(sale.sale_profit)}
                        </td>
                        <td className="px-4 py-2 text-right text-xs font-bold text-indigo-400">
                          {fmt(sale.sale_commission)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Grand total */}
          <Card className="border-indigo-500/30 bg-indigo-500/5">
            <CardContent className="px-6 py-4">
              <div className="flex justify-between items-center text-sm text-muted-foreground mb-1">
                <span>Total Profit ({sales.length} sale{sales.length !== 1 ? 's' : ''})</span>
                <span className={`font-semibold ${totals.total_profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {fmt(totals.total_profit)}
                </span>
              </div>
              <div className="flex justify-between items-center border-t border-indigo-500/20 pt-3 mt-2">
                <span className="font-bold">Total Commission (20%)</span>
                <span className="text-2xl font-bold text-indigo-400">{fmt(totals.total_commission)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

// ─── Admin View ───────────────────────────────────────────────────────────────

function AdminView({ tenantId, userId }) {
  const [month, setMonth]       = useState(nowMonth)
  const [rows, setRows]         = useState([])
  const [loading, setLoading]   = useState(false)
  const [selected, setSelected] = useState(null)
  const [paying, setPaying]     = useState(null)
  const [payingAll, setPayingAll] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await getCommissionSummary(tenantId, month)
    if (error) toast.error(error.message)
    setRows(data)
    setLoading(false)
  }, [tenantId, month])

  useEffect(() => { load() }, [load])

  const handleMarkPaid = async (e, row) => {
    e.stopPropagation()
    setPaying(row.employee_id)
    const { error } = await markMonthCommissionPaid(tenantId, row.employee_id, month)
    setPaying(null)
    if (error) { toast.error(error.message); return }
    toast.success(`Marked ${row.full_name} as paid`)
    load()
  }

  const handleMarkAllPaid = async () => {
    const unpaid = rows.filter(r => r.status !== 'paid')
    if (!unpaid.length) { toast.info('All commissions already paid'); return }
    setPayingAll(true)
    const { error } = await markAllMonthCommissionsPaid(tenantId, month, unpaid.map(r => r.employee_id))
    setPayingAll(false)
    if (error) { toast.error(error.message); return }
    toast.success(`Marked ${unpaid.length} employee${unpaid.length !== 1 ? 's' : ''} as paid`)
    load()
  }

  const totalCommission = rows.reduce((s, r) => s + r.total_commission, 0)
  const unpaidCount = rows.filter(r => r.status !== 'paid').length

  if (selected) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <SalesBreakdown
          tenantId={tenantId}
          employee={selected}
          month={month}
          onBack={() => setSelected(null)}
        />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Commissions</h1>
          <p className="text-sm text-muted-foreground">20% of profit per sale, auto-calculated</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="month"
            value={month}
            onChange={e => { setMonth(e.target.value); setSelected(null) }}
            className="border border-border rounded-lg px-3 py-1.5 text-sm bg-background text-foreground
                       focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {unpaidCount > 0 && (
            <Button
              onClick={handleMarkAllPaid}
              disabled={payingAll}
              className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
            >
              {payingAll
                ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Paying…</>
                : <><CheckCircle2 className="w-4 h-4 mr-2" />Pay All</>}
            </Button>
          )}
        </div>
      </div>

      {/* Summary cards */}
      {rows.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Total Commission', value: fmt(totalCommission), color: 'text-indigo-400', icon: DollarSign },
            { label: 'Employees',        value: rows.length,          color: 'text-blue-400',   icon: TrendingUp },
            { label: 'Unpaid',           value: unpaidCount,          color: 'text-yellow-400', icon: Banknote },
            { label: 'Paid',             value: rows.length - unpaidCount, color: 'text-emerald-400', icon: CheckCircle2 },
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
              <p className="font-medium">No active employees found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="text-left   px-4 py-3 font-medium">Employee</th>
                    <th className="text-right  px-4 py-3 font-medium">Sales</th>
                    <th className="text-right  px-4 py-3 font-medium">Total Profit</th>
                    <th className="text-right  px-4 py-3 font-medium">Commission (20%)</th>
                    <th className="text-center px-4 py-3 font-medium">Status</th>
                    <th className="text-center px-4 py-3 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(row => (
                    <motion.tr
                      key={row.employee_id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      onClick={() => setSelected(row)}
                      className="border-b border-border/50 hover:bg-muted/30 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 font-medium whitespace-nowrap">{row.full_name}</td>
                      <td className="px-4 py-3 text-right">{row.sales_count}</td>
                      <td className={`px-4 py-3 text-right ${row.total_profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {fmt(row.total_profit)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-indigo-400">
                        {fmt(row.total_commission)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium capitalize ${
                          row.status === 'paid'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-400/30'
                            : 'bg-yellow-500/10 text-yellow-400 border border-yellow-400/30'
                        }`}>
                          {row.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                        {row.status !== 'paid' ? (
                          <button
                            disabled={paying === row.employee_id}
                            onClick={e => handleMarkPaid(e, row)}
                            className="text-xs px-3 py-1 rounded bg-emerald-600/10 text-emerald-400 hover:bg-emerald-600/20 transition-colors disabled:opacity-50"
                          >
                            {paying === row.employee_id
                              ? <Loader2 className="w-3 h-3 animate-spin inline" />
                              : 'Mark Paid'}
                          </button>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {row.paid_at ? new Date(row.paid_at).toLocaleDateString('en-IN') : 'Paid'}
                          </span>
                        )}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Employee "My Commissions" View ──────────────────────────────────────────

function EmployeeView({ tenantId, userId }) {
  const [rows, setRows]       = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [month, setMonth] = useState(nowMonth)

  useEffect(() => {
    getMyCommissionHistory(tenantId, userId).then(({ data }) => {
      setRows(data)
      setLoading(false)
    })
  }, [tenantId, userId])

  if (selected) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <SalesBreakdown
          tenantId={tenantId}
          employee={{ employee_id: userId, full_name: 'My Sales' }}
          month={selected}
          onBack={() => setSelected(null)}
        />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Commissions</h1>
        <p className="text-sm text-muted-foreground">20% of profit on every sale you make</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading…
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
          <TrendingUp className="w-10 h-10 mb-3 opacity-20" />
          <p className="font-medium">No sales yet</p>
          <p className="text-sm mt-1">Complete a sale to start earning commission</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {rows.map((row, i) => (
            <motion.div
              key={row.month}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <Card
                className="h-full cursor-pointer hover:border-indigo-500/50 transition-colors"
                onClick={() => setSelected(row.month)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{monthLabel(row.month)}</CardTitle>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${
                      row.status === 'paid'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-400/30'
                        : 'bg-yellow-500/10 text-yellow-400 border border-yellow-400/30'
                    }`}>
                      {row.status}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Sales</p>
                      <p className="font-semibold">{row.sales_count} bills</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Total Profit</p>
                      <p className={`font-semibold ${row.total_profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {fmt(row.total_profit)}
                      </p>
                    </div>
                  </div>
                  <div className="flex justify-between items-center border-t border-border pt-3">
                    <span className="text-sm text-muted-foreground">Commission (20%)</span>
                    <span className="text-lg font-bold text-indigo-400">{fmt(row.total_commission)}</span>
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

// ─── Page root ────────────────────────────────────────────────────────────────

export default function Commissions() {
  const { currentUser } = useAuth()

  return currentUser?.role === 'admin'
    ? <AdminView tenantId={currentUser.tenant_id} userId={currentUser.id} />
    : <EmployeeView tenantId={currentUser.tenant_id} userId={currentUser.id} />
}
