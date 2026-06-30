import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ClipboardList, CheckCircle, XCircle, Pencil, Loader2,
  User, Calendar, Filter, Clock, Square, CheckSquare,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/context/AuthContext'
import { usePendingCount } from '@/context/PendingCountContext'
import {
  getPendingApprovals, approveInventory, rejectInventory, bulkApproveInventory,
} from '@/lib/inventory'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import EditStockDialog from '@/components/inventory/EditStockDialog'

function getAgeInfo(createdAt) {
  const days = (Date.now() - new Date(createdAt)) / 86_400_000
  if (days < 1)  return { label: null,                          border: 'border-l-slate-500/30',   bg: '' }
  if (days < 3)  return { label: `${Math.floor(days)}d old`,   border: 'border-l-yellow-400/70',  bg: 'bg-yellow-500/[0.03]' }
  if (days < 7)  return { label: `${Math.floor(days)}d old`,   border: 'border-l-orange-400/70',  bg: 'bg-orange-500/[0.04]' }
  return          { label: `${Math.floor(days)}d old`,          border: 'border-l-red-500/70',     bg: 'bg-red-500/[0.04]' }
}

function getAgeColor(createdAt) {
  const days = (Date.now() - new Date(createdAt)) / 86_400_000
  if (days < 1)  return 'text-slate-400'
  if (days < 3)  return 'text-yellow-400'
  if (days < 7)  return 'text-orange-400'
  return 'text-red-400'
}

function SourceBadge({ source }) {
  if (source === 'official')
    return <Badge className="bg-green-500/20 text-green-400 border-green-500/30 hover:bg-green-500/20 text-xs">Official</Badge>
  if (source === 'unofficial')
    return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 hover:bg-amber-500/20 text-xs">Unofficial</Badge>
  return <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30 hover:bg-slate-500/20 text-xs">Manual</Badge>
}

const fmt = (n) => `₹${Number(n ?? 0).toLocaleString('en-IN')}`
const fmtDate = (iso) => new Date(iso).toLocaleDateString('en-IN', {
  day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
})

