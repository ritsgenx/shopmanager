import React from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Loader2 } from 'lucide-react'

export default function SuperAdminRoute() {
  const { currentUser, isLoading, isAuthenticated } = useAuth()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (currentUser?.role !== 'super_admin') return <Navigate to="/dashboard" replace />

  return <Outlet />
}
