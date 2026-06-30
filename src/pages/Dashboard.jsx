import EmployeeDashboard from './EmployeeDashboard'
import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import {
  TrendingUp, TrendingDown, IndianRupee, ShoppingCart, Package, Users,
  AlertTriangle, Trophy, Activity, Target, Settings2, Loader2,
  ArrowUpRight, ArrowDownRight, ShoppingBag, Star, Zap, ClipboardList,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/context/AuthContext'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import {
  getDashboardStats, getRevenueChart, getLowStockItems,
  getEmployeeLeaderboard, getRecentActivity, getDashboardSettings, saveDashboardSettings,
} from '@/lib/dashboard'
import { useNavigate } from 'react-router-dom'
import { usePendingCount } from '@/context/PendingCountContext'

// ─── Widget registry ────────────────────────────────────────────────────────
const WIDGET_DEFS = [
  { key: 'todaySales',          label: "Today's Sales",        desc: 'Revenue and order count for today' },
  { key: 'monthlyRevenue',      label: 'Monthly Revenue',      desc: 'This month vs last month comparison' },
  { key: 'cashFlow',            label: 'Cash Flow',            desc: 'Income vs expenses, net profit' },
  { key: 'customerPulse',       label: 'Customer Pulse',       desc: 'Total and new customers this month' },
  { key: 'monthlyTarget',       label: 'Monthly Target',       desc: 'Revenue goal with progress bar' },
  { key: 'revenueChart',        label: '7-Day Revenue Chart',  desc: 'Daily revenue trend this week' },
  { key: 'smartAlerts',         label: 'Smart Alerts',         desc: 'Inventory and business health alerts' },
  { key: 'employeeLeaderboard', label: 'Employee Leaderboard', desc: 'Top 3 sellers this month' },
  { key: 'lowStockAlerts',      label: 'Low Stock List',       desc: 'Items that need restocking' },
  { key: 'recentActivity',      label: 'Recent Activity',      desc: 'Latest sales and purchases' },
  { key: 'pendingApprovals',    label: 'Pending Approvals',    desc: 'Count of inventory items awaiting your approval' },
]

const DEFAULT_WIDGETS = {
  todaySales: true, monthlyRevenue: true, cashFlow: true, customerPulse: true,
  monthlyTarget: false, revenueChart: true, smartAlerts: true,
  employeeLeaderboard: true, lowStockAlerts: true, recentActivity: true,
  pendingApprovals: true,
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const fmt = (n) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n ?? 0)
const fmtCurr = (n) => `₹${fmt(n)}`
const timeAgo = (iso) => {
  const diff = (Date.now() - new Date(iso)) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

// ─── Custom chart tooltip ────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm shadow-xl">
      <p className="text-slate-400 text-xs mb-1">{label}</p>
      <p className="text-white font-semibold">{fmtCurr(payload[0].value)}</p>
    </div>
  )
}

// ─── Stat card ───────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, subUp, color, delay = 0, onClick }) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}>
      <Card className={`hover:shadow-lg transition-shadow border-border/60 ${onClick ? 'cursor-pointer' : ''}`} onClick={onClick}>
        <CardContent className="pt-5">
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-sm text-muted-foreground truncate">{label}</p>
              <p className="text-2xl font-bold mt-1 tracking-tight">{value}</p>
              {sub && (
                <div className="flex items-center gap-1 mt-1.5">
                  {subUp !== undefined && (
                    subUp
                      ? <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      : <ArrowDownRight className="w-3.5 h-3.5 text-red-500 shrink-0" />
                  )}
                  <span className={`text-xs font-medium ${subUp === undefined ? 'text-muted-foreground' : subUp ? 'text-emerald-500' : 'text-red-500'}`}>
                    {sub}
                  </span>
                </div>
              )}
            </div>
            <div className={`flex items-center justify-center w-11 h-11 rounded-xl ${color} shrink-0 ml-3`}>
              <Icon className="w-5 h-5 text-white" />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ─── Skeleton card ───────────────────────────────────────────────────────────
function CardSkeleton({ className = '' }) {
  return (
    <Card className={className}>
      <CardContent className="pt-5 space-y-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-3 w-20" />
      </CardContent>
    </Card>
  )
}

