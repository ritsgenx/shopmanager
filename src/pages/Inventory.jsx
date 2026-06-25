import React, { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Plus, Search, Pencil, Trash2, Package, AlertCircle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/context/AuthContext'
import { getInventory, deleteInventory } from '@/lib/inventory'
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
    return (
      <Badge className="bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/20">
        Out of Stock
      </Badge>
    )
  if (qty <= 3)
    return (
      <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/20">
        Low Stock
      </Badge>
    )
  return (
    <Badge className="bg-green-500/20 text-green-400 border-green-500/30 hover:bg-green-500/20">
      In Stock
    </Badge>
  )
}

const fmt = (n) => `₹${Number(n).toLocaleString('en-IN')}`

export default function Inventory() {
  const { currentTenant } = useAuth()
  const tenantId = currentTenant?.id

  const [inventory, setInventory] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [deleteItem, setDeleteItem] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const fetchData = async () => {
    if (!tenantId) return
    setLoading(true)
    const [invRes, prodRes] = await Promise.all([
      getInventory(tenantId),
      getProducts(tenantId),
    ])
    if (invRes.error) toast.error('Failed to load inventory')
    else setInventory(invRes.data)
    if (!prodRes.error) setProducts(prodRes.data)
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [tenantId])

  const filtered = useMemo(() => {
    if (!search.trim()) return inventory
    const q = search.toLowerCase()
    return inventory.filter(
      (item) =>
        item.products?.brand?.toLowerCase().includes(q) ||
        item.products?.model?.toLowerCase().includes(q)
    )
  }, [inventory, search])

  const handleDelete = async () => {
    if (!deleteItem) return
    setDeleting(true)
    const { error } = await deleteInventory(tenantId, deleteItem.id)
    setDeleting(false)
    if (error) {
      toast.error('Failed to delete item')
    } else {
      toast.success('Item deleted')
      setInventory((prev) => prev.filter((i) => i.id !== deleteItem.id))
      setDeleteItem(null)
    }
  }

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
          <h1 className="text-2xl font-bold">Inventory</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {loading ? '…' : `${inventory.length} item${inventory.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <Button
          onClick={() => setAddOpen(true)}
          className="bg-indigo-500 hover:bg-indigo-600 text-white shrink-0"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Stock
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search brand or model…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/40 text-muted-foreground text-xs uppercase tracking-wider border-b border-border">
              <th className="px-4 py-3 text-left font-medium">Brand</th>
              <th className="px-4 py-3 text-left font-medium">Model</th>
              <th className="px-4 py-3 text-left font-medium">Variant</th>
              <th className="px-4 py-3 text-left font-medium">Color</th>
              <th className="px-4 py-3 text-right font-medium">Qty</th>
              <th className="px-4 py-3 text-right font-medium">Purchase</th>
              <th className="px-4 py-3 text-right font-medium">Selling</th>
              <th className="px-4 py-3 text-center font-medium">Status</th>
              <th className="px-4 py-3 text-center font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 9 }).map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <Skeleton className="h-4 w-full" />
                    </td>
                  ))}
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-20 text-center text-muted-foreground">
                  <Package className="w-10 h-10 mx-auto mb-2 opacity-25" />
                  <p className="font-medium">
                    {search ? 'No results found' : 'No inventory yet'}
                  </p>
                  {!search && (
                    <p className="text-sm mt-1">Click "Add Stock" to get started</p>
                  )}
                </td>
              </tr>
            ) : (
              filtered.map((item) => (
                <tr key={item.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-medium">{item.products?.brand ?? '—'}</td>
                  <td className="px-4 py-3">{item.products?.model ?? '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{item.products?.variant ?? '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{item.products?.color ?? '—'}</td>
                  <td className="px-4 py-3 text-right font-semibold">{item.quantity_remaining}</td>
                  <td className="px-4 py-3 text-right">{fmt(item.purchase_price)}</td>
                  <td className="px-4 py-3 text-right">{fmt(item.selling_price)}</td>
                  <td className="px-4 py-3 text-center">
                    <StatusBadge qty={item.quantity_remaining} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={() => setEditItem(item)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-red-400"
                        onClick={() => setDeleteItem(item)}
                      >
                        <Trash2 className="w-4 h-4" />
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
            <Card key={i}>
              <CardContent className="p-4 space-y-3">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <div className="flex gap-2">
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-4 flex-1" />
                </div>
              </CardContent>
            </Card>
          ))
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
            <Package className="w-10 h-10 opacity-25" />
            <p className="font-medium">{search ? 'No results found' : 'No inventory yet'}</p>
            {!search && <p className="text-sm">Click "Add Stock" to get started</p>}
          </div>
        ) : (
          filtered.map((item) => (
            <Card key={item.id} className="border-border">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="min-w-0">
                    <p className="font-semibold truncate">
                      {item.products?.brand} {item.products?.model}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {[item.products?.variant, item.products?.color].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <StatusBadge qty={item.quantity_remaining} />
                </div>

                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs mb-0.5">Qty</p>
                    <p className="font-semibold">{item.quantity_remaining}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs mb-0.5">Purchase</p>
                    <p className="font-medium">{fmt(item.purchase_price)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs mb-0.5">Selling</p>
                    <p className="font-medium">{fmt(item.selling_price)}</p>
                  </div>
                </div>

                <div className="flex gap-2 mt-3 pt-3 border-t border-border">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => setEditItem(item)}
                  >
                    <Pencil className="w-3.5 h-3.5 mr-1.5" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-red-400 hover:text-red-400 hover:border-red-400/50"
                    onClick={() => setDeleteItem(item)}
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Add Stock Dialog */}
      <AddStockDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        tenantId={tenantId}
        products={products}
        onSuccess={fetchData}
      />

      {/* Edit Stock Dialog */}
      <EditStockDialog
        open={!!editItem}
        onOpenChange={(open) => { if (!open) setEditItem(null) }}
        item={editItem}
        onSuccess={fetchData}
      />

      {/* Delete Confirmation */}
      <Dialog
        open={!!deleteItem}
        onOpenChange={(open) => { if (!open) setDeleteItem(null) }}
      >
        <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-sm p-6" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="text-white">Delete Item</DialogTitle>
          </DialogHeader>
          <div className="flex items-start gap-3 py-2">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <p className="text-slate-300 text-sm">
              Are you sure you want to delete{' '}
              <span className="font-semibold text-white">
                {deleteItem?.products?.brand} {deleteItem?.products?.model}
              </span>
              ? This cannot be undone.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteItem(null)}
              className="border-slate-600 text-slate-300 hover:bg-slate-700"
            >
              Cancel
            </Button>
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
