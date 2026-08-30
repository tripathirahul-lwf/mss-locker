import { useAuth } from './useAuth';

export function usePermission(permission?: string): boolean {
  const { hasPermission } = useAuth();
  return hasPermission(permission);
}
