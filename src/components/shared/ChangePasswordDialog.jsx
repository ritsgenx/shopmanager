import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { KeyRound, Loader2, Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'

function PasswordInput({ registration, placeholder, error }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <Input
        {...registration}
        type={show ? 'text' : 'password'}
        placeholder={placeholder}
        className="pr-10"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        tabIndex={-1}
      >
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
      {error && <p className="text-red-400 text-xs mt-1">{error.message}</p>}
    </div>
  )
}

export default function ChangePasswordDialog({ trigger }) {
  const [open, setOpen] = useState(false)

  const {
    register, handleSubmit, watch, reset,
    formState: { errors, isSubmitting },
  } = useForm()

  const onSubmit = async ({ newPassword }) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) {
      toast.error(error.message ?? 'Failed to change password')
      return
    }
    toast.success('Password changed successfully')
    reset()
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={(val) => { setOpen(val); if (!val) reset() }}>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-indigo-400" />
            Change Password
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>New Password</Label>
            <PasswordInput
              registration={register('newPassword', {
                required: 'New password is required',
                minLength: { value: 6, message: 'Minimum 6 characters' },
              })}
              placeholder="Enter new password"
              error={errors.newPassword}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Confirm New Password</Label>
            <PasswordInput
              registration={register('confirmPassword', {
                required: 'Please confirm your password',
                validate: (v) => v === watch('newPassword') || 'Passwords do not match',
              })}
              placeholder="Re-enter new password"
              error={errors.confirmPassword}
            />
          </div>

          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-indigo-500 hover:bg-indigo-600 text-white"
          >
            {isSubmitting
              ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Updating…</>
              : 'Update Password'
            }
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
