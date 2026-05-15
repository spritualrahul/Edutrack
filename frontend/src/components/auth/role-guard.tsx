"use client";

/**
 * RoleGuard — client-side role gating component.
 *
 * Wraps dashboard pages to ensure the current user has the required role.
 * If the user doesn't have access, they are redirected to their correct dashboard.
 *
 * NOTE: This is a UX safeguard only. The backend enforces authorization
 * on every API call via DB-backed role checks.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthState } from "@/hooks/useAuth";
import type { UserRole } from "@/lib/auth";
import { getDashboardForRole } from "@/lib/auth";

interface RoleGuardProps {
  allowedRoles: UserRole[];
  children: React.ReactNode;
}

export function RoleGuard({ allowedRoles, children }: RoleGuardProps) {
  const auth = useAuthState();
  const router = useRouter();

  useEffect(() => {
    if (auth.isLoaded && auth.isSignedIn && auth.role) {
      if (!allowedRoles.includes(auth.role)) {
        router.replace(getDashboardForRole(auth.role));
      }
    }
  }, [auth.isLoaded, auth.isSignedIn, auth.role, allowedRoles, router]);

  // Still loading
  if (!auth.isLoaded) {
    return null;
  }

  // Not authorized — will redirect via useEffect
  if (auth.role && !allowedRoles.includes(auth.role)) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-gray-500">Redirecting to your dashboard...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
