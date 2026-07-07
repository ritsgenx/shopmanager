import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Search, Clock } from 'lucide-react'
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

// Searchable product picker over the products catalog. Type-ahead filters
// across brand/model/variant/color in any word order; with an empty query the
// recently picked products (per tenant, localStorage) are shown on top.
// Controlled by product id: value / onChange(productId).
// Styled for the dark slate dialogs it lives in (Add Stock, PO line items).
export default function ProductPicker({ products, value, onChange, tenantId, error, placeholder = 'Search brand, model…' }) {
  const [query, setQuery] = useState(null) // null = not editing; input shows selected label
  const [open, setOpen] = useState(false)
  const [activeIdx, setActiveIdx] = useState(0)
  const rootRef = useRef(null)
  const listRef = useRef(null)

  const selected = products.find((p) => p.id === value)

  useEffect(() => {
    const handler = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false)
        setQuery(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

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
    if (!open) return
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
    <div ref={rootRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        <Input
          value={query ?? (selected ? productLabel(selected) : '')}
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => { setQuery(''); setOpen(true) }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="pl-9 bg-slate-700 border-slate-600 text-white placeholder:text-slate-500"
        />
      </div>

      {open && (
        <div
          ref={listRef}
          className="absolute top-full left-0 right-0 z-50 mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-xl max-h-56 overflow-y-auto"
        >
          {products.length === 0 ? (
            <p className="px-3 py-4 text-sm text-slate-400 text-center">
              No products yet — switch to "New Product"
            </p>
          ) : productRows.length === 0 ? (
            <p className="px-3 py-4 text-sm text-slate-400 text-center">
              No products match "{query}"
            </p>
          ) : (
            rows.map((row, i) => {
              if (row.type === 'header') {
                return (
                  <p key={`h-${i}`} className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider text-slate-500 flex items-center gap-1">
                    {row.label === 'Recent' && <Clock className="w-3 h-3" />}
                    {row.label}
                  </p>
                )
              }
              productIdx += 1
              const idx = productIdx
              const p = row.product
              return (
                <button
                  key={p.id}
                  type="button"
                  data-active={idx === activeIdx}
                  onMouseDown={(e) => { e.preventDefault(); pick(p) }}
                  onMouseEnter={() => setActiveIdx(idx)}
                  className={cn(
                    'w-full text-left px-3 py-2 text-sm text-white transition-colors',
                    idx === activeIdx && 'bg-slate-700'
                  )}
                >
                  {p.brand} {p.model}
                  {p.variant && <span className="text-slate-400"> ({p.variant})</span>}
                  {p.color && <span className="text-slate-400"> — {p.color}</span>}
                </button>
              )
            })
          )}
        </div>
      )}

      {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
    </div>
  )
}
