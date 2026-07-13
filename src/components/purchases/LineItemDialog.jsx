import React, { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import ProductPicker from '@/components/ProductPicker'

export default function LineItemDialog({ open, onOpenChange, tenantId, products, onAdd }) {
  const form = useForm({ defaultValues: { product_id: '' } })

  useEffect(() => {
    if (!open) form.reset()
  }, [open])

  const handleSelect = (values) => {
    const product = products.find((p) => p.id === values.product_id)
    if (!product) return
    onAdd({
      product_id: product.id,
      product_name: [product.brand, product.model, product.variant && `(${product.variant})`].filter(Boolean).join(' '),
      gst_rate: Number(product.gst_rate ?? 18),
      category: product.category,
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-md p-6" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="text-white text-lg">Select Product</DialogTitle>
          <p className="text-sm text-slate-400">
            Search the catalog and pick a model to add to this purchase.
          </p>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(handleSelect)} className="space-y-4 mt-1">
          <Controller
            name="product_id"
            control={form.control}
            rules={{ required: 'Please select a product' }}
            render={({ field, fieldState }) => (
              <ProductPicker
                inline
                products={products.filter((p) => p.is_active !== false)}
                value={field.value}
                onChange={field.onChange}
                tenantId={tenantId}
                error={fieldState.error?.message}
              />
            )}
          />
          <p className="text-xs text-slate-500">Model not listed? Add it from the Models page first.</p>
          <DialogFooter className="pt-1">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="border-slate-600 text-slate-300 hover:bg-slate-700">Cancel</Button>
            <Button type="submit" className="bg-indigo-500 hover:bg-indigo-600 text-white">Add Item</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
