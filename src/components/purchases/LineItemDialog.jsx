import React, { useState, useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { createProduct } from '@/lib/products'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

export default function LineItemDialog({ open, onOpenChange, tenantId, products, onAdd }) {
  const [mode, setMode] = useState('existing')

  const formA = useForm({ defaultValues: { product_id: '' } })
  const formB = useForm({
    defaultValues: {
      category: '', brand: '', model: '', variant: '',
      color: '', hsn_code: '', gst_rate: '18',
    },
  })

  useEffect(() => {
    if (!open) {
      formA.reset()
      formB.reset({ gst_rate: '18' })
      setMode('existing')
    }
  }, [open])

  const handleSelectExisting = (values) => {
    const product = products.find((p) => p.id === values.product_id)
    if (!product) return
    onAdd({
      product_id: product.id,
      product_name: [product.brand, product.model, product.variant && `(${product.variant})`].filter(Boolean).join(' '),
      gst_rate: Number(product.gst_rate ?? 18),
    })
    onOpenChange(false)
  }

  const handleCreateNew = async (values) => {
    const { data: product, error } = await createProduct({
      tenant_id: tenantId,
      category: values.category,
      brand: values.brand,
      model: values.model,
      variant: values.variant || null,
      color: values.color || null,
      hsn_code: values.hsn_code || null,
      gst_rate: Number(values.gst_rate),
    })
    if (error) {
      if (error.code === '23505') {
        toast.error('Product already exists — switch to "Existing Product" tab.')
      } else {
        toast.error(error.message ?? 'Failed to create product')
      }
      return
    }
    onAdd({
      product_id: product.id,
      product_name: [values.brand, values.model, values.variant && `(${values.variant})`].filter(Boolean).join(' '),
      gst_rate: Number(values.gst_rate),
    })
    onOpenChange(false)
  }

  const errA = formA.formState.errors
  const errB = formB.formState.errors

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-md max-h-[90vh] overflow-y-auto p-6">
        <DialogHeader>
          <DialogTitle className="text-white">Select Product</DialogTitle>
        </DialogHeader>

        <div className="flex rounded-lg border border-slate-600 bg-slate-900 p-1">
          {['existing', 'new'].map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); formA.reset(); formB.reset({ gst_rate: '18' }) }}
              className={cn(
                'flex-1 py-1.5 text-sm rounded transition-colors',
                mode === m ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-white'
              )}
            >
              {m === 'existing' ? 'Existing Product' : 'New Product'}
            </button>
          ))}
        </div>

        {mode === 'existing' && (
          <form onSubmit={formA.handleSubmit(handleSelectExisting)} className="space-y-4 mt-2">
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
                          No products yet — use "New Product"
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
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="border-slate-600 text-slate-300 hover:bg-slate-700">Cancel</Button>
              <Button type="submit" className="bg-indigo-500 hover:bg-indigo-600 text-white">Add Item</Button>
            </DialogFooter>
          </form>
        )}

        {mode === 'new' && (
          <form onSubmit={formB.handleSubmit(handleCreateNew)} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label className="text-slate-300">Category</Label>
              <Controller
                name="category"
                control={formB.control}
                rules={{ required: 'Required' }}
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
                <Label className="text-slate-300">Variant <span className="text-slate-500 text-xs">(opt)</span></Label>
                <Input {...formB.register('variant')} placeholder="256GB" className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-300">Color <span className="text-slate-500 text-xs">(opt)</span></Label>
                <Input {...formB.register('color')} placeholder="Black" className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-slate-300">HSN <span className="text-slate-500 text-xs">(opt)</span></Label>
                <Input {...formB.register('hsn_code')} placeholder="8517" className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-300">GST Rate (%)</Label>
                <Input {...formB.register('gst_rate', { required: 'Required', min: { value: 0, message: '≥ 0' } })} type="number" className="bg-slate-700 border-slate-600 text-white" />
                {errB.gst_rate && <p className="text-red-400 text-xs">{errB.gst_rate.message}</p>}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="border-slate-600 text-slate-300 hover:bg-slate-700">Cancel</Button>
              <Button type="submit" disabled={formB.formState.isSubmitting} className="bg-indigo-500 hover:bg-indigo-600 text-white">
                {formB.formState.isSubmitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Create &amp; Add
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
