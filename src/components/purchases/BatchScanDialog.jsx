import React, { useEffect, useRef, useState } from 'react'
import { Camera, PackageCheck } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { BarcodeCameraView, playBeep } from '@/components/inventory/BarcodeScanner'

const FILL_MODE = '__fill__'

// Continuous scanning for receiving stock: the camera stays open and every
// scanned box becomes a line item (or fills the next empty IMEI row).
// onDeviceScanned(imei, productOrNull) must return true if the scan was
// accepted — only accepted scans beep and count.
export default function BatchScanDialog({ open, onOpenChange, products, onDeviceScanned }) {
  const smartphones = products.filter((p) => p.category === 'smartphone')
  const [mode, setMode] = useState(FILL_MODE)
  const [count, setCount] = useState(0)
  const [lastImei, setLastImei] = useState(null)
  const sessionRef = useRef(new Set())
  const debounceRef = useRef({ value: '', at: 0 })

  useEffect(() => {
    if (open) {
      setMode(FILL_MODE)
      setCount(0)
      setLastImei(null)
      sessionRef.current = new Set()
      debounceRef.current = { value: '', at: 0 }
    }
  }, [open])

  const handleDetect = (imei) => {
    // The camera decodes ~10 frames/sec — ignore repeat reads of the same code
    const now = Date.now()
    if (debounceRef.current.value === imei && now - debounceRef.current.at < 2500) return
    debounceRef.current = { value: imei, at: now }

    if (sessionRef.current.has(imei)) {
      toast.info('Already scanned in this session')
      return
    }

    const product = mode === FILL_MODE ? null : smartphones.find((p) => p.id === mode)
    const accepted = onDeviceScanned(imei, product ?? null)
    if (accepted) {
      playBeep()
      sessionRef.current.add(imei)
      setCount((c) => c + 1)
      setLastImei(imei)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="bg-slate-800 border-slate-700 text-white max-w-sm"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Camera className="w-4 h-4 text-indigo-400" />
            Batch Scan Devices
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label className="text-slate-300 text-xs">Each scan adds to</Label>
          <Select onValueChange={setMode} value={mode}>
            <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-600">
              <SelectItem value={FILL_MODE} className="text-white focus:bg-slate-700 focus:text-white">
                Fill empty IMEI rows (in order)
              </SelectItem>
              {smartphones.map((p) => (
                <SelectItem key={p.id} value={p.id} className="text-white focus:bg-slate-700 focus:text-white">
                  + New item: {p.brand} {p.model}{p.variant ? ` (${p.variant})` : ''}{p.color ? ` — ${p.color}` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {open && <BarcodeCameraView onDetect={handleDetect} />}

        <div className="flex items-center justify-between rounded-lg bg-slate-900 border border-slate-700 px-3 py-2">
          <div className="flex items-center gap-2 text-sm">
            <PackageCheck className="w-4 h-4 text-emerald-400" />
            <span className="font-semibold">{count}</span>
            <span className="text-slate-400">scanned</span>
          </div>
          {lastImei && (
            <span className="text-xs font-mono text-slate-400">…{lastImei.slice(-6)}</span>
          )}
        </div>

        <Button
          type="button"
          onClick={() => onOpenChange(false)}
          className="w-full bg-indigo-500 hover:bg-indigo-600 text-white"
        >
          Done
        </Button>
      </DialogContent>
    </Dialog>
  )
}
