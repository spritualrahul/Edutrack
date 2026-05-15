"use client";

import { useCallback, useEffect, useState } from "react";
import { Calendar, Plus, X } from "lucide-react";
import { Badge, EmptyState, Skeleton } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { apiClient } from "@/lib/api";
import { useAuthState } from "@/hooks/useAuth";

type LeaveApplication = {
  id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  total_days: number;
  reason: string;
  status: "pending" | "approved" | "rejected" | "cancelled" | string;
  rejection_reason?: string | null;
  created_at: string;
};

const statusVariant = {
  approved: "success",
  pending: "warning",
  rejected: "danger",
  cancelled: "outline",
} as const;

function getErrorMessage(error: unknown, fallback: string) {
  if (typeof error === "object" && error !== null && "response" in error) {
    const response = (error as { response?: { data?: { detail?: string } } }).response;
    return response?.data?.detail || fallback;
  }
  return fallback;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export default function LeavePage() {
  const auth = useAuthState();
  const schoolId = auth.schoolId;
  const [showForm, setShowForm] = useState(false);
  const [leaves, setLeaves] = useState<LeaveApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    leave_type: "casual",
    start_date: "",
    end_date: "",
    reason: "",
  });

  const loadLeaves = useCallback(async () => {
    if (!schoolId) {
      setLeaves([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.getMyLeaves(schoolId);
      setLeaves(response.data);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Could not load leave applications."));
      setLeaves([]);
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      loadLeaves();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [loadLeaves]);

  const submitLeave = async () => {
    if (!schoolId || !form.start_date || !form.end_date || !form.reason.trim()) {
      setError("Leave type, dates, and reason are required.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await apiClient.applyLeave(schoolId, {
        leave_type: form.leave_type,
        start_date: form.start_date,
        end_date: form.end_date,
        reason: form.reason.trim(),
      });
      setShowForm(false);
      setForm({ leave_type: "casual", start_date: "", end_date: "", reason: "" });
      await loadLeaves();
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Could not submit leave application."));
    } finally {
      setSaving(false);
    }
  };

  const cancelLeave = async (leaveId: string) => {
    if (!schoolId) return;
    setSaving(true);
    setError(null);
    try {
      await apiClient.cancelLeave(schoolId, leaveId);
      await loadLeaves();
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Could not cancel leave application."));
    } finally {
      setSaving(false);
    }
  };

  const usedDays = leaves
    .filter((leave) => leave.status === "approved")
    .reduce((sum, leave) => sum + leave.total_days, 0);
  const pendingDays = leaves
    .filter((leave) => leave.status === "pending")
    .reduce((sum, leave) => sum + leave.total_days, 0);

  if (!schoolId) {
    return (
      <EmptyState
        icon={<Calendar className="h-12 w-12" />}
        title="No school assigned"
        description="Ask an administrator to assign your account to a school before applying for leave."
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: "Approved Days", value: usedDays, tone: "bg-emerald-50 text-emerald-700" },
          { label: "Pending Days", value: pendingDays, tone: "bg-amber-50 text-amber-700" },
          { label: "Applications", value: leaves.length, tone: "bg-indigo-50 text-indigo-700" },
        ].map((item) => (
          <Card key={item.label} className="p-4 text-center">
            <p className="text-xs uppercase tracking-wider text-gray-500">{item.label}</p>
            <p className={`mx-auto mt-2 flex h-12 w-12 items-center justify-center rounded-full text-2xl font-bold ${item.tone}`}>{item.value}</p>
          </Card>
        ))}
      </div>

      {error && <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Leave Applications</h2>
          <p className="text-sm text-gray-500">Track approval status and cancel pending requests.</p>
        </div>
        <Button onClick={() => setShowForm((value) => !value)}>
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? "Close" : "Apply Leave"}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>New Leave Application</CardTitle>
            <CardDescription>Your school admin will review this request.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <Label className="mb-2 block">Leave Type</Label>
                <Select value={form.leave_type} onChange={(event) => setForm((prev) => ({ ...prev, leave_type: event.target.value }))}>
                  <option value="casual">Casual Leave</option>
                  <option value="sick">Sick Leave</option>
                  <option value="earned">Earned Leave</option>
                  <option value="other">Other</option>
                </Select>
              </div>
              <div>
                <Label className="mb-2 block">From Date</Label>
                <Input type="date" value={form.start_date} onChange={(event) => setForm((prev) => ({ ...prev, start_date: event.target.value }))} />
              </div>
              <div>
                <Label className="mb-2 block">To Date</Label>
                <Input type="date" value={form.end_date} onChange={(event) => setForm((prev) => ({ ...prev, end_date: event.target.value }))} />
              </div>
            </div>
            <div>
              <Label className="mb-2 block">Reason</Label>
              <Textarea value={form.reason} onChange={(event) => setForm((prev) => ({ ...prev, reason: event.target.value }))} />
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button onClick={submitLeave} loading={saving}>Submit Application</Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Leave History</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex flex-col gap-3">
              {[0, 1, 2].map((item) => <Skeleton key={item} className="h-20 w-full" />)}
            </div>
          ) : leaves.length === 0 ? (
            <EmptyState
              icon={<Calendar className="h-12 w-12" />}
              title="No leave applications"
              description="Submit your first leave request when needed."
            />
          ) : (
            <div className="flex flex-col gap-3">
              {leaves.map((leave) => (
                <div key={leave.id} className="flex flex-col gap-3 rounded-lg border border-gray-100 p-4 hover:bg-gray-50 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50">
                      <Calendar className="h-5 w-5 text-indigo-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold capitalize text-gray-900">{leave.leave_type.replace("_", " ")} Leave</p>
                      <p className="text-xs text-gray-500">
                        {formatDate(leave.start_date)} to {formatDate(leave.end_date)} ({leave.total_days} day{leave.total_days > 1 ? "s" : ""})
                      </p>
                      <p className="mt-0.5 text-xs text-gray-400">{leave.reason}</p>
                      {leave.rejection_reason && <p className="mt-1 text-xs text-red-600">Reason: {leave.rejection_reason}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={statusVariant[leave.status as keyof typeof statusVariant] || "default"}>{leave.status}</Badge>
                    {leave.status === "pending" && (
                      <Button variant="outline" size="sm" onClick={() => cancelLeave(leave.id)} disabled={saving}>Cancel</Button>
                    )}
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
