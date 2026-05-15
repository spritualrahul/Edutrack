"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Clock, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const months = ["January", "February", "March", "April", "May"];
const attendanceData = Array.from({ length: 26 }, (_, i) => {
  const day = i + 1;
  return { day, status: day % 11 === 0 ? "absent" : day % 7 === 0 ? "late" : "present" };
});
const monthlyPercentages = [94, 91, 96, 92, 95];

export default function ParentAttendancePage() {
  return (
    <div className="space-y-6">
      <Card className="mb-6"><CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>May 2025</CardTitle><div className="flex gap-2"><Button variant="outline" size="icon" className="h-8 w-8"><ChevronLeft className="h-4 w-4" /></Button><Button variant="outline" size="icon" className="h-8 w-8"><ChevronRight className="h-4 w-4" /></Button></div>
      </CardHeader><CardContent>
        <div className="grid grid-cols-7 gap-2">{["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <div key={i} className="text-center text-xs font-medium text-gray-400 pb-2">{d}</div>
        ))}{Array.from({ length: 3 }, (_, i) => <div key={`e${i}`} />)}{attendanceData.map((d) => (
          <div key={d.day} className={`flex h-10 w-full items-center justify-center rounded-lg text-sm font-medium ${d.status === "present" ? "bg-emerald-50 text-emerald-700" : d.status === "absent" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>{d.day}</div>
        ))}</div>
        <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-gray-100">
          <div className="flex items-center gap-2"><div className="h-3 w-3 rounded-full bg-emerald-500" /><span className="text-sm text-gray-600">Present ({attendanceData.filter((d) => d.status === "present").length})</span></div>
          <div className="flex items-center gap-2"><div className="h-3 w-3 rounded-full bg-red-500" /><span className="text-sm text-gray-600">Absent ({attendanceData.filter((d) => d.status === "absent").length})</span></div>
          <div className="flex items-center gap-2"><div className="h-3 w-3 rounded-full bg-amber-500" /><span className="text-sm text-gray-600">Late ({attendanceData.filter((d) => d.status === "late").length})</span></div>
        </div>
      </CardContent></Card>
      <Card><CardHeader><CardTitle>Monthly Summary</CardTitle></CardHeader><CardContent><div className="space-y-2">{months.map((m, i) => {
        const pct = monthlyPercentages[i] ?? 90;
        return (<div key={m} className="flex items-center justify-between p-3 rounded-lg border border-gray-50"><span className="text-sm text-gray-600">{m} 2025</span>
          <div className="flex items-center gap-3"><div className="w-32 h-2 rounded-full bg-gray-100 overflow-hidden"><div className="h-full rounded-full bg-indigo-500" style={{ width: `${pct}%` }} /></div><span className="text-sm font-semibold text-gray-900 w-12 text-right">{pct}%</span></div>
        </div>);
      })}</div></CardContent></Card>
    </div>
  );
}
