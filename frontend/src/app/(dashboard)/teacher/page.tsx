"use client";

import { StatsCard } from "@/components/dashboard/stats-card";
import { BirthdayWishes } from "@/components/dashboard/birthday-wishes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuthState } from "@/hooks/useAuth";
import { CalendarCheck, BookOpen, Bell, FileText, Users, Clock, CheckCircle2 } from "lucide-react";

const todayClasses = [
  { time: "8:00 - 8:45", class: "10-A", subject: "Mathematics", room: "Room 201" },
  { time: "8:45 - 9:30", class: "10-B", subject: "Mathematics", room: "Room 202" },
  { time: "10:00 - 10:45", class: "12-A", subject: "Physics", room: "Lab 1" },
  { time: "11:30 - 12:15", class: "9-C", subject: "Mathematics", room: "Room 105" },
  { time: "1:00 - 1:45", class: "11-A", subject: "Physics", room: "Room 301" },
];

export default function TeacherDashboard() {
  const auth = useAuthState();

  return (
    <div className="space-y-6">
      <BirthdayWishes schoolId={auth.schoolId} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatsCard title="Classes Today" value="5" icon={BookOpen} iconBg="bg-indigo-50" iconColor="text-indigo-600" />
        <StatsCard title="Students" value="185" icon={Users} iconBg="bg-emerald-50" iconColor="text-emerald-600" />
        <StatsCard title="Attendance Marked" value="3/5" icon={CalendarCheck} iconBg="bg-amber-50" iconColor="text-amber-600" />
        <StatsCard title="Leave Balance" value="12" description="days remaining" icon={Clock} iconBg="bg-violet-50" iconColor="text-violet-600" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Today&apos;s Timetable</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {todayClasses.map((cls, i) => (
                <div key={i} className="flex items-center justify-between rounded-xl border border-gray-100 p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="text-center min-w-[80px]">
                      <p className="text-xs font-medium text-gray-500">{cls.time.split(" - ")[0]}</p>
                      <p className="text-[10px] text-gray-400">{cls.time.split(" - ")[1]}</p>
                    </div>
                    <div className="h-10 w-px bg-gray-200" />
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{cls.subject}</p>
                      <p className="text-xs text-gray-500">Class {cls.class} · {cls.room}</p>
                    </div>
                  </div>
                  <Button variant={i < 3 ? "ghost" : "outline"} size="sm">
                    {i < 3 ? <><CheckCircle2 className="h-4 w-4 text-emerald-500 mr-1" /> Done</> : "Mark Attendance"}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Recent Notices</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { title: "Staff Meeting - Thursday", date: "May 15", priority: "high" },
                  { title: "Report Card Submission Due", date: "May 20", priority: "urgent" },
                  { title: "Annual Day Preparations", date: "May 12", priority: "normal" },
                ].map((n, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-lg border border-gray-50 hover:bg-gray-50 transition-colors">
                    <Bell className={`h-4 w-4 mt-0.5 ${n.priority === "urgent" ? "text-red-500" : n.priority === "high" ? "text-amber-500" : "text-gray-400"}`} />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{n.title}</p>
                      <p className="text-xs text-gray-400">{n.date}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Leave Applications</CardTitle>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full"><FileText className="h-4 w-4 mr-2" /> Apply for Leave</Button>
              <div className="mt-3 space-y-2">
                <div className="flex justify-between items-center p-3 rounded-lg bg-gray-50 text-sm">
                  <span className="text-gray-600">May 5-6 (Casual)</span>
                  <Badge variant="success">Approved</Badge>
                </div>
                <div className="flex justify-between items-center p-3 rounded-lg bg-gray-50 text-sm">
                  <span className="text-gray-600">Apr 22 (Sick)</span>
                  <Badge variant="success">Approved</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
