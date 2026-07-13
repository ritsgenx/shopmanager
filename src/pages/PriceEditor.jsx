import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeft, Search, ChevronRight, IndianRupee, History,
  AlertTriangle, Loader2, X,
} from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useAuth } from '@/context/AuthContext'
import { getProducts } from '@/lib/products'
import {
  getCurrentPrices, getPriceHistory, addPriceEntries,
  getMissingPriceModels,
} from '@/lib/modelPrices'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'

const fmt = (n) => n == null ? '—' : `₹${Number(n).toLocaleString('en-IN')}`
const STALE_DAYS = 7
const TYPO_GUARD_PCT = 25

function daysAgo(iso) {
  return (Date.now() - new Date(iso).getTime()) / 86400000
}

function relTime(iso) {
  if (!iso) return 'never'
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} hr ago`
  const days = Math.floor(hrs / 24)
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days} days ago`
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Price history dialog: 3-series step chart + change log ──────────────────
const CHART_COLORS = {
  light: { finance: '#2a78d6', oc: '#1baf7a', mop: '#eda100', grid: '#e1e0d9', ink: '#898781', surface: '#ffffff' },
  dark:  { finance: '#3987e5', oc: '#199e70', mop: '#c98500', grid: '#2c2c2a', ink: '#898781', surface: '#020817' },
}

