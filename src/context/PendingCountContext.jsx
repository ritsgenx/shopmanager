import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { useAuth } from './AuthContext'
import { supabase } from '@/lib/supabase'

const PendingCountContext = createContext({ pendingCount: 0, refreshCount: () => {} })

export function PendingCountProvider({ children }) {
  const { currentTenant, currentUser } = useAuth()
  const isOwner = currentUser?.role === 'admin'
  const [pendingCount, setPendingCount] = useState(0)

  const refreshCount = useCallback(async () => {
    if (!isOwner || !currentTenant?.id) { setPendingCount(0); return }
    const { count } = await supabase
      .from('inventory')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', currentTenant.id)
      .eq('approval_status', 'pending')
    setPendingCount(count ?? 0)
  }, [isOwner, currentTenant?.id])

  useEffect(() => {
    refreshCount()
    const interval = setInterval(refreshCount, 60_000)
    return () => clearInterval(interval)
  }, [refreshCount])

  return (
    <PendingCountContext.Provider value={{ pendingCount, refreshCount }}>
      {children}
    </PendingCountContext.Provider>
  )
}

export function usePendingCount() {
  return useContext(PendingCountContext)
}
