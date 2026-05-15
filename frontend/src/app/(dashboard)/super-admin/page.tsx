"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { StatsCard } from "@/components/dashboard/stats-card";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge, EmptyState, Skeleton } from "@/components/ui/badge";
import { apiClient } from "@/lib/api";
import { ArrowRight, Building2, CreditCard, GraduationCap, IndianRupee, Plus, Users } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Stats = {
  total_schools: number;
  active_schools: number;
  total_students: number;
  total_teachers: number;
  total_revenue?: number | string;
  monthly_revenue?: number | string;
  schools_by_plan?: Record<string, number>;
};

type School = {
  id: string;
  name: string;
  unique_code: string;
  city?: string | null;
  student_count?: number;
  subscription_plan_name?: string | null;
  subscription_status: string;
  is_active: boolean;
};

export default function SuperAdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      apiClient.getPlatformStats(),
      apiClient.getOrganizations({ page_size: 5 }),
    ])
      .then(([statsResponse, schoolsResponse]) => {
        if (!mounted) return;
        setStats(statsResponse.data);
        setSchools(schoolsResponse.data.items || []);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const planData = useMemo(
    () => Object.entries(stats?.schools_by_plan || {}).map(([plan, count]) => ({ plan, count })),
    [stats]
  );

  if (loading) {
    return <div className="space-y-6"><Skeleton className="h-28" /><Skeleton className="h-80" /><Skeleton className="h-80" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Super Admin</h1>
          <p className="mt-1 text-sm text-gray-500">Live platform overview from production data.</p>
        </div>
        <Button asChild>
          <Link href="/super-admin/schools"><Plus className="h-4 w-4" /> Onboard School</Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard title="Total Schools" value={String(stats?.total_schools || 0)} description={`${stats?.active_schools || 0} active`} icon={Building2} iconBg="bg-indigo-50" iconColor="text-indigo-600" />
        <StatsCard title="Total Students" value={Number(stats?.total_students || 0).toLocaleString("en-IN")} description="Across active schools" icon={GraduationCap} iconBg="bg-emerald-50" iconColor="text-emerald-600" />
        <StatsCard title="Subscription Revenue" value={`₹${Number(stats?.total_revenue || 0).toLocaleString("en-IN")}`} description="Verified Razorpay payments" icon={IndianRupee} iconBg="bg-amber-50" iconColor="text-amber-600" />
        <StatsCard title="Teachers" value={Number(stats?.total_teachers || 0).toLocaleString("en-IN")} description={`₹${Number(stats?.monthly_revenue || 0).toLocaleString("en-IN")} this month`} icon={Users} iconBg="bg-violet-50" iconColor="text-violet-600" />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Schools by Plan</CardTitle>
            <CardDescription>Only real schools assigned to plans are counted.</CardDescription>
          </CardHeader>
          <CardContent>
            {planData.length === 0 ? (
              <EmptyState icon={<CreditCard className="h-10 w-10" />} title="No plan usage yet" description="Assign plans as schools are onboarded." />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={planData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="plan" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid #e2e8f0" }} />
                  <Bar dataKey="count" fill="#6366f1" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Schools</CardTitle>
              <CardDescription>Freshly created or updated tenants.</CardDescription>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/super-admin/schools">View All <ArrowRight className="h-3.5 w-3.5" /></Link>
            </Button>
          </CardHeader>
          <CardContent>
            {schools.length === 0 ? (
              <EmptyState
                icon={<Building2 className="h-10 w-10" />}
                title="No schools yet"
                description="Start by onboarding the first school from the Schools page."
                action={<Button asChild><Link href="/super-admin/schools"><Plus className="h-4 w-4" /> Onboard School</Link></Button>}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="pb-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">School</th>
                      <th className="pb-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Code</th>
                      <th className="pb-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Students</th>
                      <th className="pb-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Plan</th>
                      <th className="pb-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {schools.map((school) => (
                      <tr key={school.id} className="hover:bg-gray-50/60">
                        <td className="py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-sm font-semibold text-indigo-600">{school.name[0]}</div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">{school.name}</p>
                              <p className="text-xs text-gray-400">{school.city || "No city"}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 font-mono text-xs font-semibold text-gray-700">{school.unique_code}</td>
                        <td className="py-3.5 text-sm font-medium text-gray-900">{school.student_count || 0}</td>
                        <td className="py-3.5"><Badge variant="info">{school.subscription_plan_name || "Trial"}</Badge></td>
                        <td className="py-3.5">
                          <Badge variant={school.is_active && school.subscription_status === "active" ? "success" : school.subscription_status === "trial" ? "warning" : "danger"}>
                            {school.is_active ? school.subscription_status : "inactive"}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
