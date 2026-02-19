"use client";

import React, { useEffect, useState } from "react";
import { useAuthRole } from "@/app/providers/AuthRoleProvider";

export default function RoleGate({ children }: { children: React.ReactNode }) {
  const { loading } = useAuthRole();
  const [mounted, setMounted] = useState(false);

  // Prevent showing the loading UI in the server-rendered HTML.
  // Only show the spinner after the component has mounted on the client.
  useEffect(() => {
    setMounted(true);
  }, []);

  if (mounted && loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F0EA]">
        <div className="text-sm font-semibold text-gray-600">Loading…</div>
      </div>
    );
  }

  return <>{children}</>;
}