function PriceHistoryDialog({ open, onOpenChange, row, tenantId }) {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(false)

  const isDark = typeof document !== 'undefined' &&
    (document.documentElement.classList.contains('dark') || document.documentElement.classList.contains('dim'))
  const c = isDark ? CHART_COLORS.dark : CHART_COLORS.light

  useEffect(() => {
    if (!open || !row) return
    setLoading(true)
    getPriceHistory(tenantId, row.model_id).then(({ data }) => {
      setHistory(data ?? [])
      setLoading(false)
    })
  }, [open, row, tenantId])

  const chartData = useMemo(() => history.map((h) => ({
    ts: new Date(h.created_at).getTime(),
    label: new Date(h.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
    MOP: h.mop != null ? Number(h.mop) : null,
    Finance: h.finance_price != null ? Number(h.finance_price) : null,
    'O/C': h.oc_price != null ? Number(h.oc_price) : null,
  })), [history])

  if (!row) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-4 h-4 text-indigo-400" />
            Price History — {[row.brand, row.model, row.variant].filter(Boolean).join(' ')}
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 pb-6 space-y-5">
          {loading ? (
            <Skeleton className="h-64 w-full" />
          ) : history.length === 0 ? (
            <p className="text-sm text-muted-foreground py-10 text-center">
              No prices recorded yet for this model.
            </p>
          ) : (
            <>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
                    <CartesianGrid stroke={c.grid} strokeWidth={1} vertical={false} />
                    <XAxis
                      dataKey="label" tick={{ fill: c.ink, fontSize: 11 }}
                      axisLine={{ stroke: c.grid }} tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: c.ink, fontSize: 11 }} tickLine={false} axisLine={false}
                      tickFormatter={(v) => `₹${(v / 1000).toFixed(v >= 100000 ? 0 : 1)}k`}
                      width={52} domain={['auto', 'auto']}
                    />
                    <Tooltip
                      formatter={(v) => fmt(v)}
                      contentStyle={{
                        background: c.surface, border: `1px solid ${c.grid}`,
                        borderRadius: 8, fontSize: 12,
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    {/* A price holds until the next change — step lines, not slopes */}
                    <Line type="stepAfter" dataKey="Finance" stroke={c.finance} strokeWidth={2}
                      dot={false} activeDot={{ r: 4.5, strokeWidth: 2, stroke: c.surface }} connectNulls />
                    <Line type="stepAfter" dataKey="O/C" stroke={c.oc} strokeWidth={2}
                      dot={false} activeDot={{ r: 4.5, strokeWidth: 2, stroke: c.surface }} connectNulls />
                    <Line type="stepAfter" dataKey="MOP" stroke={c.mop} strokeWidth={2} strokeDasharray="5 4"
                      dot={false} activeDot={{ r: 4.5, strokeWidth: 2, stroke: c.surface }} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Change log — newest first */}
              <div className="border border-border rounded-lg overflow-hidden">
                <div className="max-h-56 overflow-y-auto overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 sticky top-0">
                      <tr className="text-left text-xs text-muted-foreground">
                        <th className="px-4 py-2 font-medium">When</th>
                        <th className="px-4 py-2 font-medium">By</th>
                        <th className="px-4 py-2 font-medium text-right">MOP</th>
                        <th className="px-4 py-2 font-medium text-right">Finance</th>
                        <th className="px-4 py-2 font-medium text-right">O/C</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...history].reverse().map((h) => (
                        <tr key={h.id} className="border-t border-border/50">
                          <td className="px-4 py-2 whitespace-nowrap">
                            {new Date(h.created_at).toLocaleString('en-IN', {
                              day: 'numeric', month: 'short', year: 'numeric',
                              hour: 'numeric', minute: '2-digit',
                            })}
                          </td>
                          <td className="px-4 py-2">{h.created_by_name ?? '—'}</td>
                          <td className="px-4 py-2 text-right">{fmt(h.mop)}</td>
                          <td className="px-4 py-2 text-right">{fmt(h.finance_price)}</td>
                          <td className="px-4 py-2 text-right">{fmt(h.oc_price)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Editable price cell ──────────────────────────────────────────────────────
function PriceCell({ value, onChange, dirty, className }) {
  return (
    <Input
      inputMode="numeric"
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, ''))}
      placeholder="—"
      className={cn(
        // ml-auto: Input renders as a block-level flex element, so the cell's
        // text-right alone can't push it to the column's right edge
        'h-8 w-24 ml-auto text-right text-sm',
        className,
        dirty && 'border-indigo-500 ring-1 ring-indigo-500/40'
      )}
    />
  )
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function PriceEditor() {
  const { currentUser, currentTenant } = useAuth()
  const tenantId = currentTenant?.id

  const [products, setProducts] = useState([])
  const [priceMap, setPriceMap] = useState(new Map())
  const [missingModels, setMissingModels] = useState([])
  const [loading, setLoading] = useState(true)

  const [selectedBrand, setSelectedBrand] = useState(null)
  const [search, setSearch] = useState('')
  const [edits, setEdits] = useState({}) // key → { mop, finance, oc } (strings)
  const [saving, setSaving] = useState(false)

  const [historyRow, setHistoryRow] = useState(null)
  const [historyOpen, setHistoryOpen] = useState(false)

  // Deep link: /prices?model=<model_id> lands directly on that model's row.
  // Any screen can use it (Models page, New Sale warnings, future widgets).
  const [searchParams] = useSearchParams()
  const [highlightId, setHighlightId] = useState(null)
  const consumedDeepLink = useRef(null)

  const fetchAll = async () => {
    if (!tenantId) return
    setLoading(true)
    const [prodRes, priceRes] = await Promise.all([
      getProducts(tenantId),
      getCurrentPrices(tenantId),
    ])
    const activeProducts = (prodRes.data ?? []).filter((p) => p.is_active !== false)
    setProducts(activeProducts)
    setPriceMap(priceRes.map)
    const { data: missing } = await getMissingPriceModels(tenantId, priceRes.map)
    setMissingModels(missing ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchAll() }, [tenantId])

  // Group products → one row per model (colors share a price)
  const modelRows = useMemo(() => {
    const map = new Map()
    for (const p of products) {
      const key = p.model_id
      const cur = map.get(key) ?? {
        key, model_id: p.model_id, brand: p.brand, model: p.model, variant: p.variant || '',
        category: p.category, colors: new Set(),
      }
      if (p.color) cur.colors.add(p.color)
      map.set(key, cur)
    }
    return [...map.values()].map((r) => ({ ...r, colors: [...r.colors] }))
  }, [products])

  // Apply the deep link once per target: select the brand, filter to the
  // model, flash the row, and (desktop only — phones would pop the keyboard)
  // focus its first price cell.
  useEffect(() => {
    const target = searchParams.get('model')
    if (!target || loading || consumedDeepLink.current === target) return
    const row = modelRows.find((r) => r.model_id === target)
    if (!row) return
    consumedDeepLink.current = target
    setSelectedBrand(row.brand)
    setSearch(row.model)
    setHighlightId(target)
    setTimeout(() => {
      if (window.matchMedia('(min-width: 768px)').matches) {
        document.querySelector(`[data-model-row="${target}"] input`)?.focus()
      }
    }, 150)
    setTimeout(() => setHighlightId(null), 2500)
  }, [searchParams, loading, modelRows]) // eslint-disable-line react-hooks/exhaustive-deps

  const brands = useMemo(() => {
    const map = new Map()
    for (const row of modelRows) {
      const b = map.get(row.brand) ?? { brand: row.brand, models: 0, priced: 0, stale: 0 }
      b.models += 1
      const price = priceMap.get(row.key)
      if (price && (price.finance_price != null || price.oc_price != null)) {
        b.priced += 1
        if (daysAgo(price.created_at) > STALE_DAYS) b.stale += 1
      }
      map.set(row.brand, b)
    }
    const missingByBrand = {}
    for (const m of missingModels) missingByBrand[m.brand] = (missingByBrand[m.brand] ?? 0) + 1
    return [...map.values()]
      .map((b) => ({ ...b, missing: missingByBrand[b.brand] ?? 0 }))
      .sort((a, b) => a.brand.localeCompare(b.brand))
  }, [modelRows, priceMap, missingModels])

  const filteredBrands = useMemo(() => {
    const q = search.toLowerCase()
    return q ? brands.filter((b) => b.brand.toLowerCase().includes(q)) : brands
  }, [brands, search])

  const brandRows = useMemo(() => {
    if (!selectedBrand) return []
    const q = search.toLowerCase()
    return modelRows
      .filter((r) => r.brand === selectedBrand)
      .filter((r) => !q || `${r.model} ${r.variant}`.toLowerCase().includes(q))
      .sort((a, b) => a.model.localeCompare(b.model) || a.variant.localeCompare(b.variant))
  }, [modelRows, selectedBrand, search])

  // ── Editing ────────────────────────────────────────────────────────────────
  const cellValue = (row, field) => {
    const edit = edits[row.key]
    if (edit && edit[field] !== undefined) return edit[field]
    const price = priceMap.get(row.key)
    const dbField = { mop: 'mop', finance: 'finance_price', oc: 'oc_price' }[field]
    return price?.[dbField] != null ? String(price[dbField]) : ''
  }

  const isDirty = (row, field) => {
    const edit = edits[row.key]
    if (!edit || edit[field] === undefined) return false
    const price = priceMap.get(row.key)
    const dbField = { mop: 'mop', finance: 'finance_price', oc: 'oc_price' }[field]
    const original = price?.[dbField] != null ? String(price[dbField]) : ''
    return edit[field] !== original
  }

  const setCell = (row, field, value) => {
    setEdits((prev) => ({ ...prev, [row.key]: { ...prev[row.key], [field]: value } }))
  }

  const dirtyRows = useMemo(
    () => brandRows.filter((r) => ['mop', 'finance', 'oc'].some((f) => isDirty(r, f))),
    [brandRows, edits, priceMap] // eslint-disable-line react-hooks/exhaustive-deps
  )

  const handleSave = async () => {
    if (dirtyRows.length === 0) return

    const entries = []
    const bigJumps = []
    for (const row of dirtyRows) {
      const price = priceMap.get(row.key)
      const parse = (f) => {
        const v = cellValue(row, f)
        return v === '' ? null : Number(v)
      }
      const entry = {
        model_id: row.model_id,
        mop: parse('mop'), finance_price: parse('finance'), oc_price: parse('oc'),
      }
      entries.push(entry)

      // Typo guard: flag changes deviating more than TYPO_GUARD_PCT from previous
      const checks = [
        ['MOP', price?.mop, entry.mop],
        ['Finance', price?.finance_price, entry.finance_price],
        ['O/C', price?.oc_price, entry.oc_price],
      ]
      for (const [label, prev, next] of checks) {
        if (prev != null && next != null && Number(prev) > 0) {
          const pct = Math.abs((next - prev) / prev) * 100
          if (pct > TYPO_GUARD_PCT) {
            bigJumps.push(`${row.model} ${row.variant} ${label}: ${fmt(prev)} → ${fmt(next)} (${Math.round(pct)}%)`)
          }
        }
      }
    }

    if (bigJumps.length > 0) {
      const ok = window.confirm(
        `Some prices changed by more than ${TYPO_GUARD_PCT}% — please double-check:\n\n${bigJumps.join('\n')}\n\nSave anyway?`
      )
      if (!ok) return
    }

    setSaving(true)
    const { error } = await addPriceEntries(tenantId, currentUser?.id, entries)
    setSaving(false)
    if (error) { toast.error(error.message ?? 'Failed to save prices'); return }

    toast.success(`Prices updated for ${entries.length} model${entries.length > 1 ? 's' : ''}`)
    setEdits({})
    fetchAll()
  }

  const openHistory = (row) => { setHistoryRow(row); setHistoryOpen(true) }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="p-4 md:p-6 max-w-7xl mx-auto space-y-5"
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        {selectedBrand && (
          <Button variant="ghost" size="icon" className="shrink-0"
            onClick={() => { setSelectedBrand(null); setSearch(''); setEdits({}) }}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
        )}
        <div className="flex-1">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <IndianRupee className="w-6 h-6 text-indigo-400" />
            {selectedBrand ? `${selectedBrand} — Prices` : 'Price Editor'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {selectedBrand
              ? 'MOP is reference only. Finance / O/C are the profit basis for official units.'
              : 'Model-level MOP, Finance and O/C prices for officially purchased stock'}
          </p>
        </div>
      </div>

      {/* Missing-price alert (official stock that cannot be sold) */}
      {missingModels.length > 0 && !selectedBrand && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <p className="text-sm font-semibold text-amber-400">
                {missingModels.length} model{missingModels.length > 1 ? 's' : ''} with official stock
                {' '}ha{missingModels.length > 1 ? 've' : 's'} no Finance / O/C price — sales are blocked until set
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {missingModels.map((m) => (
                <button
                  key={m.model_id}
                  onClick={() => { setSelectedBrand(m.brand); setSearch(m.model) }}
                  className="text-xs px-2.5 py-1 rounded-md border border-amber-500/40 text-amber-300 hover:bg-amber-500/10 transition-colors"
                >
                  {[m.brand, m.model, m.variant].filter(Boolean).join(' ')} · {m.units} unit{m.units > 1 ? 's' : ''}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search */}
      <div className="relative max-w-sm">
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

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-36 rounded-xl" />)}
        </div>
      ) : !selectedBrand ? (
        /* ── Level 1: brands ── */
        filteredBrands.length === 0 ? (
          <p className="text-sm text-muted-foreground py-10 text-center">
            No models in the catalog yet — add stock or create models first.
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
                      <span className="text-muted-foreground">With prices</span>
                      <span className="font-semibold">{b.priced} / {b.models}</span>
                    </div>
                  </div>
                  {(b.missing > 0 || b.stale > 0) && (
                    <div className="mt-3 pt-3 border-t border-border flex flex-wrap gap-x-3 gap-y-1">
                      {b.missing > 0 && (
                        <span className="text-xs text-amber-400 font-medium">{b.missing} blocking sales</span>
                      )}
                      {b.stale > 0 && (
                        <span className="text-xs text-yellow-400 font-medium">{b.stale} stale (&gt;{STALE_DAYS}d)</span>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )
      ) : (
        /* ── Level 2: model prices — cards on phones, table on md+ ── */
        <>
        <div className="md:hidden space-y-3">
          {brandRows.map((row) => {
            const price = priceMap.get(row.key)
            const stale = price && daysAgo(price.created_at) > STALE_DAYS
            const noPrices = !price || (price.finance_price == null && price.oc_price == null)
            return (
              <Card key={row.key} data-model-row={row.model_id}
                className={cn(
                  'border-border transition-colors duration-700',
                  stale && 'border-amber-500/40 bg-amber-500/5',
                  highlightId === row.model_id && 'border-indigo-500/70 bg-indigo-500/10'
                )}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <button onClick={() => openHistory(row)}
                        className="font-semibold text-left hover:text-indigo-400 transition-colors">
                        {row.model}{row.variant && <span className="text-muted-foreground font-normal"> · {row.variant}</span>}
                      </button>
                      {row.colors.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{row.colors.join(' · ')}</p>
                      )}
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 -mr-1"
                      onClick={() => openHistory(row)} title="Price history">
                      <History className="w-4 h-4 text-muted-foreground" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {[['mop', 'MOP'], ['finance', 'Finance'], ['oc', 'O/C']].map(([f, label]) => (
                      <div key={f} className="space-y-1">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
                        <PriceCell
                          value={cellValue(row, f)}
                          onChange={(v) => setCell(row, f, v)}
                          dirty={isDirty(row, f)}
                          className="h-9 w-full ml-0"
                        />
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between gap-2 text-xs">
                    {price ? (
                      <p className={cn(stale ? 'text-amber-400 font-medium' : 'text-muted-foreground')}>
                        {relTime(price.created_at)}{price.created_by_name && ` · by ${price.created_by_name}`}
                      </p>
                    ) : (
                      <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30 hover:bg-slate-500/20 text-xs">
                        never set
                      </Badge>
                    )}
                    {noPrices && price && <span className="text-amber-400">no Finance/O·C</span>}
                  </div>
                </CardContent>
              </Card>
            )
          })}
          {brandRows.length === 0 && (
            <p className="text-sm text-muted-foreground py-10 text-center">No models match your search.</p>
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
                    <th className="px-4 py-3 font-medium text-right">MOP</th>
                    <th className="px-4 py-3 font-medium text-right">Finance</th>
                    <th className="px-4 py-3 font-medium text-right">O/C</th>
                    <th className="px-4 py-3 font-medium">Last Updated</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {brandRows.map((row) => {
                    const price = priceMap.get(row.key)
                    const stale = price && daysAgo(price.created_at) > STALE_DAYS
                    const noPrices = !price || (price.finance_price == null && price.oc_price == null)
                    return (
                      <tr key={row.key} data-model-row={row.model_id}
                        className={cn(
                          'border-t border-border/50 transition-colors duration-700',
                          stale && 'bg-amber-500/5',
                          highlightId === row.model_id && 'bg-indigo-500/10'
                        )}>
                        <td className="px-4 py-2.5">
                          <button onClick={() => openHistory(row)}
                            className="font-medium hover:text-indigo-400 hover:underline underline-offset-2 transition-colors text-left">
                            {row.model}
                          </button>
                          {row.colors.length > 0 && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {row.colors.join(' · ')}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">{row.variant || '—'}</td>
                        {['mop', 'finance', 'oc'].map((f) => (
                          <td key={f} className="px-4 py-2.5 text-right">
                            <PriceCell
                              value={cellValue(row, f)}
                              onChange={(v) => setCell(row, f, v)}
                              dirty={isDirty(row, f)}
                            />
                          </td>
                        ))}
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          {price ? (
                            <div>
                              <p className={cn('text-xs', stale ? 'text-amber-400 font-medium' : 'text-muted-foreground')}>
                                {relTime(price.created_at)}
                              </p>
                              {price.created_by_name && (
                                <p className="text-xs text-muted-foreground">by {price.created_by_name}</p>
                              )}
                            </div>
                          ) : (
                            <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30 hover:bg-slate-500/20 text-xs">
                              never set
                            </Badge>
                          )}
                          {noPrices && price && (
                            <p className="text-xs text-amber-400 mt-0.5">no Finance/O·C</p>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <Button variant="ghost" size="icon" className="h-8 w-8"
                            onClick={() => openHistory(row)} title="Price history">
                            <History className="w-4 h-4 text-muted-foreground" />
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                  {brandRows.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground text-sm">
                        No models match your search.
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

      {/* Sticky save bar — stays reachable while scrolling long price lists */}
      {selectedBrand && dirtyRows.length > 0 && (
        <div className="sticky bottom-3 z-20">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-indigo-500/40 bg-background/95 backdrop-blur px-4 py-3 shadow-xl">
            <p className="text-sm min-w-0">
              <span className="font-semibold">{dirtyRows.length}</span> model{dirtyRows.length > 1 ? 's' : ''} edited
              <span className="hidden sm:inline text-muted-foreground"> — saved as new history entries, nothing is overwritten</span>
            </p>
            <div className="flex gap-2 shrink-0">
              <Button variant="outline" size="sm" onClick={() => setEdits({})} disabled={saving}>
                Discard
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving}
                className="bg-indigo-600 hover:bg-indigo-700 text-white">
                {saving
                  ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Saving…</>
                  : 'Save'}
              </Button>
            </div>
          </div>
        </div>
      )}

      <PriceHistoryDialog
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        row={historyRow}
        tenantId={tenantId}
      />
    </motion.div>
  )
}