export default function PendingApprovals() {
  const navigate = useNavigate()
  const { currentTenant, currentUser } = useAuth()
  const { refreshCount } = usePendingCount()
  const tenantId = currentTenant?.id
  const isOwner = currentUser?.role === 'admin'

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [approvingId, setApprovingId] = useState(null)
  const [bulkApproving, setBulkApproving] = useState(false)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [employeeFilter, setEmployeeFilter] = useState('all')
  const [rejectTarget, setRejectTarget] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejecting, setRejecting] = useState(false)
  const [editItem, setEditItem] = useState(null)

  const loadItems = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    const { data, error } = await getPendingApprovals(tenantId)
    if (error) toast.error('Failed to load pending approvals')
    else setItems((data ?? []).slice().sort((a, b) => new Date(a.created_at) - new Date(b.created_at)))
    setLoading(false)
  }, [tenantId])

  useEffect(() => {
    if (!isOwner) { navigate('/dashboard', { replace: true }); return }
    loadItems()
  }, [isOwner, loadItems])

  const employees = useMemo(() => {
    const map = {}
    for (const item of items) {
      const id = item.submitted_by
      if (id && !map[id]) map[id] = item.submitter?.full_name ?? `Employee (${id.slice(0, 6)})`
    }
    return Object.entries(map).map(([id, name]) => ({ id, name }))
  }, [items])

  const filtered = useMemo(() => {
    if (employeeFilter === 'all') return items
    return items.filter(item => item.submitted_by === employeeFilter)
  }, [items, employeeFilter])

  const allFilteredIds = filtered.map(i => i.id)
  const allSelected = allFilteredIds.length > 0 && allFilteredIds.every(id => selectedIds.has(id))
  const selectedInFilter = allFilteredIds.filter(id => selectedIds.has(id)).length

  const toggleSelectAll = () => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (allSelected) allFilteredIds.forEach(id => next.delete(id))
      else allFilteredIds.forEach(id => next.add(id))
      return next
    })
  }

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const removeItems = (ids) => {
    setItems(prev => prev.filter(i => !ids.includes(i.id)))
    setSelectedIds(prev => { const n = new Set(prev); ids.forEach(id => n.delete(id)); return n })
    refreshCount()
  }

  const handleApprove = async (item) => {
    setApprovingId(item.id)
    const { error } = await approveInventory(tenantId, item.id, currentUser?.id)
    setApprovingId(null)
    if (error) { toast.error('Failed to approve'); return }
    toast.success(`${[item.products?.brand, item.products?.model].filter(Boolean).join(' ')} approved`)
    removeItems([item.id])
  }

  const handleBulkApprove = async () => {
    const ids = allFilteredIds.filter(id => selectedIds.has(id))
    if (!ids.length) return
    setBulkApproving(true)
    const { error } = await bulkApproveInventory(tenantId, ids, currentUser?.id)
    setBulkApproving(false)
    if (error) { toast.error('Failed to bulk approve'); return }
    toast.success(`${ids.length} item${ids.length === 1 ? '' : 's'} approved`)
    removeItems(ids)
  }

  const handleReject = async () => {
    if (!rejectTarget) return
    setRejecting(true)
    const { error } = await rejectInventory(tenantId, rejectTarget.id, currentUser?.id, rejectReason)
    setRejecting(false)
    if (error) { toast.error('Failed to reject item'); return }
    toast.success('Item rejected')
    removeItems([rejectTarget.id])
    setRejectTarget(null)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="p-4 md:p-6 space-y-5"
    >
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight">Pending Approvals</h1>
            {!loading && items.length > 0 && (
              <span className="inline-flex items-center justify-center min-w-[26px] h-[26px] rounded-full bg-yellow-500 text-black text-xs font-bold px-1.5">
                {items.length}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            {loading
              ? 'Loading…'
              : items.length === 0
              ? 'All inventory is approved — nothing pending'
              : `${items.length} item${items.length === 1 ? '' : 's'} awaiting your review`}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {employees.length > 1 && (
            <Select value={employeeFilter} onValueChange={v => { setEmployeeFilter(v); setSelectedIds(new Set()) }}>
              <SelectTrigger className="h-9 w-48 gap-1">
                <Filter className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Employees</SelectItem>
                {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}

          {selectedInFilter > 0 && (
            <Button
              onClick={handleBulkApprove}
              disabled={bulkApproving}
              className="h-9 bg-green-600 hover:bg-green-500 text-white"
            >
              {bulkApproving
                ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Approving…</>
                : <><CheckCircle className="w-4 h-4 mr-2" />Approve {selectedInFilter}</>}
            </Button>
          )}
        </div>
      </div>

      {/* ── Select all bar ── */}
      {!loading && filtered.length > 1 && (
        <div className="flex items-center gap-2 px-1">
          <button
            onClick={toggleSelectAll}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {allSelected
              ? <CheckSquare className="w-4 h-4 text-indigo-400" />
              : <Square className="w-4 h-4" />}
            <span>{allSelected ? 'Deselect all' : `Select all ${filtered.length}`}</span>
          </button>
        </div>
      )}

      {/* ── List ── */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4 space-y-3">
                <div className="flex gap-3">
                  <Skeleton className="w-4 h-4 mt-1 rounded shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-52" />
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="h-4 w-60" />
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    <Skeleton className="h-8 w-20" />
                    <Skeleton className="h-8 w-16" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-3 py-24 text-muted-foreground"
        >
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
            <CheckCircle className="w-8 h-8 text-emerald-400" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-foreground text-base">All clear!</p>
            <p className="text-sm mt-1">
              {employeeFilter !== 'all'
                ? 'No pending items for this employee'
                : 'No inventory items awaiting approval'}
            </p>
          </div>
        </motion.div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {filtered.map(item => {
              const product = item.products ?? {}
              const name = [product.brand, product.model, product.variant && `(${product.variant})`].filter(Boolean).join(' ')
              const age = getAgeInfo(item.created_at)
              const ageColor = getAgeColor(item.created_at)
              const isApproving = approvingId === item.id
              const isSelected = selectedIds.has(item.id)
              const busy = isApproving || bulkApproving

              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -24, transition: { duration: 0.2 } }}
                  layout
                >
                  {/* ── Desktop card ── */}
                  <Card className={`border-l-4 ${age.border} ${isSelected ? 'bg-indigo-500/[0.06] border-indigo-500/40' : age.bg} transition-colors hidden md:block`}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        {/* Checkbox */}
                        <button
                          onClick={() => toggleSelect(item.id)}
                          className="mt-0.5 shrink-0 text-muted-foreground hover:text-indigo-400 transition-colors"
                        >
                          {isSelected
                            ? <CheckSquare className="w-4 h-4 text-indigo-400" />
                            : <Square className="w-4 h-4" />}
                        </button>

                        {/* Product + meta */}
                        <div className="flex-1 min-w-0 grid grid-cols-3 gap-4">
                          <div className="col-span-2 space-y-1.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-semibold">{name || 'Unknown Product'}</p>
                              <SourceBadge source={item.stock_source} />
                              {age.label && (
                                <span className={`text-xs font-medium flex items-center gap-1 ${ageColor}`}>
                                  <Clock className="w-3 h-3" />{age.label}
                                </span>
                              )}
                            </div>
                            {product.color && (
                              <p className="text-xs text-muted-foreground">{product.color}</p>
                            )}
                            <p className="text-xs font-mono text-muted-foreground">
                              IMEI: <span className="text-foreground tracking-wider">{item.imei_number ?? '—'}</span>
                            </p>
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap">
                              <User className="w-3 h-3 shrink-0" />
                              <span className="font-medium text-foreground">{item.submitter?.full_name ?? 'Unknown'}</span>
                              {item.submitter?.phone && <span>· {item.submitter.phone}</span>}
                              <span>·</span>
                              <Calendar className="w-3 h-3 shrink-0" />
                              <span>{fmtDate(item.created_at)}</span>
                            </div>
                          </div>

                          {/* Price */}
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground mb-0.5">Purchase Price</p>
                            <p className="text-xl font-bold">{fmt(item.purchase_price)}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">Selling: {fmt(item.selling_price)}</p>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col gap-1.5 shrink-0">
                          <Button
                            size="sm"
                            className="h-8 bg-green-600 hover:bg-green-500 text-white text-xs px-3"
                            onClick={() => handleApprove(item)}
                            disabled={busy}
                          >
                            {isApproving
                              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              : <><CheckCircle className="w-3.5 h-3.5 mr-1" />Approve</>}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-red-400 border-red-500/30 hover:bg-red-500/10 hover:text-red-300 text-xs px-3"
                            onClick={() => { setRejectTarget(item); setRejectReason('') }}
                            disabled={busy}
                          >
                            <XCircle className="w-3.5 h-3.5 mr-1" />Reject
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 text-xs text-muted-foreground hover:text-foreground px-3"
                            onClick={() => setEditItem(item)}
                            disabled={busy}
                          >
                            <Pencil className="w-3.5 h-3.5 mr-1" />Edit
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* ── Mobile card ── */}
                  <Card className={`border-l-4 ${age.border} ${isSelected ? 'bg-indigo-500/[0.06]' : age.bg} md:hidden`}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start gap-3">
                        <button onClick={() => toggleSelect(item.id)} className="mt-0.5 shrink-0 text-muted-foreground hover:text-indigo-400 transition-colors">
                          {isSelected ? <CheckSquare className="w-4 h-4 text-indigo-400" /> : <Square className="w-4 h-4" />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="font-semibold text-sm">{name || 'Unknown Product'}</p>
                            {age.label && (
                              <span className={`text-xs font-medium flex items-center gap-0.5 ${ageColor}`}>
                                <Clock className="w-3 h-3" />{age.label}
                              </span>
                            )}
                          </div>
                          {product.color && <p className="text-xs text-muted-foreground mt-0.5">{product.color}</p>}
                        </div>
                        <SourceBadge source={item.stock_source} />
                      </div>

                      <p className="text-xs font-mono text-muted-foreground">
                        IMEI: <span className="text-foreground tracking-wider">{item.imei_number ?? '—'}</span>
                      </p>

                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap">
                        <User className="w-3 h-3 shrink-0" />
                        <span className="font-medium text-foreground">{item.submitter?.full_name ?? 'Unknown'}</span>
                        <span>·</span>
                        <span>{fmtDate(item.created_at)}</span>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <div>
                          <p className="text-xs text-muted-foreground">Purchase</p>
                          <p className="font-bold">{fmt(item.purchase_price)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Selling</p>
                          <p className="font-medium text-muted-foreground">{fmt(item.selling_price)}</p>
                        </div>
                      </div>

                      <div className="flex gap-2 pt-2 border-t border-border">
                        <Button
                          size="sm"
                          className="flex-1 h-8 bg-green-600 hover:bg-green-500 text-white text-xs"
                          onClick={() => handleApprove(item)}
                          disabled={busy}
                        >
                          {isApproving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><CheckCircle className="w-3.5 h-3.5 mr-1" />Approve</>}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 h-8 text-red-400 border-red-500/30 hover:bg-red-500/10 text-xs"
                          onClick={() => { setRejectTarget(item); setRejectReason('') }}
                          disabled={busy}
                        >
                          <XCircle className="w-3.5 h-3.5 mr-1" />Reject
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2 text-muted-foreground hover:text-foreground"
                          onClick={() => setEditItem(item)}
                          disabled={busy}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}

      {/* ── Reject Dialog ── */}
      <Dialog open={!!rejectTarget} onOpenChange={(o) => { if (!o) setRejectTarget(null) }}>
        <DialogContent className="max-w-sm" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader className="border-b border-border">
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="w-4 h-4 text-red-400" />
              Reject Item
            </DialogTitle>
          </DialogHeader>
          {rejectTarget && (
            <div className="px-6 py-5 space-y-4">
              <div className="rounded-lg bg-muted/40 border border-border p-3">
                <p className="text-sm font-medium">
                  {[rejectTarget.products?.brand, rejectTarget.products?.model, rejectTarget.products?.variant].filter(Boolean).join(' ')}
                </p>
                <p className="text-xs text-muted-foreground font-mono mt-1">
                  IMEI: {rejectTarget.imei_number ?? '—'}
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reason">
                  Reason <span className="text-muted-foreground text-xs">(optional)</span>
                </Label>
                <Textarea
                  id="reason"
                  placeholder="e.g. Price mismatch, wrong product, duplicate entry…"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={3}
                  className="resize-none"
                />
              </div>
            </div>
          )}
          <DialogFooter className="border-t border-border">
            <Button variant="outline" onClick={() => setRejectTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject} disabled={rejecting}>
              {rejecting ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Rejecting…</> : 'Reject Item'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Dialog ── */}
      <EditStockDialog
        open={!!editItem}
        onOpenChange={(o) => { if (!o) setEditItem(null) }}
        item={editItem}
        onSuccess={() => { setEditItem(null); loadItems() }}
      />
    </motion.div>
  )
}
