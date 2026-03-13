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
  const [user, setUser]       = useState<User | null>(null);
  const [role, setRole]       = useState<Role>(null);
  const [loading, setLoading] = useState(true);
  const userRef      = useRef<User | null>(null);
  const initDoneRef  = useRef(false);

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
        // ── Step 1: getUser() ─────────────────────────────────────────────────
        // Unlike getSession(), getUser() awaits the SDK's internal
        // initializePromise which includes any pending autoRefreshToken call.
        // This means:
        //   • expired access token  → SDK refreshes first, then getUser() succeeds
        //   • valid access token    → getUser() succeeds immediately
        //   • no session at all     → getUser() returns { user: null }
        // No manual refreshSession() needed, so there's no double-refresh race.
        const getUserResult: any = await Promise.race([
          supabase.auth.getUser(),
          new Promise((resolve) =>
            setTimeout(() => resolve({ data: { user: null } }), 10000)
          ),
        ]);

        let resolvedUser: User | null = getUserResult?.data?.user ?? null;

        // ── Step 2: cookie fallback ───────────────────────────────────────────
        // getUser() returns null when the SDK had NO session to start with
        // (localStorage was cleared by the OS/browser after the app was closed).
        // In that case the refresh token cookie written by supabaseClient.ts
        // can restore the session without a full re-login.
        if (!resolvedUser && typeof document !== "undefined") {
          const m = document.cookie.match(/(?:^|; )sb-refresh-token=([^;]*)/);
          const refreshToken = m ? decodeURIComponent(m[1]) : null;
          if (refreshToken) {
            try {
              const { data: rd } = await supabase.auth.refreshSession({
                refresh_token: refreshToken,
              });
              resolvedUser = rd?.session?.user ?? null;
            } catch (e) {
              console.warn("AuthRoleProvider: cookie refresh failed", e);
            }
          }
        }

        if (!mounted) return;
        setUser(resolvedUser);

        if (resolvedUser?.id) {
          const r = await fetchRole(resolvedUser.id);
          if (!mounted) return;
          setRole(r);
        } else {
          setRole(null);
        }
      } catch (e) {
        console.warn("AuthRoleProvider: init error", e);
        if (mounted) { setUser(null); setRole(null); }
      } finally {
        if (mounted) {
          initDoneRef.current = true;
          setLoading(false);
        }
      }
    };

    init();

    // onAuthStateChange handles ongoing auth changes AFTER init() completes.
    // We skip all events fired during init() to prevent the INITIAL_SESSION(null)
    // race that would set loading=false before the cookie fallback runs.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!initDoneRef.current) return;
      if (!mounted) return;

      const u = session?.user ?? null;
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
