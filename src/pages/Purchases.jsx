import React, { useState, useEffect } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Plus, ReceiptText, AlertCircle, Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useAuth } from '@/context/AuthContext'
import { getPurchases, getPurchaseById, deletePurchase } from '@/lib/purchases'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'

const FILTERS = ['all', 'official', 'unofficial']

const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`

const fmtDate = (d) => {
  if (!d) return '—'
  const dt = new Date(d)
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function TypeBadge({ type }) {
  return type === 'official' ? (
    <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 hover:bg-blue-500/20">🔵 Official</Badge>
  ) : (
    <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30 hover:bg-slate-500/20">⚫ Unofficial</Badge>
  )
}

function PaymentBadge({ status }) {
  const map = {
    paid: 'bg-green-500/20 text-green-400 border-green-500/30 hover:bg-green-500/20',
    partial: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/20',
    pending: 'bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/20',
  }
  return (
    <Badge className={cn(map[status] ?? map.pending, 'capitalize')}>
      {status}
    </Badge>
  )
}

export default function Purchases() {
  const navigate = useNavigate()
  const { currentUser, currentTenant } = useAuth()

  // Role guard — employees cannot access this page
  if (currentUser?.role === 'employee') return <Navigate to="/dashboard" replace />

  const tenantId = currentTenant?.id
  const [filter, setFilter] = useState('all')
  const [purchases, setPurchases] = useState([])
  const [loading, setLoading] = useState(true)

  // Detail dialog state
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailData, setDetailData] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // Delete confirmation state
  const [deleteItem, setDeleteItem] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const fetchPurchases = async () => {
    if (!tenantId) return
    setLoading(true)
    const { data, error } = await getPurchases(tenantId, filter === 'all' ? null : filter)
    if (error) toast.error('Failed to load purchases')
    else setPurchases(data)
    setLoading(false)
  }

  useEffect(() => { fetchPurchases() }, [tenantId, filter])

  const openDetail = async (purchase) => {
    setDetailOpen(true)
    setDetailLoading(true)
    const { data, error } = await getPurchaseById(tenantId, purchase.id)
    setDetailLoading(false)
    if (error) {
      toast.error('Failed to load details')
      setDetailOpen(false)
    } else {
      setDetailData(data)
    }
  }

  const handleDelete = async () => {
    if (!deleteItem) return
    setDeleting(true)
    const { error } = await deletePurchase(tenantId, deleteItem.id)
    setDeleting(false)
    if (error) {
      toast.error('Failed to delete purchase')
    } else {
      toast.success('Purchase deleted')
      setPurchases((prev) => prev.filter((p) => p.id !== deleteItem.id))
      setDeleteItem(null)
    }
  }

  const isOfficial = detailData?.purchase_type === 'official'

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="p-4 md:p-6 space-y-5"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Purchases</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {loading ? '…' : `${purchases.length} record${purchases.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <Button
          onClick={() => navigate('/purchases/new')}
          className="bg-indigo-500 hover:bg-indigo-600 text-white shrink-0"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Purchase
        </Button>
      </div>

      {/* Filter Tabs */}
      <div className="flex rounded-lg border border-border p-1 w-fit">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'px-4 py-1.5 text-sm rounded capitalize transition-colors',
              filter === f
                ? 'bg-indigo-500 text-white'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/40 text-muted-foreground text-xs uppercase tracking-wider border-b border-border">
              <th className="px-4 py-3 text-left font-medium">Date</th>
              <th className="px-4 py-3 text-left font-medium">Supplier / Source</th>
              <th className="px-4 py-3 text-left font-medium">Bill No.</th>
              <th className="px-4 py-3 text-left font-medium">Type</th>
              <th className="px-4 py-3 text-right font-medium">Amount</th>
              <th className="px-4 py-3 text-center font-medium">Payment</th>
              <th className="px-4 py-3 text-center font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>
                  ))}
                </tr>
              ))
            ) : purchases.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-20 text-center text-muted-foreground">
                  <ReceiptText className="w-10 h-10 mx-auto mb-2 opacity-25" />
                  <p className="font-medium">No purchases yet</p>
                  <p className="text-sm mt-1">Click "New Purchase" to record your first purchase</p>
                </td>
              </tr>
            ) : (
              purchases.map((p) => (
                <tr
                  key={p.id}
                  className="hover:bg-muted/20 transition-colors cursor-pointer"
                  onClick={() => openDetail(p)}
                >
                  <td className="px-4 py-3 text-muted-foreground">{fmtDate(p.created_at)}</td>
                  <td className="px-4 py-3 font-medium">{p.supplier_name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {p.bill_number ?? '—'}
                  </td>
                  <td className="px-4 py-3"><TypeBadge type={p.purchase_type} /></td>
                  <td className="px-4 py-3 text-right font-semibold">{fmt(p.grand_total)}</td>
                  <td className="px-4 py-3 text-center"><PaymentBadge status={p.payment_status} /></td>
                  <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-red-400"
                      onClick={() => setDeleteItem(p)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
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
            <Card key={i}>
              <CardContent className="p-4 space-y-3">
                <Skeleton className="h-5 w-1/2" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/3" />
              </CardContent>
            </Card>
          ))
        ) : purchases.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
            <ReceiptText className="w-10 h-10 opacity-25" />
            <p className="font-medium">No purchases yet</p>
          </div>
        ) : (
          purchases.map((p) => (
            <Card key={p.id} className="border-border cursor-pointer" onClick={() => openDetail(p)}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <p className="font-semibold">{p.supplier_name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{fmtDate(p.created_at)}</p>
                  </div>
                  <TypeBadge type={p.purchase_type} />
                </div>
                <div className="flex items-center justify-between mt-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Bill: {p.bill_number ?? '—'}</p>
                    <p className="font-bold text-lg mt-0.5">{fmt(p.grand_total)}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <PaymentBadge status={p.payment_status} />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-400 hover:text-red-400 h-7 px-2"
                      onClick={(e) => { e.stopPropagation(); setDeleteItem(p) }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={(o) => { if (!o) { setDetailOpen(false); setDetailData(null) } }}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-2xl max-h-[90vh] overflow-y-auto p-6" onInteractOutside={(e) => e.preventDefault()}>
          {detailLoading || !detailData ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
            </div>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="text-white flex items-center gap-2">
                  Purchase Details
                  <TypeBadge type={detailData.purchase_type} />
                </DialogTitle>
              </DialogHeader>

              {/* Purchase Info */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm mt-2">
                <div>
                  <p className="text-slate-400 text-xs mb-0.5">Supplier / Source</p>
                  <p className="font-medium">{detailData.supplier_name}</p>
                </div>
                {detailData.supplier_phone && (
                  <div>
                    <p className="text-slate-400 text-xs mb-0.5">Phone</p>
                    <p>{detailData.supplier_phone}</p>
                  </div>
                )}
                {isOfficial && detailData.supplier_gstin && (
                  <div>
                    <p className="text-slate-400 text-xs mb-0.5">GSTIN</p>
                    <p className="font-mono text-xs">{detailData.supplier_gstin}</p>
                  </div>
                )}
                {isOfficial && detailData.bill_number && (
                  <div>
                    <p className="text-slate-400 text-xs mb-0.5">Bill Number</p>
                    <p className="font-mono">{detailData.bill_number}</p>
                  </div>
                )}
                {isOfficial && detailData.bill_date && (
                  <div>
                    <p className="text-slate-400 text-xs mb-0.5">Bill Date</p>
                    <p>{fmtDate(detailData.bill_date)}</p>
                  </div>
                )}
                <div>
                  <p className="text-slate-400 text-xs mb-0.5">Payment Method</p>
                  <p className="capitalize">{detailData.payment_method?.replace('_', ' ')}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-xs mb-0.5">Payment Status</p>
                  <PaymentBadge status={detailData.payment_status} />
                </div>
              </div>

              {/* Line Items */}
              <div className="mt-4">
                <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Items</p>
                <div className="rounded-lg border border-slate-600 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-700/50 text-slate-400 text-xs">
                        <th className="px-3 py-2 text-left">Product</th>
                        <th className="px-3 py-2 text-right">Qty</th>
                        <th className="px-3 py-2 text-right">Unit Price</th>
                        {isOfficial && <th className="px-3 py-2 text-right">GST</th>}
                        <th className="px-3 py-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700">
                      {(detailData.purchase_items ?? []).map((item) => {
                        const p = item.products ?? {}
                        const name = [p.brand, p.model, p.variant && `(${p.variant})`].filter(Boolean).join(' ')
                        return (
                          <tr key={item.id}>
                            <td className="px-3 py-2">
                              <p className="font-medium">{name}</p>
                              {p.color && <p className="text-xs text-slate-400">{p.color}</p>}
                            </td>
                            <td className="px-3 py-2 text-right">{item.quantity}</td>
                            <td className="px-3 py-2 text-right">{fmt(item.unit_price)}</td>
                            {isOfficial && (
                              <td className="px-3 py-2 text-right text-slate-400">
                                {fmt(item.gst_amount)}
                              </td>
                            )}
                            <td className="px-3 py-2 text-right font-semibold">
                              {fmt(item.total_amount + (isOfficial ? item.gst_amount : 0))}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* GST Breakdown */}
              <div className="mt-4 max-w-xs ml-auto space-y-1.5 text-sm">
                <div className="flex justify-between text-slate-300">
                  <span>Subtotal</span>
                  <span>{fmt(detailData.total_amount)}</span>
                </div>
                {isOfficial && (
                  <>
                    <div className="flex justify-between text-slate-400">
                      <span>CGST (9%)</span>
                      <span>{fmt(detailData.gst_amount / 2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>SGST (9%)</span>
                      <span>{fmt(detailData.gst_amount / 2)}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between font-bold text-base border-t border-slate-600 pt-2">
                  <span>Grand Total</span>
                  <span>{fmt(detailData.grand_total)}</span>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteItem} onOpenChange={(o) => { if (!o) setDeleteItem(null) }}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-sm p-6" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="text-white">Delete Purchase</DialogTitle>
          </DialogHeader>
          <div className="flex items-start gap-3 py-2">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <p className="text-slate-300 text-sm">
              Delete purchase from{' '}
              <span className="font-semibold text-white">{deleteItem?.supplier_name}</span>
              ? The inventory rows added by this purchase will NOT be automatically removed.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteItem(null)} className="border-slate-600 text-slate-300 hover:bg-slate-700">Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
