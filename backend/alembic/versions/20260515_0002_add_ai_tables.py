"""add ai usage and parent assistant tables

Revision ID: 20260515_0002
Revises: 20260515_0001
Create Date: 2026-05-15 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "20260515_0002"
down_revision: Union[str, None] = "20260515_0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "ai_usage_logs",
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("feature", sa.String(length=80), nullable=False),
        sa.Column("provider", sa.String(length=40), nullable=False),
        sa.Column("model", sa.String(length=120), nullable=True),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("input_tokens", sa.Integer(), nullable=True),
        sa.Column("output_tokens", sa.Integer(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("school_id", sa.UUID(), nullable=False),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["school_id"], ["organizations.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_ai_usage_logs_school_id"), "ai_usage_logs", ["school_id"], unique=False)
    op.create_index(op.f("ix_ai_usage_logs_user_id"), "ai_usage_logs", ["user_id"], unique=False)
    op.create_index(op.f("ix_ai_usage_logs_feature"), "ai_usage_logs", ["feature"], unique=False)
    op.create_index(op.f("ix_ai_usage_logs_status"), "ai_usage_logs", ["status"], unique=False)
    op.create_index(
        "ix_ai_usage_logs_school_feature_created",
        "ai_usage_logs",
        ["school_id", "feature", "created_at"],
        unique=False,
    )

    op.create_table(
        "ai_conversations",
        sa.Column("parent_user_id", sa.UUID(), nullable=False),
        sa.Column("student_id", sa.UUID(), nullable=True),
        sa.Column("title", sa.String(length=160), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("school_id", sa.UUID(), nullable=False),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["parent_user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["school_id"], ["organizations.id"]),
        sa.ForeignKeyConstraint(["student_id"], ["students.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_ai_conversations_school_id"), "ai_conversations", ["school_id"], unique=False)
    op.create_index(op.f("ix_ai_conversations_parent_user_id"), "ai_conversations", ["parent_user_id"], unique=False)
    op.create_index(op.f("ix_ai_conversations_student_id"), "ai_conversations", ["student_id"], unique=False)

    op.create_table(
        "ai_conversation_messages",
        sa.Column("conversation_id", sa.UUID(), nullable=False),
        sa.Column("role", sa.String(length=20), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("school_id", sa.UUID(), nullable=False),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["conversation_id"], ["ai_conversations.id"]),
        sa.ForeignKeyConstraint(["school_id"], ["organizations.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_ai_conversation_messages_school_id"), "ai_conversation_messages", ["school_id"], unique=False)
    op.create_index(op.f("ix_ai_conversation_messages_conversation_id"), "ai_conversation_messages", ["conversation_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_ai_conversation_messages_conversation_id"), table_name="ai_conversation_messages")
    op.drop_index(op.f("ix_ai_conversation_messages_school_id"), table_name="ai_conversation_messages")
    op.drop_table("ai_conversation_messages")
    op.drop_index(op.f("ix_ai_conversations_student_id"), table_name="ai_conversations")
    op.drop_index(op.f("ix_ai_conversations_parent_user_id"), table_name="ai_conversations")
    op.drop_index(op.f("ix_ai_conversations_school_id"), table_name="ai_conversations")
    op.drop_table("ai_conversations")
    op.drop_index("ix_ai_usage_logs_school_feature_created", table_name="ai_usage_logs")
    op.drop_index(op.f("ix_ai_usage_logs_status"), table_name="ai_usage_logs")
    op.drop_index(op.f("ix_ai_usage_logs_feature"), table_name="ai_usage_logs")
    op.drop_index(op.f("ix_ai_usage_logs_user_id"), table_name="ai_usage_logs")
    op.drop_index(op.f("ix_ai_usage_logs_school_id"), table_name="ai_usage_logs")
    op.drop_table("ai_usage_logs")
