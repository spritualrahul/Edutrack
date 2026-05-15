import { create } from "zustand";

interface AppState {
  // Auth / tenant
  schoolId: string | null;
  userId: string | null;
  userRole: string | null;
  permissions: string[];

  // Sidebar
  sidebarOpen: boolean;

  // Actions
  setSchoolId: (id: string | null) => void;
  setUserId: (id: string | null) => void;
  setUserRole: (role: string | null) => void;
  setPermissions: (perms: string[]) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  hasPermission: (perm: string) => boolean;
}

export const useAppStore = create<AppState>((set, get) => ({
  schoolId: null,
  userId: null,
  userRole: null,
  permissions: [],
  sidebarOpen: true,
  setSchoolId: (id) => set({ schoolId: id }),
  setUserId: (id) => set({ userId: id }),
  setUserRole: (role) => set({ userRole: role }),
  setPermissions: (perms) => set({ permissions: perms }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  hasPermission: (perm) => get().permissions.includes(perm),
}));

type FeeCounterRecord = Record<string, unknown>;

interface FeeCounterState {
  selectedStudent: FeeCounterRecord | null;
  pendingFees: FeeCounterRecord[];
  dailySummary: FeeCounterRecord | null;
  setSelectedStudent: (student: FeeCounterRecord | null) => void;
  setPendingFees: (fees: FeeCounterRecord[]) => void;
  setDailySummary: (summary: FeeCounterRecord | null) => void;
  clearSelection: () => void;
}

export const useFeeCounterStore = create<FeeCounterState>((set) => ({
  selectedStudent: null,
  pendingFees: [],
  dailySummary: null,
  setSelectedStudent: (student) => set({ selectedStudent: student }),
  setPendingFees: (fees) => set({ pendingFees: fees }),
  setDailySummary: (summary) => set({ dailySummary: summary }),
  clearSelection: () => set({ selectedStudent: null, pendingFees: [] }),
}));
