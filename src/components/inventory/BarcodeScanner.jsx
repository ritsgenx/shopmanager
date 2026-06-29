import React, { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { Camera, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'

const SCANNER_DIV_ID = 'imei-barcode-scanner'

export default function BarcodeScanner({ open, onClose, onScan }) {
  const scannerRef = useRef(null)
  const [error, setError] = useState(null)

  const stopScanner = async () => {
    const scanner = scannerRef.current
    if (!scanner) return
    try {
      await scanner.stop()
      scanner.clear()
    } catch {}
    scannerRef.current = null
  }

  useEffect(() => {
    if (!open) return

    setError(null)

    // Small delay so the dialog div is in the DOM before initialising
    const timer = setTimeout(() => {
      const scanner = new Html5Qrcode(SCANNER_DIV_ID)
      scannerRef.current = scanner

      scanner.start(
        { facingMode: 'environment' },
        // qrbox wider than tall — barcodes are landscape
        { fps: 10, qrbox: { width: 280, height: 100 } },
        (decodedText) => {
          // Find the first run of exactly 15 consecutive digits (the IMEI)
          const match = decodedText.match(/\d{15}/)
          if (match) {
            onScan(match[0])
            stopScanner().then(onClose)
          }
        },
        () => {} // per-frame decode errors — always ignore
      ).catch(() => {
        setError('Camera access denied. Please allow camera permissions and try again.')
      })
    }, 150)

    return () => {
      clearTimeout(timer)
      stopScanner()
    }
  }, [open])

  const handleClose = () => {
    stopScanner().then(onClose)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose() }}>
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

        <p className="text-sm text-slate-400 -mt-2">
          Point your camera at the barcode on the phone box. The IMEI will fill in automatically.
        </p>

        {error ? (
          <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-6 text-center">
            <X className="w-6 h-6 text-red-400 mx-auto mb-2" />
            <p className="text-sm text-red-400">{error}</p>
          </div>
        ) : (
          <div
            id={SCANNER_DIV_ID}
            className="w-full overflow-hidden rounded-lg [&_video]:rounded-lg [&_video]:w-full"
          />
        )}

        <Button
          type="button"
          variant="outline"
          onClick={handleClose}
          className="w-full border-slate-600 text-slate-300 hover:bg-slate-700"
        >
          Cancel
        </Button>
      </DialogContent>
    </Dialog>
  )
}
