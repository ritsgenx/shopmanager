import React, { useState, useEffect, useRef } from 'react'
import { Outlet, useLocation, useNavigationType } from 'react-router-dom'
import Sidebar from './Sidebar'
import Navbar from './Navbar'
import { PendingCountProvider } from '@/context/PendingCountContext'

export default function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  const navType = useNavigationType()
  const mainRef = useRef(null)
  const scrollPositions = useRef({})

  useEffect(() => {
    const el = mainRef.current
    if (!el) return

    let cancelled = false

    if (navType === 'POP') {
      const target = scrollPositions.current[location.pathname] || 0
      if (target > 0) {
        // Retry until the content is tall enough to hold the target scroll.
        // Necessary because the page may be in a loading state when restoration runs.
        const restore = () => {
          if (cancelled || !mainRef.current) return
          mainRef.current.scrollTop = target
          if (mainRef.current.scrollTop < target - 10) {
            setTimeout(restore, 100)
          }
        }
        setTimeout(restore, 50)
      }
    } else {
      el.scrollTop = 0
    }

    const handleScroll = () => {
      scrollPositions.current[location.pathname] = el.scrollTop
    }
    el.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      cancelled = true
      el.removeEventListener('scroll', handleScroll)
    }
  }, [location.pathname])

  return (
    <PendingCountProvider>
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Mobile backdrop — tapping it closes the sidebar */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Navbar onMenuClick={() => setMobileOpen(true)} />
        <main ref={mainRef} className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
    </PendingCountProvider>
  )
}
