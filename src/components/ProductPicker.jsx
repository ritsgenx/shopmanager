import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Search, Clock, Check, Smartphone, Package, PackageSearch, SearchX } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'

const productLabel = (p) =>
  [p.brand, p.model, p.variant && `(${p.variant})`, p.color && `— ${p.color}`].filter(Boolean).join(' ')

const recentsKey = (tenantId) => `mobileshop-recent-products-${tenantId ?? 'default'}`

const loadRecents = (tenantId) => {
  try {
    return JSON.parse(localStorage.getItem(recentsKey(tenantId))) ?? []
  } catch {
    return []
  }
}

const saveRecent = (tenantId, productId) => {
  try {
    const ids = [productId, ...loadRecents(tenantId).filter((id) => id !== productId)].slice(0, 8)
    localStorage.setItem(recentsKey(tenantId), JSON.stringify(ids))
  } catch {}
}

function EmptyState({ icon: Icon, title, hint }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-8 text-center">
      <div className="w-10 h-10 rounded-full bg-slate-700/60 flex items-center justify-center">
        <Icon className="w-5 h-5 text-slate-400" />
      </div>
      <p className="text-sm text-slate-300">{title}</p>
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  )
}

// Searchable product picker over the products catalog. Type-ahead filters
// across brand/model/variant/color in any word order; with an empty query the
// recently picked products (per tenant, localStorage) are shown on top.
// Controlled by product id: value / onChange(productId).
// Styled for the dark slate dialogs it lives in (Add Stock, PO line items).
// `inline` renders the list as an always-visible panel in normal flow instead
// of a floating dropdown — use it when the picker is the dialog's main content
// so it doesn't create nested scrollbars.
export default function ProductPicker({
  products, value, onChange, tenantId, error,
  placeholder = 'Search brand, model…', inline = false,
}) {
  const [query, setQuery] = useState(null) // null = not editing; input shows selected label
  const [open, setOpen] = useState(false)
  const [activeIdx, setActiveIdx] = useState(0)
  const rootRef = useRef(null)
  const listRef = useRef(null)

  const selected = products.find((p) => p.id === value)
  const showList = inline || open

  useEffect(() => {
    if (inline) return
    const handler = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false)
        setQuery(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [inline])

  // rows: { type: 'header', label } | { type: 'product', product }
  const rows = useMemo(() => {
    const q = (query ?? '').trim().toLowerCase()
    if (q) {
      const tokens = q.split(/\s+/)
      const matches = products.filter((p) => {
        const hay = `${p.brand} ${p.model} ${p.variant ?? ''} ${p.color ?? ''}`.toLowerCase()
        return tokens.every((t) => hay.includes(t))
      }).slice(0, 50)
      return matches.map((p) => ({ type: 'product', product: p }))
    }
    const recents = loadRecents(tenantId)
      .map((id) => products.find((p) => p.id === id))
      .filter(Boolean)
    const recentIds = new Set(recents.map((p) => p.id))
    const rest = products.filter((p) => !recentIds.has(p.id)).slice(0, 50)
    const out = []
    if (recents.length > 0) {
      out.push({ type: 'header', label: 'Recent' })
      recents.forEach((p) => out.push({ type: 'product', product: p }))
      if (rest.length > 0) out.push({ type: 'header', label: 'All products' })
    }
    rest.forEach((p) => out.push({ type: 'product', product: p }))
    return out
  }, [query, products, tenantId])

  const productRows = rows.filter((r) => r.type === 'product')

  useEffect(() => { setActiveIdx(0) }, [query])

  const pick = (product) => {
    onChange(product.id)
    saveRecent(tenantId, product.id)
    setQuery(null)
    setOpen(false)
  }

  const handleKeyDown = (e) => {
    if (!showList) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx((i) => Math.min(i + 1, productRows.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (productRows[activeIdx]) pick(productRows[activeIdx].product)
    } else if (e.key === 'Escape') {
      setOpen(false)
      setQuery(null)
    }
  }

  // Keep the active row visible while navigating with arrows
  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [activeIdx])

  let productIdx = -1

  return (
    <div ref={rootRef} className={cn(!inline && 'relative')}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        <Input
          value={query ?? (selected ? productLabel(selected) : '')}
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => { setQuery(''); setOpen(true) }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="pl-9 h-10 rounded-lg bg-slate-700/80 border-slate-600 text-white placeholder:text-slate-500 focus-visible:ring-indigo-500/60 focus-visible:border-indigo-500/60"
        />
      </div>

      {showList && (
        <div
          ref={listRef}
          className={cn(
            'thin-scrollbar overflow-y-auto rounded-xl border border-slate-600/70 bg-slate-800/95 backdrop-blur-sm',
            inline
              ? 'mt-2 h-60'
              : 'absolute top-full left-0 right-0 z-50 mt-1.5 max-h-64 shadow-2xl shadow-black/40'
          )}
        >
          {products.length === 0 ? (
            <EmptyState
              icon={PackageSearch}
              title="No models in the catalog yet"
              hint="Add one from the Models page first"
            />
          ) : productRows.length === 0 ? (
            <EmptyState
              icon={SearchX}
              title={`No products match “${query}”`}
              hint="Try fewer or different words"
            />
          ) : (
            <div className="p-1.5">
              {rows.map((row, i) => {
                if (row.type === 'header') {
                  return (
                    <p key={`h-${i}`} className="px-2.5 pt-2.5 pb-1.5 text-[10px] font-medium uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                      {row.label === 'Recent' && <Clock className="w-3 h-3" />}
                      {row.label}
                    </p>
                  )
                }
                productIdx += 1
                const idx = productIdx
                const p = row.product
                const isSelected = p.id === value
                const CategoryIcon = p.category === 'accessory' ? Package : Smartphone
                return (
                  <button
                    key={p.id}
                    type="button"
                    data-active={idx === activeIdx}
                    onMouseDown={(e) => { e.preventDefault(); pick(p) }}
                    onMouseEnter={() => setActiveIdx(idx)}
                    className={cn(
                      'w-full flex items-center gap-3 text-left px-2.5 py-2 rounded-lg transition-colors',
                      idx === activeIdx ? 'bg-slate-700/80' : 'bg-transparent',
                      isSelected && 'bg-indigo-500/15'
                    )}
                  >
                    <div className={cn(
                      'w-8 h-8 shrink-0 rounded-lg flex items-center justify-center',
                      isSelected ? 'bg-indigo-500/25 text-indigo-300' : 'bg-slate-700 text-slate-400'
                    )}>
                      <CategoryIcon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={cn('text-sm truncate', isSelected ? 'text-indigo-200 font-medium' : 'text-white')}>
                        {p.brand} {p.model}
                      </p>
                      {(p.variant || p.color) && (
                        <p className="text-xs text-slate-400 truncate">
                          {[p.variant, p.color].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </div>
                    {isSelected && <Check className="w-4 h-4 shrink-0 text-indigo-400" />}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
    </div>
  )
}
