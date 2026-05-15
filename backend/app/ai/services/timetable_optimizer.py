"""AI-assisted timetable conflict and substitute recommendations."""

from __future__ import annotations

import json
import uuid
from collections import Counter, defaultdict
from datetime import date
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.prompts.timetable import TIMETABLE_OPTIMIZER_SYSTEM_PROMPT
from app.ai.providers.openai_provider import AIProviderResult, OpenAIProvider
from app.models.academic import AcademicClass, Section
from app.models.leave import LeaveApplication
from app.models.organization import Organization
from app.models.teacher import Teacher


class TimetableOptimizerService:
    def __init__(self, provider: Optional[OpenAIProvider] = None) -> None:
        self.provider = provider or OpenAIProvider()

    async def optimize(
        self,
        *,
        db: AsyncSession,
        school: Organization,
        existing_slots: list[dict],
        absent_teacher_id: Optional[uuid.UUID],
        target_date: Optional[date],
        constraints: Optional[str],
    ) -> AIProviderResult:
        teachers = await self._teachers(db, school.id)
        classes = await self._classes(db, school.id)
        sections = await self._sections(db, school.id)
        leaves = await self._active_leaves(db, school.id, target_date)
        deterministic = self._deterministic_analysis(existing_slots, teachers, absent_teacher_id, leaves)

        context = {
            "school": {"id": str(school.id), "name": school.name},
            "teachers": teachers,
            "classes": classes,
            "sections": sections,
            "existing_slots": existing_slots[:250],
            "absent_teacher_id": str(absent_teacher_id) if absent_teacher_id else None,
            "target_date": target_date.isoformat() if target_date else None,
            "active_leave_teacher_ids": leaves,
            "constraints": constraints,
            "deterministic_analysis": deterministic,
        }
        return await self.provider.json_completion(
            system_prompt=TIMETABLE_OPTIMIZER_SYSTEM_PROMPT,
            user_prompt=json.dumps(context, ensure_ascii=False, default=str),
            feature="timetable_optimizer",
            max_completion_tokens=1800,
        )

    @staticmethod
    async def _teachers(db: AsyncSession, school_id: uuid.UUID) -> list[dict]:
        result = await db.execute(
            select(Teacher).where(Teacher.school_id == school_id, Teacher.is_active == True).order_by(Teacher.first_name)
        )
        return [
            {
                "id": str(t.id),
                "name": t.full_name,
                "department": t.department,
                "designation": t.designation,
                "specialization": t.specialization,
            }
            for t in result.scalars().all()
        ]

    @staticmethod
    async def _classes(db: AsyncSession, school_id: uuid.UUID) -> list[dict]:
        result = await db.execute(
            select(AcademicClass).where(AcademicClass.school_id == school_id, AcademicClass.is_active == True).order_by(AcademicClass.sort_order)
        )
        return [{"id": str(c.id), "name": c.name, "numeric_grade": c.numeric_grade} for c in result.scalars().all()]

    @staticmethod
    async def _sections(db: AsyncSession, school_id: uuid.UUID) -> list[dict]:
        result = await db.execute(
            select(Section).where(Section.school_id == school_id, Section.is_active == True).order_by(Section.name)
        )
        return [
            {
                "id": str(s.id),
                "class_id": str(s.class_id),
                "name": s.name,
                "class_teacher_id": str(s.class_teacher_id) if s.class_teacher_id else None,
            }
            for s in result.scalars().all()
        ]

    @staticmethod
    async def _active_leaves(db: AsyncSession, school_id: uuid.UUID, target_date: Optional[date]) -> list[str]:
        if not target_date:
            return []
        result = await db.execute(
            select(LeaveApplication.teacher_id).where(
                LeaveApplication.school_id == school_id,
                LeaveApplication.status == "approved",
                LeaveApplication.start_date <= target_date,
                LeaveApplication.end_date >= target_date,
            )
        )
        return [str(value) for value in result.scalars().all()]

    @staticmethod
    def _deterministic_analysis(
        existing_slots: list[dict],
        teachers: list[dict],
        absent_teacher_id: Optional[uuid.UUID],
        leave_teacher_ids: list[str],
    ) -> dict:
        teacher_by_id = {teacher["id"]: teacher for teacher in teachers}
        by_teacher_time: dict[tuple[str, str, str], list[str]] = defaultdict(list)
        by_class_time: dict[tuple[str, str, str], list[str]] = defaultdict(list)
        load = Counter()
        conflicts = []
        absent_ids = set(leave_teacher_ids)
        if absent_teacher_id:
            absent_ids.add(str(absent_teacher_id))

        for index, slot in enumerate(existing_slots):
            ref = slot.get("id") or f"slot-{index + 1}"
            day = str(slot.get("day") or "")
            time = str(slot.get("time") or "")
            teacher_id = str(slot.get("teacher_id") or "")
            class_label = str(slot.get("class_label") or slot.get("class") or "")

            if teacher_id:
                by_teacher_time[(day, time, teacher_id)].append(ref)
                load[teacher_id] += 1
                if teacher_id in absent_ids:
                    teacher_name = teacher_by_id.get(teacher_id, {}).get("name", "Teacher")
                    conflicts.append({
                        "type": "teacher_absent",
                        "severity": "high",
                        "description": f"{teacher_name} is unavailable for {day} {time}.",
                        "slot_refs": [ref],
                    })
            if class_label:
                by_class_time[(day, time, class_label)].append(ref)

        for (_, _, teacher_id), refs in by_teacher_time.items():
            if len(refs) > 1:
                teacher_name = teacher_by_id.get(teacher_id, {}).get("name", "Teacher")
                conflicts.append({
                    "type": "teacher_overlap",
                    "severity": "high",
                    "description": f"{teacher_name} has overlapping periods.",
                    "slot_refs": refs,
                })

        for (_, _, class_label), refs in by_class_time.items():
            if len(refs) > 1:
                conflicts.append({
                    "type": "class_overlap",
                    "severity": "high",
                    "description": f"{class_label} has overlapping periods.",
                    "slot_refs": refs,
                })

        return {
            "conflicts": conflicts,
            "teacher_period_load": [
                {"teacher_id": teacher_id, "teacher": teacher_by_id.get(teacher_id, {}).get("name", teacher_id), "periods": periods}
                for teacher_id, periods in load.most_common()
            ],
        }
