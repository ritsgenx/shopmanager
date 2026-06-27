import React, { createContext, useContext, useEffect, useState } from 'react'

const ThemeContext = createContext({ theme: 'auto', setTheme: () => {} })

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => localStorage.getItem('theme') ?? 'auto')

  useEffect(() => {
    const root = document.documentElement
    root.classList.remove('dark', 'dim')
    if (theme === 'dark') root.classList.add('dark')
    else if (theme === 'dim') root.classList.add('dim')
    else if (theme === 'auto') {
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) root.classList.add('dark')
    }
  }, [theme])

  // Keep auto mode in sync if OS theme changes while app is open
  useEffect(() => {
    if (theme !== 'auto') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e) => {
      document.documentElement.classList.remove('dark', 'dim')
      if (e.matches) document.documentElement.classList.add('dark')
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [theme])

  const setTheme = (t) => {
    localStorage.setItem('theme', t)
    setThemeState(t)
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
