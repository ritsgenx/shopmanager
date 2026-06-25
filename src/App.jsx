import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import { useAuth } from '@/context/AuthContext'
import AppLayout from '@/components/layout/AppLayout'
import ProtectedRoute from '@/components/shared/ProtectedRoute'
import SuperAdminRoute from '@/components/shared/SuperAdminRoute'
import Login from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
import Inventory from '@/pages/Inventory'
import Sales from '@/pages/Sales'
import Customers from '@/pages/Customers'
import Employees from '@/pages/Employees'
import Attendance from '@/pages/Attendance'
import Reports from '@/pages/Reports'
import Settings from '@/pages/Settings'
import Purchases from '@/pages/Purchases'
import NewPurchase from '@/pages/NewPurchase'
import NewSale from '@/pages/NewSale'
import Commissions from '@/pages/Commissions'
import SuperAdmin from '@/pages/SuperAdmin'
import AuthCallback from '@/pages/AuthCallback'

function RootRedirect() {
  const { currentUser, isLoading } = useAuth()
  if (isLoading) return null
  return <Navigate to={currentUser?.role === 'super_admin' ? '/super-admin' : '/dashboard'} replace />
}

export default function App() {
  return (
    <>
      <Toaster position="top-right" richColors closeButton />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/auth/callback" element={<AuthCallback />} />

        {/* Super admin panel — only accessible to super_admin role */}
        <Route element={<SuperAdminRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/super-admin" element={<SuperAdmin />} />
          </Route>
        </Route>

        {/* Regular app — admin + employee */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/sales" element={<Sales />} />
            <Route path="/sales/new" element={<NewSale />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/employees" element={<Employees />} />
            <Route path="/attendance" element={<Attendance />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/purchases" element={<Purchases />} />
            <Route path="/purchases/new" element={<NewPurchase />} />
            <Route path="/commissions" element={<Commissions />} />
          </Route>
        </Route>

        <Route index element={<RootRedirect />} />
        <Route path="*" element={<RootRedirect />} />
      </Routes>
    </>
  )
}
