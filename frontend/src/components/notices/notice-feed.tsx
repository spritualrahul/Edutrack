"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, CheckCircle2, Edit, Plus, Send, Sparkles, Trash2 } from "lucide-react";
import { Badge, EmptyState, Skeleton } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { apiClient } from "@/lib/api";
import { useAuthState } from "@/hooks/useAuth";

type Notice = {
  id: string;
  title: string;
  content: string;
  category: string;
  priority: "low" | "normal" | "high" | "urgent" | string;
  is_published: boolean;
  is_pinned: boolean;
  target_roles: string[];
  target_classes: string[];
  author_name?: string | null;
  created_at: string;
  published_at?: string | null;
};

type NoticeFeedProps = {
  mode: "admin" | "teacher" | "reader";
};

const priorityVariant = {
  urgent: "danger",
  high: "warning",
  normal: "default",
  low: "outline",
} as const;

const roleLabels: Record<string, string> = {
  "org:teacher": "Teachers",
  "org:parent": "Parents",
  "org:student": "Students",
  "org:accounts": "Fee Counter",
};

function getErrorMessage(error: unknown, fallback: string) {
  if (typeof error === "object" && error !== null && "response" in error) {
    const response = (error as { response?: { data?: { detail?: string } } }).response;
    return response?.data?.detail || fallback;
  }
  return fallback;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Draft";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function NoticeFeed({ mode }: NoticeFeedProps) {
  const auth = useAuthState();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showComposer, setShowComposer] = useState(false);
  const [editingNotice, setEditingNotice] = useState<Notice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiTone, setAiTone] = useState("professional");
  const [form, setForm] = useState({
    title: "",
    content: "",
    category: "general",
    priority: "normal",
    targetRole: "all",
    targetClasses: "",
    isPublished: true,
    isPinned: false,
  });

  const schoolId = auth.schoolId;
  const canCompose = mode === "admin" || mode === "teacher";
  const includeDrafts = mode === "admin";

  const resetForm = () => {
    setEditingNotice(null);
    setForm({
      title: "",
      content: "",
      category: "general",
      priority: "normal",
      targetRole: "all",
      targetClasses: "",
      isPublished: true,
      isPinned: false,
    });
  };

  const loadNotices = useCallback(async () => {
    if (!schoolId) {
      setNotices([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.getNotices(schoolId, { include_drafts: includeDrafts });
      setNotices(response.data.items || []);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Could not load notices."));
      setNotices([]);
    } finally {
      setLoading(false);
    }
  }, [schoolId, includeDrafts]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      loadNotices();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [loadNotices]);

  const openCreate = () => {
    resetForm();
    setShowComposer(true);
  };

  const openEdit = (notice: Notice) => {
    setEditingNotice(notice);
    setForm({
      title: notice.title,
      content: notice.content,
      category: notice.category,
      priority: notice.priority || "normal",
      targetRole: notice.target_roles.length === 1 ? notice.target_roles[0] : "all",
      targetClasses: notice.target_classes.join(", "),
      isPublished: notice.is_published,
      isPinned: notice.is_pinned,
    });
    setShowComposer(true);
  };

  const payload = useMemo(() => {
    const targetClasses = form.targetClasses
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    const targetRoles =
      mode === "teacher"
        ? ["org:parent", "org:student"]
        : form.targetRole === "all"
          ? []
          : [form.targetRole];

    return {
      title: form.title.trim(),
      content: form.content.trim(),
      category: form.category,
      priority: form.priority,
      target_roles: targetRoles,
      target_classes: targetClasses,
      is_published: form.isPublished,
      is_pinned: form.isPinned,
      attachments: [],
    };
  }, [form, mode]);

  const saveNotice = async () => {
    if (!schoolId || !payload.title || !payload.content) {
      setError("Title and content are required.");
      return;
    }

    if (mode === "teacher" && payload.target_classes.length === 0) {
      setError("Select at least one class for a teacher notice.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      if (editingNotice) {
        await apiClient.updateNotice(schoolId, editingNotice.id, payload);
      } else {
        await apiClient.createNotice(schoolId, payload);
      }
      setShowComposer(false);
      resetForm();
      await loadNotices();
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Could not save notice."));
    } finally {
      setSaving(false);
    }
  };

  const deleteNotice = async (notice: Notice) => {
    if (!schoolId) return;
    setSaving(true);
    setError(null);
    try {
      await apiClient.deleteNotice(schoolId, notice.id);
      await loadNotices();
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Could not delete notice."));
    } finally {
      setSaving(false);
    }
  };

  const generateDraft = async () => {
    if (!schoolId || aiPrompt.trim().length < 3) {
      setError("Enter a short topic for the AI notice draft.");
      return;
    }

    const audience =
      mode === "teacher"
        ? ["org:parent", "org:student"]
        : form.targetRole === "all"
          ? ["org:teacher", "org:parent", "org:student", "org:accounts"]
          : [form.targetRole];

    setGenerating(true);
    setError(null);
    try {
      const response = await apiClient.generateNoticeDraft(schoolId, {
        prompt: aiPrompt.trim(),
        audience,
        tone: aiTone,
        language: "English",
        category: form.category,
      });
      const draft = response.data;
      setForm((prev) => ({
        ...prev,
        title: draft.title || prev.title,
        content: draft.content || prev.content,
        category: draft.category || prev.category,
        priority: draft.priority || prev.priority,
        targetRole: mode === "admin" && Array.isArray(draft.target_roles) && draft.target_roles.length === 1 ? draft.target_roles[0] : prev.targetRole,
        targetClasses: Array.isArray(draft.suggested_class_filter) ? draft.suggested_class_filter.join(", ") : prev.targetClasses,
      }));
      setShowComposer(true);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Could not generate notice draft."));
    } finally {
      setGenerating(false);
    }
  };

  if (!schoolId) {
    return (
      <EmptyState
        icon={<Bell className="h-12 w-12" />}
        title="No school assigned"
        description="Ask an administrator to assign your account to a school before viewing notices."
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Notices</h2>
          <p className="text-sm text-gray-500">
            {mode === "admin" ? "Publish school-wide announcements and manage drafts." : "Latest school announcements for your role."}
          </p>
        </div>
        {canCompose && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> New Notice
          </Button>
        )}
      </div>

      {error && <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {showComposer && (
        <Card>
          <CardHeader>
            <CardTitle>{editingNotice ? "Edit Notice" : "New Notice"}</CardTitle>
            <CardDescription>
              {mode === "teacher"
                ? "Teacher notices are limited to selected classes and parent/student recipients."
                : "Choose audience, priority, and publish state."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/70 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                <div className="flex-1">
                  <Label className="mb-2 block text-indigo-950">AI Draft Assistant</Label>
                  <Input
                    value={aiPrompt}
                    onChange={(event) => setAiPrompt(event.target.value)}
                    placeholder="Example: exam schedule announcement for Class 10"
                  />
                </div>
                <div className="w-full lg:w-44">
                  <Label className="mb-2 block text-indigo-950">Tone</Label>
                  <Select value={aiTone} onChange={(event) => setAiTone(event.target.value)}>
                    <option value="professional">Professional</option>
                    <option value="concise">Concise</option>
                    <option value="warm">Warm</option>
                    <option value="urgent">Urgent</option>
                  </Select>
                </div>
                <Button type="button" variant="outline" onClick={generateDraft} loading={generating}>
                  <Sparkles className="h-4 w-4" /> Generate
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <Label className="mb-2 block">Title</Label>
                <Input value={form.title} onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))} />
              </div>
              <div className="md:col-span-2">
                <Label className="mb-2 block">Content</Label>
                <Textarea value={form.content} onChange={(event) => setForm((prev) => ({ ...prev, content: event.target.value }))} />
              </div>
              <div>
                <Label className="mb-2 block">Category</Label>
                <Select value={form.category} onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}>
                  <option value="general">General</option>
                  <option value="academic">Academic</option>
                  <option value="fee">Fee</option>
                  <option value="event">Event</option>
                  <option value="holiday">Holiday</option>
                  <option value="exam">Exam</option>
                </Select>
              </div>
              <div>
                <Label className="mb-2 block">Priority</Label>
                <Select value={form.priority} onChange={(event) => setForm((prev) => ({ ...prev, priority: event.target.value }))}>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                  <option value="low">Low</option>
                </Select>
              </div>
              {mode === "admin" && (
                <div>
                  <Label className="mb-2 block">Audience</Label>
                  <Select value={form.targetRole} onChange={(event) => setForm((prev) => ({ ...prev, targetRole: event.target.value }))}>
                    <option value="all">Everyone</option>
                    <option value="org:teacher">Teachers</option>
                    <option value="org:parent">Parents</option>
                    <option value="org:student">Students</option>
                    <option value="org:accounts">Fee Counter</option>
                  </Select>
                </div>
              )}
              <div>
                <Label className="mb-2 block">{mode === "teacher" ? "Target Classes" : "Class Filter"}</Label>
                <Input
                  value={form.targetClasses}
                  onChange={(event) => setForm((prev) => ({ ...prev, targetClasses: event.target.value }))}
                  placeholder="Class 8-A, Class 9-B"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={form.isPublished}
                  onChange={(event) => setForm((prev) => ({ ...prev, isPublished: event.target.checked }))}
                />
                Publish now
              </label>
              {mode === "admin" && (
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={form.isPinned}
                    onChange={(event) => setForm((prev) => ({ ...prev, isPinned: event.target.checked }))}
                  />
                  Pin notice
                </label>
              )}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button onClick={saveNotice} loading={saving}>
                <Send className="h-4 w-4" /> {editingNotice ? "Save Notice" : "Publish Notice"}
              </Button>
              <Button variant="outline" onClick={() => { setShowComposer(false); resetForm(); }}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((item) => <Skeleton key={item} className="h-28 w-full" />)}
        </div>
      ) : notices.length === 0 ? (
        <EmptyState
          icon={<Bell className="h-12 w-12" />}
          title="No notices yet"
          description={canCompose ? "Create the first notice for this school." : "Published notices will appear here."}
          action={canCompose ? <Button onClick={openCreate}><Plus className="h-4 w-4" /> New Notice</Button> : undefined}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {notices.map((notice) => {
            const variant = priorityVariant[notice.priority as keyof typeof priorityVariant] || "default";
            const audience = notice.target_roles.length
              ? notice.target_roles.map((role) => roleLabels[role] || role).join(", ")
              : "Everyone";

            return (
              <Card key={notice.id} className="hover:shadow-sm">
                <CardContent className="p-5">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                        notice.priority === "urgent" ? "bg-red-50" : notice.priority === "high" ? "bg-amber-50" : "bg-gray-50"
                      }`}>
                        <Bell className={`h-5 w-5 ${
                          notice.priority === "urgent" ? "text-red-600" : notice.priority === "high" ? "text-amber-600" : "text-gray-500"
                        }`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {notice.is_pinned && <Badge variant="info">Pinned</Badge>}
                          <h3 className="text-sm font-semibold text-gray-900">{notice.title}</h3>
                        </div>
                        <p className="mt-1 text-sm leading-6 text-gray-600">{notice.content}</p>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <Badge variant={variant}>{notice.priority}</Badge>
                          <Badge variant="info">{notice.category}</Badge>
                          <Badge variant="outline">{audience}</Badge>
                          {notice.target_classes.length > 0 && <Badge variant="outline">{notice.target_classes.join(", ")}</Badge>}
                          <span className="text-xs text-gray-400">{formatDate(notice.published_at || notice.created_at)}</span>
                          {notice.author_name && <span className="text-xs text-gray-400">by {notice.author_name}</span>}
                        </div>
                      </div>
                    </div>
                    {mode === "admin" && (
                      <div className="flex items-center gap-2 md:ml-4">
                        <Badge variant={notice.is_published ? "success" : "default"}>
                          {notice.is_published ? "Published" : "Draft"}
                        </Badge>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(notice)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => deleteNotice(notice)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                    {mode !== "admin" && notice.is_published && (
                      <CheckCircle2 className="hidden h-5 w-5 text-emerald-500 md:block" />
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
