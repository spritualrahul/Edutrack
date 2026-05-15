"use client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { StatsCard } from "@/components/dashboard/stats-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { IndianRupee, TrendingUp, AlertCircle, CheckCircle2, Plus, Download, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const feeData = [
  { month: "Apr", collected: 450000, pending: 120000 }, { month: "May", collected: 520000, pending: 95000 },
  { month: "Jun", collected: 480000, pending: 110000 }, { month: "Jul", collected: 550000, pending: 80000 },
];
const structures = [
  { id: 1, name: "Class 1-5 Fee Structure", classes: "Class 1-5", amount: 12000, components: 4, students: 350 },
  { id: 2, name: "Class 6-8 Fee Structure", classes: "Class 6-8", amount: 15000, components: 5, students: 280 },
  { id: 3, name: "Class 9-10 Fee Structure", classes: "Class 9-10", amount: 18000, components: 5, students: 200 },
  { id: 4, name: "Class 11-12 Fee Structure", classes: "Class 11-12", amount: 22000, components: 6, students: 150 },
];

export default function FeesPage() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatsCard title="Total Collected" value="₹20L" change="15%" changeType="positive" description="this year" icon={IndianRupee} iconBg="bg-emerald-50" iconColor="text-emerald-600" />
        <StatsCard title="Pending" value="₹4.05L" change="8%" changeType="negative" description="overdue" icon={AlertCircle} iconBg="bg-red-50" iconColor="text-red-600" />
        <StatsCard title="Collection Rate" value="83%" change="5%" changeType="positive" description="vs last month" icon={TrendingUp} iconBg="bg-indigo-50" iconColor="text-indigo-600" />
        <StatsCard title="Fully Paid" value="856" change="12" changeType="positive" description="students" icon={CheckCircle2} iconBg="bg-violet-50" iconColor="text-violet-600" />
      </div>
      <Card className="mb-6"><CardHeader><CardTitle>Collection Trend</CardTitle></CardHeader><CardContent>
        <ResponsiveContainer width="100%" height={250}><AreaChart data={feeData}>
          <defs><linearGradient id="cG" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.15} /><stop offset="95%" stopColor="#10b981" stopOpacity={0} /></linearGradient></defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" /><XAxis dataKey="month" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
          <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${(v/1000)}K`} />
          <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid #e2e8f0" }} /><Area type="monotone" dataKey="collected" stroke="#10b981" strokeWidth={2} fill="url(#cG)" />
        </AreaChart></ResponsiveContainer>
      </CardContent></Card>
      <Card><CardHeader><CardTitle>Fee Structures</CardTitle></CardHeader><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full"><thead><tr className="border-b border-gray-100 bg-gray-50/50">
        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Structure</th>
        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Classes</th>
        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount/Month</th>
        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Components</th>
        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Students</th>
        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
      </tr></thead><tbody className="divide-y divide-gray-50">{structures.map((s) => (
        <tr key={s.id} className="hover:bg-gray-50/80 transition-colors">
          <td className="px-6 py-4 text-sm font-medium text-gray-900">{s.name}</td>
          <td className="px-6 py-4"><Badge variant="info">{s.classes}</Badge></td>
          <td className="px-6 py-4 text-sm font-semibold text-gray-900">₹{s.amount.toLocaleString()}</td>
          <td className="px-6 py-4 text-sm text-gray-600">{s.components}</td>
          <td className="px-6 py-4 text-sm text-gray-600">{s.students}</td>
          <td className="px-6 py-4 text-right"><Button variant="ghost" size="sm">Edit</Button></td>
        </tr>
      ))}</tbody></table></div></CardContent></Card>
    </div>
  );
}
