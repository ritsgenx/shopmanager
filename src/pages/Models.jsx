import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeft, Search, ChevronRight, Smartphone, Plus, X, Loader2, IndianRupee, Pencil,
} from 'lucide-react'
import { useForm, Controller } from 'react-hook-form'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useAuth } from '@/context/AuthContext'
import { getProducts, createCatalogEntry, updateCatalogEntry, setModelActive } from '@/lib/products'
import { getTaxCategories } from '@/lib/taxCategories'
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

// "smartphone · HSN 8517 · 18%" — how a tax category reads in the pickers
const taxCategoryLabel = (tc) =>
  [tc.name, tc.hsn_code && `HSN ${tc.hsn_code}`, `${Number(tc.gst_rate)}% GST`]
    .filter(Boolean).join(' · ')

// ── Add Model dialog ─────────────────────────────────────────────────────────
function AddModelDialog({ open, onOpenChange, tenantId, products, taxCategories, defaultBrand, onSuccess }) {
  const { currentUser } = useAuth()
  const { register, handleSubmit, control, reset, watch, formState: { errors, isSubmitting } } = useForm({
    defaultValues: { tax_category_id: '', brand: defaultBrand ?? '', model: '', variant: '' },
  })

  // Colors are chips, not a form field — Enter/comma adds one, × removes it
  const [colors, setColors] = useState([])
  const [colorInput, setColorInput] = useState('')

  useEffect(() => {
    if (open) {
      reset({ tax_category_id: '', brand: defaultBrand ?? '', model: '', variant: '' })
      setColors([])
      setColorInput('')
    }
  }, [open, defaultBrand])

  const existingBrands = useMemo(
    () => [...new Set(products.map((p) => p.brand).filter(Boolean))].sort(),
    [products]
  )

  // Suggest colors already used for this brand — keeps spellings consistent
  const watchedBrand = watch('brand')
  const colorSuggestions = useMemo(() => {
    const b = norm(watchedBrand)
    const seen = new Map()
    for (const p of products) {
      if (!p.color) continue
      if (b && norm(p.brand) !== b) continue
      seen.set(p.color.toLowerCase(), p.color)
    }
    const chipped = new Set(colors.map((c) => c.toLowerCase()))
    return [...seen.values()].filter((c) => !chipped.has(c.toLowerCase())).sort()
  }, [products, watchedBrand, colors])

  // Accepts "Black" or a pasted "Black, Cream, Violet"
  const addColorChips = (raw) => {
    const names = raw.split(',').map((s) => s.trim()).filter(Boolean)
    if (names.length === 0) return
    setColors((prev) => {
      const next = [...prev]
      for (const name of names) {
        if (!next.some((c) => c.toLowerCase() === name.toLowerCase())) next.push(name)
      }
      return next
    })
    setColorInput('')
  }

  const handleColorKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addColorChips(colorInput)
    } else if (e.key === 'Backspace' && !colorInput && colors.length > 0) {
      setColors((prev) => prev.slice(0, -1))
    }
  }

  const removeColor = (name) =>
    setColors((prev) => prev.filter((c) => c !== name))

  const onSubmit = async (values) => {
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

    // A color typed but not yet chipped still counts
    const allColors = [...colors]
    for (const name of colorInput.split(',').map((s) => s.trim()).filter(Boolean)) {
      if (!allColors.some((c) => c.toLowerCase() === name.toLowerCase())) allColors.push(name)
    }

    const { data, error } = await createCatalogEntry({
      tenant_id: tenantId,
      tax_category_id: values.tax_category_id,
      brand: values.brand.trim(),
      model: values.model.trim(),
      variant: values.variant.trim() || null,
      colors: allColors,
      created_by: currentUser?.id,
    })
    if (error) {
      if (error.code === '23505') toast.error('This product already exists in the catalog.')
      else toast.error(error.message ?? 'Failed to create model')
      return
    }

    if (data.modelExisted && data.added === 0) {
      toast.error(
        allColors.length > 0
          ? 'This model already has all of these colors — nothing new to add.'
          : 'This model already exists in the catalog.'
      )
      return
    }

    if (data.modelExisted) {
      toast.success(
        `${data.added} color${data.added > 1 ? 's' : ''} added to the existing model` +
        (data.skipped > 0 ? ` (${data.skipped} already existed)` : '')
      )
    } else {
      toast.success(
        allColors.length > 0
          ? `Model added with ${data.added} color${data.added > 1 ? 's' : ''}`
          : 'Model added to catalog'
      )
    }
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
              name="tax_category_id"
              control={control}
              rules={{ required: 'Category is required' }}
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger><SelectValue placeholder="Select category…" /></SelectTrigger>
                  <SelectContent>
                    {taxCategories.map((tc) => (
                      <SelectItem key={tc.id} value={tc.id} className="capitalize">
                        {taxCategoryLabel(tc)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.tax_category_id && <p className="text-red-400 text-xs">{errors.tax_category_id.message}</p>}
            <p className="text-xs text-muted-foreground">
              GST rate and HSN come from the category — the owner maintains them in Settings.
            </p>
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
          </div>

          <div className="space-y-1.5 border-t border-border pt-3">
            <Label>Colors <span className="text-muted-foreground text-xs">(optional — Enter or comma adds each)</span></Label>
            {colors.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pb-1">
                {colors.map((c) => (
                  <span key={c}
                    className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-muted/60 text-foreground">
                    {c}
                    <button type="button" onClick={() => removeColor(c)}
                      className="text-muted-foreground hover:text-foreground" aria-label={`Remove ${c}`}>
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <Input
              value={colorInput}
              onChange={(e) => setColorInput(e.target.value)}
              onKeyDown={handleColorKeyDown}
              onBlur={() => addColorChips(colorInput)}
              placeholder={colors.length > 0 ? 'Add another color…' : 'Midnight Black'}
              list="catalog-colors" autoComplete="off"
            />
            <datalist id="catalog-colors">
              {colorSuggestions.map((c) => <option key={c} value={c} />)}
            </datalist>
            <p className="text-xs text-muted-foreground">
              Each color becomes its own catalog entry under this model. Leave empty to create the model without colors.
            </p>
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

// ── Edit Model dialog (owner-only) ───────────────────────────────────────────
// Renames are safe by construction: stock, sales and price history all point
// at the model's id, so they follow automatically. Bills reprint with the
// corrected name. Colors in use by stock/purchases/sales cannot be removed.
function EditModelDialog({ open, onOpenChange, tenantId, products, taxCategories, group, onSuccess }) {
  const { currentUser } = useAuth()
  const { register, handleSubmit, control, reset, watch, formState: { errors, isSubmitting } } = useForm({
    defaultValues: { tax_category_id: '', brand: '', model: '', variant: '' },
  })

  // Existing colors keep their product row id; newly added ones have id: null
  const [colorRows, setColorRows] = useState([])
  const [removed, setRemoved] = useState([])
  const [colorInput, setColorInput] = useState('')

  useEffect(() => {
    if (open && group) {
      const sample = group.rows?.[0] ?? {}
      reset({
        tax_category_id: sample.tax_category_id ?? '',
        brand: group.brand ?? '',
        model: group.model ?? '',
        variant: group.variant ?? '',
      })
      setColorRows(group.rows.filter((r) => r.color).map((r) => ({ id: r.id, color: r.color })))
      setRemoved([])
      setColorInput('')
    }
  }, [open, group])

  const existingBrands = useMemo(
    () => [...new Set(products.map((p) => p.brand).filter(Boolean))].sort(),
    [products]
  )

  const watchedBrand = watch('brand')
  const colorSuggestions = useMemo(() => {
    const b = norm(watchedBrand)
    const seen = new Map()
    for (const p of products) {
      if (!p.color) continue
      if (b && norm(p.brand) !== b) continue
      seen.set(p.color.toLowerCase(), p.color)
    }
    const chipped = new Set(colorRows.map((c) => c.color.toLowerCase()))
    return [...seen.values()].filter((c) => !chipped.has(c.toLowerCase())).sort()
  }, [products, watchedBrand, colorRows])

  const addColorChips = (raw) => {
    const names = raw.split(',').map((s) => s.trim()).filter(Boolean)
    if (names.length === 0) return
    setColorRows((prev) => {
      const next = [...prev]
      for (const name of names) {
        if (!next.some((c) => c.color.toLowerCase() === name.toLowerCase())) next.push({ id: null, color: name })
      }
      return next
    })
    setColorInput('')
  }

  const handleColorKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addColorChips(colorInput)
    }
  }

  const removeColorChip = (row) => {
    setColorRows((prev) => prev.filter((c) => c !== row))
    if (row.id) setRemoved((prev) => [...prev, row])
  }

  const onSubmit = async (values) => {
    if (!group) return

    // Rename collision: another model already has this brand+name+variant
    const clash = products.find((p) =>
      p.model_id !== group.modelId &&
      norm(p.brand) === norm(values.brand) &&
      norm(p.model) === norm(values.model) &&
      norm(p.variant) === norm(values.variant)
    )
    if (clash) {
      toast.error('A model with this brand, name and variant already exists — merging duplicates is not supported yet.')
      return
    }

    // Similar-name guard: same letters, different spacing/casing ("13C" vs "13 C")
    const similar = products.find((p) =>
      p.model_id !== group.modelId &&
      norm(p.brand) === norm(values.brand) &&
      squash(p.model) === squash(values.model) &&
      norm(p.model) !== norm(values.model)
    )
    if (similar) {
      const ok = window.confirm(
        `A very similar model already exists: "${similar.brand} ${similar.model}".\n` +
        `You typed "${values.model}". Keeping both will split stock and prices across duplicates.\n\nSave anyway?`
      )
      if (!ok) return
    }

    const allNewColors = colorRows.filter((r) => !r.id).map((r) => r.color)
    for (const name of colorInput.split(',').map((s) => s.trim()).filter(Boolean)) {
      if (!colorRows.some((c) => c.color.toLowerCase() === name.toLowerCase())) allNewColors.push(name)
    }

    const { data, error } = await updateCatalogEntry({
      tenantId,
      modelId: group.modelId,
      fields: {
        brand: values.brand.trim(),
        name: values.model.trim(),
        variant: values.variant.trim() || '',
        tax_category_id: values.tax_category_id,
      },
      addColors: allNewColors,
      removeProducts: removed,
      createdBy: currentUser?.id,
    })
    if (error) {
      if (error.code === '23505') toast.error('A model with this brand, name and variant already exists.')
      else toast.error(error.message ?? 'Failed to update model')
      return
    }

    if (data.blocked.length > 0) {
      toast.warning(`Model updated — colors with stock or sales history were kept: ${data.blocked.join(', ')}`)
    } else {
      toast.success('Model updated')
    }
    onSuccess()
    onOpenChange(false)
  }

  if (!group) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto p-6" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="text-lg">Edit Model</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Controller
              name="tax_category_id"
              control={control}
              rules={{ required: 'Category is required' }}
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger><SelectValue placeholder="Select category…" /></SelectTrigger>
                  <SelectContent>
                    {taxCategories.map((tc) => (
                      <SelectItem key={tc.id} value={tc.id} className="capitalize">
                        {taxCategoryLabel(tc)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.tax_category_id && <p className="text-red-400 text-xs">{errors.tax_category_id.message}</p>}
            <p className="text-xs text-muted-foreground">
              GST rate and HSN come from the category — the owner maintains them in Settings.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Brand</Label>
              <Input
                {...register('brand', { required: 'Required' })}
                placeholder="Samsung" list="edit-catalog-brands" autoComplete="off"
              />
              <datalist id="edit-catalog-brands">
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
          </div>

          <div className="space-y-1.5 border-t border-border pt-3">
            <Label>Colors <span className="text-muted-foreground text-xs">(Enter or comma adds each)</span></Label>
            {colorRows.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pb-1">
                {colorRows.map((row) => (
                  <span key={`${row.id ?? 'new'}-${row.color}`}
                    className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-muted/60 text-foreground">
                    {row.color}
                    <button type="button" onClick={() => removeColorChip(row)}
                      className="text-muted-foreground hover:text-foreground" aria-label={`Remove ${row.color}`}>
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <Input
              value={colorInput}
              onChange={(e) => setColorInput(e.target.value)}
              onKeyDown={handleColorKeyDown}
              onBlur={() => addColorChips(colorInput)}
              placeholder={colorRows.length > 0 ? 'Add another color…' : 'Midnight Black'}
              list="edit-catalog-colors" autoComplete="off"
            />
            <datalist id="edit-catalog-colors">
              {colorSuggestions.map((c) => <option key={c} value={c} />)}
            </datalist>
            <p className="text-xs text-muted-foreground">
              Colors already used by stock, purchases or sales can't be removed — history points at them.
            </p>
          </div>

          <p className="text-xs text-muted-foreground border-t border-border pt-3">
            Renaming is safe: stock, sales and price history follow this model automatically,
            and bills reprint with the corrected name.
          </p>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting} className="bg-indigo-500 hover:bg-indigo-600 text-white">
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Save Changes
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
  const [taxCategories, setTaxCategories] = useState([])
  const [userMap, setUserMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [selectedBrand, setSelectedBrand] = useState(null)
  const [search, setSearch] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [editGroup, setEditGroup] = useState(null)
  const [editOpen, setEditOpen] = useState(false)
  const [showInactive, setShowInactive] = useState(false)

  const openEdit = (group) => { setEditGroup(group); setEditOpen(true) }

  const fetchAll = async () => {
    if (!tenantId) return
    setLoading(true)
    const [prodRes, usersRes, taxRes] = await Promise.all([
      getProducts(tenantId),
      getTenantUsers(tenantId),
      getTaxCategories(tenantId),
    ])
    setProducts(prodRes.data ?? [])
    setTaxCategories(taxRes.data ?? [])
    const map = {}
    for (const u of usersRes.data ?? []) map[u.id] = u.full_name
    setUserMap(map)
    setLoading(false)
  }

  useEffect(() => { fetchAll() }, [tenantId])

  // Group products → one row per model (brand+model+variant), colors underneath
  const modelGroups = useMemo(() => {
    const map = new Map()
    for (const p of products) {
      const key = p.model_id
      const cur = map.get(key) ?? {
        key, modelId: p.model_id, brand: p.brand, model: p.model, variant: p.variant || '',
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
    const { error } = await setModelActive(tenantId, group.modelId, next)
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
                  <div className="flex items-center shrink-0 -mr-2">
                    {isOwner && (
                      <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground hover:text-indigo-400"
                        onClick={() => openEdit(g)}>
                        <Pencil className="w-3.5 h-3.5 mr-1" />Edit
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground hover:text-indigo-400"
                      onClick={() => navigate(`/prices?model=${g.modelId}`)}>
                      <IndianRupee className="w-3.5 h-3.5 mr-1" />Prices
                    </Button>
                  </div>
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
                      <td className="px-4 py-2.5 text-right whitespace-nowrap">
                        {isOwner && (
                          <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground hover:text-indigo-400"
                            onClick={() => openEdit(g)}>
                            <Pencil className="w-3.5 h-3.5 mr-1" />Edit
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground hover:text-indigo-400"
                          onClick={() => navigate(`/prices?model=${g.modelId}`)}>
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
        taxCategories={taxCategories}
        defaultBrand={selectedBrand}
        onSuccess={fetchAll}
      />

      <EditModelDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        tenantId={tenantId}
        products={products}
        taxCategories={taxCategories}
        group={editGroup}
        onSuccess={fetchAll}
      />
    </motion.div>
  )
}
