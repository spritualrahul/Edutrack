"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge, EmptyState, Skeleton } from "@/components/ui/badge";
import { apiClient } from "@/lib/api";
import { useAuthState } from "@/hooks/useAuth";
import { Download, FileText, IndianRupee, ReceiptText, RefreshCcw } from "lucide-react";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

type Student = {
  id: string;
  full_name: string;
  admission_number: string;
  class_name?: string | null;
  section_name?: string | null;
  roll_number?: number | null;
};

type FeeAllocation = {
  id: string;
  month: number;
  year: number;
  total_amount: string | number;
  discount_amount: string | number;
  paid_amount: string | number;
  balance: string | number;
  due_date: string;
  status: string;
  breakdown?: Record<string, number>;
};

type Receipt = {
  id: string;
  receipt_number: string;
  student_name?: string | null;
  amount: string | number;
  amount_in_words?: string | null;
  fee_details?: { month?: number; year?: number; breakdown?: Record<string, number> } | null;
  receipt_date: string;
};

type RazorpayPayment = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

const monthNames = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function getErrorMessage(error: unknown, fallback: string) {
  if (typeof error === "object" && error !== null && "response" in error) {
    const response = (error as { response?: { data?: { detail?: string } } }).response;
    return response?.data?.detail || fallback;
  }
  return fallback;
}

