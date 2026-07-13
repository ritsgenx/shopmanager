import React, { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { useForm, Controller } from 'react-hook-form'
import {
  Loader2, MapPin, Upload, AlertCircle, Image, X, Navigation, Sun, SunMedium, Moon, Monitor,
  Percent, Plus, Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import {
  getTenantSettings, updateTenantSettings, uploadLogo,
  getLowStockThreshold, saveLowStockThreshold, DEFAULT_LOW_STOCK_THRESHOLD,
} from '@/lib/settings'
import {
  getTaxCategories, getTaxCategoryUsage, createTaxCategory, updateTaxCategory, deleteTaxCategory,
} from '@/lib/taxCategories'
import { phoneKeyDown, phonePaste } from '@/lib/validations'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

const INDIAN_STATES = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh',
  'Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka',
  'Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram',
  'Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu',
  'Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal',
  'Andaman and Nicobar Islands','Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi','Jammu and Kashmir','Ladakh','Lakshadweep','Puducherry',
]

const defaultValues = {
  shop_name: '', owner_name: '', owner_phone: '',
  address: '', city: '', state: '', pincode: '', gst_number: '',
  primary_color: '#6366f1',
  shop_lat: '', shop_lng: '', geo_fence_radius: 150,
}

function SectionHeader({ label }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{label}</p>
      <Separator className="flex-1" />
    </div>
  )
}

function FieldError({ error }) {
  if (!error) return null
  return <p className="text-red-400 text-xs mt-1">{error.message}</p>
}

