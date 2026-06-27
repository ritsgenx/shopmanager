import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Plus, Search, Pencil, Trash2, Package, AlertCircle, Loader2,
  X, ArrowLeft, ChevronRight, Boxes, IndianRupee, AlertTriangle, PackageX,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/context/AuthContext'
import { getInventory, getBrandSummary, deleteInventory } from '@/lib/inventory'
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
import Pagination, { PAGE_SIZE } from '@/components/shared/Pagination'

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

function StatBox({ label, value, icon: Icon, color }) {
  const colorMap = {
    default: 'text-muted-foreground',
    yellow:  'text-yellow-400',
    red:     'text-red-400',
    indigo:  'text-indigo-400',
  }
  const iconColor = colorMap[color] ?? colorMap.default
  return (
    <div className="rounded-xl border border-border bg-muted/20 p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
        <Icon className={`w-4 h-4 ${iconColor}`} />
      </div>
      <p className={`text-xl font-bold ${iconColor !== colorMap.default ? iconColor : ''}`}>{value}</p>
    </div>
  )
}

function BrandCard({ b, onClick }) {
  const hasIssue = b.lowStockCount > 0 || b.outOfStockCount > 0
  return (
    <Card
      className="cursor-pointer hover:border-indigo-500/60 transition-all duration-150 group border-border"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <h3 className="font-bold text-base leading-tight">{b.brand}</h3>
          <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-indigo-400 transition-colors shrink-0 mt-0.5" />
        </div>

        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Units in stock</span>
            <span className="font-semibold">{b.totalUnits.toLocaleString('en-IN')}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Stock value</span>
            <span className="font-semibold">₹{b.inventoryValue.toLocaleString('en-IN')}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Models</span>
            <span className="font-semibold">{b.modelsInStock}</span>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-border flex flex-wrap gap-x-3 gap-y-1">
          {b.outOfStockCount > 0 && (
            <span className="text-xs text-red-400 font-medium">{b.outOfStockCount} out of stock</span>
          )}
          {b.lowStockCount > 0 && (
            <span className="text-xs text-yellow-400 font-medium">{b.lowStockCount} low stock</span>
          )}
          {!hasIssue && (
            <span className="text-xs text-green-400 font-medium">All stocked</span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

const fmt = (n) => `₹${Number(n).toLocaleString('en-IN')}`

export default function Inventory() {
  const { currentTenant } = useAuth()
  const tenantId = currentTenant?.id

  // Level 1
  const [brandSummary, setBrandSummary] = useState([])
  const [brandsLoading, setBrandsLoading] = useState(true)

  // Level 2
  const [selectedBrand, setSelectedBrand] = useState(null)
  const [inventory, setInventory] = useState([])
  const [loading, setLoading] = useState(false)
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')

  // Shared
  const [products, setProducts] = useState([])
  const [addOpen, setAddOpen] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [deleteItem, setDeleteItem] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const fetchBrandSummary = async () => {
    if (!tenantId) return
    setBrandsLoading(true)
    const { data } = await getBrandSummary(tenantId)
    setBrandSummary(data ?? [])
    setBrandsLoading(false)
  }

  const fetchInventory = async () => {
    if (!tenantId || !selectedBrand) return
    setLoading(true)
    const { data, count, error } = await getInventory(tenantId, {
      brand: selectedBrand,
      searchTerm: appliedSearch,
      page,
      pageSize: PAGE_SIZE,
    })
    if (error) toast.error('Failed to load inventory')
    else { setInventory(data); setTotalCount(count) }
    setLoading(false)
  }

  useEffect(() => { fetchBrandSummary() }, [tenantId])

  useEffect(() => {
    if (tenantId) getProducts(tenantId).then(({ data }) => setProducts(data ?? []))
  }, [tenantId])

  useEffect(() => {
    if (selectedBrand) fetchInventory()
  }, [tenantId, selectedBrand, appliedSearch, page])

  const handleBrandClick = (brand) => {
    setSelectedBrand(brand)
    setSearchInput('')
    setAppliedSearch('')
    setPage(1)
  }

  const handleBack = () => {
    setSelectedBrand(null)
    setSearchInput('')
    setAppliedSearch('')
    setPage(1)
  }

  const handleSearch = () => {
    setPage(1)
    setAppliedSearch(searchInput.trim())
  }

  const handleSearchClear = () => {
    setSearchInput('')
    setAppliedSearch('')
    setPage(1)
  }

  const handleDelete = async () => {
    if (!deleteItem) return
    setDeleting(true)
    const { error } = await deleteInventory(tenantId, deleteItem.id)
    setDeleting(false)
    if (error) {
      toast.error('Failed to delete item')
    } else {
      toast.success('Item deleted')
      setDeleteItem(null)
      fetchBrandSummary()
      fetchInventory()
    }
  }

  const handleSuccess = () => {
    fetchBrandSummary()
    if (selectedBrand) fetchInventory()
  }

  // Derived totals for stat boxes
  const totalUnits = brandSummary.reduce((s, b) => s + b.totalUnits, 0)
  const totalValue = brandSummary.reduce((s, b) => s + b.inventoryValue, 0)
  const totalLow   = brandSummary.reduce((s, b) => s + b.lowStockCount, 0)
  const totalOut   = brandSummary.reduce((s, b) => s + b.outOfStockCount, 0)

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="p-4 md:p-6 space-y-5"
    >
      {selectedBrand ? (
        /* ── Level 2: Brand Detail ─────────────────────────── */
        <>
          {/* Header */}
          <div className="flex items-center gap-3 flex-wrap">
            <Button variant="ghost" size="icon" onClick={handleBack} className="shrink-0">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold">{selectedBrand}</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {loading ? '…' : `${totalCount.toLocaleString('en-IN')} item${totalCount !== 1 ? 's' : ''}`}
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
          <div className="flex gap-2 max-w-sm">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search model… (Enter)"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                className="pl-9 pr-8"
              />
              {searchInput && (
                <button
                  onClick={handleSearchClear}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={handleSearch} className="shrink-0">Search</Button>
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40 text-muted-foreground text-xs uppercase tracking-wider border-b border-border">
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
                      {Array.from({ length: 8 }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <Skeleton className="h-4 w-full" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : inventory.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-20 text-center text-muted-foreground">
                      <Package className="w-10 h-10 mx-auto mb-2 opacity-25" />
                      <p className="font-medium">
                        {appliedSearch ? `No results for "${appliedSearch}"` : `No ${selectedBrand} stock yet`}
                      </p>
                    </td>
                  </tr>
                ) : (
                  inventory.map((item) => (
                    <tr key={item.id} className="border-l-2 border-l-transparent hover:border-l-indigo-500 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-medium">{item.products?.model ?? '—'}</td>
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
                            variant="ghost" size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={() => setEditItem(item)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost" size="icon"
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
            ) : inventory.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
                <Package className="w-10 h-10 opacity-25" />
                <p className="font-medium">
                  {appliedSearch ? `No results for "${appliedSearch}"` : `No ${selectedBrand} stock yet`}
                </p>
              </div>
            ) : (
              inventory.map((item) => (
                <Card key={item.id} className="border-border border-l-2 hover:border-l-indigo-500 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{item.products?.model}</p>
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
                      <Button variant="outline" size="sm" className="flex-1" onClick={() => setEditItem(item)}>
                        <Pencil className="w-3.5 h-3.5 mr-1.5" />Edit
                      </Button>
                      <Button
                        variant="outline" size="sm"
                        className="flex-1 text-red-400 hover:text-red-400 hover:border-red-400/50"
                        onClick={() => setDeleteItem(item)}
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1.5" />Delete
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          <Pagination page={page} totalCount={totalCount} pageSize={PAGE_SIZE} onPageChange={setPage} />
        </>
      ) : (
        /* ── Level 1: Brand Overview ───────────────────────── */
        <>
          {/* Header */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold">Inventory</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {brandsLoading ? '…' : `${brandSummary.length} brand${brandSummary.length !== 1 ? 's' : ''}`}
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

          {/* Summary Stat Boxes */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatBox label="Total Units"      value={totalUnits.toLocaleString('en-IN')}  icon={Boxes}         color="indigo" />
            <StatBox label="Stock Value"      value={`₹${totalValue.toLocaleString('en-IN')}`} icon={IndianRupee} color="default" />
            <StatBox label="Low Stock Items"  value={totalLow}  icon={AlertTriangle} color={totalLow > 0 ? 'yellow' : 'default'} />
            <StatBox label="Out of Stock"     value={totalOut}  icon={PackageX}      color={totalOut > 0 ? 'red'    : 'default'} />
          </div>

          {/* Brand Cards */}
          {brandsLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-4 space-y-3">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-4 w-1/2" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : brandSummary.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-20 text-muted-foreground">
              <Package className="w-12 h-12 opacity-25" />
              <p className="font-medium text-lg">No inventory yet</p>
              <p className="text-sm">Click "Add Stock" to get started</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {brandSummary.map(b => (
                <BrandCard key={b.brand} b={b} onClick={() => handleBrandClick(b.brand)} />
              ))}
            </div>
          )}
        </>
      )}

      {/* Shared Dialogs */}
      <AddStockDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        tenantId={tenantId}
        products={products}
        onSuccess={handleSuccess}
      />
      <EditStockDialog
        open={!!editItem}
        onOpenChange={(open) => { if (!open) setEditItem(null) }}
        item={editItem}
        onSuccess={handleSuccess}
      />

      <Dialog open={!!deleteItem} onOpenChange={(open) => { if (!open) setDeleteItem(null) }}>
        <DialogContent
          className="bg-slate-800 border-slate-700 text-white max-w-sm p-6"
          onInteractOutside={(e) => e.preventDefault()}
        >
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
