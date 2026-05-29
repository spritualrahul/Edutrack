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
  adapter: "fetch",
});

// ---- Clerk Token Cache ----
// Clerk tokens are valid for ~60s. We cache for 50s to avoid calling
// getToken() on every single API request.
let _cachedToken: string | null = null;
let _tokenExpiresAt = 0;

async function getCachedToken(): Promise<string | null> {
  const now = Date.now();
  if (_cachedToken && now < _tokenExpiresAt) return _cachedToken;

  try {
    const clerkInstance = typeof window !== "undefined" ? window.Clerk : null;
    const token = await clerkInstance?.session?.getToken();
    if (token) {
      _cachedToken = token;
      _tokenExpiresAt = now + 50_000; // 50 seconds
    }
    return token || null;
  } catch {
    return null;
  }
}

// Attach Clerk token to every request (cached)
api.interceptors.request.use(async (config) => {
  if (typeof window !== "undefined") {
    const token = await getCachedToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
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

// ---- Simple Response Cache ----
// For endpoints returning data that changes infrequently (stats, plans, org details).
const _responseCache = new Map<string, { data: unknown; expiresAt: number }>();

function cachedGet<T = unknown>(key: string, fetcher: () => Promise<T>, ttlMs = 30_000): Promise<T> {
  const entry = _responseCache.get(key);
  if (entry && Date.now() < entry.expiresAt) return Promise.resolve(entry.data as T);

  const promise = fetcher().then((result) => {
    _responseCache.set(key, { data: result, expiresAt: Date.now() + ttlMs });
    return result;
  });
  return promise;
}

// API helper functions
export const apiClient = {
  // ---- Auth ----
  syncUser: () => api.post("/auth/sync"),
  getMe: () => api.get("/auth/me"),
  assignRole: (data: { clerk_id: string; role: string; school_id?: string }) =>
    api.post("/auth/assign-role", data),

  // ---- Organizations ----
  getOrganizations: (params?: QueryParams) => api.get("/organizations", { params }),
  getOrganization: (id: string) =>
    cachedGet(`org:${id}`, () => api.get(`/organizations/${id}`), 30_000),
  createOrganization: (data: JsonObject) => api.post("/organizations", data),
  updateOrganization: (id: string, data: JsonObject) => {
    _responseCache.delete(`org:${id}`); // invalidate cache
    return api.patch(`/organizations/${id}`, data);
  },
  deleteOrganization: (id: string) => {
    _responseCache.delete(`org:${id}`);
    return api.delete(`/organizations/${id}`);
  },
  getPlatformStats: () =>
    cachedGet("platform-stats", () => api.get("/organizations/stats/platform"), 30_000),
  getSchoolStudents: (orgId: string, params?: QueryParams) =>
    api.get(`/organizations/${orgId}/students`, { params }),
  getSchoolTeachers: (orgId: string, params?: QueryParams) =>
    api.get(`/organizations/${orgId}/teachers`, { params }),
  getSchoolStaff: (orgId: string, params?: QueryParams) =>
    api.get(`/organizations/${orgId}/staff`, { params }),
  getSubscriptionPlans: (params?: QueryParams) =>
    cachedGet("sub-plans", () => api.get("/organizations/subscription-plans", { params }), 60_000),
  updateSubscriptionPlan: (planId: string, data: JsonObject) =>
    api.patch(`/organizations/subscription-plans/${planId}`, data),
  createSubscriptionCheckout: (organizationId: string, data: JsonObject) =>
    api.post(`/organizations/${organizationId}/subscription/checkout`, data),
  verifySubscriptionPayment: (organizationId: string, data: JsonObject) =>
    api.post(`/organizations/${organizationId}/subscription/verify`, data),

  // ---- Students ----
  getStudents: (schoolId: string, params?: QueryParams) =>
    api.get(`/schools/${schoolId}/students`, { params }),
  getClassesForSchool: (schoolId: string) =>
    api.get(`/schools/${schoolId}/students/classes`),
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
