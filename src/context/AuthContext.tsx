import { createContext, use, useState, useEffect, useCallback, type ReactNode } from 'react';
import { authApi } from '../api/auth';
import type { AuthUser } from '../types/api';

interface AuthContextValue {
  user:      AuthUser | null;
  isLoading: boolean;
  login:     (email: string, password: string) => Promise<void>;
  logout:    () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,      setUser]    = useState<AuthUser | null>(null);
  const [isLoading, setLoading] = useState(true);

  useEffect(() => {
    authApi.me()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { user: authUser } = await authApi.login(email, password);
    setUser(authUser);
  }, []);

  const logout = useCallback(async () => {
    try { await authApi.logout(); } catch { /* ignore */ }
    setUser(null);
  }, []);

  return (
    <AuthContext value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = use(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

// ── Convenience helpers ───────────────────────────────────────────────────────

export function useIsSuperAdmin() { return useAuth().user?.role === 'super_admin'; }
export function useIsOrgAdmin()   { return useAuth().user?.role === 'org_admin'; }
export function useIsManager()    {
  const role = useAuth().user?.role;
  return role === 'org_admin' || role === 'supervisor' || role === 'super_admin';
}