// ─── Customize dialog ────────────────────────────────────────────────────────
function CustomizeDialog({ widgets, targetAmount, onSave }) {
  const [open, setOpen] = useState(false)
  const [local, setLocal] = useState(widgets)
  const [target, setTarget] = useState(targetAmount ?? '')
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (open) { setLocal(widgets); setTarget(targetAmount ?? '') } }, [open, widgets, targetAmount])

  const handleSave = async () => {
    setSaving(true)
    await onSave(local, target)
    setSaving(false)
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings2 className="w-4 h-4" /> Customize
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-indigo-400" /> Customize Dashboard
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 pb-6 pt-5 space-y-5 max-h-[60vh] overflow-y-auto">
          <p className="text-sm text-muted-foreground">Toggle widgets to show or hide sections on your dashboard.</p>

          <div className="space-y-3">
            {WIDGET_DEFS.map(({ key, label, desc }) => (
              <div key={key} className="flex items-center justify-between gap-4 py-1">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
                <Switch
                  checked={!!local[key]}
                  onCheckedChange={(v) => setLocal(prev => ({ ...prev, [key]: v }))}
                />
              </div>
            ))}
          </div>

          {local.monthlyTarget && (
            <div className="space-y-2 border-t border-border pt-4">
              <Label>Monthly Revenue Target (₹)</Label>
              <Input
                type="number"
                placeholder="e.g. 500000"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Sets the goal shown in the Monthly Target widget.</p>
            </div>
          )}
        </div>

        <div className="px-6 pb-6 flex gap-2 justify-end border-t border-border pt-4">
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-indigo-500 hover:bg-indigo-600 text-white">
            {saving ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Saving…</> : 'Save Changes'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main Dashboard ──────────────────────────────────────────────────────────
export default function Dashboard() {
  const { currentTenant, currentUser } = useAuth()
  const tenantId = currentTenant?.id
  const navigate = useNavigate()
  const { pendingCount } = usePendingCount()

  if (currentUser?.role === 'employee') return <EmployeeDashboard />

  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState(null)
  const [chartData, setChartData] = useState([])
  const [lowStock, setLowStock] = useState([])
  const [leaderboard, setLeaderboard] = useState([])
  const [activity, setActivity] = useState([])
  const [widgets, setWidgets] = useState(DEFAULT_WIDGETS)
  const [targetAmount, setTargetAmount] = useState(null)

  const loadData = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      const [settings, statsData, chart, stock, board, feed] = await Promise.all([
        getDashboardSettings(tenantId),
        getDashboardStats(tenantId),
        getRevenueChart(tenantId),
        getLowStockItems(tenantId),
        getEmployeeLeaderboard(tenantId),
        getRecentActivity(tenantId),
      ])

      const merged = { ...DEFAULT_WIDGETS, ...settings }
      setWidgets(merged)
      setTargetAmount(settings.monthlyTargetAmount ?? null)
      setStats(statsData)
      setChartData(chart)
      setLowStock(stock)
      setLeaderboard(board)
      setActivity(feed)
    } catch {
      toast.error('Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  useEffect(() => { loadData() }, [loadData])

  const handleSaveSettings = async (newWidgets, newTarget) => {
    const payload = { ...newWidgets, monthlyTargetAmount: newTarget ? Number(newTarget) : null }
    const { error } = await saveDashboardSettings(tenantId, payload)
    if (error) { toast.error('Failed to save settings'); return }
    setWidgets(newWidgets)
    setTargetAmount(newTarget ? Number(newTarget) : null)
    toast.success('Dashboard updated')
  }

  // ── Derived values ──────────────────────────────────────────────────────
  const kpiCards = [
    widgets.todaySales && {
      key: 'todaySales', icon: IndianRupee, label: "Today's Revenue",
      value: fmtCurr(stats?.today.revenue), color: 'bg-emerald-500',
      sub: `${stats?.today.count ?? 0} orders today`, delay: 0,
    },
    widgets.monthlyRevenue && {
      key: 'monthlyRevenue', icon: TrendingUp, label: 'Monthly Revenue',
      value: fmtCurr(stats?.monthly.revenue), color: 'bg-indigo-500',
      sub: `${stats?.monthly.change >= 0 ? '+' : ''}${(stats?.monthly.change ?? 0).toFixed(1)}% vs last month`,
      subUp: (stats?.monthly.change ?? 0) >= 0, delay: 0.06,
    },
    widgets.cashFlow && {
      key: 'cashFlow', icon: Activity, label: 'Net Profit (Month)',
      value: fmtCurr(stats?.cashFlow.net), color: (stats?.cashFlow.net ?? 0) >= 0 ? 'bg-violet-500' : 'bg-red-500',
      sub: `Expenses: ${fmtCurr(stats?.cashFlow.expenses)}`,
      subUp: (stats?.cashFlow.net ?? 0) >= 0, delay: 0.12,
    },
    widgets.customerPulse && {
      key: 'customerPulse', icon: Users, label: 'Customers',
      value: fmt(stats?.customers.total), color: 'bg-orange-500',
      sub: `+${stats?.customers.newThisMonth ?? 0} new this month`, delay: 0.18,
    },
    widgets.pendingApprovals && {
      key: 'pendingApprovals', icon: ClipboardList, label: 'Pending Approvals',
      value: pendingCount, color: pendingCount > 0 ? 'bg-yellow-500' : 'bg-slate-500',
      sub: pendingCount > 0 ? 'Tap to review →' : 'All caught up', delay: 0.24,
      onClick: () => navigate('/pending-approvals'),
    },
  ].filter(Boolean)

  const targetPct = targetAmount && stats
    ? Math.min(100, Math.round((stats.monthly.revenue / targetAmount) * 100))
    : 0

  const rankColors = ['text-yellow-400', 'text-slate-400', 'text-orange-400']
  const rankBg = ['bg-yellow-400/10', 'bg-slate-400/10', 'bg-orange-400/10']

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div><Skeleton className="h-7 w-32 mb-1" /><Skeleton className="h-4 w-48" /></div>
          <Skeleton className="h-9 w-28" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[0,1,2,3].map(i => <CardSkeleton key={i} />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <CardSkeleton className="lg:col-span-2" />
          <CardSkeleton />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <CustomizeDialog widgets={widgets} targetAmount={targetAmount} onSave={handleSaveSettings} />
      </div>

      {/* KPI Cards */}
      {kpiCards.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {kpiCards.map(card => (
            <StatCard key={card.key} {...card} />
          ))}
        </div>
      )}

      {/* Monthly Target */}
      <AnimatePresence>
        {widgets.monthlyTarget && targetAmount && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Card className="border-border/60">
              <CardContent className="pt-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-indigo-400" />
                    <span className="font-semibold text-sm">Monthly Revenue Target</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xl font-bold">{targetPct}%</span>
                    <p className="text-xs text-muted-foreground">{fmtCurr(stats?.monthly.revenue)} of {fmtCurr(targetAmount)}</p>
                  </div>
                </div>
                <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                  <motion.div
                    className={`h-3 rounded-full ${targetPct >= 100 ? 'bg-emerald-500' : targetPct >= 60 ? 'bg-indigo-500' : 'bg-orange-400'}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${targetPct}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                  />
                </div>
                {targetPct >= 100 && (
                  <p className="text-xs text-emerald-500 mt-2 font-medium flex items-center gap-1">
                    <Star className="w-3 h-3" /> Target achieved! Great work this month.
                  </p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Revenue Chart + Smart Alerts */}
      {(widgets.revenueChart || widgets.smartAlerts) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {widgets.revenueChart && (
            <motion.div
              className="lg:col-span-2"
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            >
              <Card className="h-full border-border/60">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-indigo-400" /> 7-Day Revenue
                  </CardTitle>
                  <CardDescription>Daily sales revenue for the past week</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={chartData} barSize={32}>
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
          )}

          {widgets.smartAlerts && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
              <Card className="h-full border-border/60">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Zap className="w-4 h-4 text-yellow-400" /> Smart Alerts
                  </CardTitle>
                  <CardDescription>Business health snapshot</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <AlertRow
                    level={stats?.inventory.lowStock > 0 ? (stats.inventory.lowStock > 5 ? 'red' : 'yellow') : 'green'}
                    label={stats?.inventory.lowStock > 0 ? `${stats.inventory.lowStock} items need restocking` : 'Stock levels healthy'}
                    sub={stats?.inventory.lowStock > 0 ? 'Check Low Stock section below' : 'All items in stock'}
                  />
                  <AlertRow
                    level={(stats?.cashFlow.net ?? 0) >= 0 ? 'green' : 'red'}
                    label={(stats?.cashFlow.net ?? 0) >= 0 ? 'Profitable this month' : 'Expenses exceed income'}
                    sub={`Net: ${fmtCurr(stats?.cashFlow.net)}`}
                  />
                  <AlertRow
                    level={stats?.customers.newThisMonth > 0 ? 'green' : 'yellow'}
                    label={`${stats?.customers.newThisMonth ?? 0} new customers this month`}
                    sub={stats?.customers.topBuyer ? `Top: ${stats.customers.topBuyer.full_name}` : 'No purchases yet'}
                  />
                  {(stats?.monthly.change ?? 0) < -10 && (
                    <AlertRow
                      level="red"
                      label="Revenue dropped significantly"
                      sub={`${Math.abs(stats.monthly.change).toFixed(1)}% below last month`}
                    />
                  )}
                  {stats?.today.count === 0 && (
                    <AlertRow
                      level="yellow"
                      label="No sales recorded today"
                      sub="Consider running a promotion"
                    />
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>
      )}

      {/* Employee Leaderboard + Low Stock */}
      {(widgets.employeeLeaderboard || widgets.lowStockAlerts) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {widgets.employeeLeaderboard && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <Card className="border-border/60">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-yellow-400" /> Employee Leaderboard
                  </CardTitle>
                  <CardDescription>Top sellers this month</CardDescription>
                </CardHeader>
                <CardContent>
                  {leaderboard.length === 0 ? (
                    <EmptyState text="No sales recorded this month yet" />
                  ) : (
                    <div className="space-y-3">
                      {leaderboard.map((emp) => (
                        <div key={emp.rank} className={`flex items-center gap-3 rounded-lg p-3 ${rankBg[emp.rank - 1]}`}>
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${rankColors[emp.rank - 1]}`}>
                            #{emp.rank}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm truncate">{emp.name}</p>
                            <p className="text-xs text-muted-foreground">{emp.count} sales</p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-sm">{fmtCurr(emp.total)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {widgets.lowStockAlerts && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
              <Card className="border-border/60">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-orange-400" /> Low Stock Alerts
                  </CardTitle>
                  <CardDescription>Items needing immediate restock</CardDescription>
                </CardHeader>
                <CardContent>
                  {lowStock.length === 0 ? (
                    <EmptyState text="All items are well stocked" icon="✅" />
                  ) : (
                    <div className="space-y-2">
                      {lowStock.map((item) => {
                        const remaining = (item.quantity || 0) - (item.quantity_sold || 0)
                        const name = item.products
                          ? `${item.products.brand} ${item.products.model}${item.products.variant ? ` ${item.products.variant}` : ''}`
                          : '—'
                        return (
                          <div key={item.id} className="flex items-center justify-between gap-2 py-1.5 border-b border-border/50 last:border-0">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium truncate">{name}</p>
                              {item.products?.color && <p className="text-xs text-muted-foreground">{item.products.color}</p>}
                            </div>
                            <Badge variant="outline" className={`shrink-0 text-xs ${item.status === 'sold' ? 'border-red-500/40 text-red-400' : 'border-orange-500/40 text-orange-400'}`}>
                              {item.status === 'sold' ? 'Out of stock' : `${remaining} left`}
                            </Badge>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>
      )}

      {/* Recent Activity */}
      {widgets.recentActivity && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Card className="border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="w-4 h-4 text-indigo-400" /> Recent Activity
              </CardTitle>
              <CardDescription>Latest sales and purchases</CardDescription>
            </CardHeader>
            <CardContent>
              {activity.length === 0 ? (
                <EmptyState text="No activity yet — start by recording a sale" />
              ) : (
                <div className="space-y-0 divide-y divide-border/50">
                  {activity.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 py-2.5">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${item.type === 'sale' ? 'bg-emerald-500/10' : 'bg-orange-500/10'}`}>
                        {item.type === 'sale'
                          ? <ShoppingCart className="w-4 h-4 text-emerald-500" />
                          : <ShoppingBag className="w-4 h-4 text-orange-500" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.label}</p>
                        <p className="text-xs text-muted-foreground truncate">{item.sub}</p>
                        {item.salesman && (
                          <p className="text-xs text-indigo-400 truncate">by {item.salesman}</p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-sm font-semibold ${item.type === 'sale' ? 'text-emerald-500' : 'text-orange-500'}`}>
                          {item.type === 'sale' ? '+' : '-'}{fmtCurr(item.amount)}
                        </p>
                        <p className="text-xs text-muted-foreground">{timeAgo(item.at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  )
}

// ─── Sub-components ──────────────────────────────────────────────────────────
function AlertRow({ level, label, sub }) {
  const colors = {
    red: 'bg-red-500/10 border-red-500/20 text-red-400',
    yellow: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400',
    green: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
  }
  const dot = { red: 'bg-red-400', yellow: 'bg-yellow-400', green: 'bg-emerald-400' }
  return (
    <div className={`flex items-start gap-2.5 rounded-lg border p-2.5 ${colors[level]}`}>
      <div className={`w-2 h-2 rounded-full mt-0.5 shrink-0 ${dot[level]}`} />
      <div className="min-w-0">
        <p className="text-sm font-medium leading-tight">{label}</p>
        <p className="text-xs opacity-70 mt-0.5">{sub}</p>
      </div>
    </div>
  )
}

function EmptyState({ text, icon = '📦' }) {
  return (
    <div className="text-center py-8 text-muted-foreground">
      <p className="text-2xl mb-2">{icon}</p>
      <p className="text-sm">{text}</p>
    </div>
  )
}
