import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Plus, Search, Package, X, ArrowLeft, ChevronRight,
  Boxes, IndianRupee, AlertTriangle, PackageX,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/context/AuthContext'
import { getInventoryForBrand, getBrandSummary } from '@/lib/inventory'
import { getProducts } from '@/lib/products'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'
import AddStockDialog from '@/components/inventory/AddStockDialog'

function StatusBadge({ qty }) {
  if (qty === 0)
    return <Badge className="bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/20">Out of Stock</Badge>
  if (qty <= 3)
    return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/20">Low Stock</Badge>
  return <Badge className="bg-green-500/20 text-green-400 border-green-500/30 hover:bg-green-500/20">In Stock</Badge>
}

function SourceBadge({ source, count }) {
  const suffix = count != null ? ` · ${count}` : ''
  if (source === 'official')
    return <Badge className="bg-green-500/20 text-green-400 border-green-500/30 hover:bg-green-500/20">Official{suffix}</Badge>
  if (source === 'unofficial')
    return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 hover:bg-amber-500/20">Unofficial{suffix}</Badge>
  return <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30 hover:bg-slate-500/20">Manual{suffix}</Badge>
}

function StatBox({ label, value, icon: Icon, color }) {
  const colorMap = { default: 'text-muted-foreground', yellow: 'text-yellow-400', red: 'text-red-400', indigo: 'text-indigo-400' }
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
    <Card className="cursor-pointer hover:border-indigo-500/60 transition-all duration-150 group border-border" onClick={onClick}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between -mx-4 -mt-4 mb-3 px-4 pt-4 pb-3 bg-indigo-500/15 rounded-t-xl">
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
        <div className="mt-3 pt-3 border-t border-border space-y-1.5">
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {b.officialUnits > 0 && <span className="text-xs text-green-400 font-medium">{b.officialUnits} official</span>}
            {b.unofficialUnits > 0 && <span className="text-xs text-amber-400 font-medium">{b.unofficialUnits} unofficial</span>}
            {b.manualUnits > 0 && <span className="text-xs text-slate-400 font-medium">{b.manualUnits} manual</span>}
          </div>
          {hasIssue && (
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {b.outOfStockCount > 0 && <span className="text-xs text-red-400 font-medium">{b.outOfStockCount} out of stock</span>}
              {b.lowStockCount > 0 && <span className="text-xs text-yellow-400 font-medium">{b.lowStockCount} low stock</span>}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

const fmt = (n) => `₹${Number(n).toLocaleString('en-IN')}`

export default function Inventory() {
  const navigate = useNavigate()
  const location = useLocation()
  const { currentTenant } = useAuth()
  const tenantId = currentTenant?.id

  // Level 1
  const [brandSummary, setBrandSummary] = useState([])
  const [brandsLoading, setBrandsLoading] = useState(true)

  // Level 2
  const [selectedBrand, setSelectedBrand] = useState(null)
  const [inventory, setInventory] = useState([])
  const [loading, setLoading] = useState(false)
  const [searchInput, setSearchInput] = useState('')

  // Shared
  const [products, setProducts] = useState([])
  const [addOpen, setAddOpen] = useState(false)

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
    const { data, error } = await getInventoryForBrand(tenantId, selectedBrand)
    if (error) toast.error('Failed to load inventory')
    else setInventory(data)
    setLoading(false)
  }

  useEffect(() => { fetchBrandSummary() }, [tenantId])

  useEffect(() => {
    if (tenantId) getProducts(tenantId).then(({ data }) => setProducts(data ?? []))
  }, [tenantId])

  useEffect(() => {
    if (selectedBrand) fetchInventory()
  }, [tenantId, selectedBrand])

  // Restore Level 2 when navigating back from Level 3 page
  useEffect(() => {
    if (location.state?.restoreBrand) {
      setSelectedBrand(location.state.restoreBrand)
    }
  }, [])

  const groupedModels = useMemo(() => {
    const groups = {}
    for (const item of inventory) {
      const model = item.products?.model ?? 'Unknown'
      if (!groups[model]) {
        groups[model] = {
          model,
          variant: item.products?.variant ?? null,
          batches: [],
          totalQty: 0,
          minPrice: Infinity,
          maxPrice: -Infinity,
          sourceCounts: { official: 0, unofficial: 0, manual: 0 },
        }
      }
      const g = groups[model]
      const qty = item.quantity_remaining ?? 0
      const src = item.stock_source ?? 'manual'
      g.batches.push(item)
      g.totalQty += qty
      g.minPrice = Math.min(g.minPrice, item.purchase_price ?? 0)
      g.maxPrice = Math.max(g.maxPrice, item.purchase_price ?? 0)
      g.sourceCounts[src] = (g.sourceCounts[src] ?? 0) + qty
    }
    return Object.values(groups)
      .map(g => ({
        ...g,
        sources: Object.keys(g.sourceCounts).filter(s => g.sourceCounts[s] > 0),
        minPrice: g.minPrice === Infinity ? 0 : g.minPrice,
        maxPrice: g.maxPrice === -Infinity ? 0 : g.maxPrice,
      }))
      .sort((a, b) => a.model.localeCompare(b.model))
  }, [inventory])

  const filteredModels = useMemo(() => {
    const term = searchInput.trim().toLowerCase()
    if (!term) return groupedModels
    return groupedModels.filter(g => g.model.toLowerCase().includes(term))
  }, [groupedModels, searchInput])

  const handleBrandClick = (brand) => {
    setSelectedBrand(brand)
    setSearchInput('')
    setInventory([])
  }

  const handleBack = () => {
    setSelectedBrand(null)
    setSearchInput('')
    setInventory([])
  }

  const handleModelClick = (group) => {
    navigate(`/inventory/${encodeURIComponent(selectedBrand)}/${encodeURIComponent(group.model)}`)
  }

  const handleSuccess = () => {
    fetchBrandSummary()
    if (selectedBrand) fetchInventory()
  }

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
        /* ── Level 2: Brand Detail (grouped by model) ──────── */
        <>
          {/* Sticky brand header + search */}
          <div className="sticky top-0 z-20 bg-background -mx-4 md:-mx-6 px-4 md:px-6 py-3 border-b border-border">
            <div className="flex items-center gap-3 flex-wrap mb-3">
              <Button variant="ghost" size="icon" onClick={handleBack} className="shrink-0">
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl font-bold">{selectedBrand}</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {loading ? '…' : `${filteredModels.length} model${filteredModels.length !== 1 ? 's' : ''}`}
                </p>
              </div>
              <Button onClick={() => setAddOpen(true)} className="bg-indigo-500 hover:bg-indigo-600 text-white shrink-0">
                <Plus className="w-4 h-4 mr-2" />Add Stock
              </Button>
            </div>

            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search model…"
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

          {/* Desktop table — one row per model */}
          <div className="hidden md:block rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40 text-muted-foreground text-xs uppercase tracking-wider border-b border-border">
                  <th className="px-4 py-3 text-left font-medium">Model</th>
                  <th className="px-4 py-3 text-right font-medium">Total Stock</th>
                  <th className="px-4 py-3 text-right font-medium">Purchase Range</th>
                  <th className="px-4 py-3 text-center font-medium">Sources</th>
                  <th className="px-4 py-3 text-center font-medium">Status</th>
                  <th className="px-4 py-3 w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 6 }).map((_, j) => (
                        <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>
                      ))}
                    </tr>
                  ))
                ) : filteredModels.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-20 text-center text-muted-foreground">
                      <Package className="w-10 h-10 mx-auto mb-2 opacity-25" />
                      <p className="font-medium">
                        {searchInput ? `No models matching "${searchInput}"` : `No ${selectedBrand} stock yet`}
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredModels.map(group => (
                    <tr
                      key={group.model}
                      className="cursor-pointer border-l-2 border-l-transparent hover:border-l-indigo-500 hover:bg-muted/20 transition-colors"
                      onClick={() => handleModelClick(group)}
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium">{group.model}</p>
                        {group.variant && (
                          <p className="text-xs text-muted-foreground mt-0.5">{group.variant}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-semibold">{group.totalQty}</span>
                        <span className="text-muted-foreground text-xs ml-1">units</span>
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground">
                        {group.minPrice === group.maxPrice
                          ? fmt(group.minPrice)
                          : `${fmt(group.minPrice)} – ${fmt(group.maxPrice)}`}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1.5 justify-center flex-wrap">
                          {group.sources.map(s => (
                            <SourceBadge key={s} source={s} count={group.sourceCounts[s]} />
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <StatusBadge qty={group.totalQty} />
                      </td>
                      <td className="px-4 py-3 text-center text-muted-foreground">
                        <ChevronRight className="w-4 h-4 inline" />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile cards — one card per model */}
          <div className="md:hidden relative">
          <div className="space-y-3">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Card key={i}><CardContent className="p-4 space-y-3">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <div className="flex gap-2">
                    <Skeleton className="h-4 flex-1" />
                    <Skeleton className="h-4 flex-1" />
                  </div>
                </CardContent></Card>
              ))
            ) : filteredModels.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
                <Package className="w-10 h-10 opacity-25" />
                <p className="font-medium">
                  {searchInput ? `No models matching "${searchInput}"` : `No ${selectedBrand} stock yet`}
                </p>
              </div>
            ) : (
              filteredModels.map(group => (
                <Card
                  key={group.model}
                  className="border-border border-l-2 border-l-transparent hover:border-l-indigo-500 cursor-pointer transition-colors"
                  onClick={() => handleModelClick(group)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{group.model}</p>
                        {group.variant && (
                          <p className="text-xs text-muted-foreground mt-0.5">{group.variant}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <StatusBadge qty={group.totalQty} />
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-muted-foreground">Stock</span>
                      <span className="font-semibold">{group.totalQty} units</span>
                    </div>
                    <div className="flex items-center justify-between text-sm mb-3">
                      <span className="text-muted-foreground">Purchase range</span>
                      <span className="text-muted-foreground text-xs">
                        {group.minPrice === group.maxPrice
                          ? fmt(group.minPrice)
                          : `${fmt(group.minPrice)} – ${fmt(group.maxPrice)}`}
                      </span>
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                      {group.sources.map(s => (
                        <SourceBadge key={s} source={s} count={group.sourceCounts[s]} />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
          {filteredModels.length > 3 && (
            <div className="pointer-events-none absolute bottom-0 inset-x-0 h-24 bg-gradient-to-t from-background to-transparent" />
          )}
          </div>
        </>
      ) : (
        /* ── Level 1: Brand Overview ────────────────────────── */
        <>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold">Inventory</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {brandsLoading ? '…' : `${brandSummary.length} brand${brandSummary.length !== 1 ? 's' : ''}`}
              </p>
            </div>
            <Button onClick={() => setAddOpen(true)} className="bg-indigo-500 hover:bg-indigo-600 text-white shrink-0">
              <Plus className="w-4 h-4 mr-2" />Add Stock
            </Button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatBox label="Total Units"     value={totalUnits.toLocaleString('en-IN')}       icon={Boxes}         color="indigo" />
            <StatBox label="Stock Value"     value={`₹${totalValue.toLocaleString('en-IN')}`} icon={IndianRupee}   color="default" />
            <StatBox label="Low Stock Items" value={totalLow} icon={AlertTriangle} color={totalLow > 0 ? 'yellow' : 'default'} />
            <StatBox label="Out of Stock"    value={totalOut} icon={PackageX}      color={totalOut > 0 ? 'red'    : 'default'} />
          </div>

          {brandsLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i}><CardContent className="p-4 space-y-3">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-4 w-1/2" />
                </CardContent></Card>
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

      <AddStockDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        tenantId={tenantId}
        products={products}
        onSuccess={handleSuccess}
      />
    </motion.div>
  )
}
