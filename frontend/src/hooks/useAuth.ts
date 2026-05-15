"use client";

/**
 * useAuth hook — provides the current user's role, school_id,
 * permissions, and profile data from Clerk session + backend sync.
 *
 * On first mount after sign-in, it calls POST /api/v1/auth/sync to
 * ensure the user is provisioned in the backend DB and their Clerk
 * metadata is up-to-date.
 */

import { useEffect, useState, useCallback, useMemo } from "react";
import { useUser, useAuth as useClerkAuth } from "@clerk/nextjs";
import { api } from "@/lib/api";
import type { UserRole } from "@/lib/auth";
import { getDashboardForRole, getRoleDisplayName, normalizeRole } from "@/lib/auth";

type ClerkMetadata = {
  role?: UserRole;
  school_id?: string;
  school_code?: string;
  school_unique_code?: string;
  unique_code?: string;
  permissions?: string[];
};

export interface AuthState {
  /** Whether auth data has been loaded */
  isLoaded: boolean;
  /** Whether the user is signed in */
  isSignedIn: boolean;
  /** User's role from Clerk metadata / backend */
  role: UserRole | null;
  /** Display name for the role */
  roleDisplayName: string;
  /** User's school_id (null for super_admin) */
  schoolId: string | null;
  /** User's permissions */
  permissions: string[];
  /** User's full name */
  fullName: string;
  /** User's first name */
  firstName: string;
  /** User's email */
  email: string;
  /** User's avatar URL */
  avatarUrl: string | null;
  /** Backend user ID */
  userId: string | null;
  /** Clerk user ID */
  clerkId: string | null;
  /** Dashboard path for this user's role */
  dashboardPath: string;
  /** Whether the user is a new (auto-provisioned) user */
  isNewUser: boolean;
  /** Check if user has a specific permission */
  hasPermission: (perm: string) => boolean;
  /** Re-sync user data from backend */
  refresh: () => Promise<void>;
}

export function useAuthState(): AuthState {
  const { user, isLoaded: clerkLoaded, isSignedIn } = useUser();
  const { getToken } = useClerkAuth();

  const [synced, setSynced] = useState(false);
  const [backendData, setBackendData] = useState<{
    user_id: string;
    role: string;
    school_id: string | null;
    permissions: string[];
    first_name: string;
    last_name: string | null;
    email: string;
    is_new: boolean;
  } | null>(null);

  const syncUser = useCallback(async () => {
    if (!isSignedIn) return;

    try {
      const token = await getToken();
      if (!token) {
        // Token not ready — mark synced so UI isn't stuck on loader
        setSynced(true);
        return;
      }

      const response = await api.post(
        "/auth/sync",
        {},
        { headers: { Authorization: `Bearer ${token}` }, timeout: 5000 }
      );
      setBackendData(response.data);
      setSynced(true);
    } catch (err) {
      console.error("Failed to sync user with backend:", err);
      // Still mark as synced so we don't loop — fallback to Clerk metadata
      setSynced(true);
    }
  }, [isSignedIn, getToken]);

  // Sync on first sign-in
  useEffect(() => {
    if (clerkLoaded && isSignedIn && !synced) {
      void Promise.resolve().then(syncUser);
    }
  }, [clerkLoaded, isSignedIn, synced, syncUser]);

  // Prefer the backend sync result. Clerk session metadata can be stale until
  // the session token refreshes after a role change, so it is only a pre-sync
  // hint and never the post-sync source of truth.
  const clerkMetadata = (user?.publicMetadata as ClerkMetadata | undefined) || {};
  const clerkRole = normalizeRole(clerkMetadata.role);
  const backendRole = normalizeRole(backendData?.role);
  const role = (backendRole || (!synced ? clerkRole : null)) as UserRole | null;
  const metadataSchoolId =
    clerkMetadata.school_id && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clerkMetadata.school_id)
      ? clerkMetadata.school_id
      : null;
  const schoolId = role === "org:super_admin" ? null : (backendData?.school_id || (!synced ? metadataSchoolId : null) || null);
  const rawPermissions: string[] = backendData?.permissions || (!synced ? clerkMetadata.permissions || [] : []);
  // Stabilise the reference so downstream effects don't loop
  const permissionsKey = rawPermissions.join(",");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const permissions = useMemo(() => rawPermissions, [permissionsKey]);

  return {
    isLoaded: clerkLoaded && (synced || !isSignedIn),
    isSignedIn: isSignedIn || false,
    role,
    roleDisplayName: getRoleDisplayName(role),
    schoolId,
    permissions,
    fullName: user?.fullName || backendData?.first_name || "User",
    firstName: user?.firstName || backendData?.first_name || "User",
    email: user?.primaryEmailAddress?.emailAddress || backendData?.email || "",
    avatarUrl: user?.imageUrl || null,
    userId: backendData?.user_id || null,
    clerkId: user?.id || null,
    dashboardPath: getDashboardForRole(role),
    isNewUser: backendData?.is_new || false,
    hasPermission: (perm: string) => permissions.includes(perm),
    refresh: syncUser,
  };
}
