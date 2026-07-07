import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeft, Search, ChevronRight, Smartphone, Plus, X, Loader2, IndianRupee,
} from 'lucide-react'
import { useForm, Controller } from 'react-hook-form'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useAuth } from '@/context/AuthContext'
import { getProducts, createProduct, setProductsActive } from '@/lib/products'
import { getTenantUsers } from '@/lib/users'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

const norm = (s) => (s ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
const squash = (s) => norm(s).replace(/\s/g, '')

// ── Add Model dialog ─────────────────────────────────────────────────────────
function AddModelDialog({ open, onOpenChange, tenantId, products, defaultBrand, onSuccess }) {
  const { currentUser } = useAuth()
  const { register, handleSubmit, control, reset, formState: { errors, isSubmitting } } = useForm({
    defaultValues: {
      category: '', brand: defaultBrand ?? '', model: '', variant: '', color: '',
      hsn_code: '', gst_rate: '18',
    },
  })

  useEffect(() => {
    if (open) reset({ category: '', brand: defaultBrand ?? '', model: '', variant: '', color: '', hsn_code: '', gst_rate: '18' })
  }, [open, defaultBrand])

  const existingBrands = useMemo(
    () => [...new Set(products.map((p) => p.brand).filter(Boolean))].sort(),
    [products]
  )

  const onSubmit = async (values) => {
    // Duplicate guard: exact same brand+model+variant+color already in catalog
    const exact = products.find((p) =>
      norm(p.brand) === norm(values.brand) &&
      norm(p.model) === norm(values.model) &&
      norm(p.variant) === norm(values.variant) &&
      norm(p.color) === norm(values.color)
    )
    if (exact) {
      toast.error('This exact model (same variant and color) already exists in the catalog.')
      return
    }

    // Similar-name guard: same letters, different spacing/casing ("13C" vs "13 C")
    const similar = products.find((p) =>
      norm(p.brand) === norm(values.brand) &&
      squash(p.model) === squash(values.model) &&
      norm(p.model) !== norm(values.model)
    )
    if (similar) {
      const ok = window.confirm(
        `A very similar model already exists: "${similar.brand} ${similar.model}".\n` +
        `You typed "${values.model}". Creating both will split stock and prices across duplicates.\n\nCreate anyway?`
      )
      if (!ok) return
    }

    const { error } = await createProduct({
      tenant_id: tenantId,
      category: values.category,
      brand: values.brand.trim(),
      model: values.model.trim(),
      variant: values.variant.trim() || null,
      color: values.color.trim() || null,
      hsn_code: values.hsn_code.trim() || null,
      gst_rate: Number(values.gst_rate),
      created_by: currentUser?.id,
    })
    if (error) {
      if (error.code === '23505') toast.error('This product already exists in the catalog.')
      else toast.error(error.message ?? 'Failed to create model')
      return
    }
    toast.success('Model added to catalog')
    onSuccess()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto p-6" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="text-lg">Add Model</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Controller
              name="category"
              control={control}
              rules={{ required: 'Category is required' }}
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger><SelectValue placeholder="Select category…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="smartphone">Smartphone</SelectItem>
                    <SelectItem value="accessory">Accessory</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
            {errors.category && <p className="text-red-400 text-xs">{errors.category.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Brand</Label>
              <Input
                {...register('brand', { required: 'Required' })}
                placeholder="Samsung" list="catalog-brands" autoComplete="off"
              />
              <datalist id="catalog-brands">
                {existingBrands.map((b) => <option key={b} value={b} />)}
              </datalist>
              {errors.brand && <p className="text-red-400 text-xs">{errors.brand.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Model</Label>
              <Input {...register('model', { required: 'Required' })} placeholder="Galaxy S24" />
              {errors.model && <p className="text-red-400 text-xs">{errors.model.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Variant <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input {...register('variant')} placeholder="8/256GB" />
            </div>
            <div className="space-y-1.5">
              <Label>Color <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input {...register('color')} placeholder="Midnight Black" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>HSN Code <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input {...register('hsn_code')} placeholder="8517" />
            </div>
            <div className="space-y-1.5">
              <Label>GST Rate (%)</Label>
              <Input
                {...register('gst_rate', { required: 'Required', min: { value: 0, message: 'Must be ≥ 0' } })}
                type="number" placeholder="18"
              />
              {errors.gst_rate && <p className="text-red-400 text-xs">{errors.gst_rate.message}</p>}
            </div>
          </div>

          <p className="text-xs text-muted-foreground border-t border-border pt-3">
            Prices (MOP / Finance / O/C) are set per model + variant in the Price Editor —
            colors share the same prices.
          </p>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting} className="bg-indigo-500 hover:bg-indigo-600 text-white">
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Add Model
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function Models() {
  const navigate = useNavigate()
  const { currentUser, currentTenant } = useAuth()
  const tenantId = currentTenant?.id
  const isOwner = currentUser?.role === 'admin'

  const [products, setProducts] = useState([])
  const [userMap, setUserMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [selectedBrand, setSelectedBrand] = useState(null)
  const [search, setSearch] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [showInactive, setShowInactive] = useState(false)

  const fetchAll = async () => {
    if (!tenantId) return
    setLoading(true)
    const [prodRes, usersRes] = await Promise.all([
      getProducts(tenantId),
      getTenantUsers(tenantId),
    ])
    setProducts(prodRes.data ?? [])
    const map = {}
    for (const u of usersRes.data ?? []) map[u.id] = u.full_name
    setUserMap(map)
    setLoading(false)
  }

  useEffect(() => { fetchAll() }, [tenantId])

  // Group products → one row per brand+model+variant, colors underneath
  const modelGroups = useMemo(() => {
    const map = new Map()
    for (const p of products) {
      const key = `${p.brand}|${p.model}|${p.variant || ''}`
      const cur = map.get(key) ?? {
        key, brand: p.brand, model: p.model, variant: p.variant || '',
        category: p.category, rows: [],
      }
      cur.rows.push(p)
      map.set(key, cur)
    }
    return [...map.values()].map((g) => ({
      ...g,
      colors: [...new Set(g.rows.map((r) => r.color).filter(Boolean))],
      active: g.rows.some((r) => r.is_active !== false),
      createdAt: g.rows.map((r) => r.created_at).filter(Boolean).sort()[0] ?? null,
      createdBy: g.rows.map((r) => r.created_by).filter(Boolean)[0] ?? null,
    }))
  }, [products])

  const brands = useMemo(() => {
    const map = new Map()
    for (const g of modelGroups) {
      const b = map.get(g.brand) ?? { brand: g.brand, models: 0, activeModels: 0, colors: 0 }
      b.models += 1
      if (g.active) b.activeModels += 1
      b.colors += g.colors.length
      map.set(g.brand, b)
    }
    return [...map.values()].sort((a, b) => a.brand.localeCompare(b.brand))
  }, [modelGroups])

  const filteredBrands = useMemo(() => {
    const q = search.toLowerCase()
    return q ? brands.filter((b) => b.brand.toLowerCase().includes(q)) : brands
  }, [brands, search])

  const brandGroups = useMemo(() => {
    if (!selectedBrand) return []
    const q = search.toLowerCase()
    return modelGroups
      .filter((g) => g.brand === selectedBrand)
      .filter((g) => showInactive || g.active)
      .filter((g) => !q || `${g.model} ${g.variant}`.toLowerCase().includes(q))
      .sort((a, b) => a.model.localeCompare(b.model) || a.variant.localeCompare(b.variant))
  }, [modelGroups, selectedBrand, search, showInactive])

  const handleToggleActive = async (group, next) => {
    const ids = group.rows.map((r) => r.id)
    const { error } = await setProductsActive(tenantId, ids, next)
    if (error) { toast.error(error.message ?? 'Failed to update model'); return }
    toast.success(next ? 'Model reactivated' : 'Model marked discontinued — hidden from purchase pickers')
    fetchAll()
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="p-4 md:p-6 max-w-7xl mx-auto space-y-5"
    >
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        {selectedBrand && (
          <Button variant="ghost" size="icon" className="shrink-0"
            onClick={() => { setSelectedBrand(null); setSearch('') }}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
        )}
        <div className="flex-1 min-w-40">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Smartphone className="w-6 h-6 text-indigo-400" />
            {selectedBrand ? `${selectedBrand} — Models` : 'Models'}
          </h1>
          <p className="text-sm text-muted-foreground">
            The master catalog — every model used across purchases, inventory, sales and prices
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)} className="bg-indigo-500 hover:bg-indigo-600 text-white">
          <Plus className="w-4 h-4 mr-2" />Add Model
        </Button>
      </div>

      {/* Search + filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative max-w-sm flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={selectedBrand ? 'Search model…' : 'Search brand…'}
            className="pl-9 pr-8"
          />
          {search && (
            <button onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        {selectedBrand && (
          <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
            <Switch checked={showInactive} onCheckedChange={setShowInactive} />
            Show discontinued
          </label>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      ) : !selectedBrand ? (
        /* ── Level 1: brands ── */
        filteredBrands.length === 0 ? (
          <p className="text-sm text-muted-foreground py-10 text-center">
            Catalog is empty — click "Add Model" to create the first one.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredBrands.map((b) => (
              <Card key={b.brand}
                className="cursor-pointer hover:border-indigo-500/60 transition-all duration-150 group border-border"
                onClick={() => { setSelectedBrand(b.brand); setSearch('') }}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between -mx-4 -mt-4 mb-3 px-4 pt-4 pb-3 bg-indigo-500/15 rounded-t-xl">
                    <h3 className="font-bold text-base leading-tight">{b.brand}</h3>
                    <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-indigo-400 transition-colors shrink-0 mt-0.5" />
                  </div>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Models</span>
                      <span className="font-semibold">{b.models}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Colors</span>
                      <span className="font-semibold">{b.colors}</span>
                    </div>
                  </div>
                  {b.models > b.activeModels && (
                    <div className="mt-3 pt-3 border-t border-border">
                      <span className="text-xs text-slate-400 font-medium">
                        {b.models - b.activeModels} discontinued
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )
      ) : (
        /* ── Level 2: models — cards on phones, table on md+ ── */
        <>
        <div className="md:hidden space-y-3">
          {brandGroups.map((g) => (
            <Card key={g.key} className={cn('border-border', !g.active && 'opacity-50')}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">
                      {g.model}{g.variant && <span className="text-muted-foreground font-normal"> · {g.variant}</span>}
                    </p>
                    <Badge variant="outline" className="text-xs capitalize mt-1">{g.category ?? '—'}</Badge>
                  </div>
                  <Switch
                    checked={g.active}
                    onCheckedChange={(next) => handleToggleActive(g, next)}
                    disabled={!isOwner}
                  />
                </div>

                {g.colors.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {g.colors.map((c) => (
                      <span key={c} className="text-xs px-2 py-0.5 rounded-full bg-muted/60 text-muted-foreground">{c}</span>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between gap-2 border-t border-border pt-2.5">
                  <p className="text-xs text-muted-foreground">
                    {g.createdAt
                      ? `Added ${new Date(g.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`
                      : '—'}
                    {g.createdBy && userMap[g.createdBy] && ` · by ${userMap[g.createdBy]}`}
                  </p>
                  <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground hover:text-indigo-400 shrink-0 -mr-2"
                    onClick={() => navigate('/prices')}>
                    <IndianRupee className="w-3.5 h-3.5 mr-1" />Prices
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {brandGroups.length === 0 && (
            <p className="text-sm text-muted-foreground py-10 text-center">No models match.</p>
          )}
        </div>

        <Card className="hidden md:block">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Model</th>
                    <th className="px-4 py-3 font-medium">Variant</th>
                    <th className="px-4 py-3 font-medium">Category</th>
                    <th className="px-4 py-3 font-medium">Colors</th>
                    <th className="px-4 py-3 font-medium">Added</th>
                    <th className="px-4 py-3 font-medium text-center">Active</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {brandGroups.map((g) => (
                    <tr key={g.key} className={cn('border-t border-border/50', !g.active && 'opacity-50')}>
                      <td className="px-4 py-2.5 font-medium">{g.model}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{g.variant || '—'}</td>
                      <td className="px-4 py-2.5">
                        <Badge variant="outline" className="text-xs capitalize">{g.category ?? '—'}</Badge>
                      </td>
                      <td className="px-4 py-2.5">
                        {g.colors.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {g.colors.map((c) => (
                              <span key={c} className="text-xs px-2 py-0.5 rounded-full bg-muted/60 text-muted-foreground">{c}</span>
                            ))}
                          </div>
                        ) : <span className="text-muted-foreground text-xs">—</span>}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <p className="text-xs text-muted-foreground">
                          {g.createdAt
                            ? new Date(g.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                            : '—'}
                        </p>
                        {g.createdBy && userMap[g.createdBy] && (
                          <p className="text-xs text-muted-foreground">by {userMap[g.createdBy]}</p>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <Switch
                          checked={g.active}
                          onCheckedChange={(next) => handleToggleActive(g, next)}
                          disabled={!isOwner}
                        />
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground hover:text-indigo-400"
                          onClick={() => navigate('/prices')}>
                          <IndianRupee className="w-3.5 h-3.5 mr-1" />Prices
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {brandGroups.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground text-sm">
                        No models match.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
        </>
      )}

      <AddModelDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        tenantId={tenantId}
        products={products}
        defaultBrand={selectedBrand}
        onSuccess={fetchAll}
      />
    </motion.div>
  )
}
