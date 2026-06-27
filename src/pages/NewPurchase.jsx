import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm, Controller } from 'react-hook-form'
import { motion } from 'framer-motion'
import { ArrowLeft, Plus, Trash2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useAuth } from '@/context/AuthContext'
import { getProducts } from '@/lib/products'
import { PHONE_RULES_OPTIONAL, phoneInputProps } from '@/lib/validations'
import { createPurchase } from '@/lib/purchases'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import LineItemDialog from '@/components/purchases/LineItemDialog'

const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

// Unique ID for local line item tracking
let _lid = 0
const nextId = () => ++_lid

export default function NewPurchase() {
  const navigate = useNavigate()
  const { currentUser, currentTenant } = useAuth()
  const tenantId = currentTenant?.id

  const [purchaseType, setPurchaseType] = useState('official')
  const [lineItems, setLineItems] = useState([])
  const [lineDialogOpen, setLineDialogOpen] = useState(false)
  const [products, setProducts] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const submittingRef = useRef(false)

  const { register, control, handleSubmit, formState: { errors } } = useForm({
    defaultValues: {
      supplier_name: '',
      supplier_phone: '',
      supplier_gstin: '',
      bill_number: '',
      bill_date: '',
      payment_method: 'cash',
      payment_status: 'paid',
    },
  })

  useEffect(() => {
    if (tenantId) getProducts(tenantId).then(({ data }) => setProducts(data))
  }, [tenantId])

  const handleAddLineItem = useCallback((item) => {
    setLineItems((prev) => [
      ...prev,
      { _id: nextId(), ...item, quantity: 1, unit_price: '', imei_number: '' },
    ])
  }, [])

  const updateItem = (id, field, value) => {
    setLineItems((prev) =>
      prev.map((item) => (item._id === id ? { ...item, [field]: value } : item))
    )
  }

  const removeItem = (id) => {
    setLineItems((prev) => prev.filter((item) => item._id !== id))
  }

  const isOfficial = purchaseType === 'official'

  // Running totals
  const subtotal = lineItems.reduce(
    (sum, item) => sum + Number(item.unit_price || 0) * Number(item.quantity || 0),
    0
  )
  const gstAmount = isOfficial
    ? lineItems.reduce(
        (sum, item) =>
          sum + (Number(item.unit_price || 0) * Number(item.quantity || 0) * Number(item.gst_rate || 0)) / 100,
        0
      )
    : 0
  const grandTotal = subtotal + gstAmount

  const onSubmit = async (values) => {
    if (submittingRef.current) return
    if (lineItems.length === 0) {
      toast.error('Add at least one line item')
      return
    }

    // Validate line item fields
    const invalid = lineItems.some(
      (item) => !item.quantity || Number(item.quantity) < 1 || !item.unit_price || Number(item.unit_price) <= 0
    )
    if (invalid) {
      toast.error('All items need a valid quantity and unit price')
      return
    }

    // IMEI required for smartphones
    const imeiMissing = lineItems.some(
      (item) => item.category === 'smartphone' && !/^\d{15}$/.test(item.imei_number ?? '')
    )
    if (imeiMissing) {
      toast.error('IMEI (15 digits) is required for all smartphone items')
      return
    }

    // Conditional field validation
    if (isOfficial) {
      if (!values.supplier_gstin.trim()) { toast.error('Supplier GSTIN is required'); return }
      if (!values.bill_number.trim()) { toast.error('Bill number is required'); return }
      if (!values.bill_date) { toast.error('Bill date is required'); return }
    }

    submittingRef.current = true
    setSubmitting(true)

    const processedItems = lineItems.map((item) => {
      const qty = item.category === 'smartphone' ? 1 : Number(item.quantity)
      const lineSubtotal = Number(item.unit_price) * qty
      const lineGst = isOfficial ? (lineSubtotal * Number(item.gst_rate)) / 100 : 0
      return {
        product_id: item.product_id,
        quantity: qty,
        unit_price: Number(item.unit_price),
        gst_rate: Number(item.gst_rate),
        gst_amount: lineGst,
        total_amount: lineSubtotal,
        imei_number: item.imei_number || null,
      }
    })

    const headerData = {
      tenant_id: tenantId,
      created_by: currentUser.id,
      purchase_type: purchaseType,
      supplier_name: values.supplier_name,
      supplier_phone: values.supplier_phone || null,
      supplier_gstin: isOfficial ? values.supplier_gstin : null,
      bill_number: isOfficial ? values.bill_number : null,
      bill_date: isOfficial ? values.bill_date : null,
      payment_method: values.payment_method,
      payment_status: values.payment_status,
      total_amount: subtotal,
      gst_amount: gstAmount,
      grand_total: grandTotal,
    }

    const { error } = await createPurchase(headerData, processedItems, tenantId)
    submittingRef.current = false
    setSubmitting(false)

    if (error) {
      toast.error(error.message ?? 'Failed to record purchase')
    } else {
      toast.success('Purchase recorded successfully')
      navigate('/purchases')
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="p-4 md:p-6 max-w-4xl mx-auto space-y-5"
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/purchases')} className="shrink-0">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">New Purchase</h1>
          <p className="text-sm text-muted-foreground">Record a new stock purchase</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

        {/* Purchase Type Toggle */}
        <Card>
          <CardContent className="pt-5">
            <div className="flex rounded-lg border border-border p-1 max-w-xs">
              {[
                { value: 'official', label: '🔵 Official' },
                { value: 'unofficial', label: '⚫ Unofficial' },
              ].map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setPurchaseType(value)}
                  className={cn(
                    'flex-1 py-2 text-sm font-medium rounded transition-colors',
                    purchaseType === value
                      ? 'bg-indigo-500 text-white'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {isOfficial
                ? 'Official purchases appear in GST reports and require a bill number.'
                : 'Unofficial purchases (grey market) are excluded from GST reports.'}
            </p>
          </CardContent>
        </Card>

        {/* Header Fields */}
        <Card>
          <CardHeader><CardTitle className="text-base">
            {isOfficial ? 'Supplier Details' : 'Source Details'}
          </CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{isOfficial ? 'Supplier Name' : 'Source Name'} <span className="text-red-400">*</span></Label>
                <Input
                  {...register('supplier_name', { required: 'Name is required' })}
                  placeholder={isOfficial ? 'ABC Distributors' : 'Grey market source'}
                />
                {errors.supplier_name && <p className="text-red-500 text-xs">{errors.supplier_name.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>{isOfficial ? 'Supplier Phone' : 'Source Phone'} <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Input
                  {...register('supplier_phone', PHONE_RULES_OPTIONAL)}
                  {...phoneInputProps}
                  placeholder="9876543210"
                />
              </div>
            </div>

            {isOfficial && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Supplier GSTIN <span className="text-red-400">*</span></Label>
                  <Input {...register('supplier_gstin')} placeholder="23AAAAA0000A1Z5" className="font-mono" />
                </div>
                <div className="space-y-1.5">
                  <Label>Bill Number <span className="text-red-400">*</span></Label>
                  <Input {...register('bill_number')} placeholder="INV-2024-001" />
                </div>
                <div className="space-y-1.5">
                  <Label>Bill Date <span className="text-red-400">*</span></Label>
                  <Input {...register('bill_date')} type="date" />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Payment Method</Label>
                <Controller
                  name="payment_method"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {['cash', 'upi', 'credit', 'cheque', 'bank_transfer'].map((m) => (
                          <SelectItem key={m} value={m} className="capitalize">{m.replace('_', ' ')}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Payment Status</Label>
                <Controller
                  name="payment_status"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="paid">Paid</SelectItem>
                        <SelectItem value="partial">Partial</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Line Items */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Line Items</CardTitle>
              <Button
                type="button"
                size="sm"
                onClick={() => setLineDialogOpen(true)}
                className="bg-indigo-500 hover:bg-indigo-600 text-white"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Add Item
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {lineItems.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground border border-dashed border-border rounded-lg">
                <p className="text-sm">No items added yet</p>
                <p className="text-xs mt-1">Click "Add Item" to select a product</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground text-xs uppercase">
                      <th className="pb-2 text-left">Product</th>
                      <th className="pb-2 text-right">Qty</th>
                      <th className="pb-2 text-right">Unit Price</th>
                      {isOfficial && <th className="pb-2 text-right">GST%</th>}
                      {isOfficial && <th className="pb-2 text-right">GST Amt</th>}
                      <th className="pb-2 text-right">Total</th>
                      <th className="pb-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {lineItems.map((item) => {
                      const isPhone = item.category === 'smartphone'
                      const qty = isPhone ? 1 : Number(item.quantity || 0)
                      const lineSubtotal = Number(item.unit_price || 0) * qty
                      const lineGst = isOfficial ? (lineSubtotal * Number(item.gst_rate || 0)) / 100 : 0
                      const imeiInvalid = isPhone && item.imei_number && !/^\d{15}$/.test(item.imei_number)
                      return (
                        <tr key={item._id}>
                          <td className="py-2 pr-3 font-medium max-w-[200px]">
                            <p className="truncate">{item.product_name}</p>
                            {isOfficial && (
                              <p className="text-xs text-muted-foreground">GST: {item.gst_rate}%</p>
                            )}
                            {isPhone && (
                              <div className="mt-1">
                                <Input
                                  type="text"
                                  maxLength={15}
                                  inputMode="numeric"
                                  placeholder="IMEI — 15 digits *"
                                  value={item.imei_number || ''}
                                  onChange={(e) => updateItem(item._id, 'imei_number', e.target.value)}
                                  className={`w-40 h-7 text-xs font-mono ${imeiInvalid ? 'border-red-500' : ''}`}
                                />
                                {imeiInvalid && <p className="text-red-400 text-xs mt-0.5">Must be 15 digits</p>}
                              </div>
                            )}
                          </td>
                          <td className="py-2 text-right">
                            {isPhone ? (
                              <span className="text-sm font-medium px-2 text-muted-foreground">1</span>
                            ) : (
                              <Input
                                type="number"
                                min={1}
                                value={item.quantity}
                                onChange={(e) => updateItem(item._id, 'quantity', e.target.value)}
                                className="w-16 text-right ml-auto h-8 text-sm"
                              />
                            )}
                          </td>
                          <td className="py-2 text-right">
                            <Input
                              type="number"
                              min={0}
                              step="0.01"
                              value={item.unit_price}
                              onChange={(e) => updateItem(item._id, 'unit_price', e.target.value)}
                              className="w-24 text-right ml-auto h-8 text-sm"
                              placeholder="0.00"
                            />
                          </td>
                          {isOfficial && (
                            <td className="py-2 text-right text-muted-foreground">{item.gst_rate}%</td>
                          )}
                          {isOfficial && (
                            <td className="py-2 text-right text-muted-foreground">{fmt(lineGst)}</td>
                          )}
                          <td className="py-2 text-right font-medium">{fmt(lineSubtotal + lineGst)}</td>
                          <td className="py-2 pl-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-red-400"
                              onClick={() => removeItem(item._id)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Totals */}
        {lineItems.length > 0 && (
          <Card>
            <CardContent className="pt-5">
              <div className="max-w-xs ml-auto space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{fmt(subtotal)}</span>
                </div>
                {isOfficial && (
                  <>
                    <div className="flex justify-between text-muted-foreground">
                      <span>CGST (9%)</span>
                      <span>{fmt(gstAmount / 2)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>SGST (9%)</span>
                      <span>{fmt(gstAmount / 2)}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between font-bold text-base border-t border-border pt-2">
                  <span>Grand Total</span>
                  <span>{fmt(grandTotal)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Submit */}
        <div className="flex gap-3 justify-end pb-6">
          <Button type="button" variant="outline" onClick={() => navigate('/purchases')}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={submitting}
            className="bg-indigo-500 hover:bg-indigo-600 text-white min-w-[140px]"
          >
            {submitting ? (
              <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Saving…</>
            ) : (
              'Record Purchase'
            )}
          </Button>
        </div>
      </form>

      <LineItemDialog
        open={lineDialogOpen}
        onOpenChange={setLineDialogOpen}
        tenantId={tenantId}
        products={products}
        onAdd={handleAddLineItem}
      />
    </motion.div>
  )
}
