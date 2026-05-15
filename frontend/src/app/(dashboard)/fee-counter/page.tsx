"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Badge, Avatar, EmptyState } from "@/components/ui/badge";
import { apiClient } from "@/lib/api";
import { useAuthState } from "@/hooks/useAuth";
import { useFeeCounterStore } from "@/stores/app-store";
import {
  Search, IndianRupee, CreditCard, Smartphone, Banknote,
  FileText, Printer, Send, CheckCircle2, Clock, Receipt, TrendingUp,
} from "lucide-react";

type StudentSearchResult = {
  id: string;
  admission_number: string;
  full_name: string;
  class_name: string;
  section_name: string | null;
  parent_phone: string | null;
  photo_url: string | null;
  pending_fees: number | string;
};

type PendingFee = {
  id: string;
  student_id: string;
  month: number;
  year: number;
  total_amount: number | string;
  discount_amount: number | string;
  paid_amount: number | string;
  balance: number | string;
  due_date: string;
  status: "pending" | "partial" | "overdue" | "paid" | string;
  breakdown?: Record<string, number | string> | null;
};

type DailySummary = {
  date: string;
  total_collected: number | string;
  total_transactions: number;
  by_mode: Record<string, number | string>;
};

type SuccessReceipt = {
  receipt_number: string;
  student_name: string;
  amount: number;
  payment_mode: string;
  date: string;
};

const paymentModes = [
  { value: "cash", label: "Cash", icon: Banknote },
  { value: "upi", label: "UPI", icon: Smartphone },
  { value: "card", label: "Card", icon: CreditCard },
  { value: "cheque", label: "Cheque", icon: FileText },
  { value: "online", label: "Online", icon: TrendingUp },
];

