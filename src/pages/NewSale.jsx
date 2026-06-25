import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, Plus, Trash2, Search, Loader2, CheckCircle2, Phone, X } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useAuth } from '@/context/AuthContext'
import { getInventory } from '@/lib/inventory'
import { getCustomerByPhone, createCustomer } from '@/lib/customers'
import { getTenantUsers } from '@/lib/users'
import { createSale } from '@/lib/sales'
import { generateInvoicePdf } from '@/lib/generateInvoicePdf'
import { phoneKeyDown, phonePaste } from '@/lib/validations'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

let _lid = 0
const nextId = () => ++_lid

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
]

const EMPTY_NEW_CUST = {
  customer_type: 'individual',
  full_name: '', company_name: '', contact_person: '',
  whatsapp_number: '', same_as_phone: false,
  email: '', gstin: '', state: '', city: '',
}

// ── Product search dropdown ──────────────────────────────────────────────────
function ProductSearchDropdown({ value, onChange, placeholder, items, renderItem, onSelect, onClear }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          value={value}
          onChange={(e) => { onChange(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="pl-9 pr-8"
        />
        {value && (
          <button type="button" onClick={onClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-lg leading-none">
            ×
          </button>
        )}
      </div>
      {open && items.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-background border border-border rounded-lg shadow-lg max-h-52 overflow-y-auto">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); onSelect(item); setOpen(false) }}
              className="w-full text-left px-3 py-2.5 hover:bg-muted/50 transition-colors text-sm border-b border-border/50 last:border-0"
            >
              {renderItem(item)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Row helper for order summary ─────────────────────────────────────────────
function Row({ label, value, bold, muted, className }) {
  return (
    <div className={cn('flex justify-between', className)}>
      <span className={cn('text-muted-foreground', muted && 'text-xs')}>{label}</span>
      <span className={cn(bold && 'font-bold text-base')}>{value}</span>
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function NewSale() {
  const navigate = useNavigate()
  const { currentUser, currentTenant } = useAuth()
  const tenantId = currentTenant?.id

  // Remote data
  const [inventory, setInventory] = useState([])
  const [employees, setEmployees] = useState([])

  // Customer identification
  // phase: 'idle' | 'searching' | 'found' | 'new'
  const [phase, setPhase] = useState('idle')
  const [phoneInput, setPhoneInput] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [newCust, setNewCust] = useState(EMPTY_NEW_CUST)
  const [savingCustomer, setSavingCustomer] = useState(false)

  // Product selection state
  const [productSearch, setProductSearch] = useState('')
  const [selectedInv, setSelectedInv] = useState(null)
  const [imeiNumber, setImeiNumber] = useState('')
  const [qty, setQty] = useState(1)
  const [unitPrice, setUnitPrice] = useState('')
  const [lineDiscount, setLineDiscount] = useState(0)

  // Cart
  const [cart, setCart] = useState([])

  // Payment
  const [employeeId, setEmployeeId] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [paymentStatus, setPaymentStatus] = useState('paid')
  const [upiRef, setUpiRef] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const submittingRef = useRef(false)
  const lookupTimer = useRef(null)

  useEffect(() => {
    if (!tenantId) return
    Promise.all([getInventory(tenantId), getTenantUsers(tenantId)]).then(([inv, users]) => {
      setInventory(inv.data ?? [])
      setEmployees(users.data ?? [])
      if (currentUser?.id) setEmployeeId(currentUser.id)
    })
  }, [tenantId])

  // ── Customer phone lookup ────────────────────────────────────────────────
  const handlePhoneChange = (val) => {
    const digits = val.replace(/\D/g, '').slice(0, 10)
    setPhoneInput(digits)
    clearTimeout(lookupTimer.current)

    if (digits.length < 10) {
      setPhase('idle')
      setSelectedCustomer(null)
      return
    }

    setPhase('searching')
    lookupTimer.current = setTimeout(async () => {
      const { data } = await getCustomerByPhone(tenantId, digits)
      if (data) {
        setSelectedCustomer(data)
        setPhase('found')
      } else {
        setNewCust({ ...EMPTY_NEW_CUST })
        setPhase('new')
      }
    }, 400)
  }

  const resetCustomer = () => {
    clearTimeout(lookupTimer.current)
    setPhoneInput('')
    setSelectedCustomer(null)
    setNewCust(EMPTY_NEW_CUST)
    setPhase('idle')
  }

  const handleSaveNewCustomer = async () => {
    const n = newCust
    if (n.customer_type === 'individual' && !n.full_name.trim()) {
      toast.error('Full name is required'); return
    }
    if (n.customer_type === 'company' && !n.company_name.trim()) {
      toast.error('Company name is required'); return
    }
    if (n.customer_type === 'company' && !n.contact_person.trim()) {
      toast.error('Contact person is required'); return
    }
    if (!n.state) { toast.error('State is required for GST calculation'); return }

    setSavingCustomer(true)
    const payload = {
      tenant_id: tenantId,
      created_by: currentUser.id,
      customer_type: n.customer_type,
      full_name: n.customer_type === 'individual' ? n.full_name.trim() : null,
      company_name: n.customer_type === 'company' ? n.company_name.trim() : null,
      contact_person: n.customer_type === 'company' ? n.contact_person.trim() : null,
      phone: phoneInput,
      whatsapp_number: n.same_as_phone ? phoneInput : (n.whatsapp_number || null),
      email: n.email || null,
      gstin: n.customer_type === 'company' ? (n.gstin || null) : null,
      state: n.state,
      city: n.city || null,
      address: null, pincode: null,
      total_purchases: 0, visit_count: 0, last_visit_date: null, is_active: true,
    }

    const { data, error } = await createCustomer(payload)
    setSavingCustomer(false)
    if (error) { toast.error(error.message ?? 'Failed to save customer'); return }

    setSelectedCustomer(data)
    setPhase('found')
    toast.success('Customer saved!')
  }

  const setNC = (patch) => setNewCust((c) => ({ ...c, ...patch }))

  // ── Inventory filtering ──────────────────────────────────────────────────
  const availableInventory = useMemo(
    () => inventory.filter((inv) => (inv.quantity_remaining ?? 0) > 0 && inv.status !== 'sold'),
    [inventory]
  )
  const filteredInventory = useMemo(() => {
    const q = productSearch.toLowerCase()
    return availableInventory
      .filter((inv) => {
        const p = inv.products
        return !q || `${p?.brand} ${p?.model} ${p?.variant || ''} ${p?.color || ''}`.toLowerCase().includes(q)
      })
      .slice(0, 30)
  }, [availableInventory, productSearch])

  const isSmartphone = selectedInv?.products?.category === 'smartphone'

  const handleSelectProduct = (inv) => {
    setSelectedInv(inv)
    setProductSearch([inv.products?.brand, inv.products?.model, inv.products?.variant, inv.products?.color].filter(Boolean).join(' '))
    setUnitPrice(String(inv.selling_price || ''))
    setQty(1); setImeiNumber(''); setLineDiscount(0)
  }

  const handleAddToCart = () => {
    if (!selectedInv) { toast.error('Select a product first'); return }
    const price = Number(unitPrice)
    if (!price || price <= 0) { toast.error('Enter a valid unit price'); return }
    if (isSmartphone && !imeiNumber.trim()) { toast.error('IMEI number is required for smartphones'); return }
    const quantity = isSmartphone ? 1 : Number(qty)
    if (quantity < 1 || quantity > (selectedInv.quantity_remaining ?? 0)) {
      toast.error(`Quantity must be 1–${selectedInv.quantity_remaining}`); return
    }
    if (isSmartphone && cart.some((i) => i.imei_number === imeiNumber.trim())) {
      toast.error('This IMEI is already in the cart'); return
    }
    const productName = [selectedInv.products?.brand, selectedInv.products?.model, selectedInv.products?.variant, selectedInv.products?.color].filter(Boolean).join(' ')
    setCart((prev) => [...prev, {
      _id: nextId(),
      inventory_id: selectedInv.id,
      product_id: selectedInv.product_id,
      product_name: productName,
      products: selectedInv.products,
      gst_rate: selectedInv.products?.gst_rate || 0,
      hsn_code: selectedInv.products?.hsn_code,
      category: selectedInv.products?.category,
      imei_number: isSmartphone ? imeiNumber.trim() : null,
      quantity,
      unit_price: price,
      discount_amount: Number(lineDiscount) || 0,
      max_qty: selectedInv.quantity_remaining,
    }])
    setSelectedInv(null); setProductSearch(''); setImeiNumber('')
    setQty(1); setUnitPrice(''); setLineDiscount(0)
    toast.success('Added to cart')
  }

  // ── GST + order summary ──────────────────────────────────────────────────
  const sameState = useMemo(() => {
    if (!selectedCustomer?.state || !currentTenant?.state) return true
    return selectedCustomer.state.trim().toLowerCase() === currentTenant.state.trim().toLowerCase()
  }, [selectedCustomer, currentTenant])

  const summary = useMemo(() => {
    let subtotal = 0, discount = 0, cgst = 0, sgst = 0, igst = 0
    cart.forEach((item) => {
      const lineTotal = item.unit_price * item.quantity
      const disc = item.discount_amount || 0
      const taxable = lineTotal - disc
      const gstAmt = (taxable * (item.gst_rate || 0)) / 100
      subtotal += lineTotal; discount += disc
      if (sameState) { cgst += gstAmt / 2; sgst += gstAmt / 2 } else igst += gstAmt
    })
    const taxable = subtotal - discount
    const totalGst = cgst + sgst + igst
    return { subtotal, discount, taxable, cgst, sgst, igst, totalGst, grandTotal: taxable + totalGst }
  }, [cart, sameState])

  // ── Submit ───────────────────────────────────────────────────────────────
  const handleGenerateInvoice = async () => {
    if (submittingRef.current) return
    if (cart.length === 0) { toast.error('Add at least one item to the cart'); return }
    if (!selectedCustomer) { toast.error('Identify a customer first'); return }
    if (!employeeId) { toast.error('Select an employee'); return }

    submittingRef.current = true; setSubmitting(true)

    const { data, error } = await createSale(
      { employee_id: employeeId, payment_method: paymentMethod, payment_status: paymentStatus, upi_reference: paymentMethod === 'upi' ? upiRef : null },
      cart,
      { customer: selectedCustomer, tenant: currentTenant }
    )

    submittingRef.current = false; setSubmitting(false)
    if (error) { toast.error(error.message ?? 'Failed to create sale'); return }

    try {
      generateInvoicePdf({
        sale: data,
        saleItems: cart.map((item, i) => ({ ...item, ...data.processedItems[i] })),
        customer: selectedCustomer,
        tenant: currentTenant,
        sameState: data.sameState,
      })
      toast.success(`Invoice ${data.invoice_number} generated!`)
    } catch {
      toast.warning('Sale saved — PDF generation failed')
    }

    navigate('/sales')
  }

  const custDisplayName = selectedCustomer
    ? (selectedCustomer.customer_type === 'company' ? selectedCustomer.company_name : selectedCustomer.full_name)
    : ''

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="p-4 md:p-6 max-w-7xl mx-auto space-y-5"
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/sales')} className="shrink-0">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">New Sale</h1>
          <p className="text-sm text-muted-foreground">Create a new sales invoice</p>
        </div>
      </div>

      {/* ══ STEP 1: Customer identification ══════════════════════════════════ */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-indigo-500 text-white text-xs flex items-center justify-center font-bold shrink-0">1</div>
            <CardTitle className="text-base">Customer</CardTitle>
            {phase === 'found' && (
              <Badge variant="outline" className="ml-auto text-xs text-emerald-400 border-emerald-400/40">Identified</Badge>
            )}
            {phase === 'new' && (
              <Badge variant="outline" className="ml-auto text-xs text-amber-400 border-amber-400/40">New Customer</Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">

          {/* ── Found: locked customer card ── */}
          {phase === 'found' && selectedCustomer ? (
            <div className="flex items-center gap-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold">{custDisplayName}</p>
                  <Badge variant="outline" className="text-xs capitalize">{selectedCustomer.customer_type}</Badge>
                  {selectedCustomer.gstin && (
                    <Badge variant="outline" className="text-xs text-indigo-400 border-indigo-400/40">B2B</Badge>
                  )}
                </div>
                <div className="flex items-center gap-3 text-sm text-muted-foreground mt-0.5 flex-wrap">
                  <span>{selectedCustomer.phone}</span>
                  {(selectedCustomer.city || selectedCustomer.state) && (
                    <span>· {[selectedCustomer.city, selectedCustomer.state].filter(Boolean).join(', ')}</span>
                  )}
                  {selectedCustomer.visit_count > 0 && (
                    <span>· {selectedCustomer.visit_count} past visit{selectedCustomer.visit_count !== 1 ? 's' : ''}</span>
                  )}
                </div>
                {!sameState && (
                  <p className="text-xs text-amber-400 mt-1">Inter-state sale — IGST will apply</p>
                )}
              </div>
              <button
                type="button"
                onClick={resetCustomer}
                title="Change customer"
                className="shrink-0 p-1 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <>
              {/* ── Phone input ── */}
              <div className="space-y-1.5">
                <Label>Mobile Number <span className="text-red-400">*</span></Label>
                <div className="relative max-w-xs">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    value={phoneInput}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    onKeyDown={phoneKeyDown}
                    onPaste={phonePaste}
                    placeholder="Enter 10-digit mobile number"
                    className="pl-9"
                    maxLength={10}
                    type="tel"
                    inputMode="numeric"
                    autoFocus
                  />
                  {phase === 'searching' && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
                  )}
                </div>
                {phase === 'searching' && (
                  <p className="text-xs text-muted-foreground">Looking up customer…</p>
                )}
                {phase === 'new' && (
                  <p className="text-xs text-amber-400">No customer found — fill in the details below to add them.</p>
                )}
              </div>

              {/* ── New customer inline form ── */}
              {phase === 'new' && (
                <div className="space-y-4 pt-2 border-t border-border">

                  {/* Type toggle */}
                  <div className="space-y-1.5">
                    <Label>Customer Type</Label>
                    <div className="flex rounded-lg border border-border p-1 w-fit gap-1">
                      {[{ v: 'individual', l: 'Individual' }, { v: 'company', l: 'Company' }].map(({ v, l }) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setNC({ customer_type: v })}
                          className={cn(
                            'px-4 py-1.5 text-sm font-medium rounded transition-colors',
                            newCust.customer_type === v
                              ? 'bg-indigo-500 text-white'
                              : 'text-muted-foreground hover:text-foreground'
                          )}
                        >
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>

                  {newCust.customer_type === 'individual' ? (
                    <div className="grid grid-cols-2 gap-4">
                      {/* Full name */}
                      <div className="space-y-1.5">
                        <Label>Full Name <span className="text-red-400">*</span></Label>
                        <Input
                          value={newCust.full_name}
                          onChange={(e) => setNC({ full_name: e.target.value })}
                          placeholder="John Doe"
                        />
                      </div>

                      {/* WhatsApp */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <Label>WhatsApp <span className="text-xs text-muted-foreground">(optional)</span></Label>
                          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={newCust.same_as_phone}
                              onChange={(e) => setNC({ same_as_phone: e.target.checked, whatsapp_number: e.target.checked ? phoneInput : '' })}
                              className="w-3.5 h-3.5 accent-indigo-500"
                            />
                            Same as mobile
                          </label>
                        </div>
                        <Input
                          value={newCust.whatsapp_number}
                          onChange={(e) => setNC({ whatsapp_number: e.target.value })}
                          onKeyDown={phoneKeyDown}
                          onPaste={phonePaste}
                          placeholder="9876543210"
                          maxLength={10}
                          type="tel"
                          inputMode="numeric"
                          disabled={newCust.same_as_phone}
                          className={newCust.same_as_phone ? 'opacity-50' : ''}
                        />
                      </div>

                      {/* Email */}
                      <div className="space-y-1.5">
                        <Label>Email <span className="text-xs text-muted-foreground">(optional)</span></Label>
                        <Input
                          type="email"
                          value={newCust.email}
                          onChange={(e) => setNC({ email: e.target.value })}
                          placeholder="john@email.com"
                        />
                      </div>

                      {/* State */}
                      <div className="space-y-1.5">
                        <Label>State <span className="text-red-400">*</span> <span className="text-xs text-muted-foreground">(for GST)</span></Label>
                        <Select value={newCust.state} onValueChange={(v) => setNC({ state: v })}>
                          <SelectTrigger><SelectValue placeholder="Select state…" /></SelectTrigger>
                          <SelectContent>
                            {INDIAN_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* City */}
                      <div className="space-y-1.5">
                        <Label>City <span className="text-xs text-muted-foreground">(optional)</span></Label>
                        <Input
                          value={newCust.city}
                          onChange={(e) => setNC({ city: e.target.value })}
                          placeholder="Indore"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      {/* Company name */}
                      <div className="space-y-1.5">
                        <Label>Company Name <span className="text-red-400">*</span></Label>
                        <Input
                          value={newCust.company_name}
                          onChange={(e) => setNC({ company_name: e.target.value })}
                          placeholder="ABC Electronics Pvt Ltd"
                        />
                      </div>

                      {/* Contact person */}
                      <div className="space-y-1.5">
                        <Label>Contact Person <span className="text-red-400">*</span></Label>
                        <Input
                          value={newCust.contact_person}
                          onChange={(e) => setNC({ contact_person: e.target.value })}
                          placeholder="John Doe"
                        />
                      </div>

                      {/* WhatsApp */}
                      <div className="space-y-1.5">
                        <Label>WhatsApp <span className="text-xs text-muted-foreground">(optional)</span></Label>
                        <Input
                          value={newCust.whatsapp_number}
                          onChange={(e) => setNC({ whatsapp_number: e.target.value })}
                          onKeyDown={phoneKeyDown}
                          onPaste={phonePaste}
                          placeholder="9876543210"
                          maxLength={10}
                          type="tel"
                          inputMode="numeric"
                        />
                      </div>

                      {/* Email */}
                      <div className="space-y-1.5">
                        <Label>Email <span className="text-xs text-muted-foreground">(optional)</span></Label>
                        <Input
                          type="email"
                          value={newCust.email}
                          onChange={(e) => setNC({ email: e.target.value })}
                          placeholder="info@company.com"
                        />
                      </div>

                      {/* GSTIN */}
                      <div className="space-y-1.5">
                        <Label>GSTIN <span className="text-xs text-muted-foreground">(optional)</span></Label>
                        <Input
                          value={newCust.gstin}
                          onChange={(e) => setNC({ gstin: e.target.value.toUpperCase() })}
                          placeholder="23AAAAA0000A1Z5"
                          className="font-mono"
                          maxLength={15}
                        />
                      </div>

                      {/* State */}
                      <div className="space-y-1.5">
                        <Label>State <span className="text-red-400">*</span> <span className="text-xs text-muted-foreground">(for GST)</span></Label>
                        <Select value={newCust.state} onValueChange={(v) => setNC({ state: v })}>
                          <SelectTrigger><SelectValue placeholder="Select state…" /></SelectTrigger>
                          <SelectContent>
                            {INDIAN_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* City */}
                      <div className="space-y-1.5">
                        <Label>City <span className="text-xs text-muted-foreground">(optional)</span></Label>
                        <Input
                          value={newCust.city}
                          onChange={(e) => setNC({ city: e.target.value })}
                          placeholder="Indore"
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end pt-1">
                    <Button
                      type="button"
                      onClick={handleSaveNewCustomer}
                      disabled={savingCustomer}
                      className="bg-indigo-500 hover:bg-indigo-600 text-white"
                    >
                      {savingCustomer
                        ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Saving…</>
                        : 'Save & Continue →'
                      }
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* ══ STEP 2 + 3: Products + Payment ═══════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

        {/* ── LEFT: Products + Cart ── */}
        <div className="lg:col-span-3 space-y-4">
          <div className="flex items-center gap-2 px-1">
            <div className="w-6 h-6 rounded-full bg-indigo-500 text-white text-xs flex items-center justify-center font-bold shrink-0">2</div>
            <span className="text-sm font-medium text-muted-foreground">Add Products</span>
          </div>

          {/* Product search card */}
          <Card>
            <CardContent className="pt-5 space-y-4">
              <div className="space-y-1.5">
                <Label>Search Product</Label>
                <ProductSearchDropdown
                  value={productSearch}
                  onChange={setProductSearch}
                  placeholder="Brand, model, variant…"
                  items={filteredInventory}
                  onClear={() => { setProductSearch(''); setSelectedInv(null) }}
                  renderItem={(inv) => (
                    <div>
                      <span className="font-medium">
                        {[inv.products?.brand, inv.products?.model, inv.products?.variant, inv.products?.color].filter(Boolean).join(' ')}
                      </span>
                      <span className={cn('ml-2 text-xs', inv.quantity_remaining <= 5 ? 'text-amber-400' : 'text-emerald-400')}>
                        {inv.quantity_remaining} left
                      </span>
                      <span className="ml-2 text-xs text-muted-foreground">· Sell: {fmt(inv.selling_price)}</span>
                    </div>
                  )}
                  onSelect={handleSelectProduct}
                />
              </div>

              {selectedInv && (
                <>
                  {isSmartphone ? (
                    <div className="space-y-1.5">
                      <Label>IMEI Number <span className="text-red-400">*</span></Label>
                      <Input
                        value={imeiNumber}
                        onChange={(e) => setImeiNumber(e.target.value)}
                        placeholder="15-digit IMEI number"
                        maxLength={15}
                      />
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <Label>Quantity <span className="text-xs text-muted-foreground">(max {selectedInv.quantity_remaining})</span></Label>
                      <Input
                        type="number" min={1} max={selectedInv.quantity_remaining}
                        value={qty} onChange={(e) => setQty(e.target.value)}
                        className="w-32"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Unit Price <span className="text-red-400">*</span></Label>
                      <Input type="number" min={0} step="0.01" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} placeholder="0.00" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Discount <span className="text-xs text-muted-foreground">(optional)</span></Label>
                      <Input type="number" min={0} step="0.01" value={lineDiscount} onChange={(e) => setLineDiscount(e.target.value)} placeholder="0.00" />
                    </div>
                  </div>

                  <Button type="button" onClick={handleAddToCart} className="w-full bg-indigo-500 hover:bg-indigo-600 text-white">
                    <Plus className="w-4 h-4 mr-2" />Add to Cart
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          {/* Cart */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Cart</CardTitle>
                {cart.length > 0 && (
                  <span className="text-xs text-muted-foreground">{cart.length} item{cart.length !== 1 ? 's' : ''}</span>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {cart.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground border border-dashed border-border rounded-lg">
                  <p className="text-sm">No items in cart</p>
                  <p className="text-xs mt-1">Search and add products above</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground text-xs uppercase">
                        <th className="pb-2 text-left">Product</th>
                        <th className="pb-2 text-right">Qty</th>
                        <th className="pb-2 text-right">Price</th>
                        <th className="pb-2 text-right">Disc.</th>
                        <th className="pb-2 text-right">Total</th>
                        <th className="pb-2 w-8" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {cart.map((item) => {
                        const lineTotal = item.unit_price * item.quantity - (item.discount_amount || 0)
                        return (
                          <tr key={item._id}>
                            <td className="py-2 pr-2">
                              <p className="font-medium text-xs leading-snug">{item.product_name}</p>
                              {item.imei_number && (
                                <p className="text-xs text-muted-foreground">IMEI: {item.imei_number}</p>
                              )}
                            </td>
                            <td className="py-2 text-right text-xs">{item.quantity}</td>
                            <td className="py-2 text-right text-xs">{fmt(item.unit_price)}</td>
                            <td className="py-2 text-right text-xs text-amber-400">
                              {item.discount_amount > 0 ? `-${fmt(item.discount_amount)}` : '—'}
                            </td>
                            <td className="py-2 text-right text-xs font-semibold">{fmt(lineTotal)}</td>
                            <td className="py-2 pl-1">
                              <Button
                                variant="ghost" size="icon"
                                className="h-6 w-6 text-muted-foreground hover:text-red-400"
                                onClick={() => setCart((prev) => prev.filter((i) => i._id !== item._id))}
                              >
                                <Trash2 className="w-3 h-3" />
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
        </div>

        {/* ── RIGHT: Summary + Employee + Payment ── */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center gap-2 px-1">
            <div className="w-6 h-6 rounded-full bg-indigo-500 text-white text-xs flex items-center justify-center font-bold shrink-0">3</div>
            <span className="text-sm font-medium text-muted-foreground">Payment & Invoice</span>
          </div>

          {/* Order summary */}
          {cart.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row label="Subtotal" value={fmt(summary.subtotal)} />
                {summary.discount > 0 && (
                  <Row label="Discount" value={`-${fmt(summary.discount)}`} className="text-amber-400" />
                )}
                <Row label="Taxable Amount" value={fmt(summary.taxable)} />
                <div className="border-t border-border pt-2 space-y-1.5">
                  {selectedCustomer ? (
                    sameState ? (
                      <>
                        <Row label="CGST" value={fmt(summary.cgst)} muted />
                        <Row label="SGST" value={fmt(summary.sgst)} muted />
                      </>
                    ) : (
                      <Row label="IGST" value={fmt(summary.igst)} muted />
                    )
                  ) : (
                    <p className="text-xs text-muted-foreground">Identify customer above to compute GST</p>
                  )}
                </div>
                <div className="border-t border-border pt-2">
                  <Row label="Grand Total" value={fmt(summary.grandTotal)} bold />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Employee */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Employee</CardTitle>
            </CardHeader>
            <CardContent>
              {currentUser?.role === 'admin' ? (
                <Select value={employeeId} onValueChange={setEmployeeId}>
                  <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                  <SelectContent>
                    {employees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.full_name}
                        <span className="text-muted-foreground capitalize ml-1">· {emp.role}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm font-medium py-2">
                  {employees.find(e => e.id === employeeId)?.full_name ?? currentUser?.full_name ?? '—'}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Payment */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Payment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Method</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['cash', 'upi', 'card', 'emi', 'mixed'].map((m) => (
                        <SelectItem key={m} value={m} className="capitalize">{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Status</Label>
                  <Select value={paymentStatus} onValueChange={setPaymentStatus}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="partial">Partial</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {paymentMethod === 'upi' && (
                <div className="space-y-1.5">
                  <Label className="text-xs">UPI Reference</Label>
                  <Input value={upiRef} onChange={(e) => setUpiRef(e.target.value)} placeholder="UPI transaction ID" />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Generate Invoice */}
          <Button
            onClick={handleGenerateInvoice}
            disabled={submitting || cart.length === 0 || phase !== 'found'}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-12 text-base font-semibold"
          >
            {submitting
              ? <><Loader2 className="w-5 h-5 animate-spin mr-2" />Generating Invoice…</>
              : 'Generate Invoice'
            }
          </Button>

          {phase !== 'found' && cart.length > 0 && (
            <p className="text-xs text-center text-muted-foreground -mt-2">
              Complete customer identification above to enable this button
            </p>
          )}
        </div>
      </div>
    </motion.div>
  )
}
