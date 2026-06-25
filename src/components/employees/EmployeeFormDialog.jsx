import React, { useEffect } from 'react'
import { useForm, Controller, useWatch } from 'react-hook-form'
import { Loader2, Info } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useAuth } from '@/context/AuthContext'
import { createEmployee, updateEmployee } from '@/lib/employees'
import { phoneKeyDown, phonePaste } from '@/lib/validations'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

// ── Permission definitions ───────────────────────────────────────────────────
const PERM_GROUPS = [
  {
    label: 'Sales',
    perms: [
      { key: 'can_create_sale',     label: 'Create Sales' },
      { key: 'can_apply_discount',  label: 'Apply Discounts' },
      { key: 'can_view_all_sales',  label: 'View All Sales' },
      { key: 'can_delete_sale',     label: 'Delete Sales' },
      { key: 'can_generate_invoice',label: 'Generate Invoice' },
    ],
  },
  {
    label: 'Inventory',
    perms: [
      { key: 'can_add_stock',            label: 'Add Stock' },
      { key: 'can_edit_stock',           label: 'Edit Stock' },
      { key: 'can_view_purchase_price',  label: 'View Purchase Price' },
    ],
  },
  {
    label: 'Customers',
    perms: [
      { key: 'can_add_customer',    label: 'Add Customers' },
      { key: 'can_edit_customer',   label: 'Edit Customers' },
      { key: 'can_delete_customer', label: 'Delete Customers' },
    ],
  },
  {
    label: 'Communication',
    perms: [
      { key: 'can_send_whatsapp', label: 'Send WhatsApp' },
      { key: 'can_send_sms',      label: 'Send SMS' },
    ],
  },
  {
    label: 'Reports & Attendance',
    perms: [
      { key: 'can_view_reports',     label: 'View Reports' },
      { key: 'can_view_attendance',  label: 'View Attendance' },
    ],
  },
]

const JUNIOR_DEFAULTS = {
  can_create_sale: true,  can_apply_discount: false,
  can_view_all_sales: false, can_delete_sale: false,
  can_generate_invoice: true, can_add_stock: false,
  can_edit_stock: false, can_view_purchase_price: false,
  can_add_customer: true, can_edit_customer: false,
  can_delete_customer: false, can_send_whatsapp: false,
  can_send_sms: false, can_view_reports: false,
  can_view_attendance: true,
}

const SENIOR_DEFAULTS = {
  ...JUNIOR_DEFAULTS,
  can_apply_discount: true, can_view_all_sales: true,
  can_add_stock: true, can_view_purchase_price: true,
  can_edit_customer: true,
}

const ALL_PERM_KEYS = PERM_GROUPS.flatMap((g) => g.perms.map((p) => p.key))

const defaultValues = {
  // Profile
  full_name: '', email: '', temp_password: '', phone: '',
  address: '', role: 'employee',
  date_of_birth: '', date_of_joining: '',
  // Employment
  monthly_salary: '', commission_type: 'none',
  commission_value: '', commission_percentage: '',
  // Bank
  bank_name: '', bank_account: '', bank_ifsc: '',
  emergency_contact: '', id_proof_type: '', id_proof_number: '',
  // Permissions
  ...JUNIOR_DEFAULTS,
}

function SectionDivider({ label }) {
  return (
    <div className="border-t border-border pt-4 pb-1">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
    </div>
  )
}

function FieldError({ error }) {
  if (!error) return null
  return <p className="text-red-400 text-xs mt-1">{error.message}</p>
}

