import React, { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { Camera, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'

// Mimics the classic handheld barcode scanner beep used in retail shops:
// two sharp square-wave chirps at 1800 Hz — loud, crisp, instant on/off.
export function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()

    const chirp = (startAt, duration = 0.08) => {
      const osc  = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'square'
      osc.frequency.setValueAtTime(1800, startAt)
      gain.gain.setValueAtTime(0.7, startAt)
      gain.gain.setValueAtTime(0.001, startAt + duration)
      osc.start(startAt)
      osc.stop(startAt + duration)
    }

    // Two quick chirps with a 60 ms gap — identical to Zebra/Honeywell handheld scanners
    chirp(ctx.currentTime)
    chirp(ctx.currentTime + 0.14)
  } catch {}
}

let _camId = 0

// Bare camera view: starts on mount, stops on unmount, calls onDetect(imei)
// for every frame in which a 15-digit run is decoded. No beep, no dedupe —
// the caller decides what counts as an accepted scan.
export function BarcodeCameraView({ onDetect }) {
  const divIdRef = useRef(`imei-camera-${++_camId}`)
  const scannerRef = useRef(null)
  const onDetectRef = useRef(onDetect)
  onDetectRef.current = onDetect
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false

    // Small delay so the dialog div is in the DOM before initialising
    const timer = setTimeout(() => {
      if (cancelled) return
      const scanner = new Html5Qrcode(divIdRef.current)
      scannerRef.current = scanner

      scanner.start(
        { facingMode: 'environment' },
        // qrbox wider than tall — barcodes are landscape
        { fps: 10, qrbox: { width: 280, height: 100 } },
        (decodedText) => {
          // Find the first run of exactly 15 consecutive digits (the IMEI)
          const match = decodedText.match(/\d{15}/)
          if (match) onDetectRef.current(match[0])
        },
        () => {} // per-frame decode errors — always ignore
      ).catch(() => {
        setError('Camera access denied. Please allow camera permissions and try again.')
      })
    }, 150)

    return () => {
      cancelled = true
      clearTimeout(timer)
      const scanner = scannerRef.current
      if (scanner) {
        scanner.stop().then(() => scanner.clear()).catch(() => {})
        scannerRef.current = null
      }
    }
  }, [])

  if (error) {
    return (
      <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-6 text-center">
        <X className="w-6 h-6 text-red-400 mx-auto mb-2" />
        <p className="text-sm text-red-400">{error}</p>
      </div>
    )
  }

  return (
    <div
      id={divIdRef.current}
      className="w-full overflow-hidden rounded-lg [&_video]:rounded-lg [&_video]:w-full"
    />
  )
}

// Single-shot scanner dialog: beeps, returns one IMEI via onScan, then closes.
export default function BarcodeScanner({ open, onClose, onScan }) {
  const handledRef = useRef(false)

  useEffect(() => {
    if (open) handledRef.current = false
  }, [open])

  const handleDetect = (imei) => {
    if (handledRef.current) return
    handledRef.current = true
    playBeep()
    onScan(imei)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent
        className="bg-slate-800 border-slate-700 text-white max-w-sm"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Camera className="w-4 h-4 text-indigo-400" />
            Scan IMEI Barcode
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-slate-400 mt-1 pr-8">
          Point your camera at the barcode on the phone box. The IMEI will fill in automatically.
        </p>

        {open && <BarcodeCameraView onDetect={handleDetect} />}

        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          className="w-full border-slate-600 text-slate-300 hover:bg-slate-700"
        >
          Cancel
        </Button>
      </DialogContent>
    </Dialog>
  )
}
