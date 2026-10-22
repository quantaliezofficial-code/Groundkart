import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { authApi } from './api/auth';
import { restoreSession, setAccessToken } from './api/client';
import type { UserMe } from './api/types';

interface AuthContextValue {
  user: UserMe | null;
  /** True only during the initial page-load session check (restoreSession) — not while login/signup are in flight, which callers track themselves. */
  isLoading: boolean;
  login: (email: string, password: string) => Promise<UserMe>;
  signup: (name: string, email: string, password: string, phone: string) => Promise<UserMe>;
  logout: () => Promise<void>;
  /** Re-fetches /users/me against the current session — e.g. an owner
   * applicant checking "was I approved yet?" without a full logout/login
   * cycle, since role changes happen out-of-band (an admin approving
   * their verification) and nothing else refreshes this on its own. */
  refreshUser: () => Promise<UserMe | null>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserMe | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Runs once, before anything that depends on "am I logged in" renders
  // for real — see client.ts's restoreSession() docstring for why this
  // is what makes a page refresh not force a re-login.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const restored = await restoreSession();
      if (restored && !cancelled) {
        try {
          const me = await authApi.me();
          if (!cancelled) setUser(me);
        } catch {
          if (!cancelled) setUser(null);
        }
      }
      if (!cancelled) setIsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { access_token } = await authApi.login(email, password);
    setAccessToken(access_token);
    const me = await authApi.me();
    setUser(me);
    return me;
  }, []);

  const signup = useCallback(
    async (name: string, email: string, password: string, phone: string) => {
      await authApi.signup(name, email, password, phone);
      // signup deliberately doesn't log the user in on its own (the
      // backend keeps the two separate) — logging in immediately after,
      // with the same credentials, makes "sign up" feel like one step
      // instead of two from the user's side.
      return login(email, password);
    },
    [login],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      // Clear local state even if the network call fails — a logout
      // that appears to silently do nothing on a flaky connection is
      // worse than one that's locally effective immediately.
      setAccessToken(null);
      setUser(null);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const me = await authApi.me();
      setUser(me);
      return me;
    } catch {
      // Session no longer valid — leave user as whatever it already was
      // rather than guessing; the next request that actually needs auth
      // will surface a real 401 if that's genuinely what happened.
      return user;
    }
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, signup, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
