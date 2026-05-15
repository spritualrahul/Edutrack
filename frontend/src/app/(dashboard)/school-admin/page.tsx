"use client";

import { StatsCard } from "@/components/dashboard/stats-card";
import { BirthdayWishes } from "@/components/dashboard/birthday-wishes";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge, Avatar } from "@/components/ui/badge";
import { useAuthState } from "@/hooks/useAuth";
import {
  GraduationCap, Users, IndianRupee, CalendarCheck, TrendingUp,
  Bell, ArrowRight, Clock,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";

const feeCollectionData = [
  { month: "Apr", collected: 450000, pending: 120000 },
  { month: "May", collected: 520000, pending: 95000 },
  { month: "Jun", collected: 480000, pending: 110000 },
  { month: "Jul", collected: 550000, pending: 80000 },
  { month: "Aug", collected: 610000, pending: 70000 },
  { month: "Sep", collected: 580000, pending: 90000 },
];

const attendanceData = [
  { name: "Present", value: 420, color: "#10b981" },
  { name: "Absent", value: 35, color: "#ef4444" },
  { name: "Late", value: 18, color: "#f59e0b" },
  { name: "Half Day", value: 7, color: "#6366f1" },
];

const recentPayments: { id: number; student: string; class: string; amount: number; mode: string; time: string }[] = [];

const notices = [
  { id: 1, title: "Annual Day Celebration", category: "event", priority: "high", date: "May 15" },
  { id: 2, title: "Summer Vacation Notice", category: "holiday", priority: "normal", date: "May 12" },
  { id: 3, title: "Fee Deadline Extension", category: "fee", priority: "urgent", date: "May 10" },
];

export default function SchoolAdminDashboard() {
  const auth = useAuthState();

  return (
    <div className="space-y-6">
      <BirthdayWishes schoolId={auth.schoolId} />

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatsCard title="Total Students" value="1,245" change="3%" changeType="positive" description="vs last year" icon={GraduationCap} iconBg="bg-indigo-50" iconColor="text-indigo-600" />
        <StatsCard title="Total Teachers" value="68" change="2" changeType="positive" description="new this month" icon={Users} iconBg="bg-emerald-50" iconColor="text-emerald-600" />
        <StatsCard title="Fee Collected" value="₹5.8L" change="12%" changeType="positive" description="this month" icon={IndianRupee} iconBg="bg-amber-50" iconColor="text-amber-600" />
        <StatsCard title="Attendance Today" value="87.5%" change="2.1%" changeType="positive" description="vs yesterday" icon={CalendarCheck} iconBg="bg-violet-50" iconColor="text-violet-600" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 mb-6">
        {/* Fee Collection Trend */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Fee Collection Overview</CardTitle>
            <CardDescription>Monthly collection vs pending</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={feeCollectionData}>
                <defs>
                  <linearGradient id="collectedGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="pendingGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}K`} />
                <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid #e2e8f0" }} formatter={(v: unknown) => `₹${Number(v ?? 0).toLocaleString("en-IN")}`} />
                <Area type="monotone" dataKey="collected" stroke="#10b981" strokeWidth={2} fill="url(#collectedGrad)" name="Collected" />
                <Area type="monotone" dataKey="pending" stroke="#f59e0b" strokeWidth={2} fill="url(#pendingGrad)" name="Pending" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Attendance Donut */}
        <Card>
          <CardHeader>
            <CardTitle>Today&apos;s Attendance</CardTitle>
            <CardDescription>480 students total</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center">
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={attendanceData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                    {attendanceData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid #e2e8f0" }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-2 gap-3 w-full mt-2">
                {attendanceData.map((item) => (
                  <div key={item.name} className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-xs text-gray-600">{item.name}</span>
                    <span className="text-xs font-semibold text-gray-900 ml-auto">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Payments */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Payments</CardTitle>
            <Button variant="ghost" size="sm">View All <ArrowRight className="h-3.5 w-3.5 ml-1" /></Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentPayments.length === 0 && (
                <div className="rounded-xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500">
                  No payments collected today.
                </div>
              )}
              {recentPayments.map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-lg border border-gray-50 p-3 hover:bg-gray-50/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <Avatar name={p.student} size="sm" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{p.student}</p>
                      <p className="text-xs text-gray-500">Class {p.class}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900">₹{p.amount.toLocaleString()}</p>
                    <div className="flex items-center gap-1.5 justify-end">
                      <Badge variant={p.mode === "Cash" ? "success" : p.mode === "UPI" ? "info" : "outline"} className="text-[10px]">{p.mode}</Badge>
                      <span className="text-[10px] text-gray-400 flex items-center gap-0.5"><Clock className="h-2.5 w-2.5" />{p.time}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Notices */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Notices</CardTitle>
            <Button variant="ghost" size="sm">View All <ArrowRight className="h-3.5 w-3.5 ml-1" /></Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {notices.map((n) => (
                <div key={n.id} className="flex items-start gap-3 rounded-lg border border-gray-50 p-3 hover:bg-gray-50/50 transition-colors cursor-pointer">
                  <div className={`mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg ${n.priority === "urgent" ? "bg-red-50" : n.priority === "high" ? "bg-amber-50" : "bg-gray-50"}`}>
                    <Bell className={`h-4 w-4 ${n.priority === "urgent" ? "text-red-600" : n.priority === "high" ? "text-amber-600" : "text-gray-500"}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{n.title}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <Badge variant={n.priority === "urgent" ? "danger" : n.priority === "high" ? "warning" : "default"} className="text-[10px]">{n.category}</Badge>
                      <span className="text-xs text-gray-400">{n.date}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
