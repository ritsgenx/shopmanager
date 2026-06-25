import React, { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useAuth } from '@/context/AuthContext'
import { createCustomer, updateCustomer } from '@/lib/customers'
import { PHONE_RULES, PHONE_RULES_OPTIONAL, phoneInputProps } from '@/lib/validations'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

const defaultValues = {
  customer_type: 'individual',
  full_name: '',
  company_name: '',
  contact_person: '',
  phone: '',
  whatsapp_number: '',
  same_as_phone: false,
  email: '',
  address: '',
  city: '',
  state: '',
  pincode: '',
  gstin: '',
  date_of_birth: '',
  anniversary_date: '',
  notes: '',
}

function FieldError({ error }) {
  if (!error) return null
  return <p className="text-red-500 text-xs mt-1">{error.message}</p>
}

function OptionalTag() {
  return <span className="text-muted-foreground font-normal text-xs ml-1">(optional)</span>
}

export default function CustomerDialog({ open, onOpenChange, customer, onSuccess }) {
  const isEdit = Boolean(customer)
  const { currentUser, currentTenant } = useAuth()

  const {
    register, control, handleSubmit, watch, setValue, reset,
    formState: { errors, isSubmitting },
  } = useForm({ defaultValues })

  const customerType = watch('customer_type')
  const phone = watch('phone')
  const sameAsPhone = watch('same_as_phone')
  const isIndividual = customerType === 'individual'

  useEffect(() => {
    if (sameAsPhone) setValue('whatsapp_number', phone)
  }, [sameAsPhone, phone, setValue])

  useEffect(() => {
    if (!open) return
    if (customer) {
      reset({
        ...defaultValues,
        ...customer,
        same_as_phone: Boolean(
          customer.whatsapp_number && customer.whatsapp_number === customer.phone
        ),
        date_of_birth: customer.date_of_birth ?? '',
        anniversary_date: customer.anniversary_date ?? '',
        notes: customer.notes ?? '',
      })
    } else {
      reset(defaultValues)
    }
  }, [open, customer, reset])

  const onSubmit = async (values) => {
    const { same_as_phone, ...rest } = values
    const payload = {
      ...rest,
      full_name: isIndividual ? values.full_name : null,
      company_name: !isIndividual ? values.company_name : null,
      contact_person: !isIndividual ? values.contact_person : null,
      gstin: !isIndividual ? (values.gstin || null) : null,
      date_of_birth: isIndividual && values.date_of_birth ? values.date_of_birth : null,
      anniversary_date: isIndividual && values.anniversary_date ? values.anniversary_date : null,
      whatsapp_number: values.whatsapp_number || null,
      email: values.email || null,
      address: values.address || null,
      city: values.city || null,
      state: values.state || null,
      pincode: values.pincode || null,
      notes: values.notes || null,
    }
    if (!isEdit) {
      payload.tenant_id = currentTenant.id
      payload.created_by = currentUser.id
      payload.total_purchases = 0
      payload.visit_count = 0
      payload.last_visit_date = null
      payload.is_active = true
    }

    const { error } = isEdit
      ? await updateCustomer(currentTenant.id, customer.id, payload)
      : await createCustomer(payload)

    if (error) {
      toast.error(error.message ?? 'Failed to save customer')
    } else {
      toast.success(isEdit ? 'Customer updated' : 'Customer added')
      onSuccess?.()
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl w-full max-h-[90vh] overflow-y-auto" onInteractOutside={(e) => e.preventDefault()}>
        <div className="px-6 pt-6 pb-2">
          <DialogHeader>
            <DialogTitle>{isEdit ? 'Edit Customer' : 'Add Customer'}</DialogTitle>
          </DialogHeader>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="px-6 pb-6 space-y-5">

          {/* Customer Type Toggle */}
          <div className="space-y-2">
            <Label>Customer Type</Label>
            <Controller
              name="customer_type"
              control={control}
              render={({ field }) => (
                <div className="flex rounded-lg border border-border p-1">
                  {[
                    { value: 'individual', label: '👤 Individual' },
                    { value: 'company', label: '🏢 Company' },
                  ].map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => field.onChange(value)}
                      className={cn(
                        'flex-1 py-2 text-sm font-medium rounded transition-colors',
                        field.value === value
                          ? 'bg-indigo-500 text-white'
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            />
          </div>

          {isIndividual ? (
            <>
              {/* Row 1: Full Name + Phone */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Full Name <span className="text-red-400">*</span></Label>
                  <Input
                    {...register('full_name', { required: 'Full name is required' })}
                    placeholder="John Doe"
                  />
                  <FieldError error={errors.full_name} />
                </div>
                <div className="space-y-1.5">
                  <Label>Phone <span className="text-red-400">*</span></Label>
                  <Input
                    {...register('phone', PHONE_RULES)}
                    {...phoneInputProps}
                    placeholder="9876543210"
                  />
                  <FieldError error={errors.phone} />
                </div>
              </div>

              {/* Row 2: WhatsApp + Email */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label>WhatsApp<OptionalTag /></Label>
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
                      <input
                        type="checkbox"
                        {...register('same_as_phone')}
                        className="w-3.5 h-3.5 accent-indigo-500"
                      />
                      Same as phone
                    </label>
                  </div>
                  <Input
                    {...register('whatsapp_number', PHONE_RULES_OPTIONAL)}
                    {...phoneInputProps}
                    placeholder="9876543210"
                    disabled={sameAsPhone}
                    className={sameAsPhone ? 'opacity-50' : ''}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Email<OptionalTag /></Label>
                  <Input
                    {...register('email', {
                      validate: v => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || 'Enter a valid email',
                    })}
                    type="email"
                    placeholder="john@email.com"
                  />
                  <FieldError error={errors.email} />
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-border pt-1">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Address</p>
              </div>

              {/* Address */}
              <div className="space-y-1.5">
                <Label>Street Address<OptionalTag /></Label>
                <Input {...register('address')} placeholder="123, Street Name, Area" />
              </div>
              <div className="grid grid-cols-4 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <Label>City</Label>
                  <Input {...register('city')} placeholder="Indore" />
                </div>
                <div className="space-y-1.5">
                  <Label>State</Label>
                  <Input {...register('state')} placeholder="MP" />
                </div>
                <div className="space-y-1.5">
                  <Label>Pincode</Label>
                  <Input {...register('pincode')} placeholder="452001" maxLength={6} />
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-border pt-1">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Personal Dates</p>
              </div>

              {/* DOB + Anniversary */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Date of Birth<OptionalTag /></Label>
                  <Input {...register('date_of_birth')} type="date" />
                </div>
                <div className="space-y-1.5">
                  <Label>Anniversary<OptionalTag /></Label>
                  <Input {...register('anniversary_date')} type="date" />
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Row 1: Company Name + Contact Person */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Company Name <span className="text-red-400">*</span></Label>
                  <Input
                    {...register('company_name', { required: 'Company name is required' })}
                    placeholder="ABC Electronics Pvt Ltd"
                  />
                  <FieldError error={errors.company_name} />
                </div>
                <div className="space-y-1.5">
                  <Label>Contact Person <span className="text-red-400">*</span></Label>
                  <Input
                    {...register('contact_person', { required: 'Contact person is required' })}
                    placeholder="John Doe"
                  />
                  <FieldError error={errors.contact_person} />
                </div>
              </div>

              {/* Row 2: Phone + WhatsApp */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Phone <span className="text-red-400">*</span></Label>
                  <Input
                    {...register('phone', PHONE_RULES)}
                    {...phoneInputProps}
                    placeholder="9876543210"
                  />
                  <FieldError error={errors.phone} />
                </div>
                <div className="space-y-1.5">
                  <Label>WhatsApp<OptionalTag /></Label>
                  <Input
                    {...register('whatsapp_number', PHONE_RULES_OPTIONAL)}
                    {...phoneInputProps}
                    placeholder="9876543210"
                  />
                </div>
              </div>

              {/* Row 3: Email + GSTIN */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Email<OptionalTag /></Label>
                  <Input
                    {...register('email', {
                      validate: v => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || 'Enter a valid email',
                    })}
                    type="email"
                    placeholder="info@company.com"
                  />
                  <FieldError error={errors.email} />
                </div>
                <div className="space-y-1.5">
                  <Label>GSTIN <span className="text-red-400">*</span></Label>
                  <Input
                    {...register('gstin', {
                      required: 'GSTIN is required',
                      minLength: { value: 15, message: 'Must be 15 characters' },
                      maxLength: { value: 15, message: 'Must be 15 characters' },
                    })}
                    placeholder="23AAAAA0000A1Z5"
                    className="font-mono"
                    maxLength={15}
                  />
                  <FieldError error={errors.gstin} />
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-border pt-1">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Address</p>
              </div>

              {/* Address */}
              <div className="space-y-1.5">
                <Label>Street Address<OptionalTag /></Label>
                <Input {...register('address')} placeholder="123, Street Name, Area" />
              </div>
              <div className="grid grid-cols-4 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <Label>City</Label>
                  <Input {...register('city')} placeholder="Indore" />
                </div>
                <div className="space-y-1.5">
                  <Label>State</Label>
                  <Input {...register('state')} placeholder="MP" />
                </div>
                <div className="space-y-1.5">
                  <Label>Pincode</Label>
                  <Input {...register('pincode')} placeholder="452001" maxLength={6} />
                </div>
              </div>
            </>
          )}

          {/* Notes — common to both */}
          <div className="border-t border-border pt-4 space-y-1.5">
            <Label>Notes<OptionalTag /></Label>
            <Textarea
              {...register('notes')}
              placeholder="Any additional notes about this customer..."
              rows={3}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-1">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-indigo-500 hover:bg-indigo-600 text-white min-w-[130px]"
            >
              {isSubmitting
                ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Saving…</>
                : isEdit ? 'Save Changes' : 'Add Customer'
              }
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
