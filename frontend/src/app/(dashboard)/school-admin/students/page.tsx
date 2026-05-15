"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Badge, Avatar, EmptyState, Skeleton } from "@/components/ui/badge";
import { apiClient } from "@/lib/api";
import { useAuthState } from "@/hooks/useAuth";
import {
  Download,
  Edit,
  Eye,
  GraduationCap,
  Save,
  Search,
  Sparkles,
  UploadCloud,
  UserRound,
  X,
} from "lucide-react";

type Student = {
  id: string;
  admission_number: string;
  first_name: string;
  last_name?: string | null;
  full_name: string;
  class_name?: string | null;
  section_name?: string | null;
  roll_number?: number | null;
  gender?: string | null;
  blood_group?: string | null;
  date_of_birth?: string | null;
  parent_name?: string | null;
  parent_phone?: string | null;
  father_name?: string | null;
  mother_name?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  photo_url?: string | null;
  status: string;
  admission_date?: string | null;
};

type ExtractedField = { value?: string | null; confidence?: number };
type ExtractionResult = {
  document_type?: string;
  overall_confidence?: number;
  fields?: Record<string, ExtractedField>;
  warnings?: string[];
};

function getErrorMessage(error: unknown, fallback: string) {
  if (typeof error === "object" && error !== null && "response" in error) {
    const response = (error as { response?: { data?: { detail?: string } } }).response;
    return response?.data?.detail || fallback;
  }
  return fallback;
}

