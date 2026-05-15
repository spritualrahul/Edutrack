"""add timetable slots

Revision ID: 20260515_0003
Revises: 20260515_0002
Create Date: 2026-05-15
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260515_0003"
down_revision = "20260515_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "timetable_slots",
        sa.Column("class_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("section_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("subject_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("teacher_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("substitute_teacher_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("day_of_week", sa.Integer(), nullable=False),
        sa.Column("start_time", sa.Time(), nullable=False),
        sa.Column("end_time", sa.Time(), nullable=False),
        sa.Column("room", sa.String(length=80), nullable=True),
        sa.Column("effective_from", sa.Date(), nullable=False),
        sa.Column("effective_to", sa.Date(), nullable=True),
        sa.Column("is_substitute", sa.Boolean(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("school_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("day_of_week >= 0 AND day_of_week <= 6", name="ck_timetable_day_of_week"),
        sa.CheckConstraint("end_time > start_time", name="ck_timetable_time_range"),
        sa.ForeignKeyConstraint(["class_id"], ["classes.id"]),
        sa.ForeignKeyConstraint(["school_id"], ["organizations.id"]),
        sa.ForeignKeyConstraint(["section_id"], ["sections.id"]),
        sa.ForeignKeyConstraint(["subject_id"], ["subjects.id"]),
        sa.ForeignKeyConstraint(["substitute_teacher_id"], ["teachers.id"]),
        sa.ForeignKeyConstraint(["teacher_id"], ["teachers.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_timetable_slots_school_id"), "timetable_slots", ["school_id"], unique=False)
    op.create_index("ix_timetable_school_day_section", "timetable_slots", ["school_id", "day_of_week", "section_id"], unique=False)
    op.create_index("ix_timetable_school_day_teacher", "timetable_slots", ["school_id", "day_of_week", "teacher_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_timetable_school_day_teacher", table_name="timetable_slots")
    op.drop_index("ix_timetable_school_day_section", table_name="timetable_slots")
    op.drop_index(op.f("ix_timetable_slots_school_id"), table_name="timetable_slots")
    op.drop_table("timetable_slots")
