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
    return { user: null, tenant: null, permissions: null }
  }

  if (!userRow) return { user: null, tenant: null, permissions: null }

  // Super admin has no tenant or permissions
  if (userRow.role === 'super_admin') {
    return { user: userRow, tenant: null, permissions: null }
  }

  const [{ data: tenantRow, error: tenantError }, { data: permRow }] = await Promise.all([
    supabase.from('tenants').select('*').eq('id', userRow.tenant_id).single(),
    userRow.role !== 'admin'
      ? supabase.from('employee_permissions').select('*').eq('user_id', userId).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  if (tenantError) {
    console.error('[AuthContext] tenants table error:', tenantError.message)
  }

  // Block login if tenant has been deactivated
  if (tenantRow && !tenantRow.is_active) {
    await supabase.auth.signOut()
    return { user: null, tenant: null, permissions: null, suspended: true }
  }

  return { user: userRow, tenant: tenantRow ?? null, permissions: permRow ?? null }
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null)
  const [currentTenant, setCurrentTenant] = useState(null)
  const [currentPermissions, setCurrentPermissions] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  const isAuthenticated = !!currentUser

  useEffect(() => {
    // Restore session on page refresh
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const { user, tenant, permissions } = await fetchProfile(session.user.id)
        setCurrentUser(user)
        setCurrentTenant(tenant)
        setCurrentPermissions(permissions)
      }
      setIsLoading(false)
    })

    // Only need to watch for logouts here; login is handled by signIn() below
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setCurrentUser(null)
        setCurrentTenant(null)
        setCurrentPermissions(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // Runs auth + profile fetch together so Login always gets a clear result
  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error }

    const { user, tenant, permissions, suspended } = await fetchProfile(data.user.id)

    if (suspended) {
      return { error: { message: 'Your account has been suspended. Please contact support.' } }
    }

    if (!user) {
      await supabase.auth.signOut()
      return {
        error: {
          message: 'Account not set up in this system. Please contact your administrator.',
        },
      }
    }

    setCurrentUser(user)
    setCurrentTenant(tenant)
    setCurrentPermissions(permissions)
    return { data, user }
  }

  const logout = async () => {
    await supabase.auth.signOut()
    // SIGNED_OUT handler above clears currentUser / currentTenant / currentPermissions
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

  const isSuperAdmin = currentUser?.role === 'super_admin'

  const value = { currentUser, currentTenant, currentPermissions, isSuperAdmin, isLoading, isAuthenticated, signIn, logout, refreshTenant }

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
