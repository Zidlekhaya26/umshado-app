"use client";

import React from "react";
import { useAuthRole } from "@/app/providers/AuthRoleProvider";

export default function RoleGate({ children }: { children: React.ReactNode }) {
  const { loading } = useAuthRole();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F0EA]">
        <div className="text-sm font-semibold text-gray-600">Loading…</div>
      </div>
    );
  }

  return <>{children}</>;
}
