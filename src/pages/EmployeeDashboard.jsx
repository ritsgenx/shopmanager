import React, { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import {
  IndianRupee, ShoppingCart, TrendingUp, TrendingDown,
  Calendar, Clock, ArrowUpRight, ArrowDownRight,
  CheckCircle2, AlertCircle, Plus, Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/context/AuthContext'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { getMyStats, getMyCommission, getMyAttendance, getMySales, getMyRevenueChart } from '@/lib/dashboard'

const fmt = (n) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n ?? 0)
const fmtCurr = (n) => `₹${fmt(n)}`

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm shadow-xl">
      <p className="text-slate-400 text-xs mb-1">{label}</p>
      <p className="text-white font-semibold">{fmtCurr(payload[0].value)}</p>
    </div>
  )
}

const paymentBadge = {
  paid: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  partial: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  pending: 'bg-red-500/10 text-red-400 border-red-500/20',
}

export default function EmployeeDashboard() {
  const navigate = useNavigate()
  const { currentUser, currentTenant } = useAuth()
  const tenantId = currentTenant?.id
  const employeeId = currentUser?.id

  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState(null)
  const [commission, setCommission] = useState(null)
  const [attendance, setAttendance] = useState(null)
  const [sales, setSales] = useState([])
  const [chart, setChart] = useState([])

  const load = useCallback(async () => {
    if (!tenantId || !employeeId) return
    setLoading(true)
    try {
      const [s, c, a, sl, ch] = await Promise.all([
        getMyStats(tenantId, employeeId),
        getMyCommission(tenantId, employeeId),
        getMyAttendance(tenantId, employeeId),
        getMySales(tenantId, employeeId),
        getMyRevenueChart(tenantId, employeeId),
      ])
      setStats(s)
      setCommission(c)
      setAttendance(a)
      setSales(sl)
      setChart(ch)
    } catch {
      toast.error('Failed to load dashboard')
    } finally {
      setLoading(false)
    }
  }, [tenantId, employeeId])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div><Skeleton className="h-7 w-48 mb-1" /><Skeleton className="h-4 w-32" /></div>
          <Skeleton className="h-9 w-28" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[0,1,2,3].map(i => (
            <Card key={i}><CardContent className="pt-5 space-y-3">
              <Skeleton className="h-4 w-24" /><Skeleton className="h-7 w-32" /><Skeleton className="h-3 w-20" />
            </CardContent></Card>
          ))}
        </div>
      </div>
    )
  }

  const monthChange = stats?.monthly.change ?? 0
  const todayCheckedIn = !!attendance?.today?.check_in_time
  const todayCheckedOut = !!attendance?.today?.check_out_time

  const custName = (sale) => {
    if (!sale.customers) return '—'
    return sale.customers.customer_type === 'company'
      ? sale.customers.company_name
      : sale.customers.full_name
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {greeting()}, {currentUser?.full_name?.split(' ')[0]}!
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <Button
          onClick={() => navigate('/sales/new')}
          className="bg-indigo-500 hover:bg-indigo-600 text-white gap-2"
        >
          <Plus className="w-4 h-4" /> New Sale
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">

        {/* Today's Sales */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
          <Card className="hover:shadow-lg transition-shadow border-border/60">
            <CardContent className="pt-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Today's Revenue</p>
                  <p className="text-2xl font-bold mt-1 tracking-tight">{fmtCurr(stats?.today.revenue)}</p>
                  <p className="text-xs text-muted-foreground mt-1.5">
                    {stats?.today.count ?? 0} sale{stats?.today.count !== 1 ? 's' : ''} today
                  </p>
                </div>
                <div className="w-11 h-11 rounded-xl bg-emerald-500 flex items-center justify-center shrink-0 ml-3">
                  <IndianRupee className="w-5 h-5 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Monthly Sales */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}>
          <Card className="hover:shadow-lg transition-shadow border-border/60">
            <CardContent className="pt-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">My Monthly Sales</p>
                  <p className="text-2xl font-bold mt-1 tracking-tight">{fmtCurr(stats?.monthly.revenue)}</p>
                  <div className="flex items-center gap-1 mt-1.5">
                    {monthChange >= 0
                      ? <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      : <ArrowDownRight className="w-3.5 h-3.5 text-red-500 shrink-0" />
                    }
                    <span className={`text-xs font-medium ${monthChange >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                      {monthChange >= 0 ? '+' : ''}{monthChange.toFixed(1)}% vs last month
                    </span>
                  </div>
                </div>
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ml-3 ${monthChange >= 0 ? 'bg-indigo-500' : 'bg-red-500'}`}>
                  {monthChange >= 0
                    ? <TrendingUp className="w-5 h-5 text-white" />
                    : <TrendingDown className="w-5 h-5 text-white" />
                  }
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Commission */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
          <Card className="hover:shadow-lg transition-shadow border-border/60">
            <CardContent className="pt-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">My Commission</p>
                  <p className="text-2xl font-bold mt-1 tracking-tight">{fmtCurr(commission?.amount)}</p>
                  <div className="mt-1.5">
                    {commission?.status === 'paid' ? (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-400 font-medium">
                        <CheckCircle2 className="w-3 h-3" /> Paid
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-amber-400 font-medium">
                        <Clock className="w-3 h-3" /> Pending payout
                      </span>
                    )}
                  </div>
                </div>
                <div className="w-11 h-11 rounded-xl bg-violet-500 flex items-center justify-center shrink-0 ml-3">
                  <ShoppingCart className="w-5 h-5 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Attendance */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}>
          <Card className="hover:shadow-lg transition-shadow border-border/60">
            <CardContent className="pt-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Attendance (Month)</p>
                  <p className="text-2xl font-bold mt-1 tracking-tight">{attendance?.totalDays ?? 0} days</p>
                  <p className="text-xs text-muted-foreground mt-1.5">
                    {attendance?.present ?? 0} present · {attendance?.late ?? 0} late
                  </p>
                </div>
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ml-3 ${todayCheckedIn ? 'bg-emerald-500' : 'bg-orange-400'}`}>
                  <Calendar className="w-5 h-5 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Chart + Today's Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* 7-Day Chart */}
        <motion.div
          className="lg:col-span-2"
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}
        >
          <Card className="h-full border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-indigo-400" /> My 7-Day Sales
              </CardTitle>
              <CardDescription>Your personal revenue trend this week</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={210}>
                <BarChart data={chart} barSize={32}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={false} tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={false} tickLine={false}
                    tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
                    width={40}
                  />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: 'hsl(var(--muted))', radius: 4 }} />
                  <Bar dataKey="revenue" fill="hsl(239 84% 67%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        {/* Today's Status Panel */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.27 }}>
          <Card className="h-full border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-400" /> Today's Status
              </CardTitle>
              <CardDescription>Your activity snapshot for today</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">

              {/* Attendance */}
              <div className={`rounded-lg border p-3 ${todayCheckedIn ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-orange-500/10 border-orange-500/20'}`}>
                <div className="flex items-center gap-2 mb-1">
                  {todayCheckedIn
                    ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    : <AlertCircle className="w-4 h-4 text-orange-400 shrink-0" />
                  }
                  <span className={`text-sm font-medium ${todayCheckedIn ? 'text-emerald-400' : 'text-orange-400'}`}>
                    {todayCheckedIn ? 'Checked In' : 'Not Checked In'}
                  </span>
                </div>
                {attendance?.today?.check_in_time && (
                  <p className="text-xs text-muted-foreground pl-6">
                    In: {new Date(attendance.today.check_in_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    {todayCheckedOut && ` · Out: ${new Date(attendance.today.check_out_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`}
                  </p>
                )}
                {attendance?.today?.total_hours > 0 && (
                  <p className="text-xs text-muted-foreground pl-6 mt-0.5">
                    {attendance.today.total_hours.toFixed(1)} hrs worked
                  </p>
                )}
              </div>

              {/* Commission detail */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Commission This Month</p>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Profit Generated</span>
                  <span className="font-medium">{fmtCurr(commission?.profit)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Your Rate</span>
                  <span className="font-medium">20%</span>
                </div>
                <div className="flex justify-between text-sm border-t border-border pt-2">
                  <span className="font-medium">Commission Earned</span>
                  <span className="font-bold text-violet-400">{fmtCurr(commission?.amount)}</span>
                </div>
              </div>

              {/* Quick action */}
              <Button
                onClick={() => navigate('/sales/new')}
                className="w-full bg-indigo-500 hover:bg-indigo-600 text-white gap-2"
                size="sm"
              >
                <Plus className="w-4 h-4" /> Record New Sale
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* My Recent Sales */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.32 }}>
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-indigo-400" /> My Recent Sales
            </CardTitle>
            <CardDescription>Your last {sales.length} transactions</CardDescription>
          </CardHeader>
          <CardContent>
            {sales.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <p className="text-3xl mb-2">🛒</p>
                <p className="text-sm">No sales yet — hit "New Sale" to get started!</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-muted-foreground text-xs uppercase">
                      <th className="pb-2.5 font-medium">Invoice</th>
                      <th className="pb-2.5 font-medium">Customer</th>
                      <th className="pb-2.5 font-medium">Date</th>
                      <th className="pb-2.5 font-medium text-right">Amount</th>
                      <th className="pb-2.5 font-medium">Payment</th>
                      <th className="pb-2.5 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {sales.map((sale) => (
                      <tr key={sale.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-2.5 pr-3 font-mono text-xs text-muted-foreground">{sale.invoice_number}</td>
                        <td className="py-2.5 pr-3 font-medium">{custName(sale)}</td>
                        <td className="py-2.5 pr-3 text-xs text-muted-foreground">
                          {new Date(sale.sale_date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </td>
                        <td className="py-2.5 pr-3 text-right font-semibold text-emerald-400">{fmtCurr(sale.grand_total)}</td>
                        <td className="py-2.5 pr-3 capitalize text-xs text-muted-foreground">{sale.payment_method}</td>
                        <td className="py-2.5">
                          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${paymentBadge[sale.payment_status] ?? ''}`}>
                            {sale.payment_status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
