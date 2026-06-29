import React, { useState, useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { Loader2, Camera } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { createProduct } from '@/lib/products'
import { createInventory, getProductByImei } from '@/lib/inventory'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import BarcodeScanner from './BarcodeScanner'

function PurchaseFields({ register, errors, control, onScanClick }) {
  return (
    <>
      {/* Stock Source */}
      <div className="space-y-1.5">
        <Label className="text-slate-300">Stock Source</Label>
        <Controller
          name="stock_source"
          control={control}
          defaultValue="manual"
          render={({ field }) => (
            <Select onValueChange={field.onChange} value={field.value || 'manual'}>
              <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-600">
                <SelectItem value="official" className="text-white focus:bg-slate-700 focus:text-white">Official Purchase Order</SelectItem>
                <SelectItem value="unofficial" className="text-white focus:bg-slate-700 focus:text-white">Unofficial Purchase Order</SelectItem>
                <SelectItem value="manual" className="text-white focus:bg-slate-700 focus:text-white">Direct / Manual Entry</SelectItem>
              </SelectContent>
            </Select>
          )}
        />
      </div>

      {/* Prices */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-slate-300">Purchase Price (₹)</Label>
          <Input
            {...register('purchase_price', {
              required: 'Required',
              min: { value: 0.01, message: 'Must be > 0' },
            })}
            type="number" step="0.01" placeholder="0.00"
            className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500"
          />
          {errors.purchase_price && <p className="text-red-400 text-xs">{errors.purchase_price.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label className="text-slate-300">Selling Price (₹)</Label>
          <Input
            {...register('selling_price', {
              required: 'Required',
              min: { value: 0.01, message: 'Must be > 0' },
            })}
            type="number" step="0.01" placeholder="0.00"
            className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500"
          />
          {errors.selling_price && <p className="text-red-400 text-xs">{errors.selling_price.message}</p>}
        </div>
      </div>

      {/* IMEI — always required */}
      <div className="space-y-1.5">
        <Label className="text-slate-300">
          IMEI <span className="text-red-400">*</span>
        </Label>
        <div className="flex gap-2">
          <Input
            {...register('imei_number', {
              required: 'IMEI is required',
              pattern: { value: /^\d{15}$/, message: 'IMEI must be exactly 15 digits' },
            })}
            placeholder="123456789012345"
            maxLength={15}
            inputMode="numeric"
            className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500 font-mono flex-1"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onScanClick}
            className="border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-indigo-400 shrink-0"
            title="Scan barcode"
          >
            <Camera className="w-4 h-4" />
          </Button>
        </div>
        {errors.imei_number && <p className="text-red-400 text-xs">{errors.imei_number.message}</p>}
        <p className="text-xs text-slate-500">One unit per entry — each device requires its own IMEI</p>
      </div>
    </>
  )
}

export default function AddStockDialog({ open, onOpenChange, tenantId, products, onSuccess }) {
  const { currentUser } = useAuth()
  const isOwner = currentUser?.role === 'admin'
  const [mode, setMode] = useState('existing')
  const [scanOpen, setScanOpen] = useState(false)

  const formA = useForm({
    defaultValues: { product_id: '', purchase_price: '', selling_price: '', quantity: '', imei_number: '', stock_source: 'manual' },
  })
  const formB = useForm({
    defaultValues: {
      category: '', brand: '', model: '', variant: '', color: '',
      hsn_code: '', gst_rate: '18',
      purchase_price: '', selling_price: '', imei_number: '', stock_source: 'manual',
    },
  })

  useEffect(() => {
    if (!open) {
      formA.reset()
      formB.reset({ gst_rate: '18' })
      setMode('existing')
      setScanOpen(false)
    }
  }, [open])

  const switchMode = (next) => {
    setMode(next)
    formA.reset()
    formB.reset({ gst_rate: '18' })
  }

  const handleScan = async (imei) => {
    // Fill IMEI in whichever form is active
    if (mode === 'existing') {
      formA.setValue('imei_number', imei, { shouldValidate: true })

      // Try to auto-select product if this IMEI was seen before
      const { data } = await getProductByImei(tenantId, imei)
      if (data?.product_id) {
        formA.setValue('product_id', data.product_id)
        toast.success('IMEI scanned — product auto-selected')
      } else {
        toast.success('IMEI scanned — please select the product')
      }
    } else {
      formB.setValue('imei_number', imei, { shouldValidate: true })
      toast.success('IMEI scanned')
    }
  }

  const onSubmitA = async (values) => {
    const now = new Date().toISOString()
    const { error } = await createInventory({
      tenant_id: tenantId,
      product_id: values.product_id,
      purchase_price: Number(values.purchase_price),
      selling_price: Number(values.selling_price),
      quantity: 1,
      imei_number: values.imei_number || null,
      stock_source: values.stock_source || 'manual',
      approval_status: isOwner ? 'approved' : 'pending',
      submitted_by: currentUser?.id,
      approved_by: isOwner ? currentUser?.id : null,
      approved_at: isOwner ? now : null,
    })
    if (error) {
      toast.error(error.message ?? 'Failed to add stock')
    } else {
      toast.success(isOwner ? 'Stock added successfully' : 'Stock submitted — awaiting owner approval')
      onSuccess()
      onOpenChange(false)
    }
  }

  const onSubmitB = async (values) => {
    const { data: product, error: productError } = await createProduct({
      tenant_id: tenantId,
      category: values.category,
      brand: values.brand,
      model: values.model,
      variant: values.variant || null,
      color: values.color || null,
      hsn_code: values.hsn_code || null,
      gst_rate: Number(values.gst_rate),
    })
    if (productError) {
      if (productError.code === '23505') {
        toast.error('This product already exists. Switch to "Existing Product" to add stock to it.')
      } else {
        toast.error(productError.message ?? 'Failed to create product')
      }
      return
    }
    const now = new Date().toISOString()
    const { error: invError } = await createInventory({
      tenant_id: tenantId,
      product_id: product.id,
      purchase_price: Number(values.purchase_price),
      selling_price: Number(values.selling_price),
      quantity: 1,
      imei_number: values.imei_number || null,
      stock_source: values.stock_source || 'manual',
      approval_status: isOwner ? 'approved' : 'pending',
      submitted_by: currentUser?.id,
      approved_by: isOwner ? currentUser?.id : null,
      approved_at: isOwner ? now : null,
    })
    if (invError) {
      toast.error(invError.message ?? 'Failed to add inventory')
    } else {
      toast.success(isOwner ? 'Product and stock added successfully' : 'Stock submitted — awaiting owner approval')
      onSuccess()
      onOpenChange(false)
    }
  }

  const errA = formA.formState.errors
  const errB = formB.formState.errors
  const submittingA = formA.formState.isSubmitting
  const submittingB = formB.formState.isSubmitting

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-lg max-h-[90vh] overflow-y-auto p-6" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="text-white text-lg">Add Stock</DialogTitle>
          </DialogHeader>

          <div className="flex rounded-lg border border-slate-600 bg-slate-900 p-1">
            {['existing', 'new'].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => switchMode(m)}
                className={cn(
                  'flex-1 py-1.5 text-sm rounded transition-colors',
                  mode === m ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-white'
                )}
              >
                {m === 'existing' ? 'Existing Product' : 'New Product'}
              </button>
            ))}
          </div>

          {/* ── Mode A: Existing Product ── */}
          {mode === 'existing' && (
            <form onSubmit={formA.handleSubmit(onSubmitA)} className="space-y-4 mt-2">
              <div className="space-y-1.5">
                <Label className="text-slate-300">Product</Label>
                <Controller
                  name="product_id"
                  control={formA.control}
                  rules={{ required: 'Please select a product' }}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                        <SelectValue placeholder="Select a product…" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-600">
                        {products.length === 0 ? (
                          <div className="p-3 text-sm text-slate-400 text-center">
                            No products yet — switch to "New Product"
                          </div>
                        ) : (
                          products.map((p) => (
                            <SelectItem key={p.id} value={p.id} className="text-white focus:bg-slate-700 focus:text-white">
                              {p.brand} {p.model}{p.variant ? ` (${p.variant})` : ''}{p.color ? ` — ${p.color}` : ''}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errA.product_id && <p className="text-red-400 text-xs">{errA.product_id.message}</p>}
              </div>

              <PurchaseFields
                register={formA.register}
                errors={errA}
                control={formA.control}
                onScanClick={() => setScanOpen(true)}
              />

              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="border-slate-600 text-slate-300 hover:bg-slate-700">Cancel</Button>
                <Button type="submit" disabled={submittingA} className="bg-indigo-500 hover:bg-indigo-600 text-white">
                  {submittingA && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  Add Stock
                </Button>
              </DialogFooter>
            </form>
          )}

          {/* ── Mode B: New Product ── */}
          {mode === 'new' && (
            <form onSubmit={formB.handleSubmit(onSubmitB)} className="space-y-4 mt-2">
              <div className="space-y-1.5">
                <Label className="text-slate-300">Category</Label>
                <Controller
                  name="category"
                  control={formB.control}
                  rules={{ required: 'Category is required' }}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                        <SelectValue placeholder="Select category…" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-600">
                        <SelectItem value="smartphone" className="text-white focus:bg-slate-700 focus:text-white">Smartphone</SelectItem>
                        <SelectItem value="accessory" className="text-white focus:bg-slate-700 focus:text-white">Accessory</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
                {errB.category && <p className="text-red-400 text-xs">{errB.category.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-slate-300">Brand</Label>
                  <Input {...formB.register('brand', { required: 'Required' })} placeholder="Samsung" className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500" />
                  {errB.brand && <p className="text-red-400 text-xs">{errB.brand.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-300">Model</Label>
                  <Input {...formB.register('model', { required: 'Required' })} placeholder="Galaxy S24" className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500" />
                  {errB.model && <p className="text-red-400 text-xs">{errB.model.message}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-slate-300">Variant <span className="text-slate-500 text-xs">(optional)</span></Label>
                  <Input {...formB.register('variant')} placeholder="256GB" className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-300">Color <span className="text-slate-500 text-xs">(optional)</span></Label>
                  <Input {...formB.register('color')} placeholder="Midnight Black" className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-slate-300">HSN Code <span className="text-slate-500 text-xs">(optional)</span></Label>
                  <Input {...formB.register('hsn_code')} placeholder="8517" className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-300">GST Rate (%)</Label>
                  <Input
                    {...formB.register('gst_rate', { required: 'Required', min: { value: 0, message: 'Must be ≥ 0' } })}
                    type="number" placeholder="18"
                    className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500"
                  />
                  {errB.gst_rate && <p className="text-red-400 text-xs">{errB.gst_rate.message}</p>}
                </div>
              </div>

              <div className="border-t border-slate-600 pt-4">
                <p className="text-xs text-slate-400 mb-3 uppercase tracking-wider">Purchase Details</p>
                <PurchaseFields
                  register={formB.register}
                  errors={errB}
                  control={formB.control}
                  onScanClick={() => setScanOpen(true)}
                />
              </div>

              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="border-slate-600 text-slate-300 hover:bg-slate-700">Cancel</Button>
                <Button type="submit" disabled={submittingB} className="bg-indigo-500 hover:bg-indigo-600 text-white">
                  {submittingB && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  Create &amp; Add Stock
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <BarcodeScanner
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onScan={handleScan}
      />
    </>
  )
}
