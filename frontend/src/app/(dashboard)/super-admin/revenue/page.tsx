"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { StatsCard } from "@/components/dashboard/stats-card";
import { Button } from "@/components/ui/button";
import { IndianRupee, TrendingUp, ArrowUpRight, ArrowDownRight, Download } from "lucide-react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const monthlyRevenue = [
  { month: "Jul", revenue: 145000 }, { month: "Aug", revenue: 162000 }, { month: "Sep", revenue: 178000 },
  { month: "Oct", revenue: 195000 }, { month: "Nov", revenue: 188000 }, { month: "Dec", revenue: 210000 },
  { month: "Jan", revenue: 198000 }, { month: "Feb", revenue: 225000 }, { month: "Mar", revenue: 240000 },
  { month: "Apr", revenue: 255000 }, { month: "May", revenue: 270000 }, { month: "Jun", revenue: 285000 },
];

const revenueByPlan = [
  { plan: "Starter", revenue: 72000, color: "#a5b4fc" },
  { plan: "Professional", revenue: 180000, color: "#818cf8" },
  { plan: "Enterprise", revenue: 108000, color: "#6366f1" },
];

export default function RevenuePage() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatsCard title="Total Revenue" value="₹28.5L" change="18%" changeType="positive" description="this year" icon={IndianRupee} iconBg="bg-emerald-50" iconColor="text-emerald-600" />
        <StatsCard title="MRR" value="₹2.85L" change="12%" changeType="positive" description="vs last month" icon={TrendingUp} iconBg="bg-indigo-50" iconColor="text-indigo-600" />
        <StatsCard title="ARPU" value="₹11,875" change="5%" changeType="positive" description="per school" icon={ArrowUpRight} iconBg="bg-violet-50" iconColor="text-violet-600" />
        <StatsCard title="Churn Rate" value="2.1%" change="0.5%" changeType="negative" description="this month" icon={ArrowDownRight} iconBg="bg-red-50" iconColor="text-red-600" />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 mb-6">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Revenue Trend</CardTitle><CardDescription>Monthly recurring revenue over 12 months</CardDescription></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={monthlyRevenue}>
                <defs><linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} /><stop offset="95%" stopColor="#6366f1" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" /><XAxis dataKey="month" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${(v/1000)}K`} />
                <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid #e2e8f0" }} formatter={(v: unknown) => [`₹${Number(v ?? 0).toLocaleString("en-IN")}`, "Revenue"]} />
                <Area type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={2.5} fill="url(#revGrad)" dot={{ fill: "#6366f1", r: 4 }} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Revenue by Plan</CardTitle><CardDescription>Current month breakdown</CardDescription></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={revenueByPlan} layout="vertical"><CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${(v/1000)}K`} />
                <YAxis dataKey="plan" type="category" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} width={90} />
                <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid #e2e8f0" }} formatter={(v: unknown) => `₹${Number(v ?? 0).toLocaleString("en-IN")}`} />
                <Bar dataKey="revenue" radius={[0, 8, 8, 0]} barSize={28} fill="#6366f1" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
