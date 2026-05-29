"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Badge, EmptyState, Skeleton } from "@/components/ui/badge";
import { apiClient } from "@/lib/api";
import {
  Building2,
  Copy,
  Edit,
  Eye,
  GraduationCap,
  MapPin,
  Plus,
  Power,
  Save,
  Search,
  Trash2,
  Users,
  X,
} from "lucide-react";

type Plan = {
  id: string;
  name: string;
  price_monthly: string | number;
  max_students: number;
  features?: Record<string, boolean>;
};

type School = {
  id: string;
  name: string;
  slug: string;
  unique_code: string;
  email: string;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  subscription_plan_id?: string | null;
  subscription_plan_name?: string | null;
  subscription_plan_features?: Record<string, boolean> | null;
  subscription_status: string;
  is_active: boolean;
  student_count?: number;
  teacher_count?: number;
  created_at: string;
};

type FormState = {
  name: string;
  slug: string;
  unique_code: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  subscription_plan_id: string;
  subscription_status: string;
};

const emptyForm: FormState = {
  name: "",
  slug: "",
  unique_code: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  state: "",
  pincode: "",
  subscription_plan_id: "",
  subscription_status: "trial",
};

function schoolToForm(school: School): FormState {
  return {
    name: school.name || "",
    slug: school.slug || "",
    unique_code: school.unique_code || "",
    email: school.email || "",
    phone: school.phone || "",
    address: school.address || "",
    city: school.city || "",
    state: school.state || "",
    pincode: school.pincode || "",
    subscription_plan_id: school.subscription_plan_id || "",
    subscription_status: school.subscription_status || "trial",
  };
}

function getErrorMessage(error: unknown, fallback: string) {
  if (typeof error === "object" && error !== null && "response" in error) {
    const response = (error as { response?: { data?: { detail?: string } } }).response;
    return response?.data?.detail || fallback;
  }
  return fallback;
}

