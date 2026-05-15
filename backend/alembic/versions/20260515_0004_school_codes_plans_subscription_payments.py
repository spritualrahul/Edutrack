"""school codes, plan pricing, subscription payments

Revision ID: 20260515_0004
Revises: 20260515_0003
Create Date: 2026-05-15
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260515_0004"
down_revision = "20260515_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("organizations", sa.Column("unique_code", sa.String(length=32), nullable=True))
    op.execute(
        """
        UPDATE organizations
        SET unique_code = 'SCH-' || upper(substr(replace(id::text, '-', ''), 1, 8))
        WHERE unique_code IS NULL
        """
    )
    op.alter_column("organizations", "unique_code", nullable=False)
    op.create_index(op.f("ix_organizations_unique_code"), "organizations", ["unique_code"], unique=True)

    op.create_table(
        "subscription_payments",
        sa.Column("school_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("plan_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("billing_cycle", sa.String(length=20), nullable=False),
        sa.Column("amount", sa.Numeric(10, 2), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("razorpay_order_id", sa.String(length=100), nullable=True),
        sa.Column("razorpay_payment_id", sa.String(length=100), nullable=True),
        sa.Column("razorpay_signature", sa.String(length=255), nullable=True),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["plan_id"], ["subscription_plans.id"]),
        sa.ForeignKeyConstraint(["school_id"], ["organizations.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("razorpay_order_id"),
    )
    op.create_index(op.f("ix_subscription_payments_school_id"), "subscription_payments", ["school_id"], unique=False)
    op.create_index(op.f("ix_subscription_payments_razorpay_payment_id"), "subscription_payments", ["razorpay_payment_id"], unique=False)

    op.execute(
        """
        UPDATE subscription_plans
        SET price_monthly = 6999,
            price_yearly = 69990,
            max_students = 1000,
            max_teachers = 40,
            max_staff = 15,
            features = jsonb_build_object(
                'fee_management', true,
                'attendance', true,
                'notices', true,
                'reports', true,
                'email', true,
                'whatsapp', false,
                'ai', false,
                'api', false
            )
        WHERE slug = 'starter'
        """
    )
    op.execute(
        """
        UPDATE subscription_plans
        SET price_monthly = 12999,
            price_yearly = 129990,
            max_students = 3000,
            max_teachers = 120,
            max_staff = 40,
            features = jsonb_build_object(
                'fee_management', true,
                'attendance', true,
                'notices', true,
                'reports', true,
                'email', true,
                'whatsapp', true,
                'ai', true,
                'api', false
            )
        WHERE slug = 'professional'
        """
    )
    op.execute(
        """
        UPDATE subscription_plans
        SET price_monthly = 24999,
            price_yearly = 249990,
            max_students = 10000,
            max_teachers = 500,
            max_staff = 120,
            features = jsonb_build_object(
                'fee_management', true,
                'attendance', true,
                'notices', true,
                'reports', true,
                'email', true,
                'whatsapp', true,
                'ai', true,
                'api', true
            )
        WHERE slug = 'enterprise'
        """
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_subscription_payments_razorpay_payment_id"), table_name="subscription_payments")
    op.drop_index(op.f("ix_subscription_payments_school_id"), table_name="subscription_payments")
    op.drop_table("subscription_payments")
    op.drop_index(op.f("ix_organizations_unique_code"), table_name="organizations")
    op.drop_column("organizations", "unique_code")
