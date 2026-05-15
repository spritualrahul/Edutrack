"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, EmptyState, Skeleton } from "@/components/ui/badge";
import { Check, Clock, GraduationCap } from "lucide-react";
import { apiClient } from "@/lib/api";
import { useAuthState } from "@/hooks/useAuth";

type AttendanceStudent = {
  id: string;
  name: string;
  roll: number | string;
  class_id?: string | null;
  status: string;
};

export default function AttendancePage() {
  const auth = useAuthState();
  const [students, setStudents] = useState<AttendanceStudent[]>([]);
  const [selectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (!auth.schoolId) {
        setLoading(false);
        return;
      }
      apiClient
        .getStudents(auth.schoolId, { page_size: 100 })
        .then((response) => {
          setStudents((response.data.items || []).map((student: Record<string, unknown>) => ({
            id: String(student.id),
            name: String(student.full_name || `${student.first_name || ""} ${student.last_name || ""}`.trim()),
            roll: (student.roll_number as number) || "-",
            class_id: student.class_id as string | null,
            status: "",
          })));
        })
        .catch(() => setError("Could not load students."))
        .finally(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [auth.schoolId]);

  const markAll = (status: string) => setStudents(students.map((student) => ({ ...student, status })));
  const markOne = (id: string, status: string) => setStudents(students.map((student) => student.id === id ? { ...student, status } : student));

  const present = students.filter((student) => student.status === "present").length;
  const absent = students.filter((student) => student.status === "absent").length;
  const late = students.filter((student) => student.status === "late").length;
  const unmarked = students.filter((student) => !student.status).length;

  const submitAttendance = async () => {
    if (!auth.schoolId) return;
    const classId = students.find((student) => student.class_id)?.class_id;
    if (!classId) {
      setError("Students must be assigned to a class before attendance can be submitted.");
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await apiClient.markBulkAttendance(auth.schoolId, {
        class_id: classId,
        date: selectedDate,
        records: students.filter((student) => student.status).map((student) => ({
          student_id: student.id,
          date: selectedDate,
          status: student.status,
        })),
      });
      setMessage("Attendance submitted.");
    } catch {
      setError("Could not submit attendance.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {message && <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div>}
      {error && <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card className="p-4 text-center"><p className="text-2xl font-bold text-emerald-600">{present}</p><p className="text-xs text-gray-500">Present</p></Card>
        <Card className="p-4 text-center"><p className="text-2xl font-bold text-red-600">{absent}</p><p className="text-xs text-gray-500">Absent</p></Card>
        <Card className="p-4 text-center"><p className="text-2xl font-bold text-amber-600">{late}</p><p className="text-xs text-gray-500">Late</p></Card>
        <Card className="p-4 text-center"><p className="text-2xl font-bold text-gray-400">{unmarked}</p><p className="text-xs text-gray-500">Unmarked</p></Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Student Attendance</CardTitle>
            <CardDescription>{new Date(selectedDate).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => markAll("present")}><Check className="mr-1 h-4 w-4" /> Mark All Present</Button>
            <Button variant="success" size="sm" disabled={unmarked > 0 || students.length === 0} loading={saving} onClick={submitAttendance}>Submit</Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">{Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-14" />)}</div>
          ) : students.length === 0 ? (
            <EmptyState icon={<GraduationCap className="h-10 w-10" />} title="No students found" description="Onboard students before marking attendance." />
          ) : (
            <div className="space-y-2">
              {students.map((student) => (
                <div key={student.id} className="flex items-center justify-between rounded-xl border border-gray-100 p-3 hover:bg-gray-50">
                  <div className="flex items-center gap-3">
                    <span className="w-8 text-right font-mono text-sm text-gray-400">{student.roll}</span>
                    <Avatar name={student.name} size="sm" />
                    <span className="text-sm font-medium text-gray-900">{student.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {[
                      { value: "present", label: "P", color: "emerald" },
                      { value: "absent", label: "A", color: "red" },
                      { value: "late", label: "L", color: "amber" },
                    ].map((option) => (
                      <button
                        key={option.value}
                        onClick={() => markOne(student.id, option.value)}
                        className={`flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold ${
                          student.status === option.value
                            ? option.color === "emerald" ? "bg-emerald-100 text-emerald-700 ring-2 ring-emerald-300"
                            : option.color === "red" ? "bg-red-100 text-red-700 ring-2 ring-red-300"
                            : "bg-amber-100 text-amber-700 ring-2 ring-amber-300"
                            : "bg-gray-50 text-gray-400 hover:bg-gray-100"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                    <Clock className="ml-1 h-4 w-4 text-gray-300" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
