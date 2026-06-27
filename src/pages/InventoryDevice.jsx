import React, { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeft, Plus, Search, Pencil, Trash2, AlertCircle, Loader2,
  Smartphone, X, ChevronRight,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/context/AuthContext'
import { getInventoryForModel, deleteInventory } from '@/lib/inventory'
import { getProducts } from '@/lib/products'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import AddStockDialog from '@/components/inventory/AddStockDialog'
import EditStockDialog from '@/components/inventory/EditStockDialog'

function StatusBadge({ qty }) {
  if (qty === 0)
    return <Badge className="bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/20">Sold</Badge>
  return <Badge className="bg-green-500/20 text-green-400 border-green-500/30 hover:bg-green-500/20">In Stock</Badge>
}

function SourceBadge({ source }) {
  if (source === 'official')
    return <Badge className="bg-green-500/20 text-green-400 border-green-500/30 hover:bg-green-500/20">Official</Badge>
  if (source === 'unofficial')
    return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 hover:bg-amber-500/20">Unofficial</Badge>
  return <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30 hover:bg-slate-500/20">Manual</Badge>
}

const fmt = (n) => `₹${Number(n).toLocaleString('en-IN')}`

export default function InventoryDevice() {
  const { brand: brandParam, model: modelParam } = useParams()
  const brand = decodeURIComponent(brandParam)
  const model = decodeURIComponent(modelParam)
  const navigate = useNavigate()
  const { currentTenant } = useAuth()
  const tenantId = currentTenant?.id

  const [devices, setDevices] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchInput, setSearchInput] = useState('')
  const [editItem, setEditItem] = useState(null)
  const [deleteItem, setDeleteItem] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [products, setProducts] = useState([])
  const [addOpen, setAddOpen] = useState(false)

  const fetchDevices = async () => {
    if (!tenantId) return
    setLoading(true)
    const { data, error } = await getInventoryForModel(tenantId, brand, model)
    if (error) toast.error('Failed to load devices')
    else setDevices(data)
    setLoading(false)
  }

  useEffect(() => { fetchDevices() }, [tenantId, brand, model])

  useEffect(() => {
    if (tenantId) getProducts(tenantId).then(({ data }) => setProducts(data ?? []))
  }, [tenantId])

  const filtered = useMemo(() => {
    const term = searchInput.trim().toLowerCase()
    if (!term) return devices
    return devices.filter(d =>
      (d.imei_number ?? '').toLowerCase().includes(term) ||
      (d.products?.variant ?? '').toLowerCase().includes(term) ||
      (d.products?.color ?? '').toLowerCase().includes(term)
    )
  }, [devices, searchInput])

  const totalUnits = devices.reduce((s, d) => s + (d.quantity_remaining ?? 0), 0)
  const deviceCount = devices.length
  const avgPrice = deviceCount > 0
    ? Math.round(devices.reduce((s, d) => s + (d.purchase_price ?? 0), 0) / deviceCount)
    : 0

  const handleDelete = async () => {
    if (!deleteItem) return
    setDeleting(true)
    const { error } = await deleteInventory(tenantId, deleteItem.id)
    setDeleting(false)
    if (error) {
      toast.error('Failed to delete device')
    } else {
      toast.success('Device deleted')
      setDeleteItem(null)
      fetchDevices()
    }
  }

  const goBack = () => navigate('/inventory', { state: { restoreBrand: brand } })

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="p-4 md:p-6 space-y-5"
    >
      {/* Sticky header */}
      <div className="sticky top-0 z-20 bg-background -mx-4 md:-mx-6 px-4 md:px-6 py-3 border-b border-border">
        <div className="flex items-center gap-3 flex-wrap mb-3">
          <Button variant="ghost" size="icon" onClick={goBack} className="shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-0.5">
              <span className="hover:text-foreground cursor-pointer transition-colors" onClick={goBack}>
                Inventory
              </span>
              <ChevronRight className="w-3 h-3" />
              <span className="hover:text-foreground cursor-pointer transition-colors" onClick={goBack}>
                {brand}
              </span>
              <ChevronRight className="w-3 h-3" />
              <span className="text-foreground font-medium">{model}</span>
            </div>
            <h1 className="text-xl font-bold leading-tight truncate">{brand} {model}</h1>
          </div>
          <Button onClick={() => setAddOpen(true)} className="bg-indigo-500 hover:bg-indigo-600 text-white shrink-0">
            <Plus className="w-4 h-4 mr-2" />Add Device
          </Button>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search IMEI, variant, color…"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            className="pl-9 pr-8"
          />
          {searchInput && (
            <button onClick={() => setSearchInput('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-border bg-muted/20 p-3 text-center">
          <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Total Devices</p>
          <p className="text-2xl font-bold">{loading ? '…' : deviceCount}</p>
        </div>
        <div className="rounded-xl border border-border bg-muted/20 p-3 text-center">
          <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">In Stock</p>
          <p className="text-2xl font-bold text-green-400">{loading ? '…' : totalUnits}</p>
        </div>
        <div className="rounded-xl border border-border bg-muted/20 p-3 text-center">
          <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Avg. Purchase</p>
          <p className="text-2xl font-bold">{loading ? '…' : fmt(avgPrice)}</p>
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/40 text-muted-foreground text-xs uppercase tracking-wider border-b border-border">
              <th className="px-4 py-3 text-left font-medium">IMEI</th>
              <th className="px-4 py-3 text-left font-medium">Variant</th>
              <th className="px-4 py-3 text-left font-medium">Color</th>
              <th className="px-4 py-3 text-right font-medium">Purchase</th>
              <th className="px-4 py-3 text-right font-medium">Selling</th>
              <th className="px-4 py-3 text-center font-medium">Source</th>
              <th className="px-4 py-3 text-center font-medium">Status</th>
              <th className="px-4 py-3 text-center font-medium">Actions</th>
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
                <td colSpan={8} className="px-4 py-20 text-center text-muted-foreground">
                  <Smartphone className="w-10 h-10 mx-auto mb-2 opacity-25" />
                  <p className="font-medium">
                    {searchInput ? `No devices matching "${searchInput}"` : 'No devices yet — click Add Device'}
                  </p>
                </td>
              </tr>
            ) : (
              filtered.map(device => (
                <tr key={device.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-mono text-sm tracking-wider">
                    {device.imei_number
                      ? device.imei_number
                      : <span className="text-muted-foreground text-xs italic">no IMEI</span>}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{device.products?.variant ?? '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{device.products?.color ?? '—'}</td>
                  <td className="px-4 py-3 text-right font-medium">{fmt(device.purchase_price)}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">{fmt(device.selling_price)}</td>
                  <td className="px-4 py-3 text-center"><SourceBadge source={device.stock_source} /></td>
                  <td className="px-4 py-3 text-center"><StatusBadge qty={device.quantity_remaining ?? 0} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        onClick={() => setEditItem(device)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-red-400"
                        onClick={() => setDeleteItem(device)}>
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

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}><CardContent className="p-4 space-y-3">
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <div className="flex gap-2">
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 flex-1" />
              </div>
            </CardContent></Card>
          ))
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
            <Smartphone className="w-10 h-10 opacity-25" />
            <p className="font-medium text-center">
              {searchInput ? `No devices matching "${searchInput}"` : 'No devices yet'}
            </p>
          </div>
        ) : (
          filtered.map(device => (
            <Card key={device.id} className="border-border">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground mb-0.5">IMEI</p>
                    <p className="font-mono text-sm font-semibold tracking-wider break-all">
                      {device.imei_number ?? <span className="text-muted-foreground italic text-xs">no IMEI</span>}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <SourceBadge source={device.stock_source} />
                    <StatusBadge qty={device.quantity_remaining ?? 0} />
                  </div>
                </div>

                {(device.products?.variant || device.products?.color) && (
                  <p className="text-xs text-muted-foreground mb-3">
                    {[device.products?.variant, device.products?.color].filter(Boolean).join(' · ')}
                  </p>
                )}

                <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Purchase</p>
                    <p className="font-semibold">{fmt(device.purchase_price)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Selling</p>
                    <p className="font-medium">{fmt(device.selling_price)}</p>
                  </div>
                </div>

                <div className="flex gap-2 pt-3 border-t border-border">
                  <Button variant="ghost" size="sm" className="flex-1 text-muted-foreground hover:text-foreground h-7 text-xs"
                    onClick={() => setEditItem(device)}>
                    <Pencil className="w-3 h-3 mr-1" />Edit
                  </Button>
                  <Button variant="ghost" size="sm" className="flex-1 text-muted-foreground hover:text-red-400 h-7 text-xs"
                    onClick={() => setDeleteItem(device)}>
                    <Trash2 className="w-3 h-3 mr-1" />Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <AddStockDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        tenantId={tenantId}
        products={products}
        onSuccess={fetchDevices}
      />

      <EditStockDialog
        open={!!editItem}
        onOpenChange={(open) => { if (!open) setEditItem(null) }}
        item={editItem}
        onSuccess={() => { setEditItem(null); fetchDevices() }}
      />

      <Dialog open={!!deleteItem} onOpenChange={(open) => { if (!open) setDeleteItem(null) }}>
        <DialogContent className="max-w-sm" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Delete Device</DialogTitle>
          </DialogHeader>
          <div className="flex items-start gap-3 py-2">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="text-sm text-muted-foreground">
              <p>Delete device with IMEI:</p>
              <p className="font-mono font-semibold text-foreground mt-1 text-base break-all">
                {deleteItem?.imei_number ?? '—'}
              </p>
              <p className="mt-2">This cannot be undone.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteItem(null)}>Cancel</Button>
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
