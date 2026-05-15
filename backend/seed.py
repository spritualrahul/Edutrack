"""Seed only system data required by the platform.

This deliberately avoids demo schools, students, parents, teachers, fees, and
notices so a fresh environment starts clean for real onboarding tests.
"""

import asyncio
from decimal import Decimal

from sqlalchemy import delete, select, update

from app.db.session import AsyncSessionLocal, init_db
from app.models import Role, SubscriptionPlan, User


SYSTEM_ROLES = [
    {"name": "org:super_admin", "display_name": "Super Admin", "is_system": True},
    {"name": "org:school_admin", "display_name": "School Admin", "is_system": True},
    {"name": "org:accounts", "display_name": "Accountant / Fee Counter", "is_system": True},
    {"name": "org:teacher", "display_name": "Teacher", "is_system": True},
    {"name": "org:parent", "display_name": "Parent", "is_system": True},
    {"name": "org:student", "display_name": "Student", "is_system": True},
]

LEGACY_ROLE_ALIASES = {
    "super_admin": "org:super_admin",
    "school_admin": "org:school_admin",
    "accountant": "org:accounts",
    "accounts": "org:accounts",
    "teacher": "org:teacher",
    "parent": "org:parent",
    "student": "org:student",
}

PLANS = [
    {
        "name": "Starter",
        "slug": "starter",
        "description": "Core school ERP for smaller schools starting with digital fees, attendance, notices, and reports.",
        "price_monthly": Decimal("6999"),
        "price_yearly": Decimal("69990"),
        "max_students": 1000,
        "max_teachers": 40,
        "max_staff": 15,
        "features": {
            "fee_management": True,
            "attendance": True,
            "notices": True,
            "reports": True,
            "email": True,
            "whatsapp": False,
            "ai": False,
            "api": False,
        },
    },
    {
        "name": "Professional",
        "slug": "professional",
        "description": "Advanced automation with WhatsApp notifications, AI tools, and richer analytics.",
        "price_monthly": Decimal("12999"),
        "price_yearly": Decimal("129990"),
        "max_students": 3000,
        "max_teachers": 120,
        "max_staff": 40,
        "features": {
            "fee_management": True,
            "attendance": True,
            "notices": True,
            "reports": True,
            "email": True,
            "whatsapp": True,
            "ai": True,
            "api": False,
        },
    },
    {
        "name": "Enterprise",
        "slug": "enterprise",
        "description": "Large-school tier with high limits, API access, and full automation suite.",
        "price_monthly": Decimal("24999"),
        "price_yearly": Decimal("249990"),
        "max_students": 10000,
        "max_teachers": 500,
        "max_staff": 120,
        "features": {
            "fee_management": True,
            "attendance": True,
            "notices": True,
            "reports": True,
            "email": True,
            "whatsapp": True,
            "ai": True,
            "api": True,
        },
    },
]


async def seed() -> None:
    await init_db()
    async with AsyncSessionLocal() as db:
        canonical_roles: dict[str, Role] = {}
        for role_data in SYSTEM_ROLES:
            result = await db.execute(select(Role).where(Role.name == role_data["name"]))
            role = result.scalar_one_or_none()
            if role:
                role.display_name = role_data["display_name"]
                role.is_system = True
            else:
                role = Role(**role_data)
                db.add(role)
            canonical_roles[role_data["name"]] = role

        await db.flush()

        for legacy_name, canonical_name in LEGACY_ROLE_ALIASES.items():
            result = await db.execute(select(Role).where(Role.name == legacy_name))
            legacy_role = result.scalar_one_or_none()
            canonical_role = canonical_roles[canonical_name]
            if not legacy_role or legacy_role.id == canonical_role.id:
                continue

            await db.execute(
                update(User)
                .where(User.role_id == legacy_role.id)
                .values(role_id=canonical_role.id)
            )
            await db.execute(delete(Role).where(Role.id == legacy_role.id))

        for plan_data in PLANS:
            result = await db.execute(select(SubscriptionPlan).where(SubscriptionPlan.slug == plan_data["slug"]))
            plan = result.scalar_one_or_none()
            if plan:
                for key, value in plan_data.items():
                    setattr(plan, key, value)
                plan.is_active = True
            else:
                db.add(SubscriptionPlan(**plan_data, is_active=True))

        await db.commit()
        print("System roles and subscription plans are ready. No demo data was inserted.")


if __name__ == "__main__":
    asyncio.run(seed())
