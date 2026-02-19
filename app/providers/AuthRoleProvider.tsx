"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
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
    // Race the DB fetch against a short timeout to avoid hanging the UI
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
      new Promise((resolve) => setTimeout(() => resolve({ data: null, error: new Error("timeout") }), 3000)),
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
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role>(null);
  const [loading, setLoading] = useState(true);

  const refreshRole = async () => {
    if (!user?.id) {
      setRole(null);
      return;
    }
    const r = await fetchRole(user.id);
    setRole(r);
  };

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      setLoading(true);
      try {
        // Race session fetch with timeout so we don't stay stuck in loading.
        const sessionPromise = supabase.auth.getSession();
        const sessionRes: any = await Promise.race([
          sessionPromise,
          new Promise((resolve) => setTimeout(() => resolve({ data: { session: null } }), 4000)),
        ]);

        const u = sessionRes?.data?.session?.user ?? null;
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
      // Handle auth state changes safely without leaking promises into unmounted component
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

    return () => {
      mounted = false;
      try {
        sub?.subscription?.unsubscribe?.();
      } catch (e) {
        // ignore
      }
    };
  }, []);

  const value = useMemo<AuthRoleContextValue>(
    () => ({ user, role, loading, refreshRole }),
    [user, role, loading]
  );

  return <AuthRoleContext.Provider value={value}>{children}</AuthRoleContext.Provider>;
}

export function useAuthRole() {
  const ctx = useContext(AuthRoleContext);
  if (!ctx) throw new Error("useAuthRole must be used inside AuthRoleProvider");
  return ctx;
}
