import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useForm, Controller } from 'react-hook-form'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import {
  Plus, Loader2, ShieldCheck, Store, Users, AlertTriangle,
  CheckCircle2, XCircle, MoreHorizontal, Pencil, TrendingUp,
  IndianRupee, CalendarClock, Clock,
} from 'lucide-react'
import { toast } from 'sonner'
import { getAllTenants, onboardTenant, setTenantActive, updateTenantSubscription } from '@/lib/superAdmin'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

// ── Constants ───────────────────────────────────────────────────────────────
const PLAN_PRICE = { basic: 999, pro: 1999 }
const PLAN_COLOR = { basic: 'hsl(239 84% 67%)', pro: 'hsl(262 80% 60%)' }

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function daysUntil(dateStr) {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24))
}

function expiryStatus(dateStr) {
  if (!dateStr) return 'none'
  const diff = daysUntil(dateStr)
  if (diff < 0) return 'expired'
  if (diff <= 30) return 'soon'
  return 'ok'
}

function fmt(n) {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n ?? 0)
}

function SectionHeader({ label }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{label}</p>
      <Separator className="flex-1" />
    </div>
  )
}

// ── Custom chart tooltip ─────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm shadow-xl">
      <p className="text-slate-400 text-xs mb-1">{label}</p>
      <p className="text-white font-semibold">{payload[0].value} client{payload[0].value !== 1 ? 's' : ''}</p>
    </div>
  )
}

// ── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, color, sub, delay = 0 }) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}>
      <Card className="hover:shadow-lg transition-shadow border-border/60">
        <CardContent className="flex items-start gap-4 p-5">
          <div className={`flex items-center justify-center w-11 h-11 rounded-xl shrink-0 ${color}`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-2xl font-bold tracking-tight">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
            {sub && <p className="text-xs text-indigo-400 mt-0.5">{sub}</p>}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ── Onboard Dialog ───────────────────────────────────────────────────────────
function OnboardDialog({ onSuccess }) {
  const [open, setOpen] = useState(false)
  const { register, control, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({
    defaultValues: { plan: 'basic' },
  })

  const onSubmit = async (values) => {
    const { error } = await onboardTenant({
      shopName: values.shopName,
      ownerName: values.ownerName,
      ownerEmail: values.ownerEmail,
      tempPassword: values.tempPassword,
      plan: values.plan,
      subscriptionExpiresAt: values.subscriptionExpiresAt || null,
    })
    if (error) { toast.error(error.message ?? 'Failed to onboard client'); return }
    toast.success(`${values.shopName} onboarded! Owner will receive a verification email.`)
    reset(); setOpen(false); onSuccess()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset() }}>
      <DialogTrigger asChild>
        <Button className="bg-indigo-500 hover:bg-indigo-600 text-white">
          <Plus className="w-4 h-4 mr-2" />Onboard New Client
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
          <DialogTitle className="flex items-center gap-2">
            <Store className="w-4 h-4 text-indigo-400" /> Onboard New Client
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="px-6 pb-6 space-y-4 pt-5">
          <div className="space-y-1.5">
            <Label>Shop Name <span className="text-red-400">*</span></Label>
            <Input {...register('shopName', { required: 'Required' })} placeholder="Raj Mobile Store" />
            {errors.shopName && <p className="text-red-400 text-xs">{errors.shopName.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Plan</Label>
              <Controller name="plan" control={control} render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="basic">Basic — ₹999/mo</SelectItem>
                    <SelectItem value="pro">Pro — ₹1,999/mo</SelectItem>
                  </SelectContent>
                </Select>
              )} />
            </div>
            <div className="space-y-1.5">
              <Label>Subscription Expires</Label>
              <Input type="date" {...register('subscriptionExpiresAt')} />
              <p className="text-xs text-muted-foreground">Leave blank for no expiry</p>
            </div>
          </div>
          <div className="border-t border-border pt-4 space-y-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Owner Account</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Full Name <span className="text-red-400">*</span></Label>
                <Input {...register('ownerName', { required: 'Required' })} placeholder="Rajesh Kumar" />
                {errors.ownerName && <p className="text-red-400 text-xs">{errors.ownerName.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Email <span className="text-red-400">*</span></Label>
                <Input type="email" {...register('ownerEmail', { required: 'Required' })} placeholder="raj@example.com" />
                {errors.ownerEmail && <p className="text-red-400 text-xs">{errors.ownerEmail.message}</p>}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Temporary Password <span className="text-red-400">*</span></Label>
              <Input type="text" {...register('tempPassword', { required: 'Required', minLength: { value: 6, message: 'Min 6 characters' } })} placeholder="Share this with the shop owner" />
              {errors.tempPassword && <p className="text-red-400 text-xs">{errors.tempPassword.message}</p>}
              <p className="text-xs text-muted-foreground">Owner can change this after first login</p>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => { setOpen(false); reset() }}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting} className="bg-indigo-500 hover:bg-indigo-600 text-white">
              {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Creating…</> : 'Create Account'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Edit Subscription Dialog ─────────────────────────────────────────────────
function EditSubscriptionDialog({ tenant, onSuccess }) {
  const [open, setOpen] = useState(false)
  const { register, control, handleSubmit, reset, formState: { isSubmitting } } = useForm({
    defaultValues: {
      plan: tenant.plan ?? 'basic',
      subscriptionExpiresAt: tenant.subscription_expires_at
        ? new Date(tenant.subscription_expires_at).toISOString().split('T')[0]
        : '',
    },
  })

  const onSubmit = async (values) => {
    const { error } = await updateTenantSubscription(tenant.id, {
      plan: values.plan,
      subscriptionExpiresAt: values.subscriptionExpiresAt || null,
    })
    if (error) { toast.error(error.message ?? 'Failed to update'); return }
    toast.success('Subscription updated')
    setOpen(false); onSuccess()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset() }}>
      <DialogTrigger asChild>
        <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setOpen(true) }}>
          <Pencil className="w-4 h-4 mr-2" />Edit Subscription
        </DropdownMenuItem>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
          <DialogTitle>Edit Subscription</DialogTitle>
          <p className="text-sm text-muted-foreground">{tenant.shop_name}</p>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="px-6 pb-6 pt-5 space-y-4">
          <div className="space-y-1.5">
            <Label>Plan</Label>
            <Controller name="plan" control={control} render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="basic">Basic — ₹999/mo</SelectItem>
                  <SelectItem value="pro">Pro — ₹1,999/mo</SelectItem>
                </SelectContent>
              </Select>
            )} />
          </div>
          <div className="space-y-1.5">
            <Label>Subscription Expires</Label>
            <Input type="date" {...register('subscriptionExpiresAt')} />
            <p className="text-xs text-muted-foreground">Leave blank for no expiry</p>
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting} className="bg-indigo-500 hover:bg-indigo-600 text-white">
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function SuperAdmin() {
  const [tenants, setTenants] = useState([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    const { data, error } = await getAllTenants()
    if (error) toast.error('Failed to load tenants')
    else setTenants(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleToggleActive = async (tenant) => {
    const { error } = await setTenantActive(tenant.id, !tenant.is_active)
    if (error) { toast.error(error.message ?? 'Failed to update'); return }
    toast.success(`${tenant.shop_name} ${tenant.is_active ? 'deactivated' : 'reactivated'}`)
    load()
  }

  // ── Derived dashboard metrics ───────────────────────────────────────────
  const active = tenants.filter((t) => t.is_active)
  const inactive = tenants.filter((t) => !t.is_active)
  const expiringSoonList = active
    .filter((t) => expiryStatus(t.subscription_expires_at) === 'soon')
    .sort((a, b) => new Date(a.subscription_expires_at) - new Date(b.subscription_expires_at))
  const expiredList = tenants.filter((t) => expiryStatus(t.subscription_expires_at) === 'expired')

  const mrr = active.reduce((sum, t) => sum + (PLAN_PRICE[t.plan] ?? 0), 0)

  // Last 6 months onboarding trend
  const growthData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date()
    d.setMonth(d.getMonth() - (5 - i))
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
    return { label, count: tenants.filter((t) => t.created_at?.startsWith(key)).length }
  })

  // Plan distribution
  const planDist = [
    { name: 'Basic', count: active.filter((t) => t.plan === 'basic').length },
    { name: 'Pro', count: active.filter((t) => t.plan === 'pro').length },
  ]
  const totalActive = active.length || 1

  // Recently joined
  const recentlyJoined = [...tenants]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 5)

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-indigo-400" /> Platform Administration
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <OnboardDialog onSuccess={load} />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard icon={Store}         label="Total Clients"  value={tenants.length}        color="bg-indigo-500"  delay={0} />
        <StatCard icon={CheckCircle2}  label="Active"         value={active.length}         color="bg-emerald-500" delay={0.05} />
        <StatCard icon={XCircle}       label="Inactive"       value={inactive.length}       color="bg-slate-500"   delay={0.1} />
        <StatCard icon={AlertTriangle} label="Expiring Soon"  value={expiringSoonList.length} color="bg-amber-500" delay={0.15} />
        <StatCard
          icon={IndianRupee}
          label="Est. MRR"
          value={`₹${fmt(mrr)}`}
          color="bg-violet-500"
          sub={`${active.length} paying client${active.length !== 1 ? 's' : ''}`}
          delay={0.2}
        />
      </div>

      {/* Growth Chart + Plan Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Onboarding trend */}
        <motion.div
          className="lg:col-span-2"
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
        >
          <Card className="border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-indigo-400" /> Client Growth
              </CardTitle>
              <CardDescription>New clients onboarded per month (last 6 months)</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={growthData} barSize={36}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} allowDecimals={false} width={24} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: 'hsl(var(--muted))', radius: 4 }} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {growthData.map((_, i) => (
                      <Cell key={i} fill={i === growthData.length - 1 ? 'hsl(239 84% 67%)' : 'hsl(239 84% 67% / 0.5)'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        {/* Plan distribution */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="h-full border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-400" /> Plan Distribution
              </CardTitle>
              <CardDescription>Active clients by plan</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {planDist.map(({ name, count }) => {
                const pct = Math.round((count / totalActive) * 100)
                const price = PLAN_PRICE[name.toLowerCase()] ?? 0
                return (
                  <div key={name} className="space-y-1.5">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{name}</span>
                      <span className="text-muted-foreground">{count} · ₹{fmt(count * price)}/mo</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
                      <motion.div
                        className="h-2.5 rounded-full"
                        style={{ backgroundColor: PLAN_COLOR[name.toLowerCase()] }}
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.7, ease: 'easeOut', delay: 0.4 }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">{pct}% of active clients</p>
                  </div>
                )
              })}

              <div className="border-t border-border pt-4 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total MRR</span>
                  <span className="font-bold text-violet-400">₹{fmt(mrr)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Est. Annual</span>
                  <span className="font-semibold">₹{fmt(mrr * 12)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Expiring Soon + Recently Joined */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Expiring Soon */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
          <Card className="border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarClock className="w-4 h-4 text-amber-400" /> Expiring Soon
              </CardTitle>
              <CardDescription>Subscriptions expiring within 30 days</CardDescription>
            </CardHeader>
            <CardContent>
              {expiringSoonList.length === 0 && expiredList.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-500 opacity-60" />
                  <p className="text-sm">All subscriptions are healthy</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {expiredList.map((t) => (
                    <div key={t.id} className="flex items-center justify-between gap-3 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2.5">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{t.shop_name}</p>
                        <p className="text-xs text-red-400">Expired {formatDate(t.subscription_expires_at)}</p>
                      </div>
                      <Badge className="bg-red-500/15 text-red-400 border-red-500/20 shrink-0">Expired</Badge>
                    </div>
                  ))}
                  {expiringSoonList.map((t) => {
                    const days = daysUntil(t.subscription_expires_at)
                    return (
                      <div key={t.id} className="flex items-center justify-between gap-3 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2.5">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{t.shop_name}</p>
                          <p className="text-xs text-amber-400">Expires in {days} day{days !== 1 ? 's' : ''} · {formatDate(t.subscription_expires_at)}</p>
                        </div>
                        <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/20 shrink-0 capitalize">{t.plan}</Badge>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Recently Joined */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Card className="border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-400" /> Recently Onboarded
              </CardTitle>
              <CardDescription>Latest 5 clients added to the platform</CardDescription>
            </CardHeader>
            <CardContent>
              {recentlyJoined.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Store className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No clients onboarded yet</p>
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {recentlyJoined.map((t) => (
                    <div key={t.id} className="flex items-center gap-3 py-2.5">
                      <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0">
                        <Store className="w-4 h-4 text-indigo-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{t.shop_name}</p>
                        <p className="text-xs text-muted-foreground">{t.owner_name || t.owner_email || '—'}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <Badge variant="outline" className="text-xs capitalize mb-1">{t.plan}</Badge>
                        <p className="text-xs text-muted-foreground">{formatDate(t.created_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* All Clients Table */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
        <SectionHeader label="All Clients" />
        <Card className="border-border/60">
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : tenants.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
                <Users className="w-10 h-10 opacity-30" />
                <p className="text-sm">No clients onboarded yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs text-muted-foreground">
                      <th className="text-left px-4 py-3 font-medium">Shop</th>
                      <th className="text-left px-4 py-3 font-medium">Owner</th>
                      <th className="text-left px-4 py-3 font-medium">Email</th>
                      <th className="text-left px-4 py-3 font-medium">Plan</th>
                      <th className="text-left px-4 py-3 font-medium">Status</th>
                      <th className="text-left px-4 py-3 font-medium">Expires</th>
                      <th className="text-left px-4 py-3 font-medium">Joined</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {tenants.map((tenant) => {
                      const expiry = expiryStatus(tenant.subscription_expires_at)
                      return (
                        <tr key={tenant.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 font-medium">{tenant.shop_name}</td>
                          <td className="px-4 py-3 text-muted-foreground">{tenant.owner_name || '—'}</td>
                          <td className="px-4 py-3 text-muted-foreground">{tenant.owner_email || '—'}</td>
                          <td className="px-4 py-3">
                            <Badge variant="outline" className="capitalize">{tenant.plan}</Badge>
                          </td>
                          <td className="px-4 py-3">
                            {tenant.is_active
                              ? <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/20">Active</Badge>
                              : <Badge className="bg-slate-500/15 text-slate-400 border-slate-500/20">Inactive</Badge>
                            }
                          </td>
                          <td className="px-4 py-3">
                            <span className={
                              expiry === 'expired' ? 'text-red-400 font-medium' :
                              expiry === 'soon'    ? 'text-amber-400 font-medium' :
                              'text-muted-foreground'
                            }>
                              {formatDate(tenant.subscription_expires_at)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{formatDate(tenant.created_at)}</td>
                          <td className="px-4 py-3">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <EditSubscriptionDialog tenant={tenant} onSuccess={load} />
                                <DropdownMenuItem
                                  onClick={() => handleToggleActive(tenant)}
                                  className={tenant.is_active ? 'text-red-400 focus:text-red-400' : 'text-emerald-400 focus:text-emerald-400'}
                                >
                                  {tenant.is_active
                                    ? <><XCircle className="w-4 h-4 mr-2" />Deactivate</>
                                    : <><CheckCircle2 className="w-4 h-4 mr-2" />Reactivate</>
                                  }
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  )
}
