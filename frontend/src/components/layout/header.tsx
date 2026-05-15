"use client";

import { Bell, Menu, Search } from "lucide-react";
import { useAppStore } from "@/stores/app-store";
import { Input } from "@/components/ui/input";
import { UserButton } from "@clerk/nextjs";

interface HeaderProps {
  title?: string;
  subtitle?: string;
  userName?: string;
  userRole?: string;
  actions?: React.ReactNode;
}

export function Header({ title, subtitle, userName, userRole, actions }: HeaderProps) {
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);

  const displayName = userName || "Admin";
  const displayRole = userRole || "User";

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-gray-100 bg-white/80 backdrop-blur-xl px-4 lg:px-6">
      <div className="flex items-center gap-4">
        <button
          onClick={toggleSidebar}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
          aria-label="Toggle sidebar"
          aria-expanded={sidebarOpen}
        >
          <Menu className="h-5 w-5" />
        </button>

        <div>
          {title && <h1 className="text-lg font-semibold text-gray-900">{title}</h1>}
          {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="hidden md:block relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            type="search"
            placeholder="Search..."
            className="w-64 pl-9 h-9 bg-gray-50 border-gray-100 focus:bg-white"
          />
        </div>

        {actions}

        {/* Notifications */}
        <button className="relative flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors">
          <Bell className="h-5 w-5" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-indigo-600" />
        </button>

        {/* Clerk User Button */}
        <div className="flex items-center gap-3 pl-3 border-l border-gray-100">
          <UserButton
            appearance={{
              elements: {
                avatarBox: "h-9 w-9",
              },
            }}
          />
          <div className="hidden sm:block">
            <p className="text-sm font-medium text-gray-900">{displayName}</p>
            <p className="text-xs text-gray-500">{displayRole}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
