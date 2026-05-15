/**
 * Auth utilities for EduStack multi-tenant RBAC.
 *
 * This module defines:
 * - Role types and constants
 * - Role → dashboard path mapping
 * - Role → display name mapping
 * - Route protection configuration
 * - Permission helpers
 */

// ---------------------------------------------------------------------------
// Role definitions
// ---------------------------------------------------------------------------

export type UserRole =
  | "org:super_admin"
  | "org:school_admin"
  | "org:accounts"
  | "org:teacher"
  | "org:parent"
  | "org:student";

export const ALL_ROLES: UserRole[] = [
  "org:super_admin",
  "org:school_admin",
  "org:accounts",
  "org:teacher",
  "org:parent",
  "org:student",
];

// ---------------------------------------------------------------------------
// Role → Dashboard mapping
// ---------------------------------------------------------------------------

export const ROLE_DASHBOARD_MAP: Record<UserRole, string> = {
  "org:super_admin": "/super-admin",
  "org:school_admin": "/school-admin",
  "org:accounts": "/fee-counter",
  "org:teacher": "/teacher",
  "org:parent": "/parent",
  "org:student": "/student",
};

export const ROLE_DISPLAY_MAP: Record<UserRole, string> = {
  "org:super_admin": "Super Admin",
  "org:school_admin": "School Admin",
  "org:accounts": "Fee Counter",
  "org:teacher": "Teacher",
  "org:parent": "Parent",
  "org:student": "Student",
};

const ROLE_ALIASES: Record<string, UserRole> = {
  "org:super_admin": "org:super_admin",
  super_admin: "org:super_admin",
  "super-admin": "org:super_admin",
  "super admin": "org:super_admin",
  "org:school_admin": "org:school_admin",
  school_admin: "org:school_admin",
  "school-admin": "org:school_admin",
  "school admin": "org:school_admin",
  "org:accounts": "org:accounts",
  accounts: "org:accounts",
  accountant: "org:accounts",
  "fee-counter": "org:accounts",
  fee_counter: "org:accounts",
  "org:teacher": "org:teacher",
  teacher: "org:teacher",
  "org:parent": "org:parent",
  parent: "org:parent",
  "org:student": "org:student",
  student: "org:student",
};

export function normalizeRole(role: string | null | undefined): UserRole | null {
  if (!role) return null;
  return ROLE_ALIASES[String(role).trim().toLowerCase()] || null;
}

// ---------------------------------------------------------------------------
// Route → allowed roles mapping (for middleware)
// ---------------------------------------------------------------------------

export interface RouteConfig {
  pathPrefix: string;
  allowedRoles: UserRole[];
}

export const PROTECTED_ROUTES: RouteConfig[] = [
  { pathPrefix: "/super-admin", allowedRoles: ["org:super_admin"] },
  { pathPrefix: "/school-admin", allowedRoles: ["org:school_admin"] },
  { pathPrefix: "/fee-counter", allowedRoles: ["org:accounts"] },
  { pathPrefix: "/teacher", allowedRoles: ["org:teacher"] },
  { pathPrefix: "/parent", allowedRoles: ["org:parent"] },
  { pathPrefix: "/student", allowedRoles: ["org:student"] },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Given a role string, return the dashboard path to redirect to.
 */
export function getDashboardForRole(role: string | null | undefined): string {
  const normalizedRole = normalizeRole(role);
  if (!normalizedRole) return "/sign-in";
  return ROLE_DASHBOARD_MAP[normalizedRole];
}

/**
 * Given a role string, return the display name.
 */
export function getRoleDisplayName(role: string | null | undefined): string {
  const normalizedRole = normalizeRole(role);
  if (!normalizedRole) return "User";
  return ROLE_DISPLAY_MAP[normalizedRole];
}

/**
 * Check if a role is allowed to access a given path.
 */
export function isRoleAllowedForPath(role: string, path: string): boolean {
  const route = PROTECTED_ROUTES.find((r) => path.startsWith(r.pathPrefix));
  if (!route) return true; // Not a protected route
  const normalizedRole = normalizeRole(role);
  return normalizedRole ? route.allowedRoles.includes(normalizedRole) : false;
}

/**
 * Get the correct redirect URL for a role trying to access an unauthorized path.
 */
export function getRedirectForUnauthorized(role: string): string {
  return getDashboardForRole(role);
}
