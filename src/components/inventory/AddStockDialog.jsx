import React, { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { createInventory } from '@/lib/inventory'
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
import ImeiInput from './ImeiInput'
import ProductPicker from '@/components/ProductPicker'

function PurchaseFields({ register, errors, control, tenantId, onLookupResult }) {
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
          <Label className="text-slate-300">Asking Price (₹) <span className="text-slate-500 text-xs">(optional)</span></Label>
          <Input
            {...register('selling_price', {
              validate: (v) => v === '' || Number(v) > 0 || 'Must be > 0',
            })}
            type="number" step="0.01" placeholder="Set at sale time"
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
        <Controller
          name="imei_number"
          control={control}
          rules={{
            required: 'IMEI is required',
            pattern: { value: /^\d{15}$/, message: 'IMEI must be exactly 15 digits' },
          }}
          render={({ field, fieldState }) => (
            <ImeiInput
              value={field.value}
              onChange={field.onChange}
              tenantId={tenantId}
              onLookupResult={onLookupResult}
              error={fieldState.error?.message}
              inputClassName="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500"
              buttonClassName="border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-indigo-400"
            />
          )}
        />
        <p className="text-xs text-slate-500">One unit per entry — each device requires its own IMEI</p>
      </div>
    </>
  )
}

export default function AddStockDialog({ open, onOpenChange, tenantId, products, onSuccess }) {
  const { currentUser } = useAuth()
  const isOwner = currentUser?.role === 'admin'

  const form = useForm({
    defaultValues: { product_id: '', purchase_price: '', selling_price: '', quantity: '', imei_number: '', stock_source: 'manual' },
  })

  useEffect(() => {
    if (!open) form.reset()
  }, [open])

  // When an entered/scanned IMEI matches a known device, auto-select its product
  const handleLookup = (data) => {
    if (data?.product_id && !form.getValues('product_id')) {
      form.setValue('product_id', data.product_id)
      toast.success('Product auto-selected from IMEI')
    }
  }

  const onSubmit = async (values) => {
    const now = new Date().toISOString()
    const { error } = await createInventory({
      tenant_id: tenantId,
      product_id: values.product_id,
      purchase_price: Number(values.purchase_price),
      selling_price: values.selling_price ? Number(values.selling_price) : null,
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

  const errors = form.formState.errors
  const submitting = form.formState.isSubmitting

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-lg max-h-[90vh] overflow-y-auto p-6" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="text-white text-lg">Add Stock</DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label className="text-slate-300">Product</Label>
            <Controller
              name="product_id"
              control={form.control}
              rules={{ required: 'Please select a product' }}
              render={({ field, fieldState }) => (
                <ProductPicker
                  products={products.filter((p) => p.is_active !== false)}
                  value={field.value}
                  onChange={field.onChange}
                  tenantId={tenantId}
                  error={fieldState.error?.message}
                />
              )}
            />
            <p className="text-xs text-slate-500">Model not listed? Add it from the Models page first.</p>
          </div>

          <PurchaseFields
            register={form.register}
            errors={errors}
            control={form.control}
            tenantId={tenantId}
            onLookupResult={handleLookup}
          />

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="border-slate-600 text-slate-300 hover:bg-slate-700">Cancel</Button>
            <Button type="submit" disabled={submitting} className="bg-indigo-500 hover:bg-indigo-600 text-white">
              {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Add Stock
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