export default function EmployeeFormDialog({ open, onOpenChange, employee, onSuccess }) {
  const isEdit = Boolean(employee)
  const { currentTenant } = useAuth()

  const {
    register, control, handleSubmit, watch, setValue, reset,
    formState: { errors, isSubmitting },
  } = useForm({ defaultValues })

  const commType = watch('commission_type')

  useEffect(() => {
    if (!open) return
    if (employee) {
      const d = employee.employee_details ?? {}
      const p = employee.employee_permissions ?? {}
      reset({
        full_name: employee.full_name ?? '',
        email: employee.email ?? '',
        temp_password: '',
        phone: employee.phone ?? '',
        address: employee.address ?? '',
        role: employee.role ?? 'employee',
        date_of_birth: employee.date_of_birth ?? '',
        date_of_joining: employee.date_of_joining ?? '',
        monthly_salary: d.monthly_salary ?? '',
        commission_type: d.commission_type ?? 'none',
        commission_value: d.commission_value ?? '',
        commission_percentage: d.commission_percentage ?? '',
        bank_name: d.bank_name ?? '',
        bank_account: d.bank_account ?? '',
        bank_ifsc: d.bank_ifsc ?? '',
        emergency_contact: d.emergency_contact ?? '',
        id_proof_type: d.id_proof_type ?? '',
        id_proof_number: d.id_proof_number ?? '',
        ...ALL_PERM_KEYS.reduce((acc, k) => ({ ...acc, [k]: p[k] ?? JUNIOR_DEFAULTS[k] ?? false }), {}),
      })
    } else {
      reset(defaultValues)
    }
  }, [open, employee, reset])

  const applyTemplate = (template) => {
    ALL_PERM_KEYS.forEach((k) => setValue(k, template[k]))
  }

  const onSubmit = async (values) => {
    const profileData = {
      tenant_id: currentTenant.id,
      full_name: values.full_name,
      email: values.email,
      temp_password: values.temp_password,
      phone: values.phone || null,
      address: values.address || null,
      role: values.role,
      date_of_birth: values.date_of_birth || null,
      date_of_joining: values.date_of_joining || null,
    }

    const detailsData = {
      monthly_salary: values.monthly_salary ? Number(values.monthly_salary) : null,
      commission_type: values.commission_type !== 'none' ? values.commission_type : null,
      commission_value: values.commission_type === 'flat' ? Number(values.commission_value) : null,
      commission_percentage: values.commission_type === 'percentage' ? Number(values.commission_percentage) : null,
      bank_name: values.bank_name || null,
      bank_account: values.bank_account || null,
      bank_ifsc: values.bank_ifsc ? values.bank_ifsc.toUpperCase() : null,
      emergency_contact: values.emergency_contact || null,
      id_proof_type: values.id_proof_type || null,
      id_proof_number: values.id_proof_number || null,
    }

    const permissionsData = ALL_PERM_KEYS.reduce((acc, k) => ({ ...acc, [k]: Boolean(values[k]) }), {})

    if (isEdit) {
      const { error } = await updateEmployee(employee.id, currentTenant.id, profileData, detailsData, permissionsData)
      if (error) { toast.error(error.message ?? 'Failed to update employee'); return }
      toast.success('Employee updated')
    } else {
      const { error } = await createEmployee(profileData, detailsData, permissionsData)
      if (error) { toast.error(error.message ?? 'Failed to add employee'); return }
      toast.success('Employee added! They will receive a confirmation email to activate their account.')
    }

    onSuccess?.()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-full max-h-[90vh] overflow-y-auto" onInteractOutside={(e) => e.preventDefault()}>
        <div className="px-6 pt-6 pb-2">
          <DialogHeader>
            <DialogTitle>{isEdit ? 'Edit Employee' : 'Add Employee'}</DialogTitle>
          </DialogHeader>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="px-6 pb-6 space-y-4">

          {/* Auth note — new employees only */}
          {!isEdit && (
            <div className="flex gap-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-lg p-3 text-xs text-muted-foreground">
              <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
              <p>
                A Supabase auth account will be created with the email and temporary password below.
                The employee will receive a confirmation email.
                <strong className="text-foreground"> Make sure "Confirm Email" is enabled</strong> in your
                Supabase Auth settings to avoid being logged out during this step.
              </p>
            </div>
          )}

          {/* ── Basic Info ─────────────────────────────────────────────── */}
          <SectionDivider label="Basic Info" />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Full Name <span className="text-red-400">*</span></Label>
              <Input {...register('full_name', { required: 'Full name is required' })} placeholder="John Doe" />
              <FieldError error={errors.full_name} />
            </div>
            <div className="space-y-1.5">
              <Label>Role <span className="text-red-400">*</span></Label>
              <Controller
                name="role"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="employee">Employee</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Email <span className="text-red-400">*</span></Label>
              <Input
                {...register('email', {
                  required: 'Email is required',
                  pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Invalid email' },
                })}
                type="email"
                placeholder="john@example.com"
                disabled={isEdit}
                className={isEdit ? 'opacity-60' : ''}
              />
              <FieldError error={errors.email} />
            </div>

            {!isEdit && (
              <div className="space-y-1.5">
                <Label>Temporary Password <span className="text-red-400">*</span></Label>
                <Input
                  {...register('temp_password', {
                    required: 'Password is required',
                    minLength: { value: 8, message: 'Min 8 characters' },
                  })}
                  type="password"
                  placeholder="Min 8 characters"
                />
                <FieldError error={errors.temp_password} />
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input
                {...register('phone')}
                onKeyDown={phoneKeyDown}
                onPaste={phonePaste}
                type="tel"
                inputMode="numeric"
                maxLength={10}
                placeholder="9876543210"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Date of Birth</Label>
              <Input {...register('date_of_birth')} type="date" />
            </div>

            <div className="space-y-1.5">
              <Label>Date of Joining</Label>
              <Input {...register('date_of_joining')} type="date" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Address</Label>
            <Input {...register('address')} placeholder="Full address" />
          </div>

          {/* ── Employment Details ──────────────────────────────────────── */}
          <SectionDivider label="Employment Details" />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Monthly Salary (₹)</Label>
              <Input
                {...register('monthly_salary')}
                type="number"
                min={0}
                step="0.01"
                placeholder="0.00"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Commission Type</Label>
              <Controller
                name="commission_type"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="flat">Flat (per sale)</SelectItem>
                      <SelectItem value="percentage">Percentage (%)</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            {commType === 'flat' && (
              <div className="space-y-1.5">
                <Label>Commission Amount (₹ per sale)</Label>
                <Input {...register('commission_value')} type="number" min={0} step="0.01" placeholder="0.00" />
              </div>
            )}
            {commType === 'percentage' && (
              <div className="space-y-1.5">
                <Label>Commission %</Label>
                <Input {...register('commission_percentage')} type="number" min={0} max={100} step="0.1" placeholder="0.0" />
              </div>
            )}
          </div>

          {/* ── Bank & Emergency ────────────────────────────────────────── */}
          <SectionDivider label="Bank & Emergency" />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Bank Name</Label>
              <Input {...register('bank_name')} placeholder="State Bank of India" />
            </div>
            <div className="space-y-1.5">
              <Label>Account Number</Label>
              <Input {...register('bank_account')} placeholder="1234567890" />
            </div>
            <div className="space-y-1.5">
              <Label>IFSC Code</Label>
              <Input
                {...register('bank_ifsc')}
                placeholder="SBIN0001234"
                className="font-mono"
                maxLength={11}
                onChange={(e) => setValue('bank_ifsc', e.target.value.toUpperCase())}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Emergency Contact</Label>
              <Input
                {...register('emergency_contact')}
                onKeyDown={phoneKeyDown}
                onPaste={phonePaste}
                type="tel"
                inputMode="numeric"
                maxLength={10}
                placeholder="9876543210"
              />
            </div>
            <div className="space-y-1.5">
              <Label>ID Proof Type</Label>
              <Controller
                name="id_proof_type"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value || ''}>
                    <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="aadhar">Aadhar Card</SelectItem>
                      <SelectItem value="pan">PAN Card</SelectItem>
                      <SelectItem value="passport">Passport</SelectItem>
                      <SelectItem value="driving_license">Driving License</SelectItem>
                      <SelectItem value="voter_id">Voter ID</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-1.5">
              <Label>ID Proof Number</Label>
              <Input {...register('id_proof_number')} placeholder="XXXX XXXX XXXX" className="font-mono" />
            </div>
          </div>

          {/* ── Permissions ─────────────────────────────────────────────── */}
          <SectionDivider label="Permissions" />

          {/* Template buttons */}
          <div className="flex gap-2 flex-wrap">
            <Button
              type="button" size="sm" variant="outline"
              className="text-xs"
              onClick={() => applyTemplate(JUNIOR_DEFAULTS)}
            >
              Apply Junior Staff Template
            </Button>
            <Button
              type="button" size="sm" variant="outline"
              className="text-xs"
              onClick={() => applyTemplate(SENIOR_DEFAULTS)}
            >
              Apply Senior Staff Template
            </Button>
          </div>

          <div className="space-y-4">
            {PERM_GROUPS.map((group) => (
              <div key={group.label}>
                <p className="text-xs font-semibold text-muted-foreground mb-2">{group.label}</p>
                <div className="space-y-2.5">
                  {group.perms.map(({ key, label }) => (
                    <div key={key} className="flex items-center justify-between">
                      <Label className="text-sm font-normal cursor-pointer" htmlFor={key}>{label}</Label>
                      <Controller
                        name={key}
                        control={control}
                        render={({ field }) => (
                          <Switch
                            id={key}
                            checked={Boolean(field.value)}
                            onCheckedChange={field.onChange}
                          />
                        )}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2 border-t border-border">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-indigo-500 hover:bg-indigo-600 text-white min-w-[140px]"
            >
              {isSubmitting
                ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Saving…</>
                : isEdit ? 'Save Changes' : 'Add Employee'
              }
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
