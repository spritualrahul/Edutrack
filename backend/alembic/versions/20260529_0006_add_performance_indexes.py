"""add performance indexes

Revision ID: 20260529_0006
Revises: 20260529_0005
Create Date: 2026-05-29
"""

from alembic import op


revision = "20260529_0006"
down_revision = "20260529_0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Compound indexes for the most common query patterns
    op.create_index(
        "ix_students_school_id_first_name",
        "students",
        ["school_id", "first_name"],
    )
    op.create_index(
        "ix_students_school_id_admission_number",
        "students",
        ["school_id", "admission_number"],
    )
    op.create_index(
        "ix_teachers_school_id_staff_type",
        "teachers",
        ["school_id", "staff_type"],
    )
    op.create_index(
        "ix_teachers_school_id_first_name",
        "teachers",
        ["school_id", "first_name"],
    )
    op.create_index(
        "ix_student_fee_alloc_student_status",
        "student_fee_allocations",
        ["student_id", "status"],
    )


def downgrade() -> None:
    op.drop_index("ix_student_fee_alloc_student_status", table_name="student_fee_allocations")
    op.drop_index("ix_teachers_school_id_first_name", table_name="teachers")
    op.drop_index("ix_teachers_school_id_staff_type", table_name="teachers")
    op.drop_index("ix_students_school_id_admission_number", table_name="students")
    op.drop_index("ix_students_school_id_first_name", table_name="students")
