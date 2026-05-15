"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiClient } from "@/lib/api";
import { useAuthState } from "@/hooks/useAuth";
import { Download, IndianRupee, Users } from "lucide-react";

type Report = {
  title: string;
  desc: string;
  type: string;
  icon: typeof IndianRupee;
  color: string;
  action: () => Promise<void>;
};

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function downloadText(filename: string, content: string) {
  downloadBlob(new Blob([content], { type: "text/csv;charset=utf-8" }), filename);
}

export default function ReportsPage() {
  const auth = useAuthState();
  const [downloading, setDownloading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const withDownload = async (key: string, task: () => Promise<void>) => {
    setDownloading(key);
    setError(null);
    try {
      await task();
    } catch {
      setError("Could not generate report.");
    } finally {
      setDownloading(null);
    }
  };

  const reports: Report[] = [
    {
      title: "Pending Fees",
      desc: "All pending, partial, and overdue fee allocations.",
      type: "CSV",
      icon: IndianRupee,
      color: "bg-red-50 text-red-600",
      action: async () => {
        if (!auth.schoolId) return;
        const response = await apiClient.downloadPendingFeeReport(auth.schoolId);
        downloadBlob(response.data, "pending-fees.csv");
      },
    },
    {
      title: "Today Collection",
      desc: "Verified daily fee collection with receipt numbers.",
      type: "CSV",
      icon: IndianRupee,
      color: "bg-emerald-50 text-emerald-600",
      action: async () => {
        if (!auth.schoolId) return;
        const response = await apiClient.downloadDailyCollectionReport(auth.schoolId);
        downloadBlob(response.data, `daily-collection-${new Date().toISOString().slice(0, 10)}.csv`);
      },
    },
    {
      title: "Student List",
      desc: "Current students with parent contact and class details.",
      type: "CSV",
      icon: Users,
      color: "bg-indigo-50 text-indigo-600",
      action: async () => {
        if (!auth.schoolId) return;
        const response = await apiClient.getStudents(auth.schoolId, { page_size: 100 });
        const rows = response.data.items || [];
        const headers: string[] = ["Admission No", "Name", "Class", "Roll", "Parent", "Phone", "Status"];
        const tableRows: unknown[][] = [headers, ...rows.map((student: Record<string, unknown>) => [
          student.admission_number,
          student.full_name,
          `${student.class_name || ""}${student.section_name ? `-${student.section_name}` : ""}`,
          student.roll_number || "",
          student.parent_name || "",
          student.parent_phone || "",
          student.status || "",
        ])];
        const csv = tableRows.map((row: unknown[]) => row.map((cell: unknown) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
        downloadText("students.csv", csv);
      },
    },
  ];

  return (
    <div className="space-y-6">
      {error && <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {reports.map((report) => (
          <Card key={report.title}>
            <CardContent className="p-6">
              <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl ${report.color}`}>
                <report.icon className="h-6 w-6" />
              </div>
              <h3 className="mb-1 text-base font-semibold text-gray-900">{report.title}</h3>
              <p className="mb-4 text-sm text-gray-500">{report.desc}</p>
              <div className="flex items-center justify-between">
                <Badge variant="outline">{report.type}</Badge>
                <Button variant="outline" size="sm" loading={downloading === report.title} onClick={() => withDownload(report.title, report.action)}>
                  <Download className="mr-1 h-4 w-4" />Download
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
