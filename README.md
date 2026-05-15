# EduStack — Multi-Tenant School ERP SaaS Platform

A production-grade, multi-tenant School ERP platform built with modern technologies.

![EduStack](https://img.shields.io/badge/EduStack-v1.0-indigo)
![Next.js](https://img.shields.io/badge/Next.js-15-black)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-green)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    Next.js 15 Frontend                   │
│  ┌─────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │  Clerk   │  │ shadcn/  │  │ Recharts │  │ TanStack │ │
│  │  Auth    │  │   ui     │  │          │  │  Table   │ │
│  └─────────┘  └──────────┘  └──────────┘  └──────────┘ │
└──────────────────────┬───────────────────────────────────┘
                       │ REST API
┌──────────────────────▼───────────────────────────────────┐
│                   FastAPI Backend                         │
│  ┌─────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │ Routers │  │ Services │  │  Repos   │  │ Schemas  │ │
│  └─────────┘  └──────────┘  └──────────┘  └──────────┘ │
└──────────────────────┬───────────────────────────────────┘
                       │ SQLAlchemy (Async)
┌──────────────────────▼───────────────────────────────────┐
│                    PostgreSQL 16                          │
│          Multi-tenant with school_id isolation            │
└──────────────────────────────────────────────────────────┘
```

## Tech Stack

| Layer           | Technology                          |
|-----------------|-------------------------------------|
| Frontend        | Next.js 15 (App Router), TypeScript |
| Styling         | Tailwind CSS v4                     |
| UI Components   | shadcn/ui (custom)                  |
| State           | Zustand                             |
| Charts          | Recharts                            |
| Tables          | TanStack Table                      |
| Forms           | React Hook Form + Zod               |
| Backend         | Python FastAPI                      |
| Database        | PostgreSQL 16                       |
| ORM             | SQLAlchemy 2.0 (async)              |
| Auth            | Clerk                               |
| PDF             | ReportLab                           |
| Deployment      | Docker + Docker Compose             |

## Features

### Dashboards
- **Super Admin** — Platform-wide analytics, school management, revenue metrics
- **School Admin** — Student/teacher management, attendance, fee collection, notices
- **Fee Counter** — Optimized for daily repetitive use, instant search, one-click collection
- **Teacher Portal** — Timetable, attendance marking, leave applications
- **Parent Portal** — Mobile-optimized, attendance, fee status, receipts, notices

### Core Modules
- Multi-tenant architecture with `school_id` isolation
- Role-based access control (Super Admin, School Admin, Accountant, Teacher, Parent, Student)
- Fee management with partial payment support
- Auto receipt generation
- Bulk attendance marking
- Notice board with targeting
- Payment integration placeholders (Razorpay)
- WhatsApp notification placeholders

## Getting Started

### Prerequisites
- Node.js 20+
- Python 3.12+
- PostgreSQL 16+
- Docker (optional)

### Quick Start with Docker

```bash
# Clone and start
git clone <repo-url> edustack
cd edustack
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local

# Start everything
docker compose up -d

# Frontend: http://localhost:3000
# Backend API: http://localhost:8000/api/docs
```

### Manual Setup

#### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your database credentials and Clerk keys

# Run migrations
alembic upgrade head

# Start server
uvicorn app.main:app --reload --port 8000
```

#### Frontend
```bash
cd frontend
npm install
cp .env.example .env.local
# Edit .env.local with your Clerk keys

npm run dev
```

## Project Structure

```
school-erp-saas/
├── backend/
│   ├── app/
│   │   ├── api/v1/routers/      # API route handlers
│   │   ├── core/                # Config, security
│   │   ├── db/                  # Database session
│   │   ├── models/              # SQLAlchemy models
│   │   ├── schemas/             # Pydantic schemas
│   │   ├── services/            # Business logic
│   │   ├── repositories/        # Data access layer
│   │   ├── middleware/          # Auth, CORS
│   │   └── utils/               # Helpers
│   ├── alembic/                 # Database migrations
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── app/                 # Next.js App Router pages
│   │   │   ├── (auth)/          # Auth pages (Clerk)
│   │   │   └── (dashboard)/     # Dashboard pages by role
│   │   ├── components/
│   │   │   ├── ui/              # Base UI components
│   │   │   ├── layout/          # Sidebar, Header
│   │   │   ├── dashboard/       # Dashboard widgets
│   │   │   ├── forms/           # Form components
│   │   │   └── tables/          # Table components
│   │   ├── lib/                 # Utils, API client
│   │   ├── hooks/               # Custom hooks
│   │   ├── stores/              # Zustand stores
│   │   └── types/               # TypeScript types
│   ├── .env.example
│   └── Dockerfile
├── docker-compose.yml
└── README.md
```

## Database Schema

### Core Tables
- `organizations` — Schools/tenants
- `subscription_plans` — SaaS plans
- `users` — All users with Clerk auth
- `roles` — RBAC roles
- `students` — Student profiles
- `teachers` — Teacher profiles
- `parents` — Parent/guardian profiles
- `classes` — Academic classes/grades
- `sections` — Sections within classes
- `subjects` — Class subjects

### Fee Management
- `fee_structures` — Fee templates per class
- `fee_components` — Individual fee items
- `student_fee_allocations` — What each student owes
- `payments` — Payment transactions
- `receipts` — Generated receipts

### Other
- `attendance` — Daily attendance records
- `notices` — School announcements
- `leave_applications` — Teacher leaves

All tables include `school_id` for multi-tenant isolation.

## API Endpoints

### Organizations (Super Admin)
- `GET /api/v1/organizations` — List all schools
- `POST /api/v1/organizations` — Create school
- `GET /api/v1/organizations/{id}` — Get school details
- `PATCH /api/v1/organizations/{id}` — Update school

### Students
- `GET /api/v1/schools/{id}/students` — List students
- `POST /api/v1/schools/{id}/students` — Create student
- `GET /api/v1/schools/{id}/students/search?q=` — Quick search

### Fee Management
- `POST /api/v1/schools/{id}/fees/structures` — Create fee structure
- `GET /api/v1/schools/{id}/fees/students/{sid}/pending` — Get pending fees
- `POST /api/v1/schools/{id}/fees/collect` — Collect payment
- `GET /api/v1/schools/{id}/fees/daily-summary` — Daily summary

### Attendance
- `POST /api/v1/schools/{id}/attendance/bulk` — Mark bulk attendance
- `GET /api/v1/schools/{id}/attendance/summary` — Get summary

## Environment Variables

See `backend/.env.example` and `frontend/.env.example` for all required variables.

## License

MIT
