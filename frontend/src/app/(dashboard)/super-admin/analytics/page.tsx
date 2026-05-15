"use client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { MiniChartCard } from "@/components/dashboard/stats-card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";

const growthData = [
  { month: "Jan", schools: 12, students: 8500 }, { month: "Feb", schools: 14, students: 9200 },
  { month: "Mar", schools: 15, students: 9800 }, { month: "Apr", schools: 18, students: 10500 },
  { month: "May", schools: 21, students: 11200 }, { month: "Jun", schools: 24, students: 12450 },
];
const stateData = [
  { state: "Delhi", schools: 5 }, { state: "MH", schools: 4 }, { state: "KA", schools: 3 },
  { state: "TN", schools: 3 }, { state: "UP", schools: 3 }, { state: "PB", schools: 2 }, { state: "Others", schools: 4 },
];
const planDist = [{ name: "Starter", value: 8, color: "#a5b4fc" }, { name: "Pro", value: 10, color: "#818cf8" }, { name: "Enterprise", value: 6, color: "#6366f1" }];

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <MiniChartCard title="School Growth" value="24" data={[12, 14, 15, 18, 21, 24]} color="#6366f1" />
        <MiniChartCard title="Student Growth" value="12.4K" data={[8500, 9200, 9800, 10500, 11200, 12450]} color="#10b981" />
        <MiniChartCard title="Avg Size" value="518" data={[490, 505, 510, 512, 515, 518]} color="#f59e0b" />
        <MiniChartCard title="Active Rate" value="92%" data={[88, 89, 90, 91, 91, 92]} color="#8b5cf6" />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 mb-6">
        <Card><CardHeader><CardTitle>Growth Trend</CardTitle></CardHeader><CardContent>
          <ResponsiveContainer width="100%" height={280}><LineChart data={growthData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis yAxisId="l" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis yAxisId="r" orientation="right" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid #e2e8f0" }} />
            <Line yAxisId="l" type="monotone" dataKey="schools" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 4 }} />
            <Line yAxisId="r" type="monotone" dataKey="students" stroke="#10b981" strokeWidth={2.5} dot={{ r: 4 }} />
          </LineChart></ResponsiveContainer>
        </CardContent></Card>
        <Card><CardHeader><CardTitle>Schools by State</CardTitle></CardHeader><CardContent>
          <ResponsiveContainer width="100%" height={280}><BarChart data={stateData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="state" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid #e2e8f0" }} />
            <Bar dataKey="schools" fill="#6366f1" radius={[6, 6, 0, 0]} barSize={32} />
          </BarChart></ResponsiveContainer>
        </CardContent></Card>
      </div>
      <Card><CardHeader><CardTitle>Plan Distribution</CardTitle></CardHeader><CardContent>
        <div className="flex items-center justify-center gap-12">
          <ResponsiveContainer width={200} height={200}><PieChart><Pie data={planDist} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
            {planDist.map((e, i) => <Cell key={i} fill={e.color} />)}
          </Pie></PieChart></ResponsiveContainer>
          <div className="space-y-3">{planDist.map((p) => (
            <div key={p.name} className="flex items-center gap-3"><div className="h-3 w-3 rounded-full" style={{ backgroundColor: p.color }} /><span className="text-sm text-gray-600 w-20">{p.name}</span><span className="text-sm font-bold text-gray-900">{p.value}</span></div>
          ))}</div>
        </div>
      </CardContent></Card>
    </div>
  );
}
