'use client';

// src/components/layout/app-shell.tsx
import React, { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Sidebar } from './sidebar';
import { Topbar } from './topbar';
import { NetworkBanner } from './network-banner';
import { SosAlarmOverlay } from './sos-alarm-overlay';
import { getSocket, setupAdminSocketListeners } from '@/lib/socket';
import { redirectToLogin, useAuthStore } from '@/stores/auth-store';
import { API_BASE_URL } from '@/lib/api';
import { AppButton } from '@/components/ui/app-button';
import { ArrowClockwise, WifiSlash } from '@phosphor-icons/react';
import { useUIStore, applyTheme } from '@/stores/ui-store';

export function AppShell({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const { admin, accessToken, error: authError, isLoading: authLoading, fetchAdminMe } = useAuthStore();
  const { isDarkMode } = useUIStore();
  const [isClient, setIsClient] = useState(false);
  const [hasHydrated, setHasHydrated] = useState(false);
  const fetchedRef = React.useRef(false);

  useEffect(() => {
    setIsClient(true);
    // Check zustand hydration
    if (useAuthStore.persist?.hasHydrated?.()) {
      setHasHydrated(true);
    } else {
      const unsub = useAuthStore.persist?.onFinishHydration?.(() => {
        setHasHydrated(true);
      });
      // Safety timeout if listener already fired
      const timer = setTimeout(() => setHasHydrated(true), 100);
      return () => {
        unsub?.();
        clearTimeout(timer);
      };
    }
  }, []);

  // Secure: redirect to /login only after client hydration confirms no session
  useEffect(() => {
    if (!isClient || !hasHydrated) return;

    // Check if token exists in state or in localStorage
    let token = accessToken;
    if (!token && typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('kero-admin-auth');
        if (stored) {
          const parsed = JSON.parse(stored);
          token = parsed?.state?.accessToken;
        }
      } catch {}
    }

    if (!token) {
      redirectToLogin();
    }
  }, [isClient, hasHydrated, accessToken]);

  // Re-apply the persisted light/dark preference to <html> once hydrated
  useEffect(() => {
    if (hasHydrated) {
      applyTheme(isDarkMode);
    }
  }, [hasHydrated, isDarkMode]);

  // 1. Fetch fresh admin profile once on mount if authenticated and not yet fetched
  useEffect(() => {
    if (!accessToken) return;
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    fetchAdminMe();
  }, [accessToken, fetchAdminMe]);

  // 2. Connect Socket.IO client once when authenticated
  useEffect(() => {
    if (!accessToken) return;

    const socket = getSocket();
    if (!socket.connected) {
      socket.connect();
    }
    const cleanupListeners = setupAdminSocketListeners(queryClient);

    return () => {
      cleanupListeners();
      socket.disconnect();
    };
  }, [accessToken, queryClient]);

  // If SSR or hydrating without auth: render non-flashing skeleton shell instead of spinner
  if (!isClient || !hasHydrated || !accessToken) {
    return (
      <div className="flex h-screen overflow-hidden bg-background">
        {/* Sidebar Skeleton */}
        <div className="hidden md:flex w-64 flex-col border-r border-border bg-sidebar p-4 space-y-4 animate-pulse">
          <div className="h-8 bg-muted/60 rounded-xl w-32 mb-6" />
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-9 bg-muted/40 rounded-xl w-full" />
            ))}
          </div>
        </div>
        {/* Main Content Skeleton */}
        <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
          <div className="h-16 border-b border-border bg-surface px-6 flex items-center justify-between animate-pulse">
            <div className="h-6 bg-muted/50 rounded-lg w-48" />
            <div className="h-8 w-8 rounded-full bg-muted/60" />
          </div>
          <main className="flex-1 p-6 space-y-6 animate-pulse">
            <div className="h-8 bg-muted/60 rounded-xl w-64" />
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-28 bg-muted/40 rounded-3xl" />
              ))}
            </div>
            <div className="h-80 bg-muted/30 rounded-3xl" />
          </main>
        </div>
      </div>
    );
  }

  // Signed in, but the profile could not be loaded because the server is down or
  // erroring: say so instead of rendering an empty dashboard.
  if (!admin && authError) {
    return (
      <div className="flex h-screen items-center justify-center bg-background p-6">
        <div className="w-full max-w-md rounded-3xl border border-border bg-surface p-8 text-center shadow-sm">
          <WifiSlash size={40} weight="duotone" className="mx-auto mb-4 text-danger" />
          <h1 className="text-lg font-semibold text-foreground">Can&apos;t reach the Kero server</h1>
          <p className="mt-2 text-sm text-muted">
            {authError}. Check that the backend at {API_BASE_URL} is running, then try again.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <AppButton
              variant="brand"
              label="Try again"
              isLoading={authLoading}
              startContent={<ArrowClockwise />}
              onPress={() => fetchAdminMe(true)}
            />
            <AppButton variant="ghost" label="Sign in again" onPress={() => redirectToLogin()} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <NetworkBanner />
      <SosAlarmOverlay />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
          <Topbar />
          <main className="flex-1 px-4 pb-10 pt-2 sm:px-6 lg:px-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
