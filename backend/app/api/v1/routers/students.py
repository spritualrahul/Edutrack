"""Student management API routes."""
import csv
import io
import uuid
from datetime import date, datetime
from typing import Optional
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import extract, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.core.auth import AuthenticatedUser, get_authenticated_user, require_roles, require_school_access, require_own_student_access
from app.db.session import get_db
from app.models.academic import AcademicClass, Section
from app.models.parent import Parent
from app.models.student import Student
from app.models.teacher import Teacher
from app.repositories.student_repo import StudentRepository
from app.schemas.schemas import (StudentCreate, StudentUpdate, StudentResponse,
                                  StudentSearchResult, PaginatedResponse)

router = APIRouter(prefix="/schools/{school_id}/students", tags=["Students"])


@router.get("", response_model=PaginatedResponse)
async def list_students(
    school_id: uuid.UUID, page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
    class_id: Optional[uuid.UUID] = None, search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: AuthenticatedUser = Depends(require_roles("org:super_admin", "org:school_admin", "org:accounts", "org:teacher")),
    _school: AuthenticatedUser = Depends(require_school_access()),
):
    repo = StudentRepository(db)
    students, total = await repo.list_students(school_id, offset=(page - 1) * page_size,
                                                limit=page_size, class_id=class_id, search=search)
    items = []
    for s in students:
        item = _serialize_student(s)
        items.append(item)
    return PaginatedResponse(items=items, total=total, page=page, page_size=page_size,
                             total_pages=(total + page_size - 1) // page_size)


@router.post("", response_model=StudentResponse, status_code=status.HTTP_201_CREATED)
async def create_student(
    school_id: uuid.UUID, data: StudentCreate, db: AsyncSession = Depends(get_db),
    current_user: AuthenticatedUser = Depends(require_roles("org:super_admin", "org:school_admin")),
    _school: AuthenticatedUser = Depends(require_school_access()),
):
    repo = StudentRepository(db)
    student = await repo.create(school_id, **data.model_dump())
    return _serialize_student(student)


@router.post("/import", status_code=status.HTTP_201_CREATED)
async def import_students_csv(
    school_id: uuid.UUID,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: AuthenticatedUser = Depends(require_roles("org:super_admin", "org:school_admin")),
    _school: AuthenticatedUser = Depends(require_school_access()),
):
    """Import students from a CSV file while preserving school isolation.

    Supported headers include admission_number, first_name, last_name,
    class_id or class_name, section_id or section_name, parent_name,
    parent_phone, parent_email, father_name, mother_name, blood_group,
    date_of_birth, roll_number, email, phone, address, city, state, pincode.
    """
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Upload a CSV file")

    content = (await file.read()).decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(content))
    if not reader.fieldnames:
        raise HTTPException(status_code=400, detail="CSV file is empty")

    created = 0
    skipped: list[dict] = []
    for index, row in enumerate(reader, start=2):
        cleaned = {str(k).strip(): (v.strip() if isinstance(v, str) else v) for k, v in row.items()}
        admission_number = cleaned.get("admission_number")
        first_name = cleaned.get("first_name")
        if not admission_number or not first_name:
            skipped.append({"row": index, "reason": "admission_number and first_name are required"})
            continue

        duplicate = await db.execute(
            select(Student.id).where(
                Student.school_id == school_id,
                Student.admission_number == admission_number,
            )
        )
        if duplicate.scalar_one_or_none():
            skipped.append({"row": index, "reason": "admission_number already exists"})
            continue

        class_id = await _resolve_class_id(db, school_id, cleaned)
        if not class_id:
            skipped.append({"row": index, "reason": "class_id or class_name is required"})
            continue
        section_id = await _resolve_section_id(db, school_id, class_id, cleaned)

        parent_id = await _upsert_parent(db, school_id, cleaned)
        student = Student(
            school_id=school_id,
            admission_number=admission_number,
            first_name=first_name,
            last_name=cleaned.get("last_name") or None,
            date_of_birth=_parse_date(cleaned.get("date_of_birth")),
            gender=cleaned.get("gender") or None,
            blood_group=cleaned.get("blood_group") or None,
            photo_url=cleaned.get("photo_url") or None,
            class_id=class_id,
            section_id=section_id,
            roll_number=_parse_int(cleaned.get("roll_number")),
            admission_date=_parse_date(cleaned.get("admission_date")) or date.today(),
            academic_year=cleaned.get("academic_year") or None,
            email=cleaned.get("email") or None,
            phone=cleaned.get("phone") or None,
            address=cleaned.get("address") or None,
            city=cleaned.get("city") or None,
            state=cleaned.get("state") or None,
            pincode=cleaned.get("pincode") or None,
            parent_id=parent_id,
        )
        db.add(student)
        created += 1
    await db.flush()
    return {"created": created, "skipped": skipped}


