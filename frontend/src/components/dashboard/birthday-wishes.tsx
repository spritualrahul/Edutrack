"use client";

import { useEffect, useState } from "react";
import { Cake, Sparkles } from "lucide-react";
import { apiClient } from "@/lib/api";
import { Avatar, Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

type Birthday = {
  id: string;
  type: "student" | "teacher";
  name: string;
  photo_url?: string | null;
  class_name?: string | null;
  section_name?: string | null;
  department?: string | null;
  message: string;
};

export function BirthdayWishes({ schoolId }: { schoolId?: string | null }) {
  const [birthdays, setBirthdays] = useState<Birthday[]>([]);

  useEffect(() => {
    if (!schoolId) return;
    let mounted = true;
    apiClient
      .getTodaysBirthdays(schoolId)
      .then((response) => {
        if (mounted) setBirthdays(response.data || []);
      })
      .catch(() => {
        if (mounted) setBirthdays([]);
      });
    return () => {
      mounted = false;
    };
  }, [schoolId]);

  if (!schoolId || birthdays.length === 0) return null;

  return (
    <Card className="overflow-hidden border-indigo-100 bg-gradient-to-r from-indigo-50 via-white to-sky-50">
      <CardContent className="p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white">
              <Cake className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Birthday Wishes</h3>
              <p className="text-xs text-gray-500">Celebrate today&apos;s birthdays</p>
            </div>
          </div>
          <Badge variant="info">{birthdays.length} today</Badge>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {birthdays.map((person) => (
            <div key={person.id} className="rounded-xl border border-white/80 bg-white/85 p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <Avatar src={person.photo_url} name={person.name} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold text-gray-900">{person.name}</p>
                    <Badge variant={person.type === "student" ? "success" : "info"} className="text-[10px]">
                      {person.type}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    {person.class_name
                      ? `${person.class_name}${person.section_name ? `-${person.section_name}` : ""}`
                      : person.department || "School team"}
                  </p>
                  <p className="mt-3 text-sm leading-relaxed text-gray-700">{person.message}</p>
                </div>
                <Sparkles className="h-4 w-4 shrink-0 text-indigo-400" />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
