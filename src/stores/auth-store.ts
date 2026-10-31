// src/stores/auth-store.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AdminUser, Permission } from '@/types/admin';
import { api } from '@/lib/api';

interface AuthState {
  admin: AdminUser | null;
  accessToken: string | null;
  isLoading: boolean;
  error: string | null;
  hasPermission: (permission: Permission) => boolean;
  setAuth: (payload: { admin?: AdminUser | null; accessToken?: string | null }) => void;
  setAdmin: (admin: AdminUser | null) => void;
  setAccessToken: (token: string | null) => void;
  fetchAdminMe: (force?: boolean) => Promise<AdminUser | null>;
  logout: () => Promise<void>;
}

let lastFetchAdminMeTime = 0;

/** Older sessions may carry the backend's raw role and a "*" wildcard permission. */
type StoredAdmin = AdminUser & { role?: string };
const hasWildcard = (admin: AdminUser) => (admin.permissions as string[] | undefined)?.includes('*') ?? false;

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      admin: null,
      accessToken: null,
      isLoading: false,
      error: null,

      hasPermission: (permission: Permission) => {
        const { admin } = get();
        if (!admin) return false;
        if (admin.isSuperAdmin || (admin as StoredAdmin).role === 'SUPER_ADMIN') return true;
        if (hasWildcard(admin)) return true;
        return admin.permissions?.includes(permission) ?? false;
      },

      setAuth: ({ admin, accessToken }) => {
        if (typeof document !== 'undefined') {
          if (accessToken) {
            document.cookie = 'kero_admin_session=active; path=/; max-age=604800; SameSite=Lax';
          } else if (accessToken === null) {
            document.cookie = 'kero_admin_session=; path=/; max-age=0; SameSite=Lax';
          }
        }
        return set((state) => ({
          admin: admin !== undefined ? admin : state.admin,
          accessToken: accessToken !== undefined ? accessToken : state.accessToken,
        }));
      },

      setAdmin: (admin) => set({ admin }),
      setAccessToken: (accessToken) => {
        if (typeof document !== 'undefined') {
          if (accessToken) {
            document.cookie = 'kero_admin_session=active; path=/; max-age=604800; SameSite=Lax';
          } else {
            document.cookie = 'kero_admin_session=; path=/; max-age=0; SameSite=Lax';
          }
        }
        set({ accessToken });
      },

      fetchAdminMe: async (force = false) => {
        const { accessToken, admin } = get();
        if (!accessToken) {
          await get().logout();
          return null;
        }

        const now = Date.now();
        // If we already have admin profile and fetched within the last 2 minutes, return cached profile
        if (!force && admin && now - lastFetchAdminMeTime < 120_000) {
          return admin;
        }
        lastFetchAdminMeTime = now;

        set({ isLoading: true, error: null });
        try {
          const res = await api.get('/auth/admin/me');
          if (res.data?.success && res.data?.data) {
            const raw = res.data.data;
            const adminData: AdminUser = {
              id: raw.id,
              fullname: raw.fullname,
              email: raw.email,
              phone: raw.phone ?? null,
              isSuperAdmin: Boolean(raw.isSuperAdmin || raw.role === 'SUPER_ADMIN'),
              roleLabel: raw.roleLabel ?? (raw.isSuperAdmin ? 'Super Admin' : 'Admin'),
              roleId: raw.roleId ?? raw.adminRole?.id ?? null,
              isActive: raw.isActive ?? true,
              lastLoginAt: raw.lastLoginAt ?? null,
              permissions: raw.permissions ?? [],
            };
            if (typeof document !== 'undefined') {
              document.cookie = 'kero_admin_session=active; path=/; max-age=604800; SameSite=Lax';
            }
            set({ admin: adminData, isLoading: false });
            return adminData;
          }
          return null;
        } catch (err: unknown) {
          const status = (err as { response?: { status?: number } } | null)?.response?.status;
          // Only invalidate session and logout if explicitly 401 Unauthorized
          if (status === 401) {
            await get().logout();
            return null;
          }
          // On non-401 errors (e.g. rate limit 429 or network glitch), preserve active session!
          // Flag it so the shell can show a "server unreachable" screen when there is no cached profile.
          set({
            isLoading: false,
            error: status ? `Server responded with ${status}` : 'Cannot reach the Kero server',
          });
          return get().admin;
        }
      },

      logout: async () => {
        try {
          await api.post('/auth/logout', {}, { silent: true });
        } catch {
          // Ignore network errors during logout
        } finally {
          set({ isLoading: false, error: null });
          redirectToLogin();
        }
      },
    }),
    {
      name: 'kero-admin-auth',
      // The access token stays in memory only (localStorage is readable by any
      // injected script). After a reload the app shell gets a fresh one from the
      // httpOnly refresh cookie.
      partialize: (state) => ({ admin: state.admin }),
      // v1: drop the access token that older versions saved in localStorage.
      version: 1,
      migrate: (persisted) => {
        const state = (persisted ?? {}) as { admin?: AdminUser | null };
        return { admin: state.admin ?? null } as AuthState;
      },
    }
  )
);

export function getAccessToken(): string | null {
  return useAuthStore.getState().accessToken;
}

/**
 * Drop the local session and go to /login. The `kero_admin_session` marker
 * cookie MUST be cleared first: proxy.ts bounces /login back to / while it is
 * set, so leaving it behind loops the dashboard skeleton between / and /login.
 */
export function redirectToLogin(): void {
  if (typeof document !== 'undefined') {
    document.cookie = 'kero_admin_session=; path=/; max-age=0; SameSite=Lax';
  }
  useAuthStore.setState({ admin: null, accessToken: null });
  if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
    window.location.replace('/login');
  }
}
