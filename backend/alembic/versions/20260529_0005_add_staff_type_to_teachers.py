"""add staff_type to teachers

Revision ID: 20260529_0005
Revises: 20260515_0004
Create Date: 2026-05-29
"""

from alembic import op
import sqlalchemy as sa


revision = "20260529_0005"
down_revision = "20260515_0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "teachers",
        sa.Column("staff_type", sa.String(length=20), server_default="teaching", nullable=True),
    )


def downgrade() -> None:
    op.drop_column("teachers", "staff_type")
