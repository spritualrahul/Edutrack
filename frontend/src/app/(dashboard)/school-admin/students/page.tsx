"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
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

type AcademicClassOption = {
  id: string;
  name: string;
  numeric_grade: number;
  sections: { id: string; name: string }[];
};

const EMPTY_CREATE_FORM: Record<string, string> = {
  admission_number: "",
  first_name: "",
  last_name: "",
  date_of_birth: "",
  gender: "",
  blood_group: "",
  class_id: "",
  section_id: "",
  roll_number: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  state: "",
  pincode: "",
  parent_name: "",
  parent_phone: "",
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

  // Create student form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState<Record<string, string>>({ ...EMPTY_CREATE_FORM });
  const [creatingStudent, setCreatingStudent] = useState(false);
  const [createMessage, setCreateMessage] = useState<string | null>(null);
  const [classes, setClasses] = useState<AcademicClassOption[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(false);

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

  const fetchClasses = async () => {
    if (!auth.schoolId) return;
    setLoadingClasses(true);
    try {
      const response = await apiClient.getClassesForSchool(auth.schoolId);
      setClasses(response.data || []);
    } catch {
      // Silent fail - classes are optional context
    } finally {
      setLoadingClasses(false);
    }
  };

  const openCreateForm = () => {
    setShowCreateForm(true);
    setSelectedStudent(null);
    setEditingStudent(null);
    setCreateForm({ ...EMPTY_CREATE_FORM });
    setCreateMessage(null);
    if (classes.length === 0) void fetchClasses();
  };

  const submitCreateStudent = async (event: FormEvent) => {
    event.preventDefault();
    if (!auth.schoolId) return;
    if (!createForm.admission_number || !createForm.first_name || !createForm.class_id) {
      setError("Admission number, first name, and class are required.");
      return;
    }
    setCreatingStudent(true);
    setError(null);
    setCreateMessage(null);
    try {
      const payload: Record<string, unknown> = {
        admission_number: createForm.admission_number,
        first_name: createForm.first_name,
        last_name: createForm.last_name || undefined,
        date_of_birth: createForm.date_of_birth || undefined,
        gender: createForm.gender || undefined,
        blood_group: createForm.blood_group || undefined,
        class_id: createForm.class_id,
        section_id: createForm.section_id || undefined,
        roll_number: createForm.roll_number ? Number(createForm.roll_number) : undefined,
        email: createForm.email || undefined,
        phone: createForm.phone || undefined,
        address: createForm.address || undefined,
        city: createForm.city || undefined,
        state: createForm.state || undefined,
        pincode: createForm.pincode || undefined,
      };
      await apiClient.createStudent(auth.schoolId, payload);
      setCreateMessage(`Student "${createForm.first_name} ${createForm.last_name || ""}" created successfully!`);
      setCreateForm({ ...EMPTY_CREATE_FORM });
      await fetchStudents();
    } catch (err) {
      setError(getErrorMessage(err, "Could not create student."));
    } finally {
      setCreatingStudent(false);
    }
  };

  const selectedClassSections = classes.find((c) => c.id === createForm.class_id)?.sections || [];

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
      {createMessage && <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{createMessage}</div>}

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
                <Button size="sm" onClick={openCreateForm}><GraduationCap className="h-4 w-4" /> Add Student</Button>
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
          ) : showCreateForm ? (
            <Card>
              <CardHeader className="flex flex-row items-start justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <GraduationCap className="h-5 w-5 text-indigo-600" /> Create Student
                  </CardTitle>
                  <CardDescription>Manually add a new student profile.</CardDescription>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setShowCreateForm(false)}><X className="h-4 w-4" /></Button>
              </CardHeader>
              <CardContent>
                <form onSubmit={submitCreateStudent} className="space-y-4">
                  {/* Personal Info */}
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Personal Info</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>First Name <span className="text-red-400">*</span></Label>
                        <Input value={createForm.first_name} onChange={(e) => setCreateForm({ ...createForm, first_name: e.target.value })} placeholder="Rahul" required />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Last Name</Label>
                        <Input value={createForm.last_name} onChange={(e) => setCreateForm({ ...createForm, last_name: e.target.value })} placeholder="Sharma" />
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>Date of Birth</Label>
                        <Input type="date" value={createForm.date_of_birth} onChange={(e) => setCreateForm({ ...createForm, date_of_birth: e.target.value })} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Gender</Label>
                        <Select value={createForm.gender} onChange={(e) => setCreateForm({ ...createForm, gender: e.target.value })}>
                          <option value="">Select</option>
                          <option value="male">Male</option>
                          <option value="female">Female</option>
                          <option value="other">Other</option>
                        </Select>
                      </div>
                    </div>
                    <div className="mt-3">
                      <div className="space-y-1.5">
                        <Label>Blood Group</Label>
                        <Select value={createForm.blood_group} onChange={(e) => setCreateForm({ ...createForm, blood_group: e.target.value })}>
                          <option value="">Select</option>
                          {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((bg) => (
                            <option key={bg} value={bg}>{bg}</option>
                          ))}
                        </Select>
                      </div>
                    </div>
                  </div>

                  {/* Academic Info */}
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Academic Info</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>Admission No. <span className="text-red-400">*</span></Label>
                        <Input value={createForm.admission_number} onChange={(e) => setCreateForm({ ...createForm, admission_number: e.target.value })} placeholder="ADM-001" required />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Roll Number</Label>
                        <Input type="number" value={createForm.roll_number} onChange={(e) => setCreateForm({ ...createForm, roll_number: e.target.value })} placeholder="1" />
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>Class <span className="text-red-400">*</span></Label>
                        <Select
                          value={createForm.class_id}
                          onChange={(e) => setCreateForm({ ...createForm, class_id: e.target.value, section_id: "" })}
                          disabled={loadingClasses}
                          required
                        >
                          <option value="">{loadingClasses ? "Loading..." : "Select Class"}</option>
                          {classes.map((cls) => (
                            <option key={cls.id} value={cls.id}>{cls.name}</option>
                          ))}
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Section</Label>
                        <Select
                          value={createForm.section_id}
                          onChange={(e) => setCreateForm({ ...createForm, section_id: e.target.value })}
                          disabled={!createForm.class_id}
                        >
                          <option value="">Select Section</option>
                          {selectedClassSections.map((sec) => (
                            <option key={sec.id} value={sec.id}>{sec.name}</option>
                          ))}
                        </Select>
                      </div>
                    </div>
                  </div>

                  {/* Contact Info */}
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Contact Info</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>Email</Label>
                        <Input type="email" value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} placeholder="student@email.com" />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Phone</Label>
                        <Input value={createForm.phone} onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })} placeholder="+91 9876543210" />
                      </div>
                    </div>
                    <div className="mt-3 space-y-1.5">
                      <Label>Address</Label>
                      <Textarea value={createForm.address} onChange={(e) => setCreateForm({ ...createForm, address: e.target.value })} placeholder="Street address" rows={2} />
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-3">
                      <div className="space-y-1.5">
                        <Label>City</Label>
                        <Input value={createForm.city} onChange={(e) => setCreateForm({ ...createForm, city: e.target.value })} placeholder="City" />
                      </div>
                      <div className="space-y-1.5">
                        <Label>State</Label>
                        <Input value={createForm.state} onChange={(e) => setCreateForm({ ...createForm, state: e.target.value })} placeholder="State" />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Pincode</Label>
                        <Input value={createForm.pincode} onChange={(e) => setCreateForm({ ...createForm, pincode: e.target.value })} placeholder="110001" />
                      </div>
                    </div>
                  </div>

                  {/* Parent Info */}
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Parent / Guardian</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>Parent Name</Label>
                        <Input value={createForm.parent_name} onChange={(e) => setCreateForm({ ...createForm, parent_name: e.target.value })} placeholder="Parent name" />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Parent Phone</Label>
                        <Input value={createForm.parent_phone} onChange={(e) => setCreateForm({ ...createForm, parent_phone: e.target.value })} placeholder="+91 9876543210" />
                      </div>
                    </div>
                  </div>

                  <Button type="submit" loading={creatingStudent} className="w-full">
                    <Save className="h-4 w-4" /> Create Student
                  </Button>
                </form>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center gap-4 p-8">
                <EmptyState icon={<UserRound className="h-10 w-10" />} title="Select a student" description="Click the eye button to view the ID card, or create a new student profile." />
                <Button variant="outline" onClick={openCreateForm}><GraduationCap className="h-4 w-4" /> Add Student Manually</Button>
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
    <div className="id-card-hanging relative px-5 pt-8">
      <div className="absolute left-1/2 top-0 h-12 w-px -translate-x-1/2 bg-gray-300" />
      <div className="id-card-lanyard-clip absolute left-1/2 top-10 h-4 w-16 -translate-x-1/2 rounded-full border border-gray-200 bg-white shadow-sm" />
      <Card className="id-card-inner student-id-card overflow-hidden border-indigo-100 bg-white shadow-lg">
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
