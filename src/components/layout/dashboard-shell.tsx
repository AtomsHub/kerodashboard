'use client';

import React, { Suspense } from 'react';
import { usePathname } from 'next/navigation';
import { AppShell } from './app-shell';

function DashboardShellContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // On login route, render standalone without dashboard frame
  if (pathname === '/login') {
    return <>{children}</>;
  }

  // Persistent dashboard frame across all other routes
  return <AppShell>{children}</AppShell>;
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <DashboardShellContent>{children}</DashboardShellContent>
    </Suspense>
  );
}
