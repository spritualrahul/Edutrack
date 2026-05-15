"use client";

import { useCallback, useEffect, useState } from "react";
import { Building2, Check, CreditCard, MailCheck, Save } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Badge, Skeleton } from "@/components/ui/badge";
import { apiClient } from "@/lib/api";
import { useAuthState } from "@/hooks/useAuth";

type SchoolSettingsForm = {
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  website: string;
  logo_url: string;
  academic_year_start: string;
  academic_year_end: string;
};

type Plan = {
  id: string;
  name: string;
  description?: string | null;
  price_monthly: string | number;
  price_yearly: string | number;
  max_students: number;
  features: Record<string, boolean>;
};

type RazorpayPayment = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

const monthOptions = [
  ["1", "January"],
  ["2", "February"],
  ["3", "March"],
  ["4", "April"],
  ["5", "May"],
  ["6", "June"],
  ["7", "July"],
  ["8", "August"],
  ["9", "September"],
  ["10", "October"],
  ["11", "November"],
  ["12", "December"],
];

const emptyForm: SchoolSettingsForm = {
  name: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  state: "",
  pincode: "",
  website: "",
  logo_url: "",
  academic_year_start: "4",
  academic_year_end: "3",
};

function getErrorMessage(error: unknown, fallback: string) {
  if (typeof error === "object" && error !== null && "response" in error) {
    const response = (error as { response?: { data?: { detail?: string } } }).response;
    return response?.data?.detail || fallback;
  }
  return fallback;
}

