import React, { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { updateInventory } from '@/lib/inventory'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

export default function EditStockDialog({ open, onOpenChange, item, onSuccess }) {
  const {
    register, control, handleSubmit, reset,
    formState: { errors, isSubmitting },
  } = useForm()

  // Pre-fill form when item changes
  useEffect(() => {
    if (item) {
      reset({
        purchase_price: item.purchase_price ?? '',
        selling_price: item.selling_price ?? '',
        quantity: item.quantity ?? '',
        shelf_location: item.shelf_location ?? '',
        status: item.status ?? 'active',
      })
    }
  }, [item, reset])

  const onSubmit = async (values) => {
    const { error } = await updateInventory(item.id, {
      purchase_price: Number(values.purchase_price),
      selling_price: Number(values.selling_price),
      quantity: Number(values.quantity),
      shelf_location: values.shelf_location || null,
      status: values.status,
    })
    if (error) {
      toast.error(error.message ?? 'Failed to update')
    } else {
      toast.success('Stock updated')
      onSuccess()
      onOpenChange(false)
    }
  }

  if (!item) return null

  const product = item.products ?? {}
  const productLabel = [product.brand, product.model, product.variant && `(${product.variant})`]
    .filter(Boolean)
    .join(' ')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-md p-6">
        <DialogHeader>
          <DialogTitle className="text-white text-lg">Edit Stock</DialogTitle>
          {productLabel && (
            <p className="text-sm text-slate-400 mt-0.5">{productLabel}</p>
          )}
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          {/* Prices */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-slate-300">Purchase Price (₹)</Label>
              <Input
                {...register('purchase_price', {
                  required: 'Required',
                  min: { value: 0.01, message: 'Must be > 0' },
                })}
                type="number"
                step="0.01"
                className="bg-slate-700 border-slate-600 text-white"
              />
              {errors.purchase_price && (
                <p className="text-red-400 text-xs">{errors.purchase_price.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300">Selling Price (₹)</Label>
              <Input
                {...register('selling_price', {
                  required: 'Required',
                  min: { value: 0.01, message: 'Must be > 0' },
                })}
                type="number"
                step="0.01"
                className="bg-slate-700 border-slate-600 text-white"
              />
              {errors.selling_price && (
                <p className="text-red-400 text-xs">{errors.selling_price.message}</p>
              )}
            </div>
          </div>

          {/* Stock + Location */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-slate-300">Total Quantity</Label>
              <Input
                {...register('quantity', {
                  required: 'Required',
                  min: { value: 0, message: 'Must be ≥ 0' },
                })}
                type="number"
                className="bg-slate-700 border-slate-600 text-white"
              />
              {errors.quantity && (
                <p className="text-red-400 text-xs">{errors.quantity.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300">
                Shelf Location <span className="text-slate-500 text-xs">(optional)</span>
              </Label>
              <Input
                {...register('shelf_location')}
                placeholder="e.g. A-12"
                className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500"
              />
            </div>
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <Label className="text-slate-300">Status</Label>
            <Controller
              name="status"
              control={control}
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-600">
                    <SelectItem value="active" className="text-white focus:bg-slate-700 focus:text-white">
                      Active
                    </SelectItem>
                    <SelectItem value="inactive" className="text-white focus:bg-slate-700 focus:text-white">
                      Inactive
                    </SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-slate-600 text-slate-300 hover:bg-slate-700"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-indigo-500 hover:bg-indigo-600 text-white"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
