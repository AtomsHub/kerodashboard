// src/stores/ui-store.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export function applyTheme(dark: boolean) {
  if (typeof document === 'undefined') return;
  if (dark) {
    document.documentElement.classList.add('dark');
    document.documentElement.setAttribute('data-theme', 'dark');
    document.documentElement.style.colorScheme = 'dark';
  } else {
    document.documentElement.classList.remove('dark');
    document.documentElement.setAttribute('data-theme', 'light');
    document.documentElement.style.colorScheme = 'light';
  }
}

interface UIState {
  isSidebarCollapsed: boolean;
  isMobileDrawerOpen: boolean;
  isDarkMode: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleMobileDrawer: () => void;
  setMobileDrawerOpen: (open: boolean) => void;
  toggleDarkMode: () => void;
  setDarkMode: (dark: boolean) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      isSidebarCollapsed: false,
      isMobileDrawerOpen: false,
      isDarkMode: false,

      toggleSidebar: () => set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
      setSidebarCollapsed: (collapsed) => set({ isSidebarCollapsed: collapsed }),

      toggleMobileDrawer: () => set((state) => ({ isMobileDrawerOpen: !state.isMobileDrawerOpen })),
      setMobileDrawerOpen: (open) => set({ isMobileDrawerOpen: open }),

      toggleDarkMode: () =>
        set((state) => {
          const next = !state.isDarkMode;
          applyTheme(next);
          return { isDarkMode: next };
        }),

      setDarkMode: (dark) => {
        applyTheme(dark);
        set({ isDarkMode: dark });
      },
    }),
    {
      name: 'kero-ui-preferences',
      partialize: (state) => ({ isSidebarCollapsed: state.isSidebarCollapsed, isDarkMode: state.isDarkMode }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          applyTheme(state.isDarkMode);
        }
      },
    }
  )
);

