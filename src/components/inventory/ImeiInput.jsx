import React, { useEffect, useRef, useState } from 'react'
import { Camera, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getProductByImei } from '@/lib/inventory'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import BarcodeScanner from './BarcodeScanner'

// Controlled IMEI field: digits-only input + camera scan button + duplicate
// detection against inventory once 15 digits are entered (typed or scanned).
//
// - onChange(value)         controlled value updates (digits only, max 15)
// - tenantId                enables the inventory duplicate check
// - excludeInventoryId      skip this inventory row when checking (edit forms)
// - extraCheck(imei)        sync check run first — return a warning string or null
//                           (e.g. duplicate rows within the same purchase order)
// - onLookupResult(data, imei)  fires with the inventory record (or null) after
//                           the DB lookup — used by Add Stock to auto-select product
// - error                   external validation message (shown red, wins over warning)
// - compact                 small size for table rows
export default function ImeiInput({
  value = '',
  onChange,
  tenantId,
  excludeInventoryId = null,
  extraCheck,
  onLookupResult,
  error,
  compact = false,
  disabled = false,
  placeholder = '123456789012345',
  inputClassName = '',
  buttonClassName = '',
}) {
  const [scanOpen, setScanOpen] = useState(false)
  const [warning, setWarning] = useState(null)
  const lastCheckedRef = useRef(null)
  const extraCheckRef = useRef(extraCheck)
  extraCheckRef.current = extraCheck
  const onLookupResultRef = useRef(onLookupResult)
  onLookupResultRef.current = onLookupResult

  useEffect(() => {
    if (!/^\d{15}$/.test(value ?? '')) {
      setWarning(null)
      lastCheckedRef.current = null
      return
    }
    if (value === lastCheckedRef.current) return
    lastCheckedRef.current = value

    const extra = extraCheckRef.current?.(value)
    if (extra) {
      setWarning(extra)
      return
    }
    setWarning(null)
    if (!tenantId) return

    let stale = false
    getProductByImei(tenantId, value).then(({ data }) => {
      if (stale) return
      onLookupResultRef.current?.(data ?? null, value)
      if (!data || data.id === excludeInventoryId) return
      const p = data.products ?? {}
      const name = [p.brand, p.model].filter(Boolean).join(' ') || 'a device'
      setWarning(
        data.status === 'sold'
          ? `This IMEI matches ${name} that was already sold — possible buy-back.`
          : `This IMEI is already in inventory (${name}).`
      )
    })
    return () => { stale = true }
  }, [value, tenantId, excludeInventoryId])

  return (
    <div className="space-y-1">
      <div className="flex gap-2">
        <Input
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 15))}
          maxLength={15}
          inputMode="numeric"
          placeholder={placeholder}
          disabled={disabled}
          className={cn('font-mono flex-1', compact && 'h-7 text-xs', inputClassName)}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => setScanOpen(true)}
          disabled={disabled}
          className={cn('shrink-0', compact && 'h-7 w-7', buttonClassName)}
          title="Scan barcode"
        >
          <Camera className={compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
        </Button>
      </div>

      {error && <p className="text-red-400 text-xs">{error}</p>}
      {!error && warning && (
        <p className="text-amber-400 text-xs flex items-start gap-1">
          <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
          <span>{warning}</span>
        </p>
      )}

      <BarcodeScanner
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onScan={(imei) => onChange(imei)}
      />
    </div>
  )
}
