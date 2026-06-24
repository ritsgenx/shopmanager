import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import AppLayout from '@/components/layout/AppLayout'
import ProtectedRoute from '@/components/shared/ProtectedRoute'
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

export default function App() {
  return (
    <>
      <Toaster position="top-right" richColors closeButton />
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
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

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </>
  )
}
