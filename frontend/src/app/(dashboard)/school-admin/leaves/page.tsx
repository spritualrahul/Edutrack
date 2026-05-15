"use client";

import { useCallback, useEffect, useState } from "react";
import { Calendar, CheckCircle2, XCircle } from "lucide-react";
import { Badge, EmptyState, Skeleton } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiClient } from "@/lib/api";
import { useAuthState } from "@/hooks/useAuth";

type LeaveRequest = {
  id: string;
  teacher_name?: string | null;
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

export default function SchoolAdminLeavesPage() {
  const auth = useAuthState();
  const schoolId = auth.schoolId;
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const loadRequests = useCallback(async () => {
    if (!schoolId) {
      setRequests([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.getLeaveRequests(schoolId);
      setRequests(response.data);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Could not load leave requests."));
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      loadRequests();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [loadRequests]);

  const decide = async (leaveId: string, status: "approved" | "rejected") => {
    if (!schoolId) return;
    if (status === "rejected" && !rejectionReason.trim()) {
      setError("Rejection reason is required.");
      return;
    }

    setSavingId(leaveId);
    setError(null);
    try {
      await apiClient.decideLeave(schoolId, leaveId, {
        status,
        rejection_reason: status === "rejected" ? rejectionReason.trim() : undefined,
      });
      setRejectingId(null);
      setRejectionReason("");
      await loadRequests();
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Could not update leave request."));
    } finally {
      setSavingId(null);
    }
  };

  const pendingCount = requests.filter((request) => request.status === "pending").length;
  const approvedCount = requests.filter((request) => request.status === "approved").length;
  const rejectedCount = requests.filter((request) => request.status === "rejected").length;

  if (!schoolId) {
    return (
      <EmptyState
        icon={<Calendar className="h-12 w-12" />}
        title="No school assigned"
        description="School admins need a school assignment before managing leave requests."
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: "Pending", value: pendingCount, tone: "bg-amber-50 text-amber-700" },
          { label: "Approved", value: approvedCount, tone: "bg-emerald-50 text-emerald-700" },
          { label: "Rejected", value: rejectedCount, tone: "bg-red-50 text-red-700" },
        ].map((item) => (
          <Card key={item.label} className="p-4 text-center">
            <p className="text-xs uppercase tracking-wider text-gray-500">{item.label}</p>
            <p className={`mx-auto mt-2 flex h-12 w-12 items-center justify-center rounded-full text-2xl font-bold ${item.tone}`}>{item.value}</p>
          </Card>
        ))}
      </div>

      {error && <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <Card>
        <CardHeader>
          <CardTitle>Teacher Leave Requests</CardTitle>
          <CardDescription>Approve or reject teacher leave applications with an audit trail.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex flex-col gap-3">
              {[0, 1, 2].map((item) => <Skeleton key={item} className="h-24 w-full" />)}
            </div>
          ) : requests.length === 0 ? (
            <EmptyState
              icon={<Calendar className="h-12 w-12" />}
              title="No leave requests"
              description="Teacher leave applications will appear here."
            />
          ) : (
            <div className="flex flex-col gap-3">
              {requests.map((request) => (
                <div key={request.id} className="rounded-xl border border-gray-100 p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50">
                        <Calendar className="h-5 w-5 text-indigo-600" />
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-gray-900">{request.teacher_name || "Teacher"}</p>
                          <Badge variant={statusVariant[request.status as keyof typeof statusVariant] || "default"}>{request.status}</Badge>
                        </div>
                        <p className="mt-1 text-sm capitalize text-gray-700">{request.leave_type.replace("_", " ")} Leave</p>
                        <p className="text-xs text-gray-500">
                          {formatDate(request.start_date)} to {formatDate(request.end_date)} ({request.total_days} day{request.total_days > 1 ? "s" : ""})
                        </p>
                        <p className="mt-2 text-sm text-gray-600">{request.reason}</p>
                        {request.rejection_reason && <p className="mt-1 text-xs text-red-600">Reason: {request.rejection_reason}</p>}
                      </div>
                    </div>
                    {request.status === "pending" && (
                      <div className="flex flex-col gap-2 lg:min-w-72">
                        {rejectingId === request.id && (
                          <Input
                            value={rejectionReason}
                            onChange={(event) => setRejectionReason(event.target.value)}
                            placeholder="Reason for rejection"
                          />
                        )}
                        <div className="flex gap-2">
                          <Button size="sm" variant="success" onClick={() => decide(request.id, "approved")} loading={savingId === request.id}>
                            <CheckCircle2 className="h-4 w-4" /> Approve
                          </Button>
                          {rejectingId === request.id ? (
                            <Button size="sm" variant="destructive" onClick={() => decide(request.id, "rejected")} loading={savingId === request.id}>
                              Confirm Reject
                            </Button>
                          ) : (
                            <Button size="sm" variant="outline" onClick={() => setRejectingId(request.id)}>
                              <XCircle className="h-4 w-4" /> Reject
                            </Button>
                          )}
                        </div>
                      </div>
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