const monthNames = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function toNumber(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function currency(value: number | string | null | undefined) {
  return `₹${toNumber(value).toLocaleString("en-IN")}`;
}

function getApiErrorMessage(error: unknown, fallback: string) {
  if (typeof error === "object" && error !== null && "response" in error) {
    const response = (error as { response?: { data?: { detail?: string } } }).response;
    return response?.data?.detail || fallback;
  }
  return fallback;
}

export default function FeeCounterDashboard() {
  const auth = useAuthState();
  const schoolId = auth.schoolId;
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<StudentSearchResult[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [searching, setSearching] = useState(false);
  const [loadingFees, setLoadingFees] = useState(false);
  const [selectedFee, setSelectedFee] = useState<PendingFee | null>(null);
  const [paymentMode, setPaymentMode] = useState("cash");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [processing, setProcessing] = useState(false);
  const [successReceipt, setSuccessReceipt] = useState<SuccessReceipt | null>(null);
  const [dailySummary, setDailySummary] = useState<DailySummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const {
    selectedStudent: storedSelectedStudent,
    pendingFees,
    setSelectedStudent,
    setPendingFees,
    clearSelection,
  } = useFeeCounterStore();
  const selectedStudent = storedSelectedStudent as StudentSearchResult | null;
  const normalizedPendingFees = pendingFees as PendingFee[];

  const refreshDailySummary = useCallback(async () => {
    if (!schoolId) return;
    const response = await apiClient.getDailySummary(schoolId);
    setDailySummary(response.data);
  }, [schoolId]);

  const loadPendingFees = useCallback(async (student: StudentSearchResult) => {
    if (!schoolId) return;
    setLoadingFees(true);
    setError(null);
    try {
      const response = await apiClient.getStudentPendingFees(schoolId, student.id);
      setPendingFees(response.data as Record<string, unknown>[]);
    } catch {
      setPendingFees([]);
      setError("Could not load pending fees for this student.");
    } finally {
      setLoadingFees(false);
    }
  }, [schoolId, setPendingFees]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      refreshDailySummary().catch(() => setDailySummary(null));
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [refreshDailySummary]);

  useEffect(() => {
    if (!schoolId || searchQuery.trim().length < 2) {
      return;
    }

    let isCurrent = true;
    const timeout = window.setTimeout(async () => {
      setSearching(true);
      setError(null);
      try {
        const response = await apiClient.searchStudents(schoolId, searchQuery.trim());
        if (isCurrent) {
          setSearchResults(response.data);
          setShowSearch(true);
        }
      } catch {
        if (isCurrent) {
          setSearchResults([]);
          setShowSearch(true);
          setError("Student search failed. Please try again.");
        }
      } finally {
        if (isCurrent) setSearching(false);
      }
    }, 250);

    return () => {
      isCurrent = false;
      window.clearTimeout(timeout);
    };
  }, [schoolId, searchQuery]);

  const selectStudent = async (student: StudentSearchResult) => {
    setSelectedStudent(student);
    setSearchQuery("");
    setShowSearch(false);
    setSelectedFee(null);
    setSuccessReceipt(null);
    await loadPendingFees(student);
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (value.trim().length < 2) {
      setSearchResults([]);
      setShowSearch(false);
    }
  };

  const selectedBalance = toNumber(selectedFee?.balance);
  const amount = Number(paymentAmount);
  const canCollect = Boolean(selectedFee && selectedStudent && amount > 0 && amount <= selectedBalance && !processing);

  const handleCollectFee = async () => {
    if (!schoolId || !selectedStudent || !selectedFee || !canCollect) return;
    setProcessing(true);
    setError(null);
    try {
      const response = await apiClient.collectFee(schoolId, {
        student_id: selectedStudent.id,
        fee_allocation_id: selectedFee.id,
        amount,
        payment_mode: paymentMode,
        transaction_id: transactionId || undefined,
      });

      setSuccessReceipt({
        receipt_number: response.data.receipt_number || String(response.data.id).slice(0, 8).toUpperCase(),
        student_name: selectedStudent.full_name,
        amount,
        payment_mode: paymentMode,
        date: new Date(response.data.payment_date || Date.now()).toLocaleString("en-IN"),
      });
      setSelectedFee(null);
      setPaymentAmount("");
      setTransactionId("");
      await Promise.all([loadPendingFees(selectedStudent), refreshDailySummary()]);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, "Payment could not be collected."));
    } finally {
      setProcessing(false);
    }
  };

  const summaryRows = useMemo(() => {
    const modes = ["cash", "upi", "card", "cheque"];
    const total = toNumber(dailySummary?.total_collected);
    return modes.map((mode) => ({
      label: mode.toUpperCase(),
      amount: toNumber(dailySummary?.by_mode?.[mode]),
      width: total > 0 ? (toNumber(dailySummary?.by_mode?.[mode]) / total) * 100 : 0,
    }));
  }, [dailySummary]);

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {!schoolId && (
        <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          This account is not linked to a school yet. Ask an administrator to assign a school before collecting fees.
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="flex flex-col gap-4 lg:col-span-8">
          <Card className="p-4">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by student name, admission number, or parent phone..."
                value={searchQuery}
                onChange={(event) => handleSearchChange(event.target.value)}
                className="h-12 w-full rounded-xl border border-gray-200 bg-gray-50 pl-12 pr-4 text-base text-gray-900 placeholder:text-gray-400 focus:border-transparent focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                disabled={!schoolId}
                autoFocus
              />
              {showSearch && (
                <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-xl">
                  {searching && <p className="px-4 py-3 text-sm text-gray-500">Searching students...</p>}
                  {!searching && searchResults.length === 0 && (
                    <p className="px-4 py-3 text-sm text-gray-500">No matching students found.</p>
                  )}
                  {!searching && searchResults.map((student) => (
                    <button
                      key={student.id}
                      onClick={() => selectStudent(student)}
                      className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-indigo-50"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar name={student.full_name} size="sm" />
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{student.full_name}</p>
                          <p className="text-xs text-gray-500">
                            {student.admission_number} · {student.class_name}
                            {student.section_name ? `-${student.section_name}` : ""}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-red-600">{currency(student.pending_fees)}</p>
                        <p className="text-[10px] text-gray-400">pending</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Card>

          {selectedStudent && (
            <Card className="overflow-hidden">
              <div className="flex flex-col gap-4 border-b border-indigo-100 bg-gradient-to-r from-indigo-50 to-white p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  <Avatar name={selectedStudent.full_name} size="lg" />
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">{selectedStudent.full_name}</h3>
                    <p className="text-sm text-gray-500">
                      {selectedStudent.admission_number} · {selectedStudent.class_name}
                      {selectedStudent.section_name ? `-${selectedStudent.section_name}` : ""}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-400">Parent: {selectedStudent.parent_phone || "Not available"}</p>
                  </div>
                </div>
                <div className="text-left sm:text-right">
                  <p className="text-xs uppercase tracking-wider text-gray-500">Total Pending</p>
                  <p className="text-2xl font-bold text-red-600">{currency(selectedStudent.pending_fees)}</p>
                </div>
              </div>

              <CardContent className="p-4">
                <h4 className="mb-3 text-sm font-semibold text-gray-700">Pending Fee Installments</h4>
                {loadingFees && <p className="text-sm text-gray-500">Loading pending fees...</p>}
                {!loadingFees && normalizedPendingFees.length === 0 && (
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                    No pending dues for this student.
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  {normalizedPendingFees.map((fee) => (
                    <button
                      key={fee.id}
                      onClick={() => {
                        setSelectedFee(fee);
                        setPaymentAmount(String(toNumber(fee.balance)));
                        setSuccessReceipt(null);
                      }}
                      className={`flex w-full items-center justify-between rounded-xl border p-4 ${
                        selectedFee?.id === fee.id
                          ? "border-indigo-300 bg-indigo-50 ring-2 ring-indigo-200"
                          : "border-gray-100 hover:border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                          fee.status === "overdue" ? "bg-red-50 text-red-600" :
                          fee.status === "partial" ? "bg-amber-50 text-amber-600" :
                          "bg-gray-50 text-gray-600"
                        }`}>
                          <IndianRupee className="h-5 w-5" />
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-semibold text-gray-900">{monthNames[fee.month]} {fee.year}</p>
                          <div className="mt-0.5 flex items-center gap-2">
                            <Badge variant={fee.status === "overdue" ? "danger" : fee.status === "partial" ? "warning" : "default"}>
                              {fee.status}
                            </Badge>
                            {toNumber(fee.paid_amount) > 0 && (
                              <span className="text-xs text-gray-400">Paid: {currency(fee.paid_amount)}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-gray-900">{currency(fee.balance)}</p>
                        <p className="text-xs text-gray-400">
                          due: {new Date(fee.due_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {selectedFee && !successReceipt && (
            <Card>
              <CardHeader>
                <CardTitle>Collect Payment</CardTitle>
                <CardDescription>
                  {monthNames[selectedFee.month]} {selectedFee.year} · Balance: {currency(selectedFee.balance)}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-5">
                {selectedFee.breakdown && (
                  <div className="flex flex-col gap-1.5 rounded-lg bg-gray-50 p-3">
                    <p className="mb-1 text-xs font-medium uppercase tracking-wider text-gray-500">Fee Breakdown</p>
                    {Object.entries(selectedFee.breakdown).map(([key, value]) => (
                      <div key={key} className="flex justify-between text-sm">
                        <span className="text-gray-600">{key}</span>
                        <span className="font-medium text-gray-900">{currency(value)}</span>
                      </div>
                    ))}
                    {toNumber(selectedFee.discount_amount) > 0 && (
                      <div className="mt-1.5 flex justify-between border-t border-gray-200 pt-1.5 text-sm">
                        <span className="text-emerald-600">Discount</span>
                        <span className="font-medium text-emerald-600">-{currency(selectedFee.discount_amount)}</span>
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <Label className="mb-2 block">Payment Mode</Label>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                    {paymentModes.map((mode) => (
                      <button
                        key={mode.value}
                        onClick={() => setPaymentMode(mode.value)}
                        className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 ${
                          paymentMode === mode.value
                            ? "border-indigo-300 bg-indigo-50 ring-2 ring-indigo-200"
                            : "border-gray-100 hover:border-gray-200"
                        }`}
                      >
                        <mode.icon className={paymentMode === mode.value ? "h-5 w-5 text-indigo-600" : "h-5 w-5 text-gray-400"} />
                        <span className={paymentMode === mode.value ? "text-xs font-medium text-indigo-700" : "text-xs font-medium text-gray-600"}>
                          {mode.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <Label className="mb-2 block">Amount (₹)</Label>
                    <Input
                      type="number"
                      min="1"
                      max={selectedBalance}
                      value={paymentAmount}
                      onChange={(event) => setPaymentAmount(event.target.value)}
                      placeholder="Enter amount"
                      className="h-12 text-lg font-semibold"
                    />
                    <p className="mt-1 text-xs text-gray-400">Partial payments supported up to {currency(selectedBalance)}.</p>
                  </div>
                  {(paymentMode === "upi" || paymentMode === "card" || paymentMode === "online") && (
                    <div>
                      <Label className="mb-2 block">Transaction ID</Label>
                      <Input value={transactionId} onChange={(event) => setTransactionId(event.target.value)} placeholder="Enter transaction ID" className="h-12" />
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-3 pt-2 sm:flex-row">
                  <Button onClick={handleCollectFee} disabled={!canCollect} loading={processing} className="h-12 flex-1 text-base" variant="success">
                    <CheckCircle2 className="h-5 w-5" /> Collect {currency(paymentAmount || 0)}
                  </Button>
                  <Button variant="outline" onClick={() => setSelectedFee(null)} className="h-12">Cancel</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {successReceipt && (
            <Card className="border-emerald-200 bg-emerald-50/50">
              <CardContent className="p-6 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                  <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                </div>
                <h3 className="mb-1 text-xl font-bold text-gray-900">Payment Collected</h3>
                <p className="mb-4 text-sm text-gray-500">Receipt #{successReceipt.receipt_number}</p>
                <div className="mb-6 inline-flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-emerald-700">{currency(successReceipt.amount)}</span>
                  <span className="text-sm text-gray-500">via {successReceipt.payment_mode.toUpperCase()}</span>
                </div>
                <div className="flex flex-wrap justify-center gap-3">
                  <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="h-4 w-4" /> Print Receipt</Button>
                  <Button variant="outline" size="sm" disabled><Send className="h-4 w-4" /> WhatsApp Queued</Button>
                  <Button size="sm" onClick={() => { setSuccessReceipt(null); clearSelection(); }}>
                    <Search className="h-4 w-4" /> Next Student
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {!selectedStudent && (
            <EmptyState
              icon={<Search className="h-12 w-12" />}
              title="Search for a student"
              description="Type a student name, admission number, or parent phone to start collecting fees."
            />
          )}
        </div>

        <div className="flex flex-col gap-4 lg:col-span-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-indigo-600" />
                Today&apos;s Collection
              </CardTitle>
              <CardDescription>{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="py-3 text-center">
                <p className="text-4xl font-bold text-gray-900">{currency(dailySummary?.total_collected)}</p>
                <p className="mt-1 text-sm text-gray-500">{dailySummary?.total_transactions ?? 0} transactions</p>
              </div>

              <div className="flex flex-col gap-2.5">
                {summaryRows.map((item) => (
                  <div key={item.label}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="text-gray-600">{item.label}</span>
                      <span className="font-medium text-gray-900">{currency(item.amount)}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                      <div className="h-full rounded-full bg-indigo-500" style={{ width: `${item.width}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Button asChild variant="outline" className="w-full justify-start">
                <Link href="/fee-counter/reports"><FileText className="h-4 w-4" /> Daily Collection Report</Link>
              </Button>
              <Button variant="outline" className="w-full justify-start" onClick={() => window.print()}>
                <Printer className="h-4 w-4" /> Print Summary
              </Button>
              <Button asChild variant="outline" className="w-full justify-start">
                <Link href="/fee-counter/history"><Clock className="h-4 w-4" /> Payment History</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