function downloadCsv(filename: string, rows: Student[]) {
  const headers = ["Admission No", "Name", "Class", "Roll", "Parent", "Phone", "Status"];
  const body = rows.map((student) => [
    student.admission_number,
    student.full_name,
    `${student.class_name || ""}${student.section_name ? `-${student.section_name}` : ""}`,
    student.roll_number || "",
    student.parent_name || "",
    student.parent_phone || "",
    student.status,
  ]);
  const csv = [headers, ...body].map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function StudentsPage() {
  const auth = useAuthState();
  const [students, setStudents] = useState<Student[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [savingEdit, setSavingEdit] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [extraction, setExtraction] = useState<ExtractionResult | null>(null);

  const fetchStudents = async () => {
    if (!auth.schoolId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.getStudents(auth.schoolId, { page_size: 100, search: search || undefined });
      setStudents(response.data.items || []);
    } catch (err) {
      setError(getErrorMessage(err, "Could not load students."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (auth.schoolId) void fetchStudents();
    }, 0);
    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.schoolId]);

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    return students.filter((student) =>
      !term ||
      student.full_name.toLowerCase().includes(term) ||
      student.admission_number.toLowerCase().includes(term) ||
      (student.parent_name || "").toLowerCase().includes(term)
    );
  }, [students, search]);

  const importCsv = async () => {
    if (!auth.schoolId || !csvFile) return;
    const data = new FormData();
    data.append("file", csvFile);
    setImporting(true);
    setImportMessage(null);
    setError(null);
    try {
      const response = await apiClient.importStudentsCsv(auth.schoolId, data);
      setImportMessage(`Imported ${response.data.created} students. Skipped ${response.data.skipped?.length || 0} rows.`);
      await fetchStudents();
    } catch (err) {
      setError(getErrorMessage(err, "Could not import students."));
    } finally {
      setImporting(false);
    }
  };

  const extractDocument = async () => {
    if (!auth.schoolId || !documentFile) {
      setExtractError("Select a document image first.");
      return;
    }

    const data = new FormData();
    data.append("file", documentFile);
    setExtracting(true);
    setExtractError(null);
    try {
      const response = await apiClient.extractStudentDocument(auth.schoolId, data);
      setExtraction(response.data);
    } catch (err: unknown) {
      setExtractError(getErrorMessage(err, "Could not extract document fields."));
    } finally {
      setExtracting(false);
    }
  };

  const openEdit = (student: Student) => {
    setSelectedStudent(student);
    setEditingStudent(student);
    setEditForm({
      first_name: student.first_name || "",
      last_name: student.last_name || "",
      gender: student.gender || "",
      blood_group: student.blood_group || "",
      roll_number: student.roll_number ? String(student.roll_number) : "",
      email: student.email || "",
      phone: student.phone || "",
      address: student.address || "",
    });
  };

  const saveEdit = async (event: FormEvent) => {
    event.preventDefault();
    if (!auth.schoolId || !editingStudent) return;
    setSavingEdit(true);
    setError(null);
    try {
      await apiClient.updateStudent(auth.schoolId, editingStudent.id, {
        ...editForm,
        roll_number: editForm.roll_number ? Number(editForm.roll_number) : undefined,
      });
      setEditingStudent(null);
      await fetchStudents();
    } catch (err) {
      setError(getErrorMessage(err, "Could not update student."));
    } finally {
      setSavingEdit(false);
    }
  };

  if (!auth.schoolId) {
    return <EmptyState icon={<GraduationCap className="h-10 w-10" />} title="No school selected" description="Your account is not linked to a school." />;
  }

  return (
    <div className="space-y-6">
      {error && <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {importMessage && <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{importMessage}</div>}

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <UploadCloud className="h-5 w-5 text-indigo-600" /> Student Data Upload
                </CardTitle>
                <CardDescription>Upload a CSV to create students and link parent records by phone.</CardDescription>
              </div>
              <Badge variant="info">school-scoped import</Badge>
            </CardHeader>
            <CardContent className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
              <div>
                <Label className="mb-2 block">CSV File</Label>
                <Input type="file" accept=".csv,text/csv" onChange={(event) => setCsvFile(event.target.files?.[0] || null)} />
                <p className="mt-2 text-xs text-gray-400">Headers: admission_number, first_name, class_id or class_name, section_name, parent_name, parent_phone.</p>
              </div>
              <Button onClick={importCsv} loading={importing} disabled={!csvFile}><UploadCloud className="h-4 w-4" /> Import</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-indigo-600" /> AI Document Extraction
                </CardTitle>
                <CardDescription>Extract admission data from forms, Aadhaar, marksheets, or transfer certificates.</CardDescription>
              </div>
              <Badge variant="info">preview before save</Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              {extractError && <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{extractError}</div>}
              <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
                <div>
                  <Label className="mb-2 block">Student Document Image</Label>
                  <Input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setDocumentFile(event.target.files?.[0] || null)} />
                </div>
                <Button onClick={extractDocument} loading={extracting} disabled={!documentFile}>
                  <UploadCloud className="h-4 w-4" /> Extract Fields
                </Button>
              </div>
              {extraction && (
                <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-4">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <Badge variant="info">{extraction.document_type || "Document"}</Badge>
                    {typeof extraction.overall_confidence === "number" && (
                      <Badge variant={extraction.overall_confidence >= 0.75 ? "success" : "warning"}>
                        {Math.round(extraction.overall_confidence * 100)}% confidence
                      </Badge>
                    )}
                  </div>
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {Object.entries(extraction.fields || {}).map(([key, field]) => (
                      <div key={key} className="rounded-lg border border-gray-100 bg-white p-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{key.replaceAll("_", " ")}</p>
                        <p className="mt-1 text-sm font-semibold text-gray-900">{field.value || "Not found"}</p>
                        {typeof field.confidence === "number" && <p className="mt-1 text-xs text-gray-400">{Math.round(field.confidence * 100)}% confidence</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle>All Students</CardTitle>
                <CardDescription>{filtered.length} students from the database</CardDescription>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <Input placeholder="Search students..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 sm:w-72" />
                </div>
                <Button variant="outline" size="sm" onClick={() => downloadCsv("students.csv", filtered)}><Download className="h-4 w-4" /> CSV</Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="space-y-3 p-6">{Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-14" />)}</div>
              ) : filtered.length === 0 ? (
                <EmptyState icon={<GraduationCap className="h-10 w-10" />} title="No students yet" description="Import students or create them from onboarding forms." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50/50">
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Student</th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Adm. No.</th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Class</th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Roll</th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Parent</th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
                        <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filtered.map((student) => (
                        <tr key={student.id} className="group hover:bg-gray-50/80">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <Avatar src={student.photo_url} name={student.full_name} size="sm" />
                              <div>
                                <p className="text-sm font-medium text-gray-900">{student.full_name}</p>
                                <p className="text-xs text-gray-400">{student.gender || "Gender not set"}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 font-mono text-sm text-gray-600">{student.admission_number}</td>
                          <td className="px-6 py-4 text-sm text-gray-900">{student.class_name || "-"}{student.section_name ? <span className="ml-1 text-xs text-gray-400">({student.section_name})</span> : null}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">{student.roll_number || "-"}</td>
                          <td className="px-6 py-4">
                            <p className="text-sm text-gray-900">{student.parent_name || "-"}</p>
                            <p className="text-xs text-gray-400">{student.parent_phone || ""}</p>
                          </td>
                          <td className="px-6 py-4"><Badge variant={student.status === "active" ? "success" : "warning"}>{student.status}</Badge></td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setSelectedStudent(student); setEditingStudent(null); }} title="View ID card">
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(student)} title="Edit student">
                                <Edit className="h-4 w-4" />
                              </Button>
                            </div>
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

        <aside className="space-y-6">
          {selectedStudent ? (
            <>
              <StudentIdCard student={selectedStudent} />
              {editingStudent && (
                <Card>
                  <CardHeader className="flex flex-row items-start justify-between">
                    <div>
                      <CardTitle>Edit Student</CardTitle>
                      <CardDescription>Update basic profile details.</CardDescription>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => setEditingStudent(null)}><X className="h-4 w-4" /></Button>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={saveEdit} className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2"><Label>First Name</Label><Input value={editForm.first_name || ""} onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })} /></div>
                        <div className="space-y-2"><Label>Last Name</Label><Input value={editForm.last_name || ""} onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })} /></div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2"><Label>Roll</Label><Input value={editForm.roll_number || ""} onChange={(e) => setEditForm({ ...editForm, roll_number: e.target.value })} /></div>
                        <div className="space-y-2"><Label>Blood Group</Label><Input value={editForm.blood_group || ""} onChange={(e) => setEditForm({ ...editForm, blood_group: e.target.value })} /></div>
                      </div>
                      <div className="space-y-2"><Label>Email</Label><Input value={editForm.email || ""} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} /></div>
                      <div className="space-y-2"><Label>Phone</Label><Input value={editForm.phone || ""} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} /></div>
                      <div className="space-y-2"><Label>Address</Label><Textarea value={editForm.address || ""} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} /></div>
                      <Button type="submit" loading={savingEdit} className="w-full"><Save className="h-4 w-4" /> Save Changes</Button>
                    </form>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card className="border-dashed">
              <CardContent className="p-8">
                <EmptyState icon={<UserRound className="h-10 w-10" />} title="Select a student" description="Click the eye button to view the animated ID card and profile details." />
              </CardContent>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}

function StudentIdCard({ student }: { student: Student }) {
  return (
    <div className="relative px-5 pt-8">
      <div className="absolute left-1/2 top-0 h-12 w-px -translate-x-1/2 bg-gray-300" />
      <div className="absolute left-1/2 top-10 h-4 w-16 -translate-x-1/2 rounded-full border border-gray-200 bg-white shadow-sm" />
      <Card className="student-id-card overflow-hidden border-indigo-100 bg-white shadow-lg">
        <div className="bg-gradient-to-r from-indigo-600 to-blue-600 p-5 text-white">
          <div className="flex items-center gap-4">
            <Avatar src={student.photo_url} name={student.full_name} size="lg" className="ring-4 ring-white/30" />
            <div className="min-w-0">
              <p className="truncate text-lg font-bold">{student.full_name}</p>
              <p className="text-sm text-indigo-100">Adm. No. {student.admission_number}</p>
            </div>
          </div>
        </div>
        <CardContent className="space-y-4 p-5">
          <div className="grid grid-cols-2 gap-3">
            <Detail label="Class" value={`${student.class_name || "-"}${student.section_name ? `-${student.section_name}` : ""}`} />
            <Detail label="Roll No." value={student.roll_number || "-"} />
            <Detail label="Blood" value={student.blood_group || "-"} />
            <Detail label="DOB" value={student.date_of_birth ? new Date(student.date_of_birth).toLocaleDateString("en-IN") : "-"} />
          </div>
          <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Parent Details</p>
            <p className="mt-1 text-sm font-semibold text-gray-900">{student.father_name || student.parent_name || "Not linked"}</p>
            <p className="text-xs text-gray-500">{student.mother_name ? `Mother: ${student.mother_name}` : student.parent_phone || ""}</p>
          </div>
          <div className="rounded-xl border border-gray-100 bg-white p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Address</p>
            <p className="mt-1 text-sm text-gray-700">{student.address || "No address added"}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-gray-900">{value}</p>
    </div>
  );
}
