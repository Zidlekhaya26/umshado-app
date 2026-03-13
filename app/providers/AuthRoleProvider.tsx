"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";

type Role = "vendor" | "couple" | null;

type AuthRoleContextValue = {
  user: User | null;
  role: Role;
  loading: boolean;
  refreshRole: () => Promise<void>;
};

const AuthRoleContext = createContext<AuthRoleContextValue | null>(null);

async function fetchRole(userId: string): Promise<Role> {
  try {
    const p = (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("active_role")
        .eq("id", userId)
        .maybeSingle();
      return { data, error } as any;
    })();

    const res: any = await Promise.race([
      p,
      new Promise((resolve) =>
        setTimeout(() => resolve({ data: null, error: new Error("timeout") }), 3000)
      ),
    ]);

    if (res?.error) {
      console.warn("AuthRoleProvider: failed to fetch role", res.error);
      return null;
    }

    const r = (res?.data?.active_role ?? null) as Role;
    return r === "vendor" || r === "couple" ? r : null;
  } catch (e) {
    console.warn("AuthRoleProvider: fetchRole error", e);
    return null;
  }
}

export function AuthRoleProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]     = useState<User | null>(null);
  const [role, setRole]     = useState<Role>(null);
  const [loading, setLoading] = useState(true);
  const userRef = useRef<User | null>(null);

  // Keep ref in sync for use in event handlers
  useEffect(() => { userRef.current = user; }, [user]);

  const refreshRole = useCallback(async () => {
    const uid = userRef.current?.id;
    if (!uid) { setRole(null); return; }
    const r = await fetchRole(uid);
    setRole(r);
  }, []);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      setLoading(true);
      try {
        const sessionRes: any = await Promise.race([
          supabase.auth.getSession(),
          new Promise((resolve) =>
            setTimeout(() => resolve({ data: { session: null } }), 4000)
          ),
        ]);

        let session = sessionRes?.data?.session ?? null;

        // If localStorage was cleared (app reopened after close), getSession()
        // returns null even though a valid refresh token is stored in a cookie.
        // Attempt a silent token refresh so the user stays logged in.
        if (!session && typeof document !== "undefined") {
          const refreshToken = (() => {
            const m = document.cookie.match(/(?:^|; )sb-refresh-token=([^;]*)/);
            return m ? decodeURIComponent(m[1]) : null;
          })();
          if (refreshToken) {
            try {
              const { data: rd } = await supabase.auth.refreshSession({ refresh_token: refreshToken });
              session = rd?.session ?? null;
            } catch (e) {
              console.warn("AuthRoleProvider: cookie refresh failed", e);
            }
          }
        }

        const u = session?.user ?? null;
        if (!mounted) return;
        setUser(u);

        if (u?.id) {
          const r = await fetchRole(u.id);
          if (!mounted) return;
          setRole(r);
        } else {
          setRole(null);
        }
      } catch (e) {
        console.warn("AuthRoleProvider: init error", e);
        setUser(null);
        setRole(null);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    init();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      if (!mounted) return;
      setUser(u);

      (async () => {
        if (u?.id) {
          if (mounted) setLoading(true);
          const r = await fetchRole(u.id);
          if (!mounted) return;
          setRole(r);
          if (mounted) setLoading(false);
        } else {
          if (mounted) setRole(null);
          if (mounted) setLoading(false);
        }
      })();
    });

    // Re-fetch role when tab becomes visible again (after switch-role redirect)
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible" && userRef.current?.id) {
        fetchRole(userRef.current.id).then((r) => {
          if (mounted) setRole(r);
        });
      }
    };

    const onFocus = () => {
      if (userRef.current?.id) {
        fetchRole(userRef.current.id).then((r) => {
          if (mounted) setRole(r);
        });
      }
    };

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisibilityChange);
      window.addEventListener("focus", onFocus);
    }

    return () => {
      mounted = false;
      try { sub?.subscription?.unsubscribe?.(); } catch {}
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibilityChange);
        window.removeEventListener("focus", onFocus);
      }
    };
  }, []);

  const value = useMemo<AuthRoleContextValue>(
    () => ({ user, role, loading, refreshRole }),
    [user, role, loading, refreshRole]
  );

  return <AuthRoleContext.Provider value={value}>{children}</AuthRoleContext.Provider>;
}

export function useAuthRole() {
  const ctx = useContext(AuthRoleContext);
  if (!ctx) throw new Error("useAuthRole must be used inside AuthRoleProvider");
  return ctx;
}
