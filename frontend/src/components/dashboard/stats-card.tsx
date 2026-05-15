"use client";

import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: string | number;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon: LucideIcon;
  iconColor?: string;
  iconBg?: string;
  description?: string;
}

export function StatsCard({
  title, value, change, changeType = "neutral", icon: Icon,
  iconColor = "text-indigo-600", iconBg = "bg-indigo-50", description,
}: StatsCardProps) {
  return (
    <Card className="p-6">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="text-3xl font-bold text-gray-900 tracking-tight">{value}</p>
          {change && (
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                  changeType === "positive" && "bg-emerald-50 text-emerald-700",
                  changeType === "negative" && "bg-red-50 text-red-700",
                  changeType === "neutral" && "bg-gray-100 text-gray-600"
                )}
              >
                {changeType === "positive" && "↑"}
                {changeType === "negative" && "↓"}
                {change}
              </span>
              {description && <span className="text-xs text-gray-400">{description}</span>}
            </div>
          )}
        </div>
        <div className={cn("flex h-12 w-12 items-center justify-center rounded-xl", iconBg)}>
          <Icon className={cn("h-6 w-6", iconColor)} />
        </div>
      </div>
    </Card>
  );
}

// Mini chart card for analytics
interface MiniChartCardProps {
  title: string;
  value: string;
  data: number[];
  color?: string;
}

export function MiniChartCard({ title, value, data, color = "#6366f1" }: MiniChartCardProps) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-gray-500">{title}</p>
        <p className="text-lg font-bold text-gray-900">{value}</p>
      </div>
      <div className="flex items-end gap-1 h-10">
        {data.map((d, i) => (
          <div
            key={i}
            className="flex-1 rounded-sm transition-all duration-300"
            style={{
              height: `${((d - min) / range) * 100}%`,
              minHeight: "4px",
              backgroundColor: color,
              opacity: 0.3 + ((d - min) / range) * 0.7,
            }}
          />
        ))}
      </div>
    </Card>
  );
}
