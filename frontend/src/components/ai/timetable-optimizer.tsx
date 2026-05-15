"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Bot, CalendarCheck, Sparkles } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Badge, EmptyState } from "@/components/ui/badge";
import { apiClient } from "@/lib/api";
import { useAuthState } from "@/hooks/useAuth";

type TimetableSlot = {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  class_label: string;
  subject: string;
  teacher_id?: string;
  teacher: string;
  room?: string | null;
  is_substitute?: boolean;
};

type OptimizerResult = {
  summary?: string;
  conflicts?: { type: string; severity: string; description: string; slot_refs?: string[] }[];
  workload_summary?: { teacher: string; periods: number; risk: string }[];
  substitute_recommendations?: { teacher: string; reason: string; confidence: number }[];
  optimized_slots?: { day: string; time: string; class_label: string; subject: string; teacher: string; room?: string; note?: string }[];
  next_steps?: string[];
};

const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const subjectColors: Record<string, string> = {
  Mathematics: "border-indigo-100 bg-indigo-50 text-indigo-700",
  Physics: "border-sky-100 bg-sky-50 text-sky-700",
  English: "border-emerald-100 bg-emerald-50 text-emerald-700",
  Chemistry: "border-amber-100 bg-amber-50 text-amber-700",
};

function getErrorMessage(error: unknown, fallback: string) {
  if (typeof error === "object" && error !== null && "response" in error) {
    const response = (error as { response?: { data?: { detail?: string } } }).response;
    return response?.data?.detail || fallback;
  }
  return fallback;
}

export function TimetableOptimizer({ audience = "teacher" }: { audience?: "teacher" | "admin" }) {
  const auth = useAuthState();
  const [constraints, setConstraints] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<OptimizerResult | null>(null);
  const [slots, setSlots] = useState<TimetableSlot[]>([]);

  const schoolId = auth.schoolId;

  useEffect(() => {
    if (!schoolId) return;

    let mounted = true;
    void Promise.resolve().then(async () => {
      if (!mounted) return;
      setLoadingSlots(true);
      try {
        const response = await apiClient.getTimetableSlots(
          schoolId,
          targetDate ? { target_date: targetDate } : undefined
        );
        if (mounted) setSlots(response.data || []);
      } catch (err: unknown) {
        if (mounted) setError(getErrorMessage(err, "Could not load timetable slots."));
      } finally {
        if (mounted) setLoadingSlots(false);
      }
    });

    return () => {
      mounted = false;
    };
  }, [schoolId, targetDate]);

  const slotsByDay = useMemo(() => {
    return days.map((day, index) => ({ day, slots: slots.filter((slot) => slot.day_of_week === index) }));
  }, [slots]);

  const optimize = async () => {
    if (!schoolId) {
      setError("Your account is not assigned to a school.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.optimizeTimetable(schoolId, {
        existing_slots: slots.map((slot) => ({
          id: slot.id,
          day: days[slot.day_of_week] || "Unknown",
          time: `${slot.start_time}-${slot.end_time}`,
          class_label: slot.class_label,
          subject: slot.subject,
          teacher_id: slot.teacher_id,
          teacher: slot.teacher,
          room: slot.room || "",
        })),
        target_date: targetDate || null,
        constraints: constraints || null,
      });
      setResult(response.data);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Could not optimize timetable."));
    } finally {
      setLoading(false);
    }
  };

  if (!schoolId) {
    return (
      <EmptyState
        icon={<CalendarCheck className="h-12 w-12" />}
        title="No school assigned"
        description="A school assignment is required before AI timetable optimization can run."
      />
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <CalendarCheck className="h-5 w-5 text-indigo-600" /> {audience === "admin" ? "AI Timetable Optimization" : "My Timetable"}
                </CardTitle>
                <CardDescription>Color-coded weekly periods with conflict and workload analysis.</CardDescription>
              </div>
              <Badge variant="info">AI assisted</Badge>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-2">
            {slotsByDay.map(({ day, slots }) => (
              <div key={day} className="rounded-xl border border-gray-100 bg-gray-50/60 p-4">
                <h3 className="mb-3 text-sm font-semibold text-gray-900">{day}</h3>
                <div className="space-y-2">
                  {slots.map((slot) => (
                    <div key={slot.id} className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <Badge className={subjectColors[slot.subject] || "border-gray-100 bg-gray-50 text-gray-700"}>{slot.subject}</Badge>
                          <p className="mt-2 text-sm font-semibold text-gray-950">Class {slot.class_label}</p>
                          <p className="text-xs text-gray-500">{slot.teacher} · {slot.room ? `Room ${slot.room}` : "No room assigned"}</p>
                        </div>
                        <span className="text-xs font-medium text-gray-500">{slot.start_time}-{slot.end_time}</span>
                      </div>
                    </div>
                  ))}
                  {slots.length === 0 && <p className="py-6 text-center text-sm text-gray-400">No periods</p>}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-indigo-600" /> Optimization Panel
            </CardTitle>
            <CardDescription>Run conflict checks and substitute recommendations.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
            {loadingSlots && <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-700">Loading timetable...</div>}
            <div>
              <Label className="mb-2 block">Target Date</Label>
              <Input type="date" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} />
            </div>
            <div>
              <Label className="mb-2 block">Constraints</Label>
              <Textarea
                value={constraints}
                onChange={(event) => setConstraints(event.target.value)}
                placeholder="Example: Sunita Verma is absent, keep Physics in Lab 1, avoid first period for Class 10."
              />
            </div>
            <Button className="w-full" onClick={optimize} loading={loading}>
              <Bot className="h-4 w-4" /> Optimize Timetable
            </Button>
            {!slots.length && !loadingSlots && (
              <p className="text-xs leading-5 text-gray-500">
                No saved timetable slots for this date.
              </p>
            )}
          </CardContent>
        </Card>

        {result && (
          <Card>
            <CardHeader>
              <CardTitle>AI Suggestions</CardTitle>
              <CardDescription>{result.summary || "Optimization complete."}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {result.conflicts && result.conflicts.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-gray-900">Conflicts</p>
                  {result.conflicts.map((conflict, index) => (
                    <div key={`${conflict.type}-${index}`} className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-sm text-amber-800">
                      <div className="flex items-center gap-2 font-medium">
                        <AlertTriangle className="h-4 w-4" /> {conflict.severity}
                      </div>
                      <p className="mt-1">{conflict.description}</p>
                    </div>
                  ))}
                </div>
              )}
              {result.substitute_recommendations && result.substitute_recommendations.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-gray-900">Substitutes</p>
                  {result.substitute_recommendations.map((item) => (
                    <div key={item.teacher} className="rounded-xl border border-gray-100 p-3">
                      <p className="text-sm font-semibold text-gray-950">{item.teacher}</p>
                      <p className="mt-1 text-xs leading-5 text-gray-500">{item.reason}</p>
                    </div>
                  ))}
                </div>
              )}
              {result.next_steps && result.next_steps.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-gray-900">Next Steps</p>
                  {result.next_steps.map((step) => <p key={step} className="text-sm text-gray-600">- {step}</p>)}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
