"use client";

import { useAuthState } from "@/hooks/useAuth";
import { BirthdayWishes } from "@/components/dashboard/birthday-wishes";
import {
  CalendarCheck,
  IndianRupee,
  Bell,
  BookOpen,
  Award,
  Clock,
} from "lucide-react";

export default function StudentDashboard() {
  const auth = useAuthState();

  const stats = [
    { label: "Attendance", value: "92%", icon: CalendarCheck, color: "text-emerald-600", bg: "bg-emerald-50" },
    { label: "Pending Fees", value: "₹15,000", icon: IndianRupee, color: "text-amber-600", bg: "bg-amber-50" },
    { label: "Notices", value: "3 New", icon: Bell, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Subjects", value: "8", icon: BookOpen, color: "text-violet-600", bg: "bg-violet-50" },
  ];

  return (
    <div className="space-y-6">
      <BirthdayWishes schoolId={auth.schoolId} />

      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back, {auth.firstName}! 👋
        </h1>
        <p className="text-gray-500 mt-1">Here&apos;s your academic overview</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{stat.label}</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">{stat.value}</p>
              </div>
              <div className={`${stat.bg} rounded-lg p-2.5`}>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <button className="flex items-center gap-3 rounded-lg border border-gray-100 p-4 hover:bg-gray-50 transition-colors">
            <CalendarCheck className="h-5 w-5 text-emerald-500" />
            <span className="text-sm font-medium text-gray-700">View Attendance</span>
          </button>
          <button className="flex items-center gap-3 rounded-lg border border-gray-100 p-4 hover:bg-gray-50 transition-colors">
            <IndianRupee className="h-5 w-5 text-amber-500" />
            <span className="text-sm font-medium text-gray-700">Fee Status</span>
          </button>
          <button className="flex items-center gap-3 rounded-lg border border-gray-100 p-4 hover:bg-gray-50 transition-colors">
            <Bell className="h-5 w-5 text-blue-500" />
            <span className="text-sm font-medium text-gray-700">View Notices</span>
          </button>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
        <div className="space-y-4">
          {[
            { icon: Award, text: "Mathematics test score: 85/100", time: "2 hours ago", color: "text-indigo-500" },
            { icon: CalendarCheck, text: "Attendance marked: Present", time: "Today, 9:00 AM", color: "text-emerald-500" },
            { icon: Bell, text: "New notice: Annual Day Celebration", time: "Yesterday", color: "text-blue-500" },
            { icon: Clock, text: "Fee payment due: May 2025", time: "3 days ago", color: "text-amber-500" },
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-3 py-2">
              <div className="mt-0.5">
                <item.icon className={`h-4 w-4 ${item.color}`} />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-700">{item.text}</p>
                <p className="text-xs text-gray-400 mt-0.5">{item.time}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