function loadRazorpayScript() {
  return new Promise<boolean>((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function SchoolSettings() {
  const auth = useAuthState();
  const [form, setForm] = useState<SchoolSettingsForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [currentPlanId, setCurrentPlanId] = useState<string | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string>("trial");
  const [buyingPlanId, setBuyingPlanId] = useState<string | null>(null);

  const loadSchool = useCallback(async () => {
    if (!auth.schoolId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [response, plansResponse] = await Promise.all([
        apiClient.getOrganization(auth.schoolId),
        apiClient.getSubscriptionPlans(),
      ]);
      const school = response.data;
      setPlans(plansResponse.data || []);
      setCurrentPlanId(school.subscription_plan_id || null);
      setSubscriptionStatus(school.subscription_status || "trial");
      setForm({
        name: school.name || "",
        email: school.email || "",
        phone: school.phone || "",
        address: school.address || "",
        city: school.city || "",
        state: school.state || "",
        pincode: school.pincode || "",
        website: school.website || "",
        logo_url: school.logo_url || "",
        academic_year_start: String(school.academic_year_start || 4),
        academic_year_end: String(school.academic_year_end || 3),
      });
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Could not load school settings."));
    } finally {
      setLoading(false);
    }
  }, [auth.schoolId]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadSchool();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [loadSchool]);

  const updateField = (field: keyof SchoolSettingsForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const saveSettings = async () => {
    if (!auth.schoolId) {
      setError("Your account is not assigned to a school.");
      return;
    }
    if (!form.name.trim() || !form.email.trim()) {
      setError("School name and email are required.");
      return;
    }

    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      await apiClient.updateOrganization(auth.schoolId, {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
        city: form.city.trim() || null,
        state: form.state.trim() || null,
        pincode: form.pincode.trim() || null,
        website: form.website.trim() || null,
        logo_url: form.logo_url.trim() || null,
        academic_year_start: Number(form.academic_year_start),
        academic_year_end: Number(form.academic_year_end),
      });
      setMessage("School settings updated.");
      await loadSchool();
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Could not save school settings."));
    } finally {
      setSaving(false);
    }
  };

  const buyPlan = async (plan: Plan) => {
    if (!auth.schoolId) return;
    setBuyingPlanId(plan.id);
    setMessage(null);
    setError(null);
    try {
      const response = await apiClient.createSubscriptionCheckout(auth.schoolId, {
        plan_id: plan.id,
        billing_cycle: "monthly",
      });
      if (!response.data.gateway_configured) {
        setMessage(response.data.message || "Razorpay subscription checkout is not configured yet.");
        return;
      }
      const loaded = await loadRazorpayScript();
      if (!loaded || !window.Razorpay) {
        setError("Razorpay checkout could not be loaded.");
        return;
      }
      const order = response.data.order;
      const checkout = new window.Razorpay({
        key: response.data.razorpay_key_id,
        amount: order.amount,
        currency: order.currency,
        name: "EduStack Subscription",
        description: `${plan.name} monthly plan`,
        order_id: order.id,
        prefill: { name: form.name, email: form.email },
        handler: async (payment: RazorpayPayment) => {
          await apiClient.verifySubscriptionPayment(auth.schoolId!, {
            razorpay_order_id: payment.razorpay_order_id,
            razorpay_payment_id: payment.razorpay_payment_id,
            razorpay_signature: payment.razorpay_signature,
          });
          setMessage("Subscription payment verified and plan activated.");
          await loadSchool();
        },
        modal: { ondismiss: () => setBuyingPlanId(null) },
      });
      checkout.open();
    } catch (err) {
      setError(getErrorMessage(err, "Could not start subscription checkout."));
    } finally {
      setBuyingPlanId(null);
    }
  };

  if (!auth.schoolId && auth.isLoaded) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Your account is not assigned to a school.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-950">School Settings</h1>
          <p className="mt-1 text-sm text-gray-500">Manage official school profile and communication identity.</p>
        </div>
        <Button onClick={saveSettings} loading={saving} disabled={loading}>
          <Save className="h-4 w-4" /> Save Changes
        </Button>
      </div>

      {error && <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {message && <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div>}

      {loading ? (
        <div className="grid gap-6 lg:grid-cols-[1fr_0.75fr]">
          <Skeleton className="h-96 w-full" />
          <Skeleton className="h-72 w-full" />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_0.75fr]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-indigo-600" /> School Information
              </CardTitle>
              <CardDescription>These details are used across receipts, dashboards, and parent communication.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="mb-2 block">School Name</Label>
                <Input value={form.name} onChange={(event) => updateField("name", event.target.value)} />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label className="mb-2 block">Email</Label>
                  <Input type="email" value={form.email} onChange={(event) => updateField("email", event.target.value)} />
                </div>
                <div>
                  <Label className="mb-2 block">Phone</Label>
                  <Input value={form.phone} onChange={(event) => updateField("phone", event.target.value)} />
                </div>
              </div>
              <div>
                <Label className="mb-2 block">Address</Label>
                <Textarea value={form.address} onChange={(event) => updateField("address", event.target.value)} />
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <Label className="mb-2 block">City</Label>
                  <Input value={form.city} onChange={(event) => updateField("city", event.target.value)} />
                </div>
                <div>
                  <Label className="mb-2 block">State</Label>
                  <Input value={form.state} onChange={(event) => updateField("state", event.target.value)} />
                </div>
                <div>
                  <Label className="mb-2 block">Pincode</Label>
                  <Input value={form.pincode} onChange={(event) => updateField("pincode", event.target.value)} />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label className="mb-2 block">Website</Label>
                  <Input value={form.website} onChange={(event) => updateField("website", event.target.value)} />
                </div>
                <div>
                  <Label className="mb-2 block">Logo URL</Label>
                  <Input value={form.logo_url} onChange={(event) => updateField("logo_url", event.target.value)} />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-indigo-600" /> Subscription
                </CardTitle>
                <CardDescription>Buy or switch the active school plan. Payments are verified server-side.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">Current Status</p>
                  <div className="mt-1 flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-gray-900">{subscriptionStatus}</span>
                    <Badge variant={subscriptionStatus === "active" ? "success" : "warning"}>{subscriptionStatus}</Badge>
                  </div>
                </div>
                {plans.map((plan) => {
                  const active = currentPlanId === plan.id && subscriptionStatus === "active";
                  return (
                    <div key={plan.id} className="rounded-xl border border-gray-100 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{plan.name}</p>
                          <p className="mt-1 text-xs text-gray-500">Up to {plan.max_students.toLocaleString("en-IN")} students</p>
                        </div>
                        <Badge variant={active ? "success" : "info"}>{active ? "active" : `₹${Number(plan.price_monthly).toLocaleString("en-IN")}/mo`}</Badge>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {Object.entries(plan.features || {}).filter(([, enabled]) => enabled).slice(0, 5).map(([feature]) => (
                          <span key={feature} className="inline-flex items-center gap-1 rounded-full bg-gray-50 px-2 py-1 text-[10px] font-medium text-gray-600">
                            <Check className="h-3 w-3 text-emerald-500" /> {feature.replaceAll("_", " ")}
                          </span>
                        ))}
                      </div>
                      <Button className="mt-4 w-full" variant={active ? "outline" : "default"} size="sm" disabled={active} loading={buyingPlanId === plan.id} onClick={() => buyPlan(plan)}>
                        {active ? "Current Plan" : "Buy Plan"}
                      </Button>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MailCheck className="h-5 w-5 text-indigo-600" /> Email Identity
                </CardTitle>
                <CardDescription>Parent emails use this school email as reply-to by default.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-indigo-950">{form.email || "No email set"}</span>
                    <Badge variant="info">Reply-To</Badge>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-indigo-700">
                    To send directly from this address, verify its domain in Resend and enable school sender mode on the backend.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Academic Year</CardTitle>
                <CardDescription>Controls reporting defaults for this school.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <div>
                  <Label className="mb-2 block">Starts In</Label>
                  <Select value={form.academic_year_start} onChange={(event) => updateField("academic_year_start", event.target.value)}>
                    {monthOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </Select>
                </div>
                <div>
                  <Label className="mb-2 block">Ends In</Label>
                  <Select value={form.academic_year_end} onChange={(event) => updateField("academic_year_end", event.target.value)}>
                    {monthOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </Select>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
