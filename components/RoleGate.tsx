"use client";

import React, { useEffect, useState } from "react";
import { useAuthRole } from "@/app/providers/AuthRoleProvider";

export default function RoleGate({ children }: { children: React.ReactNode }) {
  const { loading } = useAuthRole();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Before mounted: render null so page components never mount and cannot
  // run their useEffect auth-checks before AuthRoleProvider.init() finishes.
  // This is the key guard — without it, child useEffects fire first (React
  // runs child effects before parent effects), so pages call getUser() and
  // redirect to sign-in before AuthRoleProvider has a chance to restore the
  // session from the refresh-token cookie.
  if (!mounted) return null;

  if (loading) {
    return (
      <div role="status" aria-label="Loading" style={{ minHeight: '100svh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--um-ivory)' }}>
        <div aria-hidden="true" style={{ width: 36, height: 36, border: '3px solid rgba(154,33,67,0.15)', borderTopColor: 'var(--um-crimson)', borderRadius: '50%', animation: 'rg-spin .8s linear infinite' }} />
        <style>{'@keyframes rg-spin{to{transform:rotate(360deg)}}'}</style>
      </div>
    );
  }

  return <>{children}</>;
}
