"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, BookOpen, Users, ChevronRight } from "lucide-react";

const classes = Array.from({ length: 12 }, (_, i) => ({
  id: i + 1, name: `Class ${i + 1}`, sections: ["A", "B"], students: Math.floor(Math.random() * 40) + 50,
  teachers: Math.floor(Math.random() * 3) + 3, classTeacher: ["Sunita Verma", "Rajiv Sharma", "Priya Kapoor", "Amit Saxena"][i % 4],
}));

export default function ClassesPage() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {classes.map((cls) => (
          <Card key={cls.id} className="hover:shadow-md transition-shadow cursor-pointer group">
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 font-bold text-lg">{cls.id}</div>
                <ChevronRight className="h-5 w-5 text-gray-300 group-hover:text-gray-500 transition-colors" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">{cls.name}</h3>
              <div className="flex gap-1.5 mb-3">{cls.sections.map((s) => <Badge key={s} variant="info">Section {s}</Badge>)}</div>
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{cls.students} students</span>
                <span className="flex items-center gap-1"><BookOpen className="h-3.5 w-3.5" />{cls.teachers} teachers</span>
              </div>
              <p className="text-xs text-gray-400 mt-2">Class Teacher: {cls.classTeacher}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
