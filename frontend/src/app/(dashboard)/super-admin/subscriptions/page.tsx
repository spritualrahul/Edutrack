"use client";

import { FormEvent, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Badge, EmptyState, Skeleton } from "@/components/ui/badge";
import { apiClient } from "@/lib/api";
import { Check, CreditCard, Edit, GraduationCap, HardDrive, Save, Users, X } from "lucide-react";

type Plan = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  price_monthly: string | number;
  price_yearly: string | number;
  max_students: number;
  max_teachers: number;
  max_staff: number;
  features: Record<string, boolean>;
  is_active: boolean;
};

type EditState = {
  name: string;
  description: string;
  price_monthly: string;
  price_yearly: string;
  max_students: string;
  max_teachers: string;
  max_staff: string;
  features: string;
};

function getErrorMessage(error: unknown, fallback: string) {
  if (typeof error === "object" && error !== null && "response" in error) {
    const response = (error as { response?: { data?: { detail?: string } } }).response;
    return response?.data?.detail || fallback;
  }
  return fallback;
}

function toEditState(plan: Plan): EditState {
  return {
    name: plan.name,
    description: plan.description || "",
    price_monthly: String(plan.price_monthly),
    price_yearly: String(plan.price_yearly),
    max_students: String(plan.max_students),
    max_teachers: String(plan.max_teachers),
    max_staff: String(plan.max_staff),
    features: Object.entries(plan.features || {})
      .filter(([, enabled]) => enabled)
      .map(([feature]) => feature)
      .join(", "),
  };
}

export default function SubscriptionsPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [form, setForm] = useState<EditState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchPlans = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.getSubscriptionPlans({ include_inactive: true });
      setPlans(response.data || []);
    } catch (err) {
      setError(getErrorMessage(err, "Could not load subscription plans."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void fetchPlans();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  const startEdit = (plan: Plan) => {
    setEditing(plan);
    setForm(toEditState(plan));
  };

  const savePlan = async (event: FormEvent) => {
    event.preventDefault();
    if (!editing || !form) return;
    setSaving(true);
    setError(null);
    const features = form.features
      .split(",")
      .map((feature) => feature.trim())
      .filter(Boolean)
      .reduce<Record<string, boolean>>((acc, feature) => {
        acc[feature] = true;
        return acc;
      }, {});
    try {
      await apiClient.updateSubscriptionPlan(editing.id, {
        name: form.name,
        description: form.description,
        price_monthly: Number(form.price_monthly),
        price_yearly: Number(form.price_yearly),
        max_students: Number(form.max_students),
        max_teachers: Number(form.max_teachers),
        max_staff: Number(form.max_staff),
        features,
      });
      setEditing(null);
      setForm(null);
      await fetchPlans();
    } catch (err) {
      setError(getErrorMessage(err, "Could not save plan."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Subscription Plans</h1>
        <p className="mt-1 text-sm text-gray-500">Configure pricing, limits, and enabled features for schools.</p>
      </div>

      {error && <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {editing && form && (
        <Card>
          <CardHeader className="flex flex-row items-start justify-between">
            <div>
              <CardTitle>Edit {editing.name}</CardTitle>
              <CardDescription>Feature names are stored as plan flags and used for school feature access.</CardDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setEditing(null)}><X className="h-4 w-4" /></Button>
          </CardHeader>
          <CardContent>
            <form onSubmit={savePlan} className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Monthly Price</Label>
                <Input required type="number" min="1" value={form.price_monthly} onChange={(e) => setForm({ ...form, price_monthly: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Yearly Price</Label>
                <Input required type="number" min="1" value={form.price_yearly} onChange={(e) => setForm({ ...form, price_yearly: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Student Limit</Label>
                <Input required type="number" min="1" value={form.max_students} onChange={(e) => setForm({ ...form, max_students: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Teacher Limit</Label>
                <Input required type="number" min="1" value={form.max_teachers} onChange={(e) => setForm({ ...form, max_teachers: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Staff Limit</Label>
                <Input required type="number" min="1" value={form.max_staff} onChange={(e) => setForm({ ...form, max_staff: e.target.value })} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Description</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="space-y-2 md:col-span-2 lg:col-span-3">
                <Label>Enabled Features</Label>
                <Input value={form.features} onChange={(e) => setForm({ ...form, features: e.target.value })} />
                <p className="text-xs text-gray-400">Comma separated, for example: fee_management, attendance, notices, reports, whatsapp, ai.</p>
              </div>
              <div className="flex items-end gap-2">
                <Button type="submit" loading={saving}><Save className="h-4 w-4" /> Save Plan</Button>
                <Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="grid gap-6 lg:grid-cols-3">{Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-96" />)}</div>
      ) : plans.length === 0 ? (
        <EmptyState icon={<CreditCard className="h-10 w-10" />} title="No plans configured" description="Run the backend seed to create system plans." />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {plans.map((plan) => {
            const features = Object.entries(plan.features || {}).filter(([, enabled]) => enabled).map(([feature]) => feature);
            return (
              <Card key={plan.id} className={plan.slug === "professional" ? "relative overflow-hidden ring-2 ring-indigo-500" : "relative overflow-hidden"}>
                {plan.slug === "professional" && <div className="absolute right-0 top-0 rounded-bl-lg bg-indigo-600 px-3 py-1 text-xs font-medium text-white">Popular</div>}
                <CardHeader>
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                  <div className="mt-4">
                    <span className="text-4xl font-bold text-gray-900">₹{Number(plan.price_monthly).toLocaleString("en-IN")}</span>
                    <span className="text-sm text-gray-500">/month</span>
                  </div>
                  <p className="text-xs text-gray-400">₹{Number(plan.price_yearly).toLocaleString("en-IN")}/year</p>
                </CardHeader>
                <CardContent>
                  <div className="mb-6 space-y-3">
                    <div className="flex items-center gap-2 text-sm text-gray-600"><GraduationCap className="h-4 w-4 text-gray-400" />Up to {plan.max_students.toLocaleString()} students</div>
                    <div className="flex items-center gap-2 text-sm text-gray-600"><Users className="h-4 w-4 text-gray-400" />Up to {plan.max_teachers} teachers</div>
                    <div className="flex items-center gap-2 text-sm text-gray-600"><HardDrive className="h-4 w-4 text-gray-400" />Up to {plan.max_staff} staff</div>
                  </div>
                  <div className="space-y-2 border-t border-gray-100 pt-4">
                    {features.length === 0 ? (
                      <p className="text-sm text-gray-500">No feature flags enabled.</p>
                    ) : (
                      features.map((feature) => (
                        <div key={feature} className="flex items-center gap-2 text-sm">
                          <Check className="h-4 w-4 text-emerald-500" />
                          <span className="text-gray-600">{feature.replaceAll("_", " ")}</span>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="mt-6 flex items-center justify-between">
                    <Badge variant={plan.is_active ? "success" : "danger"}>{plan.is_active ? "active" : "inactive"}</Badge>
                    <Button variant={plan.slug === "professional" ? "default" : "outline"} size="sm" onClick={() => startEdit(plan)}>
                      <Edit className="h-4 w-4" /> Edit Plan
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
