import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

async function fetchProfile(userId) {
  const { data: userRow, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single()

  if (userError) {
    console.error('[AuthContext] users table error:', userError.message)
    return { user: null, tenant: null }
  }

  if (!userRow) return { user: null, tenant: null }

  const { data: tenantRow, error: tenantError } = await supabase
    .from('tenants')
    .select('*')
    .eq('id', userRow.tenant_id)
    .single()

  if (tenantError) {
    console.error('[AuthContext] tenants table error:', tenantError.message)
  }

  return { user: userRow, tenant: tenantRow ?? null }
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null)
  const [currentTenant, setCurrentTenant] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  const isAuthenticated = !!currentUser

  useEffect(() => {
    // Restore session on page refresh
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const { user, tenant } = await fetchProfile(session.user.id)
        setCurrentUser(user)
        setCurrentTenant(tenant)
      }
      setIsLoading(false)
    })

    // Only need to watch for logouts here; login is handled by signIn() below
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setCurrentUser(null)
        setCurrentTenant(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // Runs auth + profile fetch together so Login always gets a clear result
  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error }

    const { user, tenant } = await fetchProfile(data.user.id)
    if (!user) {
      // Auth passed but no row in our users table — sign back out so session isn't dangling
      await supabase.auth.signOut()
      return {
        error: {
          message: 'Account not set up in this system. Please contact your administrator.',
        },
      }
    }

    setCurrentUser(user)
    setCurrentTenant(tenant)
    return { data }
  }

  const logout = async () => {
    await supabase.auth.signOut()
    // SIGNED_OUT handler above clears currentUser / currentTenant
  }

  // Re-fetches the tenant row and updates context — call after saving settings
  const refreshTenant = async () => {
    if (!currentUser?.tenant_id) return
    const { data } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', currentUser.tenant_id)
      .single()
    if (data) setCurrentTenant(data)
  }

  const value = { currentUser, currentTenant, isLoading, isAuthenticated, signIn, logout, refreshTenant }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
