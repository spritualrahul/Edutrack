"use client";

import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";

interface DashboardLayoutProps {
  children: React.ReactNode;
  role?: string;
  title?: string;
  subtitle?: string;
  userName?: string;
  userRole?: string;
  actions?: React.ReactNode;
}

export function DashboardLayout({
  children, role, title, subtitle, userName, userRole, actions,
}: DashboardLayoutProps) {
  const resolvedRole = role || "org:student";
  const resolvedUserName = userName || "User";
  const resolvedUserRole = userRole || "User";

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50/50">
      <Sidebar role={resolvedRole} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          title={title}
          subtitle={subtitle}
          userName={resolvedUserName}
          userRole={resolvedUserRole}
          actions={actions}
        />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl p-4 lg:p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
