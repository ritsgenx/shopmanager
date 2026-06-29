import React, { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Bell, Search, Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/context/AuthContext'
import { getPendingApprovals } from '@/lib/inventory'

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

export default function Navbar({ onMenuClick }) {
  const location = useLocation()
  const navigate = useNavigate()
  const title = pageLabels[location.pathname] ?? 'MobileShop'
  const { currentTenant, currentUser } = useAuth()
  const isOwner = currentUser?.role === 'admin'
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    if (!isOwner || !currentTenant?.id) return
    let cancelled = false

    const fetchCount = async () => {
      const { data } = await getPendingApprovals(currentTenant.id)
      if (!cancelled) setPendingCount(data?.length ?? 0)
    }

    fetchCount()
    // Refresh every 60 seconds so the badge stays accurate
    const interval = setInterval(fetchCount, 60_000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [isOwner, currentTenant?.id])

  return (
    <header className="flex items-center justify-between px-4 md:px-6 py-4 bg-background border-b border-border shadow-sm">
      <div className="flex items-center gap-3">
        {/* Hamburger — mobile only */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden shrink-0"
          onClick={onMenuClick}
        >
          <Menu className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-xl font-semibold text-foreground">{title}</h1>
          <p className="text-xs text-muted-foreground hidden sm:block">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search..." className="pl-9 w-56 h-9" />
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          onClick={() => isOwner && navigate('/dashboard')}
          title={isOwner && pendingCount > 0 ? `${pendingCount} item${pendingCount === 1 ? '' : 's'} pending approval` : undefined}
        >
          <Bell className="w-5 h-5" />
          {isOwner && pendingCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-yellow-500 text-black text-[10px] font-bold flex items-center justify-center px-1 leading-none">
              {pendingCount > 99 ? '99+' : pendingCount}
            </span>
          )}
        </Button>
      </div>
    </header>
  )
}