// ── Inventory Alerts (owner-only) ────────────────────────────────────────────
// The app-wide definition of "low stock": a model is low when its total
// remaining units fall to this number or below (zero = out of stock).
function InventoryAlertsCard({ tenantId }) {
  const [value, setValue] = useState(String(DEFAULT_LOW_STOCK_THRESHOLD))
  const [saved, setSaved] = useState(DEFAULT_LOW_STOCK_THRESHOLD)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!tenantId) return
    getLowStockThreshold(tenantId).then((v) => { setValue(String(v)); setSaved(v) })
  }, [tenantId])

  const dirty = Number(value) !== saved

  const handleSave = async () => {
    const n = Number(value)
    if (!Number.isInteger(n) || n < 1 || n > 100) {
      toast.error('Threshold must be a whole number between 1 and 100')
      return
    }
    setSaving(true)
    const { error } = await saveLowStockThreshold(tenantId, n)
    setSaving(false)
    if (error) { toast.error(error.message ?? 'Failed to save'); return }
    setSaved(n)
    toast.success(`Low-stock alert set to ${n} unit${n > 1 ? 's' : ''}`)
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <AlertCircle className="w-5 h-5 text-yellow-400" />
          Inventory Alerts
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          A model counts as <strong>low stock</strong> when its remaining units fall to this
          number or below (zero = out of stock). One rule, used everywhere — Inventory page,
          Dashboard alerts and stock badges.
        </p>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-3">
          <Label className="whitespace-nowrap">Alert when a model has</Label>
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value.replace(/[^\d]/g, ''))}
            inputMode="numeric"
            className="w-20 text-right"
          />
          <span className="text-sm text-muted-foreground whitespace-nowrap">units or fewer</span>
          {dirty && (
            <Button size="sm" className="h-9 bg-indigo-500 hover:bg-indigo-600 text-white" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// ── Tax Categories (owner-only) ──────────────────────────────────────────────
// The single source of truth for GST rate + HSN per commodity group. Models
// point at a category; every PO, sale and invoice resolves through it. Rate
// edits apply to FUTURE transactions only — past bills keep their frozen rate.
function TaxCategoryRow({ row, usage, onSaved, onDeleted, tenantId }) {
  const [name, setName] = useState(row.name)
  const [hsn, setHsn] = useState(row.hsn_code ?? '')
  const [rate, setRate] = useState(String(Number(row.gst_rate)))
  const [saving, setSaving] = useState(false)

  const dirty =
    name.trim().toLowerCase() !== row.name ||
    (hsn.trim() || '') !== (row.hsn_code ?? '') ||
    Number(rate) !== Number(row.gst_rate)

  const models = usage[row.id] ?? 0

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Category name is required'); return }
    if (rate === '' || Number(rate) < 0 || Number(rate) > 100) { toast.error('GST rate must be 0–100'); return }
    if (Number(rate) !== Number(row.gst_rate) && models > 0) {
      const ok = window.confirm(
        `Change GST for "${row.name}" from ${Number(row.gst_rate)}% to ${Number(rate)}%?\n\n` +
        `${models} model${models > 1 ? 's' : ''} use${models > 1 ? '' : 's'} this category — all FUTURE sales and purchases will bill at ${Number(rate)}%.\n` +
        `Past invoices are not affected.`
      )
      if (!ok) return
    }
    setSaving(true)
    const { error } = await updateTaxCategory(tenantId, row.id, { name, hsn_code: hsn, gst_rate: rate })
    setSaving(false)
    if (error) {
      if (error.code === '23505') toast.error('A category with this name already exists.')
      else toast.error(error.message ?? 'Failed to save category')
      return
    }
    toast.success(`"${name.trim().toLowerCase()}" saved`)
    onSaved()
  }

  const handleDelete = async () => {
    const ok = window.confirm(`Delete category "${row.name}"?`)
    if (!ok) return
    const { error } = await deleteTaxCategory(tenantId, row.id)
    if (error) { toast.error(error.message ?? 'Failed to delete'); return }
    toast.success(`"${row.name}" deleted`)
    onDeleted()
  }

  return (
    <div className="grid grid-cols-[1fr_5.5rem_4.5rem_auto] gap-2 items-center">
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Category" className="capitalize" />
      <Input value={hsn} onChange={(e) => setHsn(e.target.value)} placeholder="HSN" />
      <Input value={rate} onChange={(e) => setRate(e.target.value.replace(/[^\d.]/g, ''))}
        inputMode="numeric" placeholder="%" className="text-right" />
      <div className="flex items-center gap-1">
        {dirty ? (
          <Button size="sm" className="h-9 bg-indigo-500 hover:bg-indigo-600 text-white" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground w-14 text-center whitespace-nowrap">
            {models} model{models === 1 ? '' : 's'}
          </span>
        )}
        <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-red-400"
          onClick={handleDelete} disabled={models > 0}
          title={models > 0 ? 'In use by models — reassign them first' : 'Delete category'}>
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}

function TaxCategoriesCard({ tenantId }) {
  const [rows, setRows] = useState([])
  const [usage, setUsage] = useState({})
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [newRow, setNewRow] = useState({ name: '', hsn: '', rate: '18' })

  const load = async () => {
    const [catRes, usageRes] = await Promise.all([
      getTaxCategories(tenantId),
      getTaxCategoryUsage(tenantId),
    ])
    setRows(catRes.data ?? [])
    setUsage(usageRes.data ?? {})
    setLoading(false)
  }

  useEffect(() => { if (tenantId) load() }, [tenantId])

  const handleAdd = async () => {
    if (!newRow.name.trim()) { toast.error('Category name is required'); return }
    if (newRow.rate === '' || Number(newRow.rate) < 0 || Number(newRow.rate) > 100) {
      toast.error('GST rate must be 0–100'); return
    }
    setAdding(true)
    const { error } = await createTaxCategory(tenantId, {
      name: newRow.name, hsn_code: newRow.hsn, gst_rate: newRow.rate,
    })
    setAdding(false)
    if (error) {
      if (error.code === '23505') toast.error('A category with this name already exists.')
      else toast.error(error.message ?? 'Failed to add category')
      return
    }
    toast.success(`"${newRow.name.trim().toLowerCase()}" added`)
    setNewRow({ name: '', hsn: '', rate: '18' })
    load()
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Percent className="w-5 h-5 text-indigo-400" />
          Tax Categories (GST &amp; HSN)
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          One row per commodity group. Every model belongs to a category, and all purchases,
          sales and invoices bill at its rate — nobody can override it during entry.
          When the government changes a rate, edit it here once; past bills keep the rate they were billed at.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Loading…</p>
        ) : (
          <>
            <div className="grid grid-cols-[1fr_5.5rem_4.5rem_auto] gap-2 text-xs text-muted-foreground font-medium px-1">
              <span>Category</span><span>HSN</span><span className="text-right">GST %</span><span />
            </div>
            {rows.map((row) => (
              <TaxCategoryRow key={row.id} row={row} usage={usage} tenantId={tenantId}
                onSaved={load} onDeleted={load} />
            ))}

            <div className="grid grid-cols-[1fr_5.5rem_4.5rem_auto] gap-2 items-center border-t border-border pt-3">
              <Input value={newRow.name} onChange={(e) => setNewRow((p) => ({ ...p, name: e.target.value }))}
                placeholder="New category…" />
              <Input value={newRow.hsn} onChange={(e) => setNewRow((p) => ({ ...p, hsn: e.target.value }))}
                placeholder="HSN" />
              <Input value={newRow.rate} onChange={(e) => setNewRow((p) => ({ ...p, rate: e.target.value.replace(/[^\d.]/g, '') }))}
                inputMode="numeric" placeholder="%" className="text-right" />
              <Button size="sm" variant="outline" className="h-9" onClick={handleAdd} disabled={adding}>
                {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4 mr-1" />Add</>}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

export default function Settings() {
  const { currentUser, currentTenant, refreshTenant } = useAuth()
  const { theme, setTheme } = useTheme()
  const isEmployee = currentUser?.role === 'employee'

  // Logo state (handled outside RHF)
  const [logoFile, setLogoFile]       = useState(null)
  const [logoPreview, setLogoPreview] = useState(null)
  const [locating, setLocating]       = useState(false)
  const logoInputRef = useRef(null)

  const {
    register, control, handleSubmit, setValue, watch, reset,
    formState: { errors, isSubmitting },
  } = useForm({ defaultValues })

  const watchLat = watch('shop_lat')
  const watchLng = watch('shop_lng')
  const locationConfigured = watchLat && watchLng

  // Load existing settings
  useEffect(() => {
    if (!currentTenant?.id) return
    getTenantSettings(currentTenant.id).then(({ data }) => {
      if (!data) return
      reset({
        shop_name:        data.shop_name        ?? '',
        owner_name:       data.owner_name       ?? '',
        owner_phone:      data.owner_phone      ?? '',
        address:          data.address          ?? '',
        city:             data.city             ?? '',
        state:            data.state            ?? '',
        pincode:          data.pincode          ?? '',
        gst_number:       data.gst_number       ?? '',
        primary_color:    data.primary_color    ?? '#6366f1',
        shop_lat:         data.shop_lat         ?? '',
        shop_lng:         data.shop_lng         ?? '',
        geo_fence_radius: data.geo_fence_radius ?? 150,
      })
      if (data.logo_url) setLogoPreview(data.logo_url)
    })
  }, [currentTenant?.id, reset])

  const handleLogoChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { toast.error('Logo must be under 2 MB'); return }
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
  }

  const handleGetLocation = () => {
    if (!navigator.geolocation) { toast.error('Geolocation not supported in this browser'); return }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setValue('shop_lat', parseFloat(pos.coords.latitude.toFixed(6)), { shouldValidate: true })
        setValue('shop_lng', parseFloat(pos.coords.longitude.toFixed(6)), { shouldValidate: true })
        setLocating(false)
        toast.success('Location captured — review the coordinates below before saving.')
      },
      (err) => {
        setLocating(false)
        if (err.code === 1) toast.error('Location permission denied. Allow access in browser settings.')
        else toast.error('Could not get location. Please try again or enter coordinates manually.')
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const onSubmit = async (values) => {
    let logo_url = currentTenant?.logo_url ?? null

    // Upload new logo if selected
    if (logoFile) {
      const { url, error: uploadError } = await uploadLogo(currentTenant.id, logoFile)
      if (uploadError) {
        toast.error(`Logo upload failed: ${uploadError.message}. Settings not saved.`)
        return
      }
      logo_url = url
    }

    const payload = {
      shop_name:        values.shop_name        || null,
      owner_name:       values.owner_name        || null,
      owner_phone:      values.owner_phone       || null,
      address:          values.address           || null,
      city:             values.city              || null,
      state:            values.state             || null,
      pincode:          values.pincode           || null,
      gst_number:       values.gst_number        || null,
      primary_color:    values.primary_color     || '#6366f1',
      shop_lat:         values.shop_lat !== '' ? Number(values.shop_lat) : null,
      shop_lng:         values.shop_lng !== '' ? Number(values.shop_lng) : null,
      geo_fence_radius: values.geo_fence_radius ? Number(values.geo_fence_radius) : 150,
      logo_url,
    }

    const { error } = await updateTenantSettings(currentTenant.id, payload)
    if (error) { toast.error(error.message ?? 'Failed to save settings'); return }

    await refreshTenant()           // update AuthContext so geo-fence widget uses new coords
    setLogoFile(null)               // clear pending upload
    toast.success('Settings saved successfully!')
  }

  const colorValue = watch('primary_color') || '#6366f1'

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="p-4 md:p-6 max-w-3xl mx-auto space-y-6"
    >
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          {isEmployee ? 'Manage your personal preferences' : 'Configure your shop profile, branding and geo-fence location'}
        </p>
      </div>

      {/* ══ Appearance — visible to all users ════════════════════════════════ */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Appearance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Label>Color Theme</Label>
          <div className="flex flex-wrap rounded-lg border border-border bg-muted/30 p-1 w-fit gap-1">
            {[
              { value: 'light', label: 'Light', icon: Sun },
              { value: 'dim',   label: 'Dim',   icon: SunMedium },
              { value: 'dark',  label: 'Dark',  icon: Moon },
              { value: 'auto',  label: 'Auto',  icon: Monitor },
            ].map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setTheme(value)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors',
                  theme === value
                    ? 'bg-indigo-500 text-white shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Auto follows your device's system setting.</p>
        </CardContent>
      </Card>

      {!isEmployee && <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

        {/* ══ Section A: Shop Information ═══════════════════════════════════ */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Shop Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">

            {/* Logo upload */}
            <div className="space-y-2">
              <Label>Shop Logo</Label>
              <div className="flex items-center gap-4 flex-wrap">
                {/* Preview */}
                <div className="w-20 h-20 rounded-xl border border-border bg-muted/30 flex items-center justify-center overflow-hidden shrink-0">
                  {logoPreview
                    ? <img src={logoPreview} alt="Logo preview" className="w-full h-full object-contain" />
                    : <Image className="w-8 h-8 text-muted-foreground" />
                  }
                </div>

                <div className="space-y-2">
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    onChange={handleLogoChange}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => logoInputRef.current?.click()}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    {logoPreview ? 'Replace Logo' : 'Upload Logo'}
                  </Button>
                  {logoFile && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="truncate max-w-[160px]">{logoFile.name}</span>
                      <button
                        type="button"
                        onClick={() => { setLogoFile(null); setLogoPreview(currentTenant?.logo_url ?? null) }}
                        className="text-red-400 hover:text-red-300"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">PNG, JPG or WebP · max 2 MB</p>
                  <p className="text-xs text-amber-400">
                    Requires a public "logos" bucket in Supabase Storage.
                  </p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Shop name + GST */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Shop Name <span className="text-red-400">*</span></Label>
                <Input
                  {...register('shop_name', { required: 'Shop name is required' })}
                  placeholder="My Mobile Store"
                />
                <FieldError error={errors.shop_name} />
              </div>
              <div className="space-y-1.5">
                <Label>GST Number</Label>
                <Input
                  {...register('gst_number', {
                    validate: (v) => !v || /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[A-Z0-9]{1}[Z]{1}[A-Z0-9]{1}$/.test(v)
                      || 'Enter a valid 15-character GSTIN',
                  })}
                  placeholder="23AAAAA0000A1Z5"
                  className="font-mono"
                  maxLength={15}
                  onChange={(e) => setValue('gst_number', e.target.value.toUpperCase())}
                />
                <FieldError error={errors.gst_number} />
              </div>
            </div>

            {/* Owner */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Owner Name</Label>
                <Input {...register('owner_name')} placeholder="Ritesh Mittal" />
              </div>
              <div className="space-y-1.5">
                <Label>Owner Phone</Label>
                <Input
                  {...register('owner_phone')}
                  onKeyDown={phoneKeyDown}
                  onPaste={phonePaste}
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="9876543210"
                />
              </div>
            </div>

            {/* Address */}
            <div className="space-y-1.5">
              <Label>Street Address</Label>
              <Input {...register('address')} placeholder="Shop No. 12, Main Market" />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="col-span-2 sm:col-span-2 space-y-1.5">
                <Label>City</Label>
                <Input {...register('city')} placeholder="Indore" />
              </div>
              <div className="space-y-1.5">
                <Label>State</Label>
                <Controller
                  name="state"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value || ''}>
                      <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                      <SelectContent>
                        {INDIAN_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Pincode</Label>
                <Input {...register('pincode')} placeholder="452001" maxLength={6} inputMode="numeric" />
              </div>
            </div>

            {/* Brand color */}
            <div className="space-y-1.5">
              <Label>Primary Brand Color</Label>
              <div className="flex items-center gap-3">
                <Controller
                  name="primary_color"
                  control={control}
                  render={({ field }) => (
                    <>
                      <input
                        type="color"
                        value={field.value || '#6366f1'}
                        onChange={field.onChange}
                        className="h-10 w-12 rounded-md border border-border cursor-pointer bg-transparent p-0.5"
                      />
                      <Input
                        value={field.value || '#6366f1'}
                        onChange={(e) => field.onChange(e.target.value)}
                        placeholder="#6366f1"
                        className="font-mono w-32"
                        maxLength={7}
                      />
                    </>
                  )}
                />
                <div
                  className="w-8 h-8 rounded-full border border-border"
                  style={{ backgroundColor: colorValue }}
                />
                <span className="text-xs text-muted-foreground">Preview</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ══ Section B: Shop Location ══════════════════════════════════════ */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="w-4 h-4 text-indigo-400" />
              Shop Location <span className="text-muted-foreground font-normal text-sm">(for attendance geo-fence)</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">

            {/* Location not configured warning */}
            {!locationConfigured && (
              <div className="flex items-start gap-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-3 text-sm text-amber-400">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Location not configured</p>
                  <p className="text-xs mt-0.5 text-amber-400/80">
                    Attendance check-in will be blocked for all employees until you set the shop coordinates.
                  </p>
                </div>
              </div>
            )}

            {/* Get Current Location button */}
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleGetLocation}
                disabled={locating}
                className="shrink-0"
              >
                {locating
                  ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Getting location…</>
                  : <><Navigation className="w-4 h-4 mr-2" />Get Current Location</>
                }
              </Button>
              <p className="text-xs text-muted-foreground">
                Stand at the shop and click this to auto-fill coordinates
              </p>
            </div>

            {/* Lat / Lng / Radius */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>Latitude</Label>
                <Input
                  {...register('shop_lat', {
                    validate: (v) => v === '' || v == null || (Number(v) >= -90 && Number(v) <= 90)
                      || 'Must be between -90 and 90',
                  })}
                  type="number"
                  step="any"
                  placeholder="22.7196"
                />
                <FieldError error={errors.shop_lat} />
              </div>
              <div className="space-y-1.5">
                <Label>Longitude</Label>
                <Input
                  {...register('shop_lng', {
                    validate: (v) => v === '' || v == null || (Number(v) >= -180 && Number(v) <= 180)
                      || 'Must be between -180 and 180',
                  })}
                  type="number"
                  step="any"
                  placeholder="75.8577"
                />
                <FieldError error={errors.shop_lng} />
              </div>
              <div className="space-y-1.5">
                <Label>Geo-fence Radius (m)</Label>
                <Input
                  {...register('geo_fence_radius', {
                    min: { value: 10, message: 'Minimum 10 metres' },
                    max: { value: 5000, message: 'Maximum 5000 metres' },
                  })}
                  type="number"
                  min={10}
                  max={5000}
                  placeholder="150"
                />
                <FieldError error={errors.geo_fence_radius} />
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Employees must be within <strong>{watch('geo_fence_radius') || 150} metres</strong> of the shop to check in or out.
              Recommended: 100–200 metres.
            </p>

            {locationConfigured && (
              <div className="flex items-center gap-2 text-xs text-emerald-400">
                <MapPin className="w-3.5 h-3.5" />
                Location set: {watch('shop_lat')}, {watch('shop_lng')}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ══ Section C: Save ═══════════════════════════════════════════════ */}
        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={isSubmitting}
            className="bg-indigo-500 hover:bg-indigo-600 text-white px-8 h-11 text-base font-semibold"
          >
            {isSubmitting
              ? <><Loader2 className="w-5 h-5 animate-spin mr-2" />Saving…</>
              : 'Save Settings'
            }
          </Button>
        </div>
      </form>}

      {/* These cards manage their own saves — outside the profile form */}
      {!isEmployee && <InventoryAlertsCard tenantId={currentTenant?.id} />}
      {!isEmployee && <TaxCategoriesCard tenantId={currentTenant?.id} />}
    </motion.div>
  )
}
