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
    const res: any = await Promise.race([
      supabase.from("profiles").select("active_role").eq("id", userId).maybeSingle(),
      new Promise((resolve) =>
        setTimeout(() => resolve({ data: null, error: new Error("timeout") }), 3000)
      ),
    ]);
    if (res?.error) return null;
    const r = (res?.data?.active_role ?? null) as Role;
    return r === "vendor" || r === "couple" ? r : null;
  } catch {
    return null;
  }
}

export function AuthRoleProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]       = useState<User | null>(null);
  const [role, setRole]       = useState<Role>(null);
  const [loading, setLoading] = useState(true);
  const userRef     = useRef<User | null>(null);
  const initDoneRef = useRef(false);

  useEffect(() => { userRef.current = user; }, [user]);

  const refreshRole = useCallback(async () => {
    const uid = userRef.current?.id;
    if (!uid) { setRole(null); return; }
    setRole(await fetchRole(uid));
  }, []);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      setLoading(true);
      try {
        // With @supabase/ssr the middleware has already refreshed the access
        // token server-side before this page loaded.  getSession() reads the
        // fresh session from cookies instantly — no network call needed here.
        const { data: { session } } = await supabase.auth.getSession();
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
        if (mounted) { setUser(null); setRole(null); }
      } finally {
        if (mounted) {
          initDoneRef.current = true;
          setLoading(false);
        }
      }
    };

    init();

    // Handle ongoing auth events (sign-out, token refresh, etc.) after init.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!initDoneRef.current) return; // let init() own the initial state
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
          if (mounted) { setRole(null); setLoading(false); }
        }
      })();
    });

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible" && userRef.current?.id) {
        fetchRole(userRef.current.id).then((r) => { if (mounted) setRole(r); });
      }
    };
    const onFocus = () => {
      if (userRef.current?.id) {
        fetchRole(userRef.current.id).then((r) => { if (mounted) setRole(r); });
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
