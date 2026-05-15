"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge, Avatar } from "@/components/ui/badge";
import { BirthdayWishes } from "@/components/dashboard/birthday-wishes";
import { useAuthState } from "@/hooks/useAuth";
import { apiClient } from "@/lib/api";
import {
  CalendarCheck, IndianRupee, Bell, FileText, Download, ChevronRight,
  CheckCircle2, XCircle, Clock, TrendingUp,
} from "lucide-react";

const attendanceThisWeek = [
  { day: "Mon", status: "present" }, { day: "Tue", status: "present" }, { day: "Wed", status: "absent" },
  { day: "Thu", status: "present" }, { day: "Fri", status: "late" }, { day: "Sat", status: "holiday" },
];

const feeStatus = [
  { month: "April 2025", amount: 15000, status: "paid", date: "Apr 8" },
  { month: "May 2025", amount: 15000, status: "paid", date: "May 10" },
  { month: "June 2025", amount: 15000, status: "pending", date: "Jun 10" },
  { month: "July 2025", amount: 15000, status: "upcoming", date: "Jul 10" },
];

type Student = {
  full_name: string;
  admission_number: string;
  class_name?: string | null;
  section_name?: string | null;
  roll_number?: number | null;
};

export default function ParentDashboard() {
  const auth = useAuthState();
  const [student, setStudent] = useState<Student | null>(null);
  const [pending, setPending] = useState(0);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (!auth.schoolId) return;
      apiClient.getMyStudent(auth.schoolId).then(async (response) => {
        const linked = response.data as Student & { id: string };
        setStudent(linked);
        const fees = await apiClient.getStudentPendingFees(auth.schoolId!, linked.id);
        setPending((fees.data || []).reduce((sum: number, fee: { balance?: number | string }) => sum + Number(fee.balance || 0), 0));
      }).catch(() => {
        setStudent(null);
      });
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [auth.schoolId]);

  return (
    <div className="space-y-6">
      <BirthdayWishes schoolId={auth.schoolId} />

      {/* Student Info Card */}
      <Card className="mb-6 overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 p-6 text-white">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 text-2xl font-bold backdrop-blur-sm">AS</div>
            <div>
              <h2 className="text-xl font-bold">{student?.full_name || auth.firstName}</h2>
              <p className="text-indigo-200">
                {student ? `${student.class_name || "Class not set"}${student.section_name ? `-${student.section_name}` : ""} · Roll No. ${student.roll_number || "-"} · Adm. No. ${student.admission_number}` : "Linked student details will appear here"}
              </p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-4">
            <div className="rounded-xl bg-white/10 p-3 backdrop-blur-sm text-center">
              <p className="text-2xl font-bold">92%</p>
              <p className="text-xs text-indigo-200">Attendance</p>
            </div>
            <div className="rounded-xl bg-white/10 p-3 backdrop-blur-sm text-center">
              <p className="text-2xl font-bold">₹30K</p>
              <p className="text-xs text-indigo-200">Fees Paid</p>
            </div>
            <div className="rounded-xl bg-white/10 p-3 backdrop-blur-sm text-center">
              <p className="text-2xl font-bold">₹{pending.toLocaleString("en-IN")}</p>
              <p className="text-xs text-indigo-200">Pending</p>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Attendance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><CalendarCheck className="h-5 w-5 text-indigo-600" /> This Week</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-6 gap-2">
              {attendanceThisWeek.map((d, i) => (
                <div key={i} className="flex flex-col items-center gap-1.5">
                  <p className="text-xs text-gray-500">{d.day}</p>
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                    d.status === "present" ? "bg-emerald-50" : d.status === "absent" ? "bg-red-50" :
                    d.status === "late" ? "bg-amber-50" : "bg-gray-50"
                  }`}>
                    {d.status === "present" && <CheckCircle2 className="h-5 w-5 text-emerald-500" />}
                    {d.status === "absent" && <XCircle className="h-5 w-5 text-red-500" />}
                    {d.status === "late" && <Clock className="h-5 w-5 text-amber-500" />}
                    {d.status === "holiday" && <span className="text-xs text-gray-400">H</span>}
                  </div>
                </div>
              ))}
            </div>
            <Button variant="ghost" className="w-full mt-4" size="sm">View Full Attendance <ChevronRight className="h-4 w-4" /></Button>
          </CardContent>
        </Card>

        {/* Fee Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><IndianRupee className="h-5 w-5 text-indigo-600" /> Fee Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {feeStatus.map((f, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg border border-gray-50 p-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{f.month}</p>
                    <p className="text-xs text-gray-400">Due: {f.date}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-gray-900">₹{f.amount.toLocaleString()}</span>
                    <Badge variant={f.status === "paid" ? "success" : f.status === "pending" ? "warning" : "default"}>
                      {f.status}
                    </Badge>
                    {f.status === "paid" && (
                      <Button variant="ghost" size="icon" className="h-7 w-7"><Download className="h-3.5 w-3.5" /></Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <Button className="w-full mt-4" size="sm">Pay Pending Fees</Button>
          </CardContent>
        </Card>

        {/* Notices */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5 text-indigo-600" /> Notices</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { title: "Annual Day Celebration on May 25th", date: "May 15", category: "event", priority: "high" },
                { title: "Summer Vacation from June 1-30", date: "May 12", category: "holiday", priority: "normal" },
                { title: "Parent-Teacher Meeting on May 22", date: "May 10", category: "academic", priority: "high" },
              ].map((n, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg border border-gray-50 p-4 hover:bg-gray-50 transition-colors cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${n.priority === "high" ? "bg-amber-50" : "bg-gray-50"}`}>
                      <Bell className={`h-4 w-4 ${n.priority === "high" ? "text-amber-600" : "text-gray-400"}`} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{n.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="default" className="text-[10px]">{n.category}</Badge>
                        <span className="text-xs text-gray-400">{n.date}</span>
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-300" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