export default function SchoolsPage() {
  const [schools, setSchools] = useState<School[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingSchool, setEditingSchool] = useState<School | null>(null);
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [schoolsResponse, plansResponse] = await Promise.all([
        apiClient.getOrganizations({ page_size: 100 }),
        apiClient.getSubscriptionPlans(),
      ]);
      setSchools(schoolsResponse.data.items || []);
      setPlans(plansResponse.data || []);
    } catch (err) {
      setError(getErrorMessage(err, "Could not load schools."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void fetchData();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    return schools.filter((school) => {
      const matchesSearch =
        !term ||
        school.name.toLowerCase().includes(term) ||
        school.email.toLowerCase().includes(term) ||
        school.unique_code.toLowerCase().includes(term) ||
        (school.city || "").toLowerCase().includes(term);
      const matchesStatus = !statusFilter || school.subscription_status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [schools, search, statusFilter]);

  const openCreate = () => {
    setEditingSchool(null);
    setSelectedSchool(null);
    setForm(emptyForm);
    setFormOpen(true);
  };

  const openEdit = (school: School) => {
    setEditingSchool(school);
    setSelectedSchool(school);
    setForm(schoolToForm(school));
    setFormOpen(true);
  };

  const submitForm = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const payload = Object.fromEntries(
      Object.entries(form).filter(([, value]) => String(value).trim() !== "")
    );
    try {
      if (editingSchool) {
        await apiClient.updateOrganization(editingSchool.id, payload);
      } else {
        await apiClient.createOrganization(payload);
      }
      setFormOpen(false);
      setEditingSchool(null);
      setForm(emptyForm);
      await fetchData();
    } catch (err) {
      setError(getErrorMessage(err, "Could not save school."));
    } finally {
      setSaving(false);
    }
  };

  const toggleSchool = async (school: School) => {
    await apiClient.updateOrganization(school.id, { is_active: !school.is_active });
    await fetchData();
  };

  const deactivateSchool = async (school: School) => {
    const confirmed = window.confirm(`Deactivate ${school.name}? Users will lose access until it is reactivated.`);
    if (!confirmed) return;
    await apiClient.deleteOrganization(school.id);
    await fetchData();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Schools</h1>
          <p className="mt-1 text-sm text-gray-500">Onboard schools, manage plans, and keep Clerk tenant codes in one place.</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4" /> Onboard School</Button>
      </div>

      {error && <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {formOpen && (
        <Card>
          <CardHeader className="flex flex-row items-start justify-between">
            <div>
              <CardTitle>{editingSchool ? "Edit School" : "Onboard School"}</CardTitle>
              <CardDescription>Basic school details, tenant code, and initial subscription plan.</CardDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setFormOpen(false)}><X className="h-4 w-4" /></Button>
          </CardHeader>
          <CardContent>
            <form onSubmit={submitForm} className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2">
                <Label>School Name</Label>
                <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Slug</Label>
                <Input placeholder="Auto-generated if blank" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Unique Code</Label>
                <Input placeholder="Auto-generated if blank" value={form.unique_code} onChange={(e) => setForm({ ...form, unique_code: e.target.value.toUpperCase() })} />
                <p className="text-xs text-gray-400">Use this as the school key in Clerk metadata.</p>
              </div>
              <div className="space-y-2">
                <Label>Plan</Label>
                <Select value={form.subscription_plan_id} onChange={(e) => setForm({ ...form, subscription_plan_id: e.target.value })}>
                  <option value="">No plan / trial</option>
                  {plans.map((plan) => (
                    <option key={plan.id} value={plan.id}>{plan.name} · ₹{Number(plan.price_monthly).toLocaleString("en-IN")}/mo</option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.subscription_status} onChange={(e) => setForm({ ...form, subscription_status: e.target.value })}>
                  <option value="trial">Trial</option>
                  <option value="active">Active</option>
                  <option value="expired">Expired</option>
                  <option value="cancelled">Cancelled</option>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>City</Label>
                <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>State</Label>
                <Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Pincode</Label>
                <Input value={form.pincode} onChange={(e) => setForm({ ...form, pincode: e.target.value })} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Address</Label>
                <Textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </div>
              <div className="flex items-end gap-2">
                <Button type="submit" loading={saving}><Save className="h-4 w-4" /> Save School</Button>
                <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {selectedSchool && (
        <Card className="border-indigo-100">
          <CardContent className="grid gap-5 p-5 lg:grid-cols-[1.2fr_1fr]">
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Badge variant="info">{selectedSchool.unique_code}</Badge>
                <Badge variant={selectedSchool.is_active ? "success" : "danger"}>{selectedSchool.is_active ? "active" : "inactive"}</Badge>
                <Badge variant={selectedSchool.subscription_status === "active" ? "success" : selectedSchool.subscription_status === "trial" ? "warning" : "danger"}>
                  {selectedSchool.subscription_status}
                </Badge>
              </div>
              <h2 className="text-xl font-semibold text-gray-900">{selectedSchool.name}</h2>
              <p className="mt-1 text-sm text-gray-500">{selectedSchool.email} · {selectedSchool.phone || "No phone"}</p>
              <p className="mt-3 max-w-2xl text-sm text-gray-600">{selectedSchool.address || "No address added yet"}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-4">
                <p className="text-xs text-gray-500">Students</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">{selectedSchool.student_count || 0}</p>
              </div>
              <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-4">
                <p className="text-xs text-gray-500">Teachers</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">{selectedSchool.teacher_count || 0}</p>
              </div>
              <div className="col-span-2 rounded-xl border border-gray-100 bg-white p-4">
                <p className="text-xs text-gray-500">Plan</p>
                <p className="mt-1 text-sm font-semibold text-gray-900">{selectedSchool.subscription_plan_name || "Trial / no plan"}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {Object.entries(selectedSchool.subscription_plan_features || {}).filter(([, enabled]) => enabled).slice(0, 6).map(([feature]) => (
                    <Badge key={feature} variant="outline" className="text-[10px]">{feature.replaceAll("_", " ")}</Badge>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle>All Schools</CardTitle>
            <CardDescription>{filtered.length} schools from the database</CardDescription>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input placeholder="Search school, email, code..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 sm:w-72" />
            </div>
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="sm:w-40">
              <option value="">All Status</option>
              <option value="trial">Trial</option>
              <option value="active">Active</option>
              <option value="expired">Expired</option>
              <option value="cancelled">Cancelled</option>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-3 p-6">{Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-14" />)}</div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<Building2 className="h-10 w-10" />}
              title="No schools yet"
              description="Onboard your first real school. This table only renders database records."
              action={<Button onClick={openCreate}><Plus className="h-4 w-4" /> Onboard School</Button>}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/70">
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">School</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Unique Code</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Location</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Students</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Teachers</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Plan</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map((school) => (
                    <tr key={school.id} className="group hover:bg-gray-50/80">
                      <td className="px-6 py-4">
                        <Link href={`/super-admin/schools/${school.id}`} className="flex items-center gap-3 group/link">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-sm font-bold text-indigo-600">{school.name[0]}</div>
                          <div>
                            <p className="text-sm font-semibold text-gray-900 group-hover/link:text-indigo-600 transition-colors">{school.name}</p>
                            <p className="text-xs text-gray-400">{school.email}</p>
                          </div>
                        </Link>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1 font-mono text-xs font-semibold text-gray-700 hover:bg-gray-50"
                          onClick={() => navigator.clipboard?.writeText(school.unique_code)}
                          title="Copy Clerk school key"
                        >
                          {school.unique_code}<Copy className="h-3 w-3 text-gray-400" />
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 text-sm text-gray-600">
                          <MapPin className="h-3.5 w-3.5 text-gray-400" />{school.city || "Not set"}{school.state ? `, ${school.state}` : ""}
                        </div>
                      </td>
                      <td className="px-6 py-4"><span className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-900"><GraduationCap className="h-3.5 w-3.5 text-gray-400" />{school.student_count || 0}</span></td>
                      <td className="px-6 py-4"><span className="inline-flex items-center gap-1.5 text-sm text-gray-600"><Users className="h-3.5 w-3.5 text-gray-400" />{school.teacher_count || 0}</span></td>
                      <td className="px-6 py-4"><Badge variant="info">{school.subscription_plan_name || "Trial"}</Badge></td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          <Badge variant={school.subscription_status === "active" ? "success" : school.subscription_status === "trial" ? "warning" : "danger"}>
                            {school.subscription_status}
                          </Badge>
                          {!school.is_active && <Badge variant="danger">inactive</Badge>}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedSchool(school)} title="View">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(school)} title="Edit">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleSchool(school)} title={school.is_active ? "Deactivate" : "Activate"}>
                            <Power className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700" onClick={() => deactivateSchool(school)} title="Deactivate school">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
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
  );
}