@router.get("/search", response_model=list[StudentSearchResult])
async def search_students_fee_counter(
    school_id: uuid.UUID, q: str = Query(..., min_length=1),
    db: AsyncSession = Depends(get_db),
    current_user: AuthenticatedUser = Depends(require_roles("org:super_admin", "org:school_admin", "org:accounts")),
    _school: AuthenticatedUser = Depends(require_school_access()),
):
    """Quick search for fee counter - optimized for speed."""
    repo = StudentRepository(db)
    return await repo.search_for_fee_counter(school_id, q)


@router.get("/me", response_model=StudentResponse)
async def get_my_student_profile(
    school_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: AuthenticatedUser = Depends(require_roles("org:parent", "org:student")),
    _school: AuthenticatedUser = Depends(require_school_access()),
):
    if current_user.role == "org:student":
        stmt = (
            select(Student)
            .where(
                Student.school_id == school_id,
                Student.clerk_user_id == current_user.clerk_id,
                Student.is_active == True,
            )
        )
    else:
        stmt = (
            select(Student)
            .join(Parent, Student.parent_id == Parent.id)
            .where(
                Student.school_id == school_id,
                Parent.school_id == school_id,
                Parent.clerk_user_id == current_user.clerk_id,
                Student.is_active == True,
            )
            .order_by(Student.first_name)
        )
    stmt = stmt.options(
        selectinload(Student.academic_class),
        selectinload(Student.section),
        selectinload(Student.parent),
    )
    result = await db.execute(stmt)
    student = result.scalars().first()
    if not student:
        raise HTTPException(status_code=404, detail="No linked student profile found")
    return _serialize_student(student)


@router.get("/birthdays/today")
async def get_todays_birthdays(
    school_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: AuthenticatedUser = Depends(require_roles("org:school_admin", "org:accounts", "org:teacher", "org:parent", "org:student")),
    _school: AuthenticatedUser = Depends(require_school_access()),
):
    today = date.today()
    student_query = (
        select(Student)
        .options(selectinload(Student.academic_class), selectinload(Student.section), selectinload(Student.parent))
        .where(
            Student.school_id == school_id,
            Student.is_active == True,
            Student.date_of_birth.is_not(None),
            extract("month", Student.date_of_birth) == today.month,
            extract("day", Student.date_of_birth) == today.day,
        )
    )
    if current_user.role == "org:student":
        student_query = student_query.where(Student.clerk_user_id == current_user.clerk_id)
    elif current_user.role == "org:parent":
        student_query = student_query.join(Parent, Student.parent_id == Parent.id).where(
            Parent.school_id == school_id,
            Parent.clerk_user_id == current_user.clerk_id,
        )

    students = (await db.execute(student_query)).scalars().all()
    items = [
        {
            "id": student.id,
            "type": "student",
            "name": student.full_name,
            "photo_url": student.photo_url,
            "class_name": student.academic_class.name if student.academic_class else None,
            "section_name": student.section.name if student.section else None,
            "message": f"Happy birthday, {student.full_name}! Wishing you a bright, joyful year ahead.",
        }
        for student in students
    ]

    if current_user.role in ("org:school_admin", "org:accounts", "org:teacher"):
        teacher_query = select(Teacher).where(
            Teacher.school_id == school_id,
            Teacher.is_active == True,
            Teacher.date_of_birth.is_not(None),
            extract("month", Teacher.date_of_birth) == today.month,
            extract("day", Teacher.date_of_birth) == today.day,
        )
        teachers = (await db.execute(teacher_query)).scalars().all()
        items.extend(
            {
                "id": teacher.id,
                "type": "teacher",
                "name": teacher.full_name,
                "photo_url": teacher.photo_url,
                "department": teacher.department,
                "message": f"Happy birthday, {teacher.full_name}! Wishing you a wonderful day and a successful year ahead.",
            }
            for teacher in teachers
        )
    return items