function loadRazorpayScript() {
  return new Promise<boolean>((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function SelfServiceFees({ heading = "Fee Status" }: { heading?: string }) {
  const auth = useAuthState();
  const [student, setStudent] = useState<Student | null>(null);
  const [fees, setFees] = useState<FeeAllocation[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    if (!auth.schoolId) return;
    setLoading(true);
    setError(null);
    try {
      const studentResponse = await apiClient.getMyStudent(auth.schoolId);
      const currentStudent = studentResponse.data as Student;
      setStudent(currentStudent);
      const [feesResponse, receiptsResponse] = await Promise.all([
        apiClient.getStudentPendingFees(auth.schoolId, currentStudent.id),
        apiClient.getReceipts(auth.schoolId, { student_id: currentStudent.id }),
      ]);
      setFees(feesResponse.data || []);
      setReceipts(receiptsResponse.data || []);
    } catch (err) {
      setError(getErrorMessage(err, "Could not load fee details."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (auth.schoolId) void fetchData();
    }, 0);
    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.schoolId]);

  const pendingTotal = useMemo(
    () => fees.reduce((total, fee) => total + Number(fee.balance || 0), 0),
    [fees]
  );
  const paidTotal = useMemo(
    () => receipts.reduce((total, receipt) => total + Number(receipt.amount || 0), 0),
    [receipts]
  );

  const payFee = async (fee: FeeAllocation) => {
    if (!auth.schoolId || !student) return;
    const amount = Number(fee.balance || 0);
    if (amount <= 0) return;
    setPayingId(fee.id);
    setMessage(null);
    setError(null);
    try {
      const orderResponse = await apiClient.createOnlineFeeOrder(auth.schoolId, {
        student_id: student.id,
        fee_allocation_id: fee.id,
        amount,
      });
      if (!orderResponse.data.gateway_configured) {
        setMessage(orderResponse.data.message || "Online payments are not configured yet.");
        return;
      }
      const loaded = await loadRazorpayScript();
      if (!loaded || !window.Razorpay) {
        setError("Razorpay checkout could not be loaded.");
        return;
      }
      const order = orderResponse.data.order;
      const checkout = new window.Razorpay({
        key: orderResponse.data.razorpay_key_id,
        amount: order.amount,
        currency: order.currency,
        name: "EduStack Fees",
        description: `${monthNames[fee.month]} ${fee.year} fee`,
        order_id: order.id,
        prefill: {
          name: student.full_name,
          email: auth.email,
        },
        handler: async (payment: RazorpayPayment) => {
          await apiClient.verifyOnlineFeePayment(auth.schoolId!, {
            student_id: student.id,
            fee_allocation_id: fee.id,
            amount,
            razorpay_order_id: payment.razorpay_order_id,
            razorpay_payment_id: payment.razorpay_payment_id,
            razorpay_signature: payment.razorpay_signature,
          });
          setMessage("Payment verified and receipt generated.");
          await fetchData();
        },
        modal: {
          ondismiss: () => setPayingId(null),
        },
      });
      checkout.open();
    } catch (err) {
      setError(getErrorMessage(err, "Payment could not be started."));
    } finally {
      setPayingId(null);
    }
  };

  const downloadReceipt = async (receipt: Receipt) => {
    if (!auth.schoolId) return;
    const response = await apiClient.downloadReceipt(auth.schoolId, receipt.id);
    downloadBlob(response.data, `${receipt.receipt_number}.pdf`);
  };

  if (loading) {
    return <div className="space-y-4"><Skeleton className="h-28" /><Skeleton className="h-80" /></div>;
  }

  if (!auth.schoolId || !student) {
    return <EmptyState icon={<IndianRupee className="h-10 w-10" />} title="No linked student" description="Your login is not linked to a student record yet." />;
  }

  return (
    <div className="space-y-6">
      {message && <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div>}
      {error && <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <Card className="overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-600 to-blue-600 p-6 text-white">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold">{student.full_name}</h2>
              <p className="text-sm text-indigo-100">
                {student.class_name || "Class not set"}{student.section_name ? `-${student.section_name}` : ""} · Adm. {student.admission_number}
              </p>
            </div>
            <Button variant="outline" className="border-white/30 bg-white/10 text-white hover:bg-white/20" onClick={fetchData}>
              <RefreshCcw className="h-4 w-4" /> Refresh
            </Button>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-white/10 p-3 backdrop-blur-sm">
              <p className="text-xs text-indigo-100">Pending</p>
              <p className="mt-1 text-2xl font-bold">₹{pendingTotal.toLocaleString("en-IN")}</p>
            </div>
            <div className="rounded-xl bg-white/10 p-3 backdrop-blur-sm">
              <p className="text-xs text-indigo-100">Paid</p>
              <p className="mt-1 text-2xl font-bold">₹{paidTotal.toLocaleString("en-IN")}</p>
            </div>
            <div className="rounded-xl bg-white/10 p-3 backdrop-blur-sm">
              <p className="text-xs text-indigo-100">Receipts</p>
              <p className="mt-1 text-2xl font-bold">{receipts.length}</p>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{heading}</CardTitle>
          <CardDescription>Pay pending fees online and download verified receipts.</CardDescription>
        </CardHeader>
        <CardContent>
          {fees.length === 0 ? (
            <EmptyState icon={<ReceiptText className="h-10 w-10" />} title="No pending fees" description="All currently allocated fees are paid." />
          ) : (
            <div className="space-y-3">
              {fees.map((fee) => {
                const balance = Number(fee.balance || 0);
                return (
                  <div key={fee.id} className="flex flex-col gap-3 rounded-xl border border-gray-100 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                        <IndianRupee className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{monthNames[fee.month]} {fee.year}</p>
                        <p className="text-xs text-gray-400">Due {new Date(fee.due_date).toLocaleDateString("en-IN")}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-sm font-semibold text-gray-900">₹{balance.toLocaleString("en-IN")}</span>
                      <Badge variant={fee.status === "overdue" ? "danger" : fee.status === "partial" ? "warning" : "info"}>{fee.status}</Badge>
                      <Button size="sm" onClick={() => payFee(fee)} loading={payingId === fee.id}>Pay Now</Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Receipts</CardTitle>
          <CardDescription>Download PDF receipts generated after payment verification.</CardDescription>
        </CardHeader>
        <CardContent>
          {receipts.length === 0 ? (
            <EmptyState icon={<FileText className="h-10 w-10" />} title="No receipts yet" description="Receipts will appear here after successful payments." />
          ) : (
            <div className="space-y-3">
              {receipts.map((receipt) => (
                <div key={receipt.id} className="rounded-xl border border-gray-100 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{receipt.receipt_number}</p>
                      <p className="text-xs text-gray-400">{new Date(receipt.receipt_date).toLocaleString("en-IN")}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-gray-900">₹{Number(receipt.amount).toLocaleString("en-IN")}</span>
                      <Button variant="outline" size="sm" onClick={() => downloadReceipt(receipt)}>
                        <Download className="h-4 w-4" /> PDF
                      </Button>
                    </div>
                  </div>
                  {receipt.fee_details?.breakdown && (
                    <div className="mt-3 grid gap-2 rounded-lg bg-gray-50 p-3 sm:grid-cols-2">
                      {Object.entries(receipt.fee_details.breakdown).map(([name, amount]) => (
                        <div key={name} className="flex justify-between text-xs">
                          <span className="text-gray-500">{name}</span>
                          <span className="font-medium text-gray-800">₹{Number(amount).toLocaleString("en-IN")}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
