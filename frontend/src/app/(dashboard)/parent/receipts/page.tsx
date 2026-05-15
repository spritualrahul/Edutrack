"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge, EmptyState, Skeleton } from "@/components/ui/badge";
import { apiClient } from "@/lib/api";
import { useAuthState } from "@/hooks/useAuth";
import { Download, FileText, Printer } from "lucide-react";

type Receipt = {
  id: string;
  receipt_number: string;
  amount: string | number;
  fee_details?: { month?: number; year?: number; breakdown?: Record<string, number> } | null;
  receipt_date: string;
};

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function ReceiptsPage() {
  const auth = useAuthState();
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth.schoolId) return;
    let mounted = true;
    apiClient
      .getReceipts(auth.schoolId)
      .then((response) => {
        if (mounted) setReceipts(response.data || []);
      })
      .catch(() => {
        if (mounted) setError("Could not load receipts.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [auth.schoolId]);

  const downloadReceipt = async (receipt: Receipt) => {
    if (!auth.schoolId) return;
    const response = await apiClient.downloadReceipt(auth.schoolId, receipt.id);
    downloadBlob(response.data, `${receipt.receipt_number}.pdf`);
  };

  if (loading) return <div className="space-y-4"><Skeleton className="h-28" /><Skeleton className="h-28" /></div>;

  return (
    <div className="space-y-6">
      {error && <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {receipts.length === 0 ? (
        <EmptyState icon={<FileText className="h-10 w-10" />} title="No receipts yet" description="Receipts appear here after verified fee payments." />
      ) : (
        <div className="space-y-4">
          {receipts.map((receipt) => (
            <Card key={receipt.id}>
              <CardContent className="p-5">
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-lg font-bold text-gray-900">₹{Number(receipt.amount).toLocaleString("en-IN")}</p>
                    <p className="text-sm text-gray-500">{receipt.fee_details?.month ? `Month ${receipt.fee_details.month}, ${receipt.fee_details.year}` : "Fee receipt"}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-sm text-indigo-600">{receipt.receipt_number}</p>
                    <p className="text-xs text-gray-400">{new Date(receipt.receipt_date).toLocaleString("en-IN")}</p>
                  </div>
                </div>
                {receipt.fee_details?.breakdown && (
                  <div className="mb-4 space-y-1 rounded-lg bg-gray-50 p-3">
                    {Object.entries(receipt.fee_details.breakdown).map(([key, value]) => (
                      <div key={key} className="flex justify-between text-sm">
                        <span className="text-gray-600">{key}</span>
                        <span className="font-medium text-gray-900">₹{Number(value).toLocaleString("en-IN")}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <Badge variant="success">verified</Badge>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => downloadReceipt(receipt)}><Download className="mr-1 h-4 w-4" />PDF</Button>
                    <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="mr-1 h-4 w-4" />Print</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
