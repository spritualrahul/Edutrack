"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, Avatar, EmptyState, Skeleton } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Clock, Download, ReceiptText, Search } from "lucide-react";
import { apiClient } from "@/lib/api";
import { useAuthState } from "@/hooks/useAuth";

type Payment = {
  id: string;
  student_name?: string | null;
  amount: string | number;
  payment_mode: string;
  payment_date: string;
  transaction_id?: string | null;
  receipt_number?: string | null;
  status: string;
};

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function FeeHistoryPage() {
  const auth = useAuthState();
  const [search, setSearch] = useState("");
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (!auth.schoolId) {
        setLoading(false);
        return;
      }
      apiClient
        .getDailySummary(auth.schoolId)
        .then((response) => setPayments(response.data.recent_payments || []))
        .catch(() => setError("Could not load transaction history."))
        .finally(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [auth.schoolId]);

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    return payments.filter((payment) =>
      !term ||
      (payment.student_name || "").toLowerCase().includes(term) ||
      (payment.receipt_number || "").toLowerCase().includes(term) ||
      (payment.transaction_id || "").toLowerCase().includes(term)
    );
  }, [payments, search]);

  const downloadDailyReport = async () => {
    if (!auth.schoolId) return;
    const response = await apiClient.downloadDailyCollectionReport(auth.schoolId);
    downloadBlob(response.data, `daily-collection-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  return (
    <div className="space-y-6">
      {error && <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Recent Transactions</CardTitle>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input placeholder="Search receipts..." value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9 sm:w-64" />
            </div>
            <Button variant="outline" size="sm" onClick={downloadDailyReport}><Download className="h-4 w-4" /> CSV</Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-3 p-6">{Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-14" />)}</div>
          ) : filtered.length === 0 ? (
            <EmptyState icon={<ReceiptText className="h-10 w-10" />} title="No transactions today" description="Completed fee payments will appear here." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Receipt</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Student</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Mode</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Date & Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map((payment) => (
                    <tr key={payment.id} className="hover:bg-gray-50/80">
                      <td className="px-6 py-4 font-mono text-sm text-indigo-600">{payment.receipt_number || "-"}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <Avatar name={payment.student_name || "Student"} size="sm" />
                          <p className="text-sm font-medium text-gray-900">{payment.student_name || "Student"}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-gray-900">₹{Number(payment.amount).toLocaleString("en-IN")}</td>
                      <td className="px-6 py-4"><Badge variant={payment.payment_mode === "cash" ? "success" : payment.payment_mode === "upi" ? "info" : "outline"}>{payment.payment_mode}</Badge></td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-gray-600">{new Date(payment.payment_date).toLocaleDateString("en-IN")}</p>
                        <p className="flex items-center gap-1 text-xs text-gray-400"><Clock className="h-3 w-3" />{new Date(payment.payment_date).toLocaleTimeString("en-IN")}</p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
