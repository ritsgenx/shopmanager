import { useAuth } from '@/context/AuthContext'

// Returns a function `can(permKey)` that checks if the current user is allowed.
// Admins always return true. Employees check their employee_permissions row.
export function usePermissions() {
  const { currentUser, currentPermissions } = useAuth()

  function can(permKey) {
    if (!currentUser) return false
    if (currentUser.role === 'admin') return true
    return Boolean(currentPermissions?.[permKey])
  }

  return { can }
}
