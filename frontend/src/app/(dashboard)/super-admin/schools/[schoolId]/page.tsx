"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge, Avatar, EmptyState, Skeleton } from "@/components/ui/badge";
import { apiClient } from "@/lib/api";
import {
  ArrowLeft,
  Building2,
  GraduationCap,
  Users,
  Search,
  Eye,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  BookOpen,
  Calendar,
  Droplets,
  IdCard,
  Wrench,
} from "lucide-react";

type School = {
  id: string;
  name: string;
  unique_code: string;
  email: string;
  phone?: string | null;
  city?: string | null;
  state?: string | null;
  subscription_status: string;
  subscription_plan_name?: string | null;
  is_active: boolean;
  student_count?: number;
  teacher_count?: number;
};

type Student = {
  id: string;
  admission_number: string;
  first_name: string;
  last_name?: string | null;
  full_name: string;
  class_name?: string | null;
  section_name?: string | null;
  roll_number?: number | null;
  gender?: string | null;
  blood_group?: string | null;
  date_of_birth?: string | null;
  parent_name?: string | null;
  parent_phone?: string | null;
  father_name?: string | null;
  mother_name?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  photo_url?: string | null;
  status: string;
  admission_date?: string | null;
};

type Teacher = {
  id: string;
  employee_id: string;
  first_name: string;
  last_name?: string | null;
  full_name: string;
  email: string;
  phone?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  photo_url?: string | null;
  address?: string | null;
  designation?: string | null;
  department?: string | null;
  qualification?: string | null;
  experience_years?: number | null;
  joining_date?: string | null;
  specialization?: string | null;
  status: string;
  is_active: boolean;
  staff_type?: string | null;
};

type Staff = Teacher; // Non-teaching staff uses the same model

type Tab = "students" | "teachers" | "staff";

