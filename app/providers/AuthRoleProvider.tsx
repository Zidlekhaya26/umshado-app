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
    const { data, error } = await supabase
      .from("profiles")
      .select("active_role")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.warn("AuthRoleProvider: failed to fetch role", error);
      return null;
    }

    const r = (data?.active_role ?? null) as Role;
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

    // Initialize session with a timeout to avoid indefinite loading on flaky mobile
    const init = async () => {
      setLoading(true);
      try {
        const race = Promise.race([
          (async () => {
            const { data } = await supabase.auth.getSession();
            return data.session?.user ?? null;
          })(),
          new Promise<null>((res) => setTimeout(() => res(null), 4000)),
        ]);

        const u = await race;

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

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const u = session?.user ?? null;
      if (!mounted) return;
      setUser(u);

      if (u?.id) {
        try {
          setLoading(true);
          const r = await fetchRole(u.id);
          if (!mounted) return;
          setRole(r);
        } catch (e) {
          console.warn("AuthRoleProvider: onAuthStateChange fetchRole error", e);
          setRole(null);
        } finally {
          if (mounted) setLoading(false);
        }
      } else {
        setRole(null);
        if (mounted) setLoading(false);
      }
    });

    return () => {
      mounted = false;
      try { sub.subscription.unsubscribe(); } catch {}
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
