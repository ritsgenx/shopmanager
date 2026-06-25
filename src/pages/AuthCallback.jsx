import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, Store } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'

export default function AuthCallback() {
  const { isAuthenticated, isLoading, currentUser } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (isLoading) return
    if (isAuthenticated) {
      navigate(
        currentUser?.role === 'super_admin' ? '/super-admin' : '/dashboard',
        { replace: true }
      )
    } else {
      navigate('/login', { replace: true })
    }
  }, [isLoading, isAuthenticated, currentUser, navigate])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 gap-4">
      <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-500 shadow-lg shadow-indigo-500/30">
        <Store className="w-8 h-8 text-white" />
      </div>
      <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
      <p className="text-slate-400 text-sm">Verifying your account…</p>
    </div>
  )
}