export default function SchoolDetailPage() {
  const params = useParams();
  const schoolId = params.schoolId as string;

  const [school, setSchool] = useState<School | null>(null);
  const [tab, setTab] = useState<Tab>("students");
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [totalStudents, setTotalStudents] = useState(0);
  const [totalTeachers, setTotalTeachers] = useState(0);
  const [totalStaff, setTotalStaff] = useState(0);

  // Debounce search — waits 300ms after user stops typing before firing API
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(value), 300);
  }, []);

  // Fetch school details
  useEffect(() => {
    if (!schoolId) return;
    const load = async () => {
      setLoading(true);
      try {
        const response = await apiClient.getOrganization(schoolId);
        setSchool(response.data);
      } catch {
        setError("Could not load school details.");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [schoolId]);

  // Fetch students/teachers based on tab (uses debounced search)
  useEffect(() => {
    if (!schoolId) return;
    const load = async () => {
      setLoadingMembers(true);
      try {
        if (tab === "students") {
          const response = await apiClient.getSchoolStudents(schoolId, {
            page_size: 20,
            search: debouncedSearch || undefined,
          });
          setStudents(response.data.items || []);
          setTotalStudents(response.data.total || 0);
        } else if (tab === "teachers") {
          const response = await apiClient.getSchoolTeachers(schoolId, {
            page_size: 20,
            search: debouncedSearch || undefined,
          });
          setTeachers(response.data.items || []);
          setTotalTeachers(response.data.total || 0);
        } else {
          const response = await apiClient.getSchoolStaff(schoolId, {
            page_size: 20,
            search: debouncedSearch || undefined,
          });
          setStaff(response.data.items || []);
          setTotalStaff(response.data.total || 0);
        }
      } catch {
        setError(`Could not load ${tab}.`);
      } finally {
        setLoadingMembers(false);
      }
    };
    void load();
  }, [schoolId, tab, debouncedSearch]);

  const filteredStudents = useMemo(() => {
    const term = search.toLowerCase();
    return students.filter(
      (s) =>
        !term ||
        s.full_name.toLowerCase().includes(term) ||
        s.admission_number.toLowerCase().includes(term) ||
        (s.parent_name || "").toLowerCase().includes(term)
    );
  }, [students, search]);

  const filteredTeachers = useMemo(() => {
    const term = search.toLowerCase();
    return teachers.filter(
      (t) =>
        !term ||
        t.full_name.toLowerCase().includes(term) ||
        t.employee_id.toLowerCase().includes(term) ||
        (t.department || "").toLowerCase().includes(term)
    );
  }, [teachers, search]);

  const filteredStaff = useMemo(() => {
    const term = search.toLowerCase();
    return staff.filter(
      (s) =>
        !term ||
        s.full_name.toLowerCase().includes(term) ||
        s.employee_id.toLowerCase().includes(term) ||
        (s.designation || "").toLowerCase().includes(term)
    );
  }, [staff, search]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-32" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!school) {
    return (
      <EmptyState
        icon={<Building2 className="h-10 w-10" />}
        title="School not found"
        description="The school you're looking for doesn't exist or has been removed."
        action={
          <Button asChild>
            <Link href="/super-admin/schools">
              <ArrowLeft className="h-4 w-4" /> Back to Schools
            </Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Back navigation */}
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon" className="h-9 w-9">
          <Link href="/super-admin/schools">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">{school.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Badge variant="info">{school.unique_code}</Badge>
            <Badge variant={school.is_active ? "success" : "danger"}>
              {school.is_active ? "Active" : "Inactive"}
            </Badge>
            <Badge
              variant={
                school.subscription_status === "active"
                  ? "success"
                  : school.subscription_status === "trial"
                    ? "warning"
                    : "danger"
              }
            >
              {school.subscription_status}
            </Badge>
            {school.city && (
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <MapPin className="h-3 w-3" />
                {school.city}
                {school.state ? `, ${school.state}` : ""}
              </span>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card className="border-indigo-100 bg-gradient-to-br from-indigo-50/80 to-white">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100">
                <GraduationCap className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{school.student_count || totalStudents}</p>
                <p className="text-xs text-gray-500">Students</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-emerald-100 bg-gradient-to-br from-emerald-50/80 to-white">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100">
                <Users className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{school.teacher_count || totalTeachers}</p>
                <p className="text-xs text-gray-500">Teachers</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-gray-100">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100">
                <Mail className="h-5 w-5 text-gray-600" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-900">{school.email}</p>
                <p className="text-xs text-gray-500">Email</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-gray-100">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100">
                <BookOpen className="h-5 w-5 text-gray-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">{school.subscription_plan_name || "Trial"}</p>
                <p className="text-xs text-gray-500">Plan</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main content: table + ID card sidebar */}
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          {/* Tab bar */}
          <div className="flex items-center gap-1 rounded-xl border border-gray-200 bg-gray-50/50 p-1">
            <button
              onClick={() => { setTab("students"); setSelectedStudent(null); setSelectedTeacher(null); setSelectedStaff(null); setSearch(""); setDebouncedSearch(""); }}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                tab === "students"
                  ? "bg-white text-indigo-700 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <GraduationCap className="h-4 w-4" />
              Students
              <span className={`ml-1 rounded-full px-2 py-0.5 text-xs ${tab === "students" ? "bg-indigo-100 text-indigo-700" : "bg-gray-200 text-gray-600"}`}>
                {totalStudents}
              </span>
            </button>
            <button
              onClick={() => { setTab("teachers"); setSelectedStudent(null); setSelectedTeacher(null); setSelectedStaff(null); setSearch(""); setDebouncedSearch(""); }}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                tab === "teachers"
                  ? "bg-white text-emerald-700 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <Users className="h-4 w-4" />
              Teachers
              <span className={`ml-1 rounded-full px-2 py-0.5 text-xs ${tab === "teachers" ? "bg-emerald-100 text-emerald-700" : "bg-gray-200 text-gray-600"}`}>
                {totalTeachers}
              </span>
            </button>
            <button
              onClick={() => { setTab("staff"); setSelectedStudent(null); setSelectedTeacher(null); setSelectedStaff(null); setSearch(""); setDebouncedSearch(""); }}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                tab === "staff"
                  ? "bg-white text-amber-700 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <Wrench className="h-4 w-4" />
              Staff
              <span className={`ml-1 rounded-full px-2 py-0.5 text-xs ${tab === "staff" ? "bg-amber-100 text-amber-700" : "bg-gray-200 text-gray-600"}`}>
                {totalStaff}
              </span>
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder={`Search ${tab}...`}
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Table */}
          <Card>
            <CardContent className="p-0">
              {loadingMembers ? (
                <div className="space-y-3 p-6">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-14" />
                  ))}
                </div>
              ) : tab === "students" ? (
                filteredStudents.length === 0 ? (
                  <EmptyState
                    icon={<GraduationCap className="h-10 w-10" />}
                    title="No students found"
                    description={search ? "Try a different search term." : "This school has no students yet."}
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-100 bg-gray-50/50">
                          <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Student</th>
                          <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Adm. No.</th>
                          <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Class</th>
                          <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Roll</th>
                          <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Parent</th>
                          <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
                          <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">ID Card</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {filteredStudents.map((student) => (
                          <tr key={student.id} className="group hover:bg-gray-50/80 transition-colors">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <Avatar src={student.photo_url} name={student.full_name} size="sm" />
                                <div>
                                  <p className="text-sm font-medium text-gray-900">{student.full_name}</p>
                                  <p className="text-xs text-gray-400">{student.gender || "Gender not set"}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 font-mono text-sm text-gray-600">{student.admission_number}</td>
                            <td className="px-6 py-4 text-sm text-gray-900">
                              {student.class_name || "-"}
                              {student.section_name ? <span className="ml-1 text-xs text-gray-400">({student.section_name})</span> : null}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-600">{student.roll_number || "-"}</td>
                            <td className="px-6 py-4">
                              <p className="text-sm text-gray-900">{student.parent_name || "-"}</p>
                              <p className="text-xs text-gray-400">{student.parent_phone || ""}</p>
                            </td>
                            <td className="px-6 py-4">
                              <Badge variant={student.status === "active" ? "success" : "warning"}>{student.status}</Badge>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => { setSelectedStudent(student); setSelectedTeacher(null); }}
                                title="View ID Card"
                              >
                                <IdCard className="h-4 w-4" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              ) : tab === "teachers" ? (
                filteredTeachers.length === 0 ? (
                <EmptyState
                  icon={<Users className="h-10 w-10" />}
                  title="No teachers found"
                  description={search ? "Try a different search term." : "This school has no teachers yet."}
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50/50">
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Teacher</th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Emp. ID</th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Department</th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Designation</th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Contact</th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
                        <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">ID Card</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filteredTeachers.map((teacher) => (
                        <tr key={teacher.id} className="group hover:bg-gray-50/80 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <Avatar src={teacher.photo_url} name={teacher.full_name} size="sm" className="!bg-emerald-100 !text-emerald-700" />
                              <div>
                                <p className="text-sm font-medium text-gray-900">{teacher.full_name}</p>
                                <p className="text-xs text-gray-400">{teacher.qualification || teacher.gender || ""}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 font-mono text-sm text-gray-600">{teacher.employee_id}</td>
                          <td className="px-6 py-4 text-sm text-gray-900">{teacher.department || "-"}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">{teacher.designation || "-"}</td>
                          <td className="px-6 py-4">
                            <p className="text-sm text-gray-600">{teacher.email}</p>
                            <p className="text-xs text-gray-400">{teacher.phone || ""}</p>
                          </td>
                          <td className="px-6 py-4">
                            <Badge variant={teacher.status === "active" ? "success" : "warning"}>{teacher.status}</Badge>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => { setSelectedTeacher(teacher); setSelectedStudent(null); }}
                              title="View ID Card"
                            >
                              <IdCard className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
              ) : filteredStaff.length === 0 ? (
                <EmptyState
                  icon={<Wrench className="h-10 w-10" />}
                  title="No staff found"
                  description={search ? "Try a different search term." : "This school has no non-teaching staff yet."}
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50/50">
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Staff</th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Emp. ID</th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Designation</th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Department</th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Contact</th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
                        <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">ID Card</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filteredStaff.map((s) => (
                        <tr key={s.id} className="group hover:bg-gray-50/80 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <Avatar src={s.photo_url} name={s.full_name} size="sm" className="!bg-amber-100 !text-amber-700" />
                              <div>
                                <p className="text-sm font-medium text-gray-900">{s.full_name}</p>
                                <p className="text-xs text-gray-400">{s.qualification || s.gender || ""}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 font-mono text-sm text-gray-600">{s.employee_id}</td>
                          <td className="px-6 py-4 text-sm text-gray-900">{s.designation || "-"}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">{s.department || "-"}</td>
                          <td className="px-6 py-4">
                            <p className="text-sm text-gray-600">{s.email}</p>
                            <p className="text-xs text-gray-400">{s.phone || ""}</p>
                          </td>
                          <td className="px-6 py-4">
                            <Badge variant={s.status === "active" ? "success" : "warning"}>{s.status}</Badge>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => { setSelectedStaff(s); setSelectedStudent(null); setSelectedTeacher(null); }}
                              title="View ID Card"
                            >
                              <IdCard className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ID Card Sidebar */}
        <aside>
          {selectedStudent ? (
            <StudentIdCard student={selectedStudent} schoolName={school.name} />
          ) : selectedTeacher ? (
            <TeacherIdCard teacher={selectedTeacher} schoolName={school.name} />
          ) : selectedStaff ? (
            <StaffIdCard staff={selectedStaff} schoolName={school.name} />
          ) : (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center gap-4 p-8">
                <EmptyState
                  icon={<IdCard className="h-10 w-10" />}
                  title="Select a person"
                  description="Click the ID card button on any row to preview their card."
                />
              </CardContent>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}


/* ========================================================================
   ID Cards
   ======================================================================== */

function DetailField({ label, value, icon }: { label: string; value: string | number; icon?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-3">
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-gray-400">
        {icon}
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-gray-900">{value}</p>
    </div>
  );
}


function StudentIdCard({ student, schoolName }: { student: Student; schoolName: string }) {
  return (
    <div className="id-card-hanging relative px-5 pt-8">
      {/* Lanyard */}
      <div className="absolute left-1/2 top-0 h-12 w-px -translate-x-1/2 bg-gray-300" />
      <div className="id-card-lanyard-clip absolute left-1/2 top-10 h-4 w-16 -translate-x-1/2 rounded-full border border-gray-200 bg-white shadow-sm" />

      <Card className="id-card-inner overflow-hidden border-indigo-100 bg-white shadow-lg">
        {/* Header — Indigo gradient for students */}
        <div className="bg-gradient-to-r from-indigo-600 to-blue-600 p-5 text-white">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-indigo-200">{schoolName}</p>
          <div className="flex items-center gap-4">
            <Avatar src={student.photo_url} name={student.full_name} size="lg" className="ring-4 ring-white/30 !bg-indigo-400 !text-white" />
            <div className="min-w-0">
              <p className="truncate text-lg font-bold">{student.full_name}</p>
              <p className="text-sm text-indigo-100">Adm. No. {student.admission_number}</p>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <Badge variant="outline" className="border-white/30 bg-white/10 text-white text-[10px]">STUDENT</Badge>
            <Badge variant="outline" className="border-white/30 bg-white/10 text-white text-[10px]">{student.status.toUpperCase()}</Badge>
          </div>
        </div>

        <CardContent className="space-y-4 p-5">
          <div className="grid grid-cols-2 gap-3">
            <DetailField
              label="Class"
              value={`${student.class_name || "-"}${student.section_name ? `-${student.section_name}` : ""}`}
              icon={<BookOpen className="h-3 w-3" />}
            />
            <DetailField
              label="Roll No."
              value={student.roll_number || "-"}
            />
            <DetailField
              label="Blood"
              value={student.blood_group || "-"}
              icon={<Droplets className="h-3 w-3" />}
            />
            <DetailField
              label="DOB"
              value={student.date_of_birth ? new Date(student.date_of_birth).toLocaleDateString("en-IN") : "-"}
              icon={<Calendar className="h-3 w-3" />}
            />
          </div>

          {/* Parent details */}
          <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Parent Details</p>
            <p className="mt-1 text-sm font-semibold text-gray-900">
              {student.father_name || student.parent_name || "Not linked"}
            </p>
            <p className="text-xs text-gray-500">
              {student.mother_name ? `Mother: ${student.mother_name}` : student.parent_phone || ""}
            </p>
          </div>

          {/* Contact */}
          {(student.email || student.phone) && (
            <div className="rounded-xl border border-gray-100 bg-white p-3 space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Contact</p>
              {student.email && (
                <p className="flex items-center gap-1.5 text-xs text-gray-600">
                  <Mail className="h-3 w-3 text-gray-400" />{student.email}
                </p>
              )}
              {student.phone && (
                <p className="flex items-center gap-1.5 text-xs text-gray-600">
                  <Phone className="h-3 w-3 text-gray-400" />{student.phone}
                </p>
              )}
            </div>
          )}

          {student.address && (
            <div className="rounded-xl border border-gray-100 bg-white p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Address</p>
              <p className="mt-1 text-sm text-gray-700">{student.address}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


function TeacherIdCard({ teacher, schoolName }: { teacher: Teacher; schoolName: string }) {
  return (
    <div className="id-card-hanging relative px-5 pt-8">
      {/* Lanyard */}
      <div className="absolute left-1/2 top-0 h-12 w-px -translate-x-1/2 bg-gray-300" />
      <div className="id-card-lanyard-clip absolute left-1/2 top-10 h-4 w-16 -translate-x-1/2 rounded-full border border-gray-200 bg-white shadow-sm" />

      <Card className="id-card-inner overflow-hidden border-emerald-100 bg-white shadow-lg">
        {/* Header — Emerald gradient for teachers */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-5 text-white">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-emerald-200">{schoolName}</p>
          <div className="flex items-center gap-4">
            <Avatar src={teacher.photo_url} name={teacher.full_name} size="lg" className="ring-4 ring-white/30 !bg-emerald-400 !text-white" />
            <div className="min-w-0">
              <p className="truncate text-lg font-bold">{teacher.full_name}</p>
              <p className="text-sm text-emerald-100">Emp. ID {teacher.employee_id}</p>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <Badge variant="outline" className="border-white/30 bg-white/10 text-white text-[10px]">TEACHER</Badge>
            {teacher.designation && (
              <Badge variant="outline" className="border-white/30 bg-white/10 text-white text-[10px]">{teacher.designation.toUpperCase()}</Badge>
            )}
          </div>
        </div>

        <CardContent className="space-y-4 p-5">
          <div className="grid grid-cols-2 gap-3">
            <DetailField
              label="Department"
              value={teacher.department || "-"}
              icon={<Briefcase className="h-3 w-3" />}
            />
            <DetailField
              label="Designation"
              value={teacher.designation || "-"}
            />
            <DetailField
              label="Experience"
              value={teacher.experience_years ? `${teacher.experience_years} yrs` : "-"}
            />
            <DetailField
              label="Joining Date"
              value={teacher.joining_date ? new Date(teacher.joining_date).toLocaleDateString("en-IN") : "-"}
              icon={<Calendar className="h-3 w-3" />}
            />
          </div>

          {teacher.qualification && (
            <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Qualification</p>
              <p className="mt-1 text-sm font-semibold text-gray-900">{teacher.qualification}</p>
              {teacher.specialization && (
                <p className="text-xs text-gray-500">Specialization: {teacher.specialization}</p>
              )}
            </div>
          )}

          {/* Contact */}
          <div className="rounded-xl border border-gray-100 bg-white p-3 space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Contact</p>
            <p className="flex items-center gap-1.5 text-xs text-gray-600">
              <Mail className="h-3 w-3 text-gray-400" />{teacher.email}
            </p>
            {teacher.phone && (
              <p className="flex items-center gap-1.5 text-xs text-gray-600">
                <Phone className="h-3 w-3 text-gray-400" />{teacher.phone}
              </p>
            )}
          </div>

          {teacher.address && (
            <div className="rounded-xl border border-gray-100 bg-white p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Address</p>
              <p className="mt-1 text-sm text-gray-700">{teacher.address}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


function StaffIdCard({ staff, schoolName }: { staff: Staff; schoolName: string }) {
  return (
    <div className="id-card-hanging relative px-5 pt-8">
      {/* Lanyard */}
      <div className="absolute left-1/2 top-0 h-12 w-px -translate-x-1/2 bg-gray-300" />
      <div className="id-card-lanyard-clip absolute left-1/2 top-10 h-4 w-16 -translate-x-1/2 rounded-full border border-gray-200 bg-white shadow-sm" />

      <Card className="id-card-inner overflow-hidden border-amber-100 bg-white shadow-lg">
        {/* Header — Amber gradient for non-teaching staff */}
        <div className="bg-gradient-to-r from-amber-600 to-orange-600 p-5 text-white">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-amber-200">{schoolName}</p>
          <div className="flex items-center gap-4">
            <Avatar src={staff.photo_url} name={staff.full_name} size="lg" className="ring-4 ring-white/30 !bg-amber-400 !text-white" />
            <div className="min-w-0">
              <p className="truncate text-lg font-bold">{staff.full_name}</p>
              <p className="text-sm text-amber-100">Emp. ID {staff.employee_id}</p>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <Badge variant="outline" className="border-white/30 bg-white/10 text-white text-[10px]">NON-TEACHING STAFF</Badge>
            {staff.designation && (
              <Badge variant="outline" className="border-white/30 bg-white/10 text-white text-[10px]">{staff.designation.toUpperCase()}</Badge>
            )}
          </div>
        </div>

        <CardContent className="space-y-4 p-5">
          <div className="grid grid-cols-2 gap-3">
            <DetailField
              label="Designation"
              value={staff.designation || "-"}
              icon={<Wrench className="h-3 w-3" />}
            />
            <DetailField
              label="Department"
              value={staff.department || "-"}
              icon={<Briefcase className="h-3 w-3" />}
            />
            <DetailField
              label="Experience"
              value={staff.experience_years ? `${staff.experience_years} yrs` : "-"}
            />
            <DetailField
              label="Joining Date"
              value={staff.joining_date ? new Date(staff.joining_date).toLocaleDateString("en-IN") : "-"}
              icon={<Calendar className="h-3 w-3" />}
            />
          </div>

          {staff.qualification && (
            <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Qualification</p>
              <p className="mt-1 text-sm font-semibold text-gray-900">{staff.qualification}</p>
            </div>
          )}

          {/* Contact */}
          <div className="rounded-xl border border-gray-100 bg-white p-3 space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Contact</p>
            <p className="flex items-center gap-1.5 text-xs text-gray-600">
              <Mail className="h-3 w-3 text-gray-400" />{staff.email}
            </p>
            {staff.phone && (
              <p className="flex items-center gap-1.5 text-xs text-gray-600">
                <Phone className="h-3 w-3 text-gray-400" />{staff.phone}
              </p>
            )}
          </div>

          {staff.address && (
            <div className="rounded-xl border border-gray-100 bg-white p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Address</p>
              <p className="mt-1 text-sm text-gray-700">{staff.address}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
