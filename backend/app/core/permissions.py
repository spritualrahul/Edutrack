"""Granular permission definitions for RBAC.

Each permission follows the pattern: resource.action
Roles map to a set of permissions. The `require_permission` dependency
factory checks whether the current user (resolved from JWT + DB) holds
the necessary permission.
"""

from __future__ import annotations

from enum import Enum
from typing import FrozenSet


# ---------------------------------------------------------------------------
# Permission catalogue
# ---------------------------------------------------------------------------

class Permission(str, Enum):
    """Every granular permission in the system."""

    # Organizations / Schools
    SCHOOLS_READ = "schools.read"
    SCHOOLS_WRITE = "schools.write"
    SCHOOLS_DELETE = "schools.delete"

    # Students
    STUDENTS_READ = "students.read"
    STUDENTS_WRITE = "students.write"
    STUDENTS_DELETE = "students.delete"

    # Teachers
    TEACHERS_READ = "teachers.read"
    TEACHERS_WRITE = "teachers.write"
    TEACHERS_DELETE = "teachers.delete"

    # Classes
    CLASSES_READ = "classes.read"
    CLASSES_WRITE = "classes.write"

    # Attendance
    ATTENDANCE_READ = "attendance.read"
    ATTENDANCE_WRITE = "attendance.write"

    # Fees
    FEES_READ = "fees.read"
    FEES_WRITE = "fees.write"
    FEES_COLLECT = "fees.collect"

    # Notices
    NOTICES_READ = "notices.read"
    NOTICES_WRITE = "notices.write"

    # Reports / Analytics
    REPORTS_READ = "reports.read"
    ANALYTICS_READ = "analytics.read"

    # Platform (super-admin only)
    PLATFORM_MANAGE = "platform.manage"
    SUBSCRIPTIONS_MANAGE = "subscriptions.manage"

    # Settings
    SETTINGS_READ = "settings.read"
    SETTINGS_WRITE = "settings.write"

    # Users / RBAC
    USERS_READ = "users.read"
    USERS_WRITE = "users.write"


# ---------------------------------------------------------------------------
# Role → Permissions mapping
# ---------------------------------------------------------------------------

ROLE_PERMISSIONS: dict[str, FrozenSet[str]] = {
    "org:super_admin": frozenset(p.value for p in Permission),  # all permissions

    "org:school_admin": frozenset([
        Permission.SCHOOLS_READ,
        Permission.STUDENTS_READ, Permission.STUDENTS_WRITE, Permission.STUDENTS_DELETE,
        Permission.TEACHERS_READ, Permission.TEACHERS_WRITE, Permission.TEACHERS_DELETE,
        Permission.CLASSES_READ, Permission.CLASSES_WRITE,
        Permission.ATTENDANCE_READ, Permission.ATTENDANCE_WRITE,
        Permission.FEES_READ, Permission.FEES_WRITE, Permission.FEES_COLLECT,
        Permission.NOTICES_READ, Permission.NOTICES_WRITE,
        Permission.REPORTS_READ, Permission.ANALYTICS_READ,
        Permission.SETTINGS_READ, Permission.SETTINGS_WRITE,
        Permission.USERS_READ, Permission.USERS_WRITE,
    ]),

    "org:accounts": frozenset([
        Permission.STUDENTS_READ,
        Permission.FEES_READ, Permission.FEES_WRITE, Permission.FEES_COLLECT,
        Permission.REPORTS_READ,
    ]),

    "org:teacher": frozenset([
        Permission.STUDENTS_READ,
        Permission.CLASSES_READ,
        Permission.ATTENDANCE_READ, Permission.ATTENDANCE_WRITE,
        Permission.NOTICES_READ,
        Permission.REPORTS_READ,
    ]),

    "org:parent": frozenset([
        Permission.STUDENTS_READ,  # own children only (enforced at query level)
        Permission.ATTENDANCE_READ,
        Permission.FEES_READ,
        Permission.NOTICES_READ,
    ]),

    "org:student": frozenset([
        Permission.ATTENDANCE_READ,
        Permission.FEES_READ,
        Permission.NOTICES_READ,
    ]),
}


def get_permissions_for_role(role: str) -> FrozenSet[str]:
    """Return the permission set for a given role name."""
    return ROLE_PERMISSIONS.get(role, frozenset())


def has_permission(role: str, permission: str) -> bool:
    """Check whether *role* includes *permission*."""
    return permission in get_permissions_for_role(role)
