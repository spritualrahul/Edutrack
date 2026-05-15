"use client";

import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import {
  ArrowRight,
  BarChart3,
  Bell,
  CalendarCheck,
  CheckCircle2,
  CreditCard,
  GraduationCap,
  IndianRupee,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { useAuthState } from "@/hooks/useAuth";

const platformStats = [
  { label: "Fee workflows automated", value: "92%" },
  { label: "Parent response time", value: "3x" },
  { label: "Daily admin hours saved", value: "18+" },
];

const featureCards = [
  {
    title: "Fee Management",
    desc: "Monthly, quarterly, yearly, partial, offline, and online fee collection with receipts.",
    icon: IndianRupee,
  },
  {
    title: "Attendance Automation",
    desc: "Fast class-wise attendance, parent visibility, summaries, and secure tenant records.",
    icon: CalendarCheck,
  },
  {
    title: "Role-Based Portals",
    desc: "Separate dashboards for admins, teachers, parents, students, and fee counter staff.",
    icon: Users,
  },
  {
    title: "School Analytics",
    desc: "Clean dashboards for collections, attendance, staff, notices, revenue, and subscriptions.",
    icon: BarChart3,
  },
  {
    title: "Parent Communication",
    desc: "Notices, reminders, receipt confirmations, and upcoming WhatsApp/email workflows.",
    icon: Bell,
  },
  {
    title: "Enterprise Controls",
    desc: "RBAC, tenant isolation, school activation, plan controls, and audit-friendly operations.",
    icon: ShieldCheck,
  },
];

export default function Home() {
  const auth = useAuthState();
  const showDashboardActions = auth.isLoaded && auth.isSignedIn;

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <header className="fixed left-0 right-0 top-0 z-50 border-b border-gray-100 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">E</div>
            <span className="text-xl font-bold tracking-tight">EduStack</span>
          </Link>
          <nav className="hidden items-center gap-8 md:flex">
            <a href="#features" className="text-sm text-gray-600 hover:text-gray-900">Features</a>
            <a href="#workflow" className="text-sm text-gray-600 hover:text-gray-900">Workflow</a>
            <a href="#pricing" className="text-sm text-gray-600 hover:text-gray-900">Pricing</a>
          </nav>
          <div className="flex items-center gap-3">
            {showDashboardActions ? (
              <>
              <DashboardLink href={auth.dashboardPath} />
              <UserButton />
              </>
            ) : (
              <>
                <Link href="/sign-in" className="text-sm font-medium text-gray-600 hover:text-gray-900">Sign In</Link>
                <Link href="/sign-up" className="inline-flex h-9 items-center justify-center rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-700">
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden px-6 pb-16 pt-28 lg:pb-20 lg:pt-32">
          <div className="absolute inset-x-0 top-0 -z-10 h-[520px] bg-[radial-gradient(circle_at_50%_0%,rgba(99,102,241,0.16),transparent_58%)]" />
          <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[0.92fr_1.08fr]">
            <div>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-4 py-1.5 text-xs font-medium text-indigo-700">
                <Sparkles className="h-3.5 w-3.5" />
                Modern ERP operations for growing schools
              </div>
              <h1 className="max-w-4xl text-5xl font-bold leading-tight tracking-tight text-gray-950 md:text-6xl">
                Run your school from one calm, secure dashboard.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-gray-600">
                EduStack brings admissions, fees, attendance, staff workflows, notices, and parent communication into a premium SaaS workspace built for Indian schools.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                {showDashboardActions ? (
                  <DashboardCTALink href={auth.dashboardPath} />
                ) : (
                  <>
                    <Link href="/sign-up" className="inline-flex h-12 items-center justify-center rounded-xl bg-indigo-600 px-6 text-sm font-semibold text-white shadow-lg shadow-indigo-200 hover:-translate-y-0.5 hover:bg-indigo-700 hover:shadow-xl">
                      Start onboarding <ArrowRight className="h-4 w-4" />
                    </Link>
                  <a href="#features" className="inline-flex h-12 items-center justify-center rounded-xl border border-gray-200 bg-white px-6 text-sm font-semibold text-gray-700 shadow-sm hover:-translate-y-0.5 hover:bg-gray-50">
                    Explore platform
                  </a>
                  </>
                )}
              </div>
              <div className="mt-10 grid max-w-2xl grid-cols-3 gap-3">
                {platformStats.map((stat) => (
                  <div key={stat.label} className="rounded-xl border border-gray-100 bg-white/80 p-4 shadow-sm">
                    <p className="text-2xl font-bold text-gray-950">{stat.value}</p>
                    <p className="mt-1 text-xs leading-5 text-gray-500">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-br from-indigo-100 via-white to-blue-50 blur-2xl" />
              <div className="animate-dashboard-float overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl shadow-indigo-100">
                <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
                  <div>
                    <p className="text-sm font-semibold text-gray-950">School Admin Overview</p>
                    <p className="text-xs text-gray-500">Live operations snapshot</p>
                  </div>
                  <div className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">Healthy</div>
                </div>
                <div className="grid gap-4 p-5">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[
                      { label: "Students", value: "1,245", icon: GraduationCap },
                      { label: "Collected", value: "₹5.8L", icon: CreditCard },
                      { label: "Attendance", value: "87.5%", icon: CalendarCheck },
                      { label: "Notices", value: "14", icon: Bell },
                    ].map(({ label, value, icon: Icon }) => (
                      <div key={label} className="rounded-xl border border-gray-100 bg-gray-50/60 p-3">
                        <Icon className="h-4 w-4 text-indigo-600" />
                        <p className="mt-3 text-lg font-bold text-gray-950">{value}</p>
                        <p className="text-xs text-gray-500">{label}</p>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-xl border border-gray-100 p-4">
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">Collection Trend</p>
                        <p className="text-xs text-gray-500">Last 6 months</p>
                      </div>
                      <span className="text-xs font-medium text-emerald-600">+18.4%</span>
                    </div>
                    <div className="flex h-40 items-end gap-2">
                      {[42, 58, 52, 70, 82, 76, 88, 92, 84, 96, 90, 100].map((height, index) => (
                        <div key={index} className="flex h-full flex-1 items-end rounded-full bg-indigo-50">
                          <div className="w-full rounded-full bg-indigo-500" style={{ height: `${height}%` }} />
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {["Teacher leave approved", "Receipt sent to parent", "Fee reminder scheduled", "New student onboarded"].map((item) => (
                      <div key={item} className="flex items-center gap-2 rounded-xl border border-gray-100 bg-white p-3 text-sm text-gray-700">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-gray-100 bg-gray-50/60 px-6 py-8">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 text-center md:flex-row md:items-center md:justify-between md:text-left">
            <p className="text-sm font-medium text-gray-500">Designed for CBSE, ICSE, state board, and independent school operations</p>
            <div className="flex flex-wrap justify-center gap-3">
              {["Admissions", "Fee Counter", "Parent Portal", "Teacher Desk"].map((label) => (
                <span key={label} className="rounded-full border border-gray-200 bg-white px-4 py-2 text-xs font-medium text-gray-600 shadow-sm">
                  {label}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section id="features" className="px-6 py-20">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold text-indigo-600">Platform Modules</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-gray-950">Everything a school team needs, without the clutter.</h2>
              <p className="mt-4 text-gray-600">Each role gets a focused workspace, and every sensitive action runs through role and tenant-aware backend APIs.</p>
            </div>
            <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
              {featureCards.map((feature) => (
                <div key={feature.title} className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm hover:-translate-y-1 hover:shadow-md">
                  <feature.icon className="h-5 w-5 text-indigo-600" />
                  <h3 className="mt-5 text-lg font-semibold text-gray-950">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-gray-500">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="workflow" className="bg-gray-50/70 px-6 py-20">
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <p className="text-sm font-semibold text-indigo-600">Onboarding Flow</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-gray-950">From school setup to daily collection in four clear steps.</h2>
              <p className="mt-4 text-gray-600">Super admins control plans, pricing, activation, and feature access. School teams handle the operational work inside their own tenant.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                ["1", "Create school tenant", "Add school details, plan limits, billing status, and subscription terms."],
                ["2", "Assign staff roles", "Give each admin, teacher, parent, student, or accountant the right workspace."],
                ["3", "Import operations", "Load classes, students, fee structures, attendance, notices, and timetable data."],
                ["4", "Automate follow-ups", "Collect fees, generate receipts, trigger reminders, and review live analytics."],
              ].map(([step, title, desc]) => (
                <div key={step} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-50 text-sm font-bold text-indigo-700">{step}</span>
                  <h3 className="mt-4 font-semibold text-gray-950">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-gray-500">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="pricing" className="px-6 py-20">
          <div className="mx-auto max-w-4xl rounded-2xl border border-gray-100 bg-white p-8 shadow-xl shadow-gray-100">
            <div className="grid gap-8 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <p className="text-sm font-semibold text-indigo-600">Starter SaaS Plan</p>
                <h2 className="mt-3 text-3xl font-bold tracking-tight text-gray-950">₹10,000/month for up to 10,000 students.</h2>
                <p className="mt-4 text-gray-600">Pricing tiers, feature limits, and subscription controls are configurable by the super admin as schools scale.</p>
              </div>
              {showDashboardActions ? (
                <DashboardCTALink href={auth.dashboardPath} />
              ) : (
                <Link href="/sign-up" className="inline-flex h-12 items-center justify-center rounded-xl bg-indigo-600 px-6 text-sm font-semibold text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700">
                    Start setup <ArrowRight className="h-4 w-4" />
                </Link>
              )}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-gray-100 px-6 py-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 md:flex-row">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-xs font-bold text-white">E</div>
            <span className="font-semibold">EduStack</span>
          </Link>
          <p className="text-sm text-gray-400">© 2026 EduStack. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

function DashboardLink({ href }: { href: string }) {
  return (
    <Link href={href} className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
      Dashboard
    </Link>
  );
}

function DashboardCTALink({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="inline-flex h-12 items-center justify-center rounded-xl bg-indigo-600 px-6 text-sm font-semibold text-white shadow-lg shadow-indigo-200 hover:-translate-y-0.5 hover:bg-indigo-700 hover:shadow-xl"
    >
      Go to dashboard <ArrowRight className="h-4 w-4" />
    </Link>
  );
}
