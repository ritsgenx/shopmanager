import React from 'react'
import { useLocation } from 'react-router-dom'
import { Bell, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const pageLabels = {
  '/dashboard': 'Dashboard',
  '/inventory': 'Inventory',
  '/sales': 'Sales',
  '/customers': 'Customers',
  '/employees': 'Employees',
  '/attendance': 'Attendance',
  '/reports': 'Reports',
  '/settings': 'Settings',
  '/super-admin': 'Platform Administration',
}

export default function Navbar() {
  const location = useLocation()
  const title = pageLabels[location.pathname] ?? 'MobileShop'

  return (
    <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-border shadow-sm">
      <div>
        <h1 className="text-xl font-semibold text-foreground">{title}</h1>
        <p className="text-xs text-muted-foreground">
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search..." className="pl-9 w-56 h-9" />
        </div>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500" />
        </Button>
      </div>
    </header>
  )
}
