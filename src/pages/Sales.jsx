import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Plus, Search, Trash2, Download, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Navigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useAuth } from '@/context/AuthContext'
import { getSales, getSaleById, deleteSale } from '@/lib/sales'
import { getTenantUsers } from '@/lib/users'
import { generateInvoicePdf } from '@/lib/generateInvoicePdf'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'

const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

function TypeBadge({ type }) {
  return type === 'b2b' ? (
    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">B2B</span>
  ) : (
    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-sky-500/10 text-sky-400 border border-sky-500/20">B2C</span>
  )
}

function PaymentBadge({ status }) {
  const styles = {
    paid: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    partial: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    pending: 'bg-red-500/10 text-red-400 border-red-500/20',
  }
  return (
    <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium border capitalize', styles[status] ?? styles.pending)}>
      {status}
    </span>
  )
}

const DATE_TABS = [
  { value: 'all', label: 'All' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
]

function getDateRange(range) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  if (range === 'today') return { from: today.toISOString().split('T')[0], to: new Date().toISOString().split('T')[0] }
  if (range === 'week') {
    const d = new Date(today); d.setDate(d.getDate() - 7)
    return { from: d.toISOString().split('T')[0], to: new Date().toISOString().split('T')[0] }
  }
  if (range === 'month') {
    const d = new Date(today); d.setMonth(d.getMonth() - 1)
    return { from: d.toISOString().split('T')[0], to: new Date().toISOString().split('T')[0] }
  }
  return {}
}

