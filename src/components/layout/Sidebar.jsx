import React, { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, Package, ShoppingCart, Users, UserCheck,
  CalendarCheck, BarChart3, Settings, LogOut, ChevronLeft,
  ChevronRight, Store, ShoppingBag, Wallet, KeyRound, ShieldCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/context/AuthContext'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import ChangePasswordDialog from '@/components/shared/ChangePasswordDialog'

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/inventory', icon: Package, label: 'Inventory' },
  { to: '/purchases', icon: ShoppingBag, label: 'Purchases', adminOnly: true },
  { to: '/sales', icon: ShoppingCart, label: 'Sales' },
  { to: '/customers', icon: Users, label: 'Customers' },
  { to: '/employees', icon: UserCheck, label: 'Employees' },
  { to: '/attendance',   icon: CalendarCheck, label: 'Attendance' },
  { to: '/commissions',  icon: Wallet,        label: 'Commissions' },
  { to: '/reports',      icon: BarChart3,     label: 'Reports' },
  { to: '/settings', icon: Settings, label: 'Settings', adminOnly: true },
]

const superAdminNav = [
  { to: '/super-admin', icon: ShieldCheck, label: 'Platform Admin' },
]

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const { currentUser, currentTenant, logout } = useAuth()
  const navigate = useNavigate()

  const isSuperAdmin = currentUser?.role === 'super_admin'
  const shopName = isSuperAdmin ? 'Platform Admin' : (currentTenant?.shop_name ?? 'MobileShop')
  const shopSubtitle = isSuperAdmin ? 'SaaS Administration' : 'Management System'
  const userName = currentUser?.full_name ?? currentUser?.email ?? 'User'
  const userRole = isSuperAdmin ? 'Super Admin' : (currentUser?.role ?? 'Staff')
  const avatarInitials = userName.slice(0, 2).toUpperCase()
  const employeeDisplayId = currentUser?.role === 'employee' && currentUser?.id
    ? `EMP-${currentUser.id.slice(0, 6).toUpperCase()}`
    : null
  const activeNav = isSuperAdmin ? superAdminNav : navItems

  const handleSignOut = async () => {
    try {
      await logout()
      toast.success('Signed out successfully')
      navigate('/login')
    } catch {
      toast.error('Failed to sign out')
    }
  }

  return (
    <motion.aside
      animate={{ width: collapsed ? 72 : 240 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="relative flex flex-col h-screen bg-slate-900 text-white shadow-xl shrink-0 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-slate-700">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-indigo-500 shrink-0">
          <Store className="w-5 h-5 text-white" />
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <p className="text-sm font-bold text-white whitespace-nowrap">{shopName}</p>
              <p className="text-xs text-slate-400 whitespace-nowrap">{shopSubtitle}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Toggle button */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-16 z-10 flex items-center justify-center w-6 h-6 rounded-full bg-indigo-500 hover:bg-indigo-600 transition-colors shadow-lg"
      >
        {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
      </button>

      {/* Nav items */}
      <nav className="flex-1 py-4 overflow-y-auto overflow-x-hidden">
        <ul className="space-y-1 px-2">
          {activeNav.filter(item => !(item.adminOnly && currentUser?.role === 'employee')).map(({ to, icon: Icon, label }) => (
            <li key={to}>
              <NavLink
                to={to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group',
                    isActive
                      ? 'bg-indigo-500 text-white shadow-md'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  )
                }
              >
                <Icon className="w-5 h-5 shrink-0" />
                <AnimatePresence>
                  {!collapsed && (
                    <motion.span
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      transition={{ duration: 0.2 }}
                      className="whitespace-nowrap"
                    >
                      {label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <Separator className="bg-slate-700" />

      {/* User footer */}
      <div className="px-2 py-3">
        <div className={cn('flex items-center gap-3 px-2 py-2 rounded-lg', !collapsed && 'mb-2')}>
          <Avatar className="w-8 h-8 shrink-0">
            <AvatarFallback className="bg-indigo-600 text-white text-xs">
              {avatarInitials}
            </AvatarFallback>
          </Avatar>
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="overflow-hidden flex-1 min-w-0"
              >
                <p className="text-xs font-medium text-white truncate">{userName}</p>
                <p className="text-xs text-slate-400 capitalize">{userRole}</p>
                {employeeDisplayId && (
                  <p className="text-xs text-indigo-400 font-mono mt-0.5">{employeeDisplayId}</p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <ChangePasswordDialog
          trigger={
            <button
              type="button"
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
            >
              <KeyRound className="w-5 h-5 shrink-0" />
              <AnimatePresence>
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="whitespace-nowrap"
                  >
                    Change Password
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          }
        />

        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-colors"
        >
          <LogOut className="w-5 h-5 shrink-0" />
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="whitespace-nowrap"
              >
                Sign Out
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>
    </motion.aside>
  )
}
