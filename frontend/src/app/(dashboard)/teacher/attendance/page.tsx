"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, EmptyState, Skeleton } from "@/components/ui/badge";
import { Check, GraduationCap } from "lucide-react";
import { apiClient } from "@/lib/api";
import { useAuthState } from "@/hooks/useAuth";

type AttendanceStudent = {
  id: string;
  name: string;
  roll: number | string;
  class_id?: string | null;
  status: string;
};

export default function TeacherAttendancePage() {
  const auth = useAuthState();
  const [list, setList] = useState<AttendanceStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (!auth.schoolId) {
        setLoading(false);
        return;
      }
      apiClient
        .getStudents(auth.schoolId, { page_size: 100 })
        .then((response) => {
          setList((response.data.items || []).map((student: Record<string, unknown>) => ({
            id: String(student.id),
            name: String(student.full_name || ""),
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

  const mark = (id: string, status: string) => setList(list.map((student) => student.id === id ? { ...student, status } : student));
  const markAll = (status: string) => setList(list.map((student) => ({ ...student, status })));

  const submit = async () => {
    if (!auth.schoolId) return;
    const classId = list.find((student) => student.class_id)?.class_id;
    if (!classId) {
      setError("Students must be assigned to a class before attendance can be submitted.");
      return;
    }
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      await apiClient.markBulkAttendance(auth.schoolId, {
        class_id: classId,
        date: today,
        records: list.filter((student) => student.status).map((student) => ({
          student_id: student.id,
          date: today,
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
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Class Attendance</CardTitle>
            <CardDescription>{new Date(today).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => markAll("present")}><Check className="mr-1 h-4 w-4" />All Present</Button>
            <Button variant="success" size="sm" loading={saving} disabled={list.length === 0 || list.some((student) => !student.status)} onClick={submit}>Submit</Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">{Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-14" />)}</div>
          ) : list.length === 0 ? (
            <EmptyState icon={<GraduationCap className="h-10 w-10" />} title="No students found" description="Students assigned to your school will appear here." />
          ) : (
            <div className="space-y-2">
              {list.map((student) => (
                <div key={student.id} className="flex items-center justify-between rounded-xl border border-gray-100 p-3 hover:bg-gray-50">
                  <div className="flex items-center gap-3">
                    <span className="w-8 text-right font-mono text-sm text-gray-400">{student.roll}</span>
                    <Avatar name={student.name} size="sm" />
                    <span className="text-sm font-medium text-gray-900">{student.name}</span>
                  </div>
                  <div className="flex gap-1.5">
                    {[
                      { value: "present", label: "P", color: "emerald" },
                      { value: "absent", label: "A", color: "red" },
                      { value: "late", label: "L", color: "amber" },
                    ].map((option) => (
                      <button
                        key={option.value}
                        onClick={() => mark(student.id, option.value)}
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
