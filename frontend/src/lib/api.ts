import axios from "axios";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type QueryParams = Record<string, string | number | boolean | null | undefined>;
type JsonObject = Record<string, unknown>;

declare global {
  interface Window {
    Clerk?: {
      session?: {
        getToken: () => Promise<string | null>;
      };
    };
  }
}

export const api = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  headers: { "Content-Type": "application/json" },
});

// Attach Clerk token to every request using the modern Clerk client API
api.interceptors.request.use(async (config) => {
  if (typeof window !== "undefined") {
    try {
      // Clerk v7 exposes the session on window.Clerk
      const clerkInstance = window.Clerk;
      const token = await clerkInstance?.session?.getToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch {
      // Silent fail — user might not be signed in
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;

    if (typeof window !== "undefined") {
      if (status === 401) {
        // Unauthenticated — session expired or invalid token
        window.location.href = "/sign-in";
      } else if (status === 403) {
        // Forbidden — user doesn't have the required role/permission
        console.error(
          "[RBAC] 403 Forbidden:",
          error.response?.data?.detail || "Access denied"
        );
      }
    }

    return Promise.reject(error);
  }
);

// API helper functions
export const apiClient = {
  // ---- Auth ----
  syncUser: () => api.post("/auth/sync"),
  getMe: () => api.get("/auth/me"),
  assignRole: (data: { clerk_id: string; role: string; school_id?: string }) =>
    api.post("/auth/assign-role", data),

  // ---- Organizations ----
  getOrganizations: (params?: QueryParams) => api.get("/organizations", { params }),
  getOrganization: (id: string) => api.get(`/organizations/${id}`),
  createOrganization: (data: JsonObject) => api.post("/organizations", data),
  updateOrganization: (id: string, data: JsonObject) => api.patch(`/organizations/${id}`, data),
  deleteOrganization: (id: string) => api.delete(`/organizations/${id}`),
  getPlatformStats: () => api.get("/organizations/stats/platform"),
  getSubscriptionPlans: (params?: QueryParams) =>
    api.get("/organizations/subscription-plans", { params }),
  updateSubscriptionPlan: (planId: string, data: JsonObject) =>
    api.patch(`/organizations/subscription-plans/${planId}`, data),
  createSubscriptionCheckout: (organizationId: string, data: JsonObject) =>
    api.post(`/organizations/${organizationId}/subscription/checkout`, data),
  verifySubscriptionPayment: (organizationId: string, data: JsonObject) =>
    api.post(`/organizations/${organizationId}/subscription/verify`, data),

  // ---- Students ----
  getStudents: (schoolId: string, params?: QueryParams) =>
    api.get(`/schools/${schoolId}/students`, { params }),
  getMyStudent: (schoolId: string) =>
    api.get(`/schools/${schoolId}/students/me`),
  getTodaysBirthdays: (schoolId: string) =>
    api.get(`/schools/${schoolId}/students/birthdays/today`),
  getStudent: (schoolId: string, studentId: string) =>
    api.get(`/schools/${schoolId}/students/${studentId}`),
  createStudent: (schoolId: string, data: JsonObject) =>
    api.post(`/schools/${schoolId}/students`, data),
  updateStudent: (schoolId: string, studentId: string, data: JsonObject) =>
    api.patch(`/schools/${schoolId}/students/${studentId}`, data),
  importStudentsCsv: (schoolId: string, data: FormData) =>
    api.post(`/schools/${schoolId}/students/import`, data, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  searchStudents: (schoolId: string, query: string) =>
    api.get(`/schools/${schoolId}/students/search`, { params: { q: query } }),

  // ---- Fees ----
  getStudentPendingFees: (schoolId: string, studentId: string) =>
    api.get(`/schools/${schoolId}/fees/students/${studentId}/pending`),
  createOnlineFeeOrder: (schoolId: string, data: JsonObject) =>
    api.post(`/schools/${schoolId}/fees/online/order`, data),
  verifyOnlineFeePayment: (schoolId: string, data: JsonObject) =>
    api.post(`/schools/${schoolId}/fees/online/verify`, data),
  collectFee: (schoolId: string, data: JsonObject) =>
    api.post(`/schools/${schoolId}/fees/collect`, data),
  getDailySummary: (schoolId: string, date?: string) =>
    api.get(`/schools/${schoolId}/fees/daily-summary`, { params: date ? { target_date: date } : {} }),
  getReceipts: (schoolId: string, params?: QueryParams) =>
    api.get(`/schools/${schoolId}/fees/receipts`, { params }),
  downloadReceipt: (schoolId: string, receiptId: string) =>
    api.get(`/schools/${schoolId}/fees/receipts/${receiptId}/download`, { responseType: "blob" }),
  downloadPendingFeeReport: (schoolId: string) =>
    api.get(`/schools/${schoolId}/fees/reports/pending.csv`, { responseType: "blob" }),
  downloadDailyCollectionReport: (schoolId: string, date?: string) =>
    api.get(`/schools/${schoolId}/fees/reports/daily.csv`, {
      params: date ? { target_date: date } : {},
      responseType: "blob",
    }),

  // ---- Attendance ----
  markBulkAttendance: (schoolId: string, data: JsonObject) =>
    api.post(`/schools/${schoolId}/attendance/bulk`, data),
  getAttendanceSummary: (schoolId: string, params?: QueryParams) =>
    api.get(`/schools/${schoolId}/attendance/summary`, { params }),
  getStudentAttendance: (schoolId: string, studentId: string, params: QueryParams) =>
    api.get(`/schools/${schoolId}/attendance/student/${studentId}`, { params }),

  // ---- Timetable ----
  getTimetableSlots: (schoolId: string, params?: QueryParams) =>
    api.get(`/schools/${schoolId}/timetable`, { params }),
  createTimetableSlot: (schoolId: string, data: JsonObject) =>
    api.post(`/schools/${schoolId}/timetable`, data),
  updateTimetableSlot: (schoolId: string, slotId: string, data: JsonObject) =>
    api.patch(`/schools/${schoolId}/timetable/${slotId}`, data),
  deleteTimetableSlot: (schoolId: string, slotId: string) =>
    api.delete(`/schools/${schoolId}/timetable/${slotId}`),

  // ---- Notices ----
  getNotices: (schoolId: string, params?: QueryParams) =>
    api.get(`/schools/${schoolId}/notices`, { params }),
  createNotice: (schoolId: string, data: JsonObject) =>
    api.post(`/schools/${schoolId}/notices`, data),
  updateNotice: (schoolId: string, noticeId: string, data: JsonObject) =>
    api.patch(`/schools/${schoolId}/notices/${noticeId}`, data),
  deleteNotice: (schoolId: string, noticeId: string) =>
    api.delete(`/schools/${schoolId}/notices/${noticeId}`),

  // ---- Leave workflow ----
  getMyLeaves: (schoolId: string) =>
    api.get(`/schools/${schoolId}/leaves/me`),
  applyLeave: (schoolId: string, data: JsonObject) =>
    api.post(`/schools/${schoolId}/leaves/me`, data),
  cancelLeave: (schoolId: string, leaveId: string) =>
    api.patch(`/schools/${schoolId}/leaves/me/${leaveId}/cancel`),
  getLeaveRequests: (schoolId: string) =>
    api.get(`/schools/${schoolId}/leaves/requests`),
  decideLeave: (schoolId: string, leaveId: string, data: JsonObject) =>
    api.patch(`/schools/${schoolId}/leaves/requests/${leaveId}/decision`, data),

  // ---- AI features ----
  generateNoticeDraft: (schoolId: string, data: JsonObject) =>
    api.post(`/schools/${schoolId}/ai/notices/generate`, data),
  chatWithParentAssistant: (schoolId: string, data: JsonObject) =>
    api.post(`/schools/${schoolId}/ai/parent-assistant/chat`, data),
  optimizeTimetable: (schoolId: string, data: JsonObject) =>
    api.post(`/schools/${schoolId}/ai/timetable/optimize`, data),
  extractStudentDocument: (schoolId: string, data: FormData) =>
    api.post(`/schools/${schoolId}/ai/documents/extract`, data),
};
