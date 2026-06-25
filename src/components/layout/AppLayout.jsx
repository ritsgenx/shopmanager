import React, { useState, useEffect, useRef } from 'react'
import { Outlet, useLocation, useNavigationType } from 'react-router-dom'
import Sidebar from './Sidebar'
import Navbar from './Navbar'

export default function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  const navType = useNavigationType()
  const mainRef = useRef(null)
  const scrollPositions = useRef({})

  useEffect(() => {
    const el = mainRef.current
    if (!el) return

    if (navType === 'POP') {
      // Back / forward button — restore the saved position
      requestAnimationFrame(() => {
        el.scrollTop = scrollPositions.current[location.pathname] || 0
      })
    } else {
      // Normal forward navigation — start at top
      el.scrollTop = 0
    }

    // Continuously save scroll position for the current path
    const handleScroll = () => {
      scrollPositions.current[location.pathname] = el.scrollTop
    }
    el.addEventListener('scroll', handleScroll, { passive: true })
    return () => el.removeEventListener('scroll', handleScroll)
  }, [location.pathname])

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
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
  )
}