export default function Sales() {
  const navigate = useNavigate()
  const { currentUser, currentTenant } = useAuth()
  const tenantId = currentTenant?.id
  const isEmployee = currentUser?.role === 'employee'

  const [sales, setSales] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [dateTab, setDateTab] = useState('all')

  const [detailId, setDetailId] = useState(null)
  const [detailData, setDetailData] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const fetchSales = async () => {
    if (!tenantId) return
    setLoading(true)
    const filters = {
      ...(isEmployee ? { employeeId: currentUser.id } : {}),
      ...getDateRange(dateTab),
    }
    const { data } = await getSales(tenantId, filters)
    setSales(data)
    setLoading(false)
  }

  useEffect(() => { fetchSales() }, [tenantId, dateTab])

  useEffect(() => {
    if (tenantId) getTenantUsers(tenantId).then(({ data }) => setUsers(data))
  }, [tenantId])

  const filtered = useMemo(() => {
    if (!search.trim()) return sales
    const q = search.toLowerCase()
    return sales.filter((s) =>
      s.invoice_number?.toLowerCase().includes(q) ||
      s.customers?.full_name?.toLowerCase().includes(q) ||
      s.customers?.company_name?.toLowerCase().includes(q)
    )
  }, [sales, search])

  const openDetail = async (id) => {
    setDetailId(id)
    setDetailData(null)
    setDetailLoading(true)
    const { data } = await getSaleById(id)
    setDetailData(data)
    setDetailLoading(false)
  }

  const handleDownloadPdf = () => {
    if (!detailData) return
    const sameState = (detailData.cgst_amount || 0) > 0
    try {
      generateInvoicePdf({
        sale: detailData,
        saleItems: detailData.sale_items ?? [],
        customer: detailData.customers ?? {},
        tenant: currentTenant,
        sameState,
      })
    } catch {
      toast.error('PDF generation failed')
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    const { error } = await deleteSale(deleteTarget.id)
    setDeleting(false)
    if (error) {
      toast.error('Failed to delete sale')
    } else {
      toast.success('Sale deleted')
      setDeleteTarget(null)
      if (detailId === deleteTarget.id) setDetailId(null)
      fetchSales()
    }
  }

  const employeeName = (id) => users.find((u) => u.id === id)?.full_name ?? '—'
  const custName = (s) =>
    s.customers?.customer_type === 'company' ? s.customers.company_name : s.customers?.full_name ?? '—'

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="p-4 md:p-6 space-y-5"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Sales</h1>
          <p className="text-sm text-muted-foreground">{sales.length} record{sales.length !== 1 ? 's' : ''}</p>
        </div>
        <Button
          onClick={() => navigate('/sales/new')}
          className="bg-indigo-500 hover:bg-indigo-600 text-white"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          New Sale
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-1 border border-border rounded-lg p-1 self-start flex-wrap">
          {DATE_TABS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setDateTab(value)}
              className={cn(
                'px-3 py-1.5 rounded text-sm font-medium transition-colors',
                dateTab === value ? 'bg-indigo-500 text-white' : 'text-muted-foreground hover:text-foreground'
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
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search invoice or customer..."
            className="pl-9"
          />
        </div>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              {['Invoice No.', 'Date', 'Customer', 'Employee', 'Type', 'Grand Total', 'Payment', ''].map((h, i) => (
                <th key={i} className={cn(
                  'px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider',
                  i === 5 ? 'text-right' : 'text-left'
                )}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 8 }).map((_, j) => (
                    <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>
                  ))}
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-16 text-center text-muted-foreground text-sm">
                  {sales.length === 0 ? 'No sales yet — create your first one' : 'No results match your search'}
                </td>
              </tr>
            ) : filtered.map((sale) => (
              <tr
                key={sale.id}
                onClick={() => openDetail(sale.id)}
                className="hover:bg-muted/20 cursor-pointer transition-colors"
              >
                <td className="px-4 py-3 font-mono text-xs font-semibold">{sale.invoice_number}</td>
                <td className="px-4 py-3 text-muted-foreground">{fmtDate(sale.sale_date)}</td>
                <td className="px-4 py-3 font-medium">{custName(sale)}</td>
                <td className="px-4 py-3 text-muted-foreground">{employeeName(sale.employee_id)}</td>
                <td className="px-4 py-3"><TypeBadge type={sale.sale_type} /></td>
                <td className="px-4 py-3 text-right font-semibold">{fmt(sale.grand_total)}</td>
                <td className="px-4 py-3"><PaymentBadge status={sale.payment_status} /></td>
                <td className="px-4 py-3">
                  <Button
                    variant="ghost" size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-red-400"
                    onClick={(e) => { e.stopPropagation(); setDeleteTarget(sale) }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border p-4 space-y-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          ))
        ) : filtered.length === 0 ? (
          <p className="text-center py-12 text-muted-foreground text-sm">
            {sales.length === 0 ? 'No sales yet — create your first one' : 'No results match your search'}
          </p>
        ) : filtered.map((sale) => (
          <div
            key={sale.id}
            onClick={() => openDetail(sale.id)}
            className="rounded-xl border border-border p-4 cursor-pointer hover:bg-muted/20 transition-colors"
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="font-mono text-xs font-semibold">{sale.invoice_number}</p>
                <p className="font-medium text-sm mt-0.5">{custName(sale)}</p>
                <p className="text-xs text-muted-foreground">{fmtDate(sale.sale_date)}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-sm">{fmt(sale.grand_total)}</p>
                <div className="mt-1"><PaymentBadge status={sale.payment_status} /></div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Detail Dialog ─────────────────────────────────────────────────── */}
      <Dialog open={Boolean(detailId)} onOpenChange={() => { setDetailId(null); setDetailData(null) }}>
        <DialogContent className="max-w-2xl p-0 max-h-[90vh] overflow-y-auto">
          {detailLoading || !detailData ? (
            <div className="p-8 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Detail header */}
              <div className="bg-indigo-500/10 border-b border-border px-6 py-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-mono text-sm font-bold">{detailData.invoice_number}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{fmtDate(detailData.sale_date)}</p>
                  </div>
                  <div className="flex gap-2">
                    <TypeBadge type={detailData.sale_type} />
                    <PaymentBadge status={detailData.payment_status} />
                  </div>
                </div>
              </div>

              {/* Customer + Employee */}
              <div className="px-6 py-4 grid grid-cols-2 gap-4 border-b border-border text-sm">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Customer</p>
                  <p className="font-medium">
                    {detailData.customers?.customer_type === 'company'
                      ? detailData.customers.company_name
                      : detailData.customers?.full_name ?? '—'}
                  </p>
                  {detailData.customers?.phone && (
                    <p className="text-xs text-muted-foreground">{detailData.customers.phone}</p>
                  )}
                  {detailData.customers?.gstin && (
                    <p className="text-xs font-mono text-muted-foreground">{detailData.customers.gstin}</p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Employee</p>
                  <p className="font-medium">{employeeName(detailData.employee_id)}</p>
                  <p className="text-xs text-muted-foreground capitalize">{detailData.payment_method?.replace('_', ' ')}</p>
                  {detailData.upi_reference && (
                    <p className="text-xs text-muted-foreground font-mono">Ref: {detailData.upi_reference}</p>
                  )}
                </div>
              </div>

              {/* Line Items */}
              <div className="px-6 py-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Items</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs text-muted-foreground uppercase">
                        <th className="pb-2 text-left">Product</th>
                        <th className="pb-2 text-right">Qty</th>
                        <th className="pb-2 text-right">Rate</th>
                        <th className="pb-2 text-right">GST</th>
                        <th className="pb-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {(detailData.sale_items ?? []).map((item) => {
                        const p = item.products
                        const name = [p?.brand, p?.model, p?.variant, p?.color].filter(Boolean).join(' ')
                        return (
                          <tr key={item.id}>
                            <td className="py-2 pr-2">
                              <p className="font-medium text-xs">{name}</p>
                              {item.imei_number && (
                                <p className="text-xs text-muted-foreground">IMEI: {item.imei_number}</p>
                              )}
                            </td>
                            <td className="py-2 text-right text-xs">{item.quantity}</td>
                            <td className="py-2 text-right text-xs">{fmt(item.unit_price)}</td>
                            <td className="py-2 text-right text-xs text-muted-foreground">
                              {fmt((item.cgst_amount || 0) + (item.sgst_amount || 0) + (item.igst_amount || 0))}
                            </td>
                            <td className="py-2 text-right text-xs font-semibold">{fmt(item.total_amount)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Totals */}
              <div className="px-6 pb-4 border-t border-border pt-4">
                <div className="max-w-xs ml-auto space-y-1.5 text-sm">
                  <TotalRow label="Subtotal" value={fmt(detailData.subtotal)} />
                  {(detailData.discount_amount || 0) > 0 && (
                    <TotalRow label="Discount" value={`-${fmt(detailData.discount_amount)}`} />
                  )}
                  <TotalRow label="Taxable Amount" value={fmt(detailData.taxable_amount)} />
                  {(detailData.cgst_amount || 0) > 0 && (
                    <>
                      <TotalRow label="CGST" value={fmt(detailData.cgst_amount)} muted />
                      <TotalRow label="SGST" value={fmt(detailData.sgst_amount)} muted />
                    </>
                  )}
                  {(detailData.igst_amount || 0) > 0 && (
                    <TotalRow label="IGST" value={fmt(detailData.igst_amount)} muted />
                  )}
                  <div className="border-t border-border pt-2">
                    <TotalRow label="Grand Total" value={fmt(detailData.grand_total)} bold />
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 pb-5 flex justify-between items-center border-t border-border pt-4">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                  onClick={() => { setDeleteTarget(detailData); setDetailId(null) }}
                >
                  <Trash2 className="w-4 h-4 mr-1.5" />
                  Delete Sale
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => { setDetailId(null); setDetailData(null) }}>
                    Close
                  </Button>
                  <Button
                    size="sm"
                    className="bg-indigo-500 hover:bg-indigo-600 text-white"
                    onClick={handleDownloadPdf}
                  >
                    <Download className="w-4 h-4 mr-1.5" />
                    Download PDF
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation ────────────────────────────────────────────── */}
      <Dialog open={Boolean(deleteTarget)} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="max-w-sm p-6">
          <DialogHeader>
            <DialogTitle>Delete Sale?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground pr-2">
            This will permanently delete invoice{' '}
            <span className="font-mono font-semibold text-foreground">{deleteTarget?.invoice_number}</span>,
            reverse the inventory changes, and adjust the customer's purchase history.
          </p>
          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" disabled={deleting} onClick={handleDelete}>
              {deleting ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Deleting…</> : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}

function TotalRow({ label, value, bold, muted }) {
  return (
    <div className="flex justify-between">
      <span className={cn('text-muted-foreground', muted && 'text-xs')}>{label}</span>
      <span className={cn(bold && 'font-bold text-base')}>{value}</span>
    </div>
  )
}
