/* oxlint-disable react/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { auth as authApi } from '../api';
import { getToken } from '../api/client';
import type { UserApi } from '../api/types';

export type UserRole = 'client' | 'vendor' | 'support' | 'admin' | 'carrier';

interface AuthContextValue {
  user: UserApi | null;
  loading: boolean;
  isAuthenticated: boolean;
  role: UserRole | null;
  login: (email: string, password: string) => Promise<UserApi>;
  register: (payload: {
    name: string;
    email: string;
    password: string;
    password_confirmation: string;
    phone?: string;
    role?: 'client' | 'vendor';
    shop_name?: string;
  }) => Promise<UserApi>;
  setUser: (user: UserApi | null) => void;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function roleOf(user: UserApi | null): UserRole | null {
  const names = user?.roles?.map((r) => r.name) ?? [];
  if (names.includes('admin')) return 'admin';
  if (names.includes('vendor')) return 'vendor';
  if (names.includes('support')) return 'support';
  if (names.includes('carrier')) return 'carrier';
  return names.includes('client') ? 'client' : 'client';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<UserApi | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setUserState(null);
      setLoading(false);
      return;
    }
    try {
      setUserState(await authApi.me());
    } catch {
      setUserState(null);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    void refresh().finally(() => setLoading(false));
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await authApi.login({ email, password });
    setUserState(res.user);
    return res.user;
  }, []);

  const register = useCallback(
    async (payload: Parameters<AuthContextValue['register']>[0]) => {
      const res = await authApi.register(payload);
      setUserState(res.user);
      return res.user;
    },
    [],
  );

  const setUser = useCallback((user: UserApi | null) => setUserState(user), []);

  const logout = useCallback(async () => {
    await authApi.logout();
    setUserState(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      role: roleOf(user),
      login,
      register,
      setUser,
      refresh,
      logout,
    }),
    [user, loading, login, register, setUser, refresh, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé dans <AuthProvider>');
  return ctx;
}