@router.get("/{student_id}", response_model=StudentResponse)
async def get_student(
    school_id: uuid.UUID, student_id: uuid.UUID, db: AsyncSession = Depends(get_db),
    current_user: AuthenticatedUser = Depends(require_school_access()),
    _own: AuthenticatedUser = Depends(require_own_student_access()),
):
    repo = StudentRepository(db)
    student = await repo.get_by_id(student_id, school_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    return _serialize_student(student)


@router.patch("/{student_id}", response_model=StudentResponse)
async def update_student(
    school_id: uuid.UUID, student_id: uuid.UUID, data: StudentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: AuthenticatedUser = Depends(require_roles("org:super_admin", "org:school_admin")),
    _school: AuthenticatedUser = Depends(require_school_access()),
):
    repo = StudentRepository(db)
    student = await repo.update(student_id, school_id, **data.model_dump(exclude_unset=True))
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    return _serialize_student(student)


def _serialize_student(student: Student) -> dict:
    item = StudentResponse.model_validate(student).model_dump()
    item["class_name"] = student.academic_class.name if student.academic_class else None
    item["section_name"] = student.section.name if student.section else None
    if student.parent:
        item["parent_name"] = student.parent.primary_contact_name
        item["parent_phone"] = student.parent.primary_phone
        item["father_name"] = student.parent.father_name
        item["mother_name"] = student.parent.mother_name
    return item


async def _resolve_class_id(
    db: AsyncSession, school_id: uuid.UUID, row: dict[str, str]
) -> Optional[uuid.UUID]:
    if row.get("class_id"):
        return uuid.UUID(row["class_id"])
    if not row.get("class_name"):
        return None
    result = await db.execute(
        select(AcademicClass.id).where(
            AcademicClass.school_id == school_id,
            AcademicClass.name.ilike(row["class_name"]),
        )
    )
    return result.scalar_one_or_none()


async def _resolve_section_id(
    db: AsyncSession, school_id: uuid.UUID, class_id: uuid.UUID, row: dict[str, str]
) -> Optional[uuid.UUID]:
    if row.get("section_id"):
        return uuid.UUID(row["section_id"])
    if not row.get("section_name"):
        return None
    result = await db.execute(
        select(Section.id).where(
            Section.school_id == school_id,
            Section.class_id == class_id,
            Section.name.ilike(row["section_name"]),
        )
    )
    return result.scalar_one_or_none()


async def _upsert_parent(
    db: AsyncSession, school_id: uuid.UUID, row: dict[str, str]
) -> Optional[uuid.UUID]:
    phone = row.get("parent_phone") or row.get("father_phone") or row.get("mother_phone")
    email = row.get("parent_email") or row.get("father_email") or row.get("mother_email")
    name = row.get("parent_name") or row.get("father_name") or row.get("mother_name")
    if not phone or not name:
        return None
    result = await db.execute(
        select(Parent).where(Parent.school_id == school_id, Parent.primary_phone == phone)
    )
    parent = result.scalar_one_or_none()
    if parent:
        return parent.id
    parent = Parent(
        school_id=school_id,
        primary_contact_name=name,
        primary_phone=phone,
        primary_email=email or None,
        father_name=row.get("father_name") or None,
        father_phone=row.get("father_phone") or None,
        father_email=row.get("father_email") or None,
        mother_name=row.get("mother_name") or None,
        mother_phone=row.get("mother_phone") or None,
        mother_email=row.get("mother_email") or None,
        address=row.get("address") or None,
        city=row.get("city") or None,
        state=row.get("state") or None,
        pincode=row.get("pincode") or None,
    )
    db.add(parent)
    await db.flush()
    return parent.id


def _parse_date(value: Optional[str]) -> Optional[date]:
    if not value:
        return None
    for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y"):
        try:
            return datetime.strptime(value, fmt).date()
        except ValueError:
            continue
    return None


def _parse_int(value: Optional[str]) -> Optional[int]:
    try:
        return int(value) if value else None
    except ValueError:
        return None
