"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useClerk } from "@clerk/nextjs";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/app-store";
import {
  LayoutDashboard, Users, GraduationCap, BookOpen, CalendarCheck, IndianRupee,
  Bell, FileText, Settings, ChevronLeft, ChevronRight, LogOut, Sparkles,
  Building2, BarChart3, CreditCard, UserCheck, ClipboardList, X,
} from "lucide-react";

interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
  badge?: string;
}

const navItemsByRole: Record<string, NavItem[]> = {
  "org:super_admin": [
    { title: "Dashboard", href: "/super-admin", icon: LayoutDashboard },
    { title: "Schools", href: "/super-admin/schools", icon: Building2 },
    { title: "Subscriptions", href: "/super-admin/subscriptions", icon: CreditCard },
    { title: "Revenue", href: "/super-admin/revenue", icon: BarChart3 },
    { title: "Analytics", href: "/super-admin/analytics", icon: FileText },
    { title: "Settings", href: "/super-admin/settings", icon: Settings },
  ],
  "org:school_admin": [
    { title: "Dashboard", href: "/school-admin", icon: LayoutDashboard },
    { title: "Students", href: "/school-admin/students", icon: GraduationCap },
    { title: "Teachers", href: "/school-admin/teachers", icon: Users },
    { title: "Classes", href: "/school-admin/classes", icon: BookOpen },
    { title: "AI Timetable", href: "/school-admin/timetable", icon: Sparkles },
    { title: "Attendance", href: "/school-admin/attendance", icon: CalendarCheck },
    { title: "Fee Management", href: "/school-admin/fees", icon: IndianRupee },
    { title: "Notices", href: "/school-admin/notices", icon: Bell },
    { title: "Leave Requests", href: "/school-admin/leaves", icon: CalendarCheck },
    { title: "Reports", href: "/school-admin/reports", icon: FileText },
    { title: "Settings", href: "/school-admin/settings", icon: Settings },
  ],
  "org:accounts": [
    { title: "Fee Counter", href: "/fee-counter", icon: IndianRupee },
    { title: "Collection History", href: "/fee-counter/history", icon: ClipboardList },
    { title: "Reports", href: "/fee-counter/reports", icon: FileText },
  ],
  "org:teacher": [
    { title: "Dashboard", href: "/teacher", icon: LayoutDashboard },
    { title: "Attendance", href: "/teacher/attendance", icon: UserCheck },
    { title: "Timetable", href: "/teacher/timetable", icon: CalendarCheck },
    { title: "Notices", href: "/teacher/notices", icon: Bell },
    { title: "Leave", href: "/teacher/leave", icon: FileText },
  ],
  "org:parent": [
    { title: "Dashboard", href: "/parent", icon: LayoutDashboard },
    { title: "AI Assistant", href: "/parent/assistant", icon: Sparkles },
    { title: "Attendance", href: "/parent/attendance", icon: CalendarCheck },
    { title: "Fee Status", href: "/parent/fees", icon: IndianRupee },
    { title: "Receipts", href: "/parent/receipts", icon: FileText },
    { title: "Notices", href: "/parent/notices", icon: Bell },
  ],
  "org:student": [
    { title: "Dashboard", href: "/student", icon: LayoutDashboard },
    { title: "Attendance", href: "/student/attendance", icon: CalendarCheck },
    { title: "Fee Status", href: "/student/fees", icon: IndianRupee },
    { title: "Notices", href: "/student/notices", icon: Bell },
  ],
};

export function Sidebar({ role = "org:student" }: { role?: string }) {
  const pathname = usePathname();
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);
  const setSidebarOpen = useAppStore((s) => s.setSidebarOpen);
  const { signOut } = useClerk();
  const navItems = navItemsByRole[role] || navItemsByRole["org:student"];

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          className="fixed inset-0 z-40 cursor-default bg-black/20 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex h-dvh w-64 flex-col border-r border-gray-100 bg-white shadow-xl transition-[transform,width] duration-300 ease-out lg:relative lg:z-0 lg:h-screen lg:translate-x-0 lg:shadow-none",
          sidebarOpen ? "translate-x-0 lg:w-64" : "-translate-x-full lg:w-[76px]"
        )}
        aria-label="Dashboard sidebar"
      >
        {/* Logo */}
        <div
          className={cn(
            "relative flex h-16 items-center border-b border-gray-100 px-3",
            sidebarOpen ? "justify-between" : "justify-center lg:justify-center"
          )}
        >
          <Link
            href="/"
            className={cn("flex items-center gap-2.5", !sidebarOpen && "lg:justify-center")}
            aria-label="EduStack home"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white font-bold text-sm">
              E
            </div>
            {sidebarOpen && (
              <span className="text-lg font-bold text-gray-900 tracking-tight">EduStack</span>
            )}
          </Link>
          <button
            onClick={toggleSidebar}
            className="absolute -right-3 top-1/2 hidden h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 shadow-sm transition-colors hover:bg-gray-50 hover:text-gray-700 lg:flex"
            aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
            aria-expanded={sidebarOpen}
          >
            {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
          <button
            onClick={() => setSidebarOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 lg:hidden"
            aria-label="Close sidebar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => {
                  if (window.innerWidth < 1024) setSidebarOpen(false);
                }}
                className={cn(
                  "flex min-h-10 items-center rounded-lg text-sm font-medium transition-all duration-200",
                  sidebarOpen ? "gap-3 px-3 py-2.5" : "justify-center px-0 py-2.5",
                  isActive
                    ? "bg-indigo-50 text-indigo-700 shadow-sm"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                )}
                title={!sidebarOpen ? item.title : undefined}
              >
                <item.icon className={cn("h-5 w-5 shrink-0", isActive ? "text-indigo-600" : "text-gray-400")} />
                {sidebarOpen && <span>{item.title}</span>}
                {sidebarOpen && item.badge && (
                  <span className="ml-auto inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-indigo-100 px-1.5 text-xs font-medium text-indigo-700">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-gray-100 p-3">
          <button
            onClick={() => signOut({ redirectUrl: "/" })}
            className={cn(
              "flex min-h-10 w-full items-center rounded-lg text-sm font-medium text-gray-600 transition-colors hover:bg-red-50 hover:text-red-700",
              sidebarOpen ? "gap-3 px-3 py-2.5" : "justify-center px-0 py-2.5"
            )}
            title={!sidebarOpen ? "Sign Out" : undefined}
          >
            <LogOut className="h-5 w-5 text-gray-400" />
            {sidebarOpen && <span>Sign Out</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
