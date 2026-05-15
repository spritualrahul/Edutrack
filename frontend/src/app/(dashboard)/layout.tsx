"use client";

/**
 * Shared layout for all dashboard routes.
 *
 * This component:
 * 1. Requires authentication (redirects to sign-in if not signed in)
 * 2. Syncs user with backend
 * 3. Shows a loading spinner while auth resolves
 * 4. Renders DashboardLayout with correct role context
 */

import { useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Show, RedirectToSignIn } from "@clerk/nextjs";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { useAuthState } from "@/hooks/useAuth";
import { useAppStore } from "@/stores/app-store";
import { isRoleAllowedForPath, getDashboardForRole } from "@/lib/auth";

function AuthenticatedDashboard({ children }: { children: React.ReactNode }) {
  const auth = useAuthState();
  const router = useRouter();
  const pathname = usePathname();

  // Use individual selectors so we only subscribe to setters (stable refs)
  const setUserRole = useAppStore((s) => s.setUserRole);
  const setSchoolId = useAppStore((s) => s.setSchoolId);
  const setUserId = useAppStore((s) => s.setUserId);
  const setPermissions = useAppStore((s) => s.setPermissions);

  // Track what we last synced to prevent re-triggering
  const lastSynced = useRef<string>("");

  // Sync auth state to app store (only when values actually change)
  useEffect(() => {
    if (!auth.isLoaded || !auth.isSignedIn) return;

    const key = `${auth.role}|${auth.schoolId}|${auth.userId}`;
    if (key === lastSynced.current) return;
    lastSynced.current = key;

    setUserRole(auth.role);
    setSchoolId(auth.schoolId);
    setUserId(auth.userId);
    setPermissions(auth.permissions);
  }, [auth.isLoaded, auth.isSignedIn, auth.role, auth.schoolId, auth.userId, auth.permissions, setUserRole, setSchoolId, setUserId, setPermissions]);

  // Client-side route protection: redirect if role doesn't match path
  useEffect(() => {
    if (auth.isLoaded && auth.isSignedIn && auth.role && pathname) {
      if (!isRoleAllowedForPath(auth.role, pathname)) {
        router.replace(getDashboardForRole(auth.role));
      }
    }
  }, [auth.isLoaded, auth.isSignedIn, auth.role, pathname, router]);

  // Show loading while auth resolves
  if (!auth.isLoaded) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50/50">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
          <p className="text-sm text-gray-500 animate-pulse">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (auth.isSignedIn && !auth.role) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50/50">
        <div className="max-w-md rounded-xl border border-amber-100 bg-white p-6 text-center shadow-sm">
          <p className="text-sm font-semibold text-gray-900">Could not resolve your dashboard role.</p>
          <p className="mt-2 text-sm text-gray-500">Please refresh once more after the backend is running, or update the user role in the database/Clerk metadata.</p>
        </div>
      </div>
    );
  }

  // Don't render content if role doesn't match path (will redirect)
  if (auth.role && pathname && !isRoleAllowedForPath(auth.role, pathname)) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50/50">
        <p className="text-sm text-gray-500">Redirecting to your dashboard...</p>
      </div>
    );
  }

  return (
    <DashboardLayout
      role={auth.role || undefined}
      userName={auth.fullName}
      userRole={auth.roleDisplayName}
    >
      {children}
    </DashboardLayout>
  );
}

export default function DashboardRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Show when="signed-in">
        <AuthenticatedDashboard>{children}</AuthenticatedDashboard>
      </Show>
      <Show when="signed-out">
        <RedirectToSignIn />
      </Show>
    </>
  );
}
