"use client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileText, IndianRupee, Calendar } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const dailyData = [
  { day: "Mon", amount: 45000 }, { day: "Tue", amount: 62000 }, { day: "Wed", amount: 38000 },
  { day: "Thu", amount: 55000 }, { day: "Fri", amount: 72000 }, { day: "Sat", amount: 25000 },
];

export default function FeeReportsPage() {
  return (
    <div className="space-y-6">
      <Card className="mb-6"><CardHeader><CardTitle>This Week&apos;s Collection</CardTitle><CardDescription>Daily breakdown</CardDescription></CardHeader><CardContent>
        <ResponsiveContainer width="100%" height={250}><BarChart data={dailyData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="day" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
          <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${(v/1000)}K`} />
          <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid #e2e8f0" }} formatter={(v: unknown) => `₹${Number(v ?? 0).toLocaleString("en-IN")}`} />
          <Bar dataKey="amount" fill="#6366f1" radius={[6, 6, 0, 0]} barSize={36} />
        </BarChart></ResponsiveContainer>
      </CardContent></Card>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {[
          { title: "Daily Collection Report", desc: "Today's fee collection summary", icon: IndianRupee, color: "bg-emerald-50 text-emerald-600" },
          { title: "Monthly Summary", desc: "Monthly collection and pending overview", icon: Calendar, color: "bg-indigo-50 text-indigo-600" },
          { title: "Defaulters List", desc: "Students with overdue payments", icon: FileText, color: "bg-red-50 text-red-600" },
          { title: "Mode-wise Report", desc: "Collection breakdown by payment mode", icon: FileText, color: "bg-violet-50 text-violet-600" },
        ].map((r, i) => (
          <Card key={i}><CardContent className="p-5 flex items-center justify-between">
            <div className="flex items-center gap-3"><div className={`flex h-10 w-10 items-center justify-center rounded-xl ${r.color}`}><r.icon className="h-5 w-5" /></div>
              <div><p className="text-sm font-semibold text-gray-900">{r.title}</p><p className="text-xs text-gray-500">{r.desc}</p></div></div>
            <Button variant="outline" size="sm"><Download className="h-4 w-4 mr-1" />Export</Button>
          </CardContent></Card>
        ))}
      </div>
    </div>
  );
}
