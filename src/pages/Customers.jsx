import React, { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Pencil, Trash2, Cake, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useAuth } from '@/context/AuthContext'
import { getCustomers, deleteCustomer } from '@/lib/customers'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import CustomerDialog from '@/components/customers/CustomerDialog'

const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

const fmtBirthdayShort = (dateStr) => {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}

const TypeBadge = ({ type }) =>
  type === 'company' ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
      🏢 Company
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-sky-500/10 text-sky-400 border border-sky-500/20">
      👤 Individual
    </span>
  )

const TABS = [
  { value: 'all',        label: 'All' },
  { value: 'individual', label: 'Individual' },
  { value: 'company',    label: 'Company' },
]

export default function Customers() {
  const { currentTenant } = useAuth()
  const tenantId = currentTenant?.id
  const navigate = useNavigate()

  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editCustomer, setEditCustomer] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const fetchData = async () => {
    if (!tenantId) return
    setLoading(true)
    const { data } = await getCustomers(tenantId)
    setCustomers(data)
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [tenantId])

  const filtered = useMemo(() => {
    let list = customers
    if (activeTab !== 'all') list = list.filter(c => c.customer_type === activeTab)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(c =>
        c.full_name?.toLowerCase().includes(q) ||
        c.company_name?.toLowerCase().includes(q) ||
        c.phone?.includes(q)
      )
    }
    return list
  }, [customers, activeTab, search])

  const upcomingBirthdays = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const in30 = new Date(today)
    in30.setDate(today.getDate() + 30)
    return customers
      .filter(c => c.customer_type === 'individual' && c.date_of_birth)
      .map(c => {
        const dob = new Date(c.date_of_birth)
        const yr = today.getFullYear()
        let next = new Date(yr, dob.getMonth(), dob.getDate())
        if (next < today) next = new Date(yr + 1, dob.getMonth(), dob.getDate())
        return { ...c, nextBirthday: next }
      })
      .filter(c => c.nextBirthday >= today && c.nextBirthday <= in30)
      .sort((a, b) => a.nextBirthday - b.nextBirthday)
  }, [customers])

  const displayName = (c) =>
    (c?.customer_type === 'company' ? c.company_name : c?.full_name) ?? '—'

  const handleOpenAdd = () => {
    setEditCustomer(null)
    setDialogOpen(true)
  }

  const handleOpenEdit = (e, customer) => {
    e?.stopPropagation()
    setEditCustomer(customer)
    setDialogOpen(true)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    const { error } = await deleteCustomer(tenantId, deleteTarget.id)
    setDeleting(false)
    if (error) {
      toast.error('Failed to delete customer')
    } else {
      toast.success('Customer deleted')
      setDeleteTarget(null)
      fetchData()
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="p-4 md:p-6 space-y-5"
    >
      {/* Upcoming Birthdays */}
      {upcomingBirthdays.length > 0 && (
        <div className="rounded-xl border border-pink-500/20 bg-pink-500/5 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Cake className="w-4 h-4 text-pink-400" />
            <span className="text-sm font-semibold text-pink-400">
              Upcoming Birthdays · next 30 days
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {upcomingBirthdays.map(c => (
              <span
                key={c.id}
                className="text-xs bg-pink-500/10 text-pink-300 border border-pink-500/20 px-3 py-1 rounded-full"
              >
                {c.full_name} · {fmtBirthdayShort(c.date_of_birth)}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Customers</h1>
          <p className="text-sm text-muted-foreground">{customers.length} total</p>
        </div>
        <Button onClick={handleOpenAdd} className="bg-indigo-500 hover:bg-indigo-600 text-white">
          <Plus className="w-4 h-4 mr-1.5" />
          Add Customer
        </Button>
      </div>

      {/* Tabs + Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-1 border border-border rounded-lg p-1 self-start">
          {TABS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setActiveTab(value)}
              className={cn(
                'px-3 py-1.5 rounded text-sm font-medium transition-colors',
                activeTab === value
                  ? 'bg-indigo-500 text-white'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or phone..."
            className="pl-9"
          />
        </div>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              {['Name / Company', 'Phone', 'City', 'Type', 'Total Purchases', 'Visits', 'Last Visit', ''].map((h, i) => (
                <th
                  key={i}
                  className={cn(
                    'px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider',
                    i >= 4 && i <= 6 ? 'text-right' : 'text-left'
                  )}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 8 }).map((_, j) => (
                    <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>
                  ))}
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-16 text-center text-muted-foreground text-sm">
                  {customers.length === 0
                    ? 'No customers yet — add your first one'
                    : 'No customers match your search'}
                </td>
              </tr>
            ) : (
              filtered.map(customer => (
                <tr
                  key={customer.id}
                  onClick={() => navigate(`/customers/${customer.id}`)}
                  className="hover:bg-muted/20 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 font-medium">{displayName(customer)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{customer.phone}</td>
                  <td className="px-4 py-3 text-muted-foreground">{customer.city || '—'}</td>
                  <td className="px-4 py-3"><TypeBadge type={customer.customer_type} /></td>
                  <td className="px-4 py-3 text-right">{fmt(customer.total_purchases)}</td>
                  <td className="px-4 py-3 text-right">{customer.visit_count ?? 0}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">{fmtDate(customer.last_visit_date)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end" onClick={e => e.stopPropagation()}>
                      <Button
                        variant="ghost" size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        onClick={e => handleOpenEdit(e, customer)}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost" size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-red-400"
                        onClick={e => { e.stopPropagation(); setDeleteTarget(customer) }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border p-4 space-y-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-1/3" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          ))
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground text-sm">
            {customers.length === 0
              ? 'No customers yet — add your first one'
              : 'No customers match your search'}
          </div>
        ) : (
          filtered.map(customer => (
            <div
              key={customer.id}
              onClick={() => navigate(`/customers/${customer.id}`)}
              className="rounded-xl border border-border p-4 cursor-pointer hover:bg-muted/20 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate">{displayName(customer)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{customer.phone}</p>
                  {customer.city && (
                    <p className="text-xs text-muted-foreground">{customer.city}</p>
                  )}
                </div>
                <TypeBadge type={customer.customer_type} />
              </div>
              <div
                className="flex items-center justify-between mt-3 pt-3 border-t border-border"
                onClick={e => e.stopPropagation()}
              >
                <p className="text-xs text-muted-foreground">
                  {fmt(customer.total_purchases)} · {customer.visit_count ?? 0} visits
                </p>
                <div className="flex gap-1">
                  <Button
                    variant="ghost" size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    onClick={e => handleOpenEdit(e, customer)}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost" size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-red-400"
                    onClick={() => setDeleteTarget(customer)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add / Edit Dialog */}
      <CustomerDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        customer={editCustomer}
        onSuccess={fetchData}
      />

      {/* Delete Confirmation */}
      <Dialog open={Boolean(deleteTarget)} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="max-w-sm p-6" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Delete Customer?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground pr-2">
            This will remove{' '}
            <span className="font-semibold text-foreground">{displayName(deleteTarget)}</span>{' '}
            from your customer list. This cannot be undone.
          </p>
          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" disabled={deleting} onClick={handleDelete}>
              {deleting
                ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Deleting…</>
                : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
