'use client';

// src/components/auth/can.tsx
// Role-Based Access Control (RBAC) primitives for Kero Admin Dashboard.
// Provides:
// - <Can permission="..." />: conditionally render elements based on admin permissions
// - usePermission(permission): hook for conditional logic / disabled state
// - <PermissionGuard permission="...">: wraps routes/views, rendering AccessDenied if forbidden
// - <AccessDenied />: token-styled fallback view with status description and navigation

import React from 'react';
import Link from 'next/link';
import { ShieldWarning, ArrowLeft } from '@phosphor-icons/react';
import { Card } from '@heroui/react';
import { Permission } from '@/types/admin';
import { redirectToLogin, useAuthStore } from '@/stores/auth-store';
import { AppButton } from '@/components/ui/app-button';

export interface CanProps {
  permission: Permission | Permission[];
  /** When true, admin must possess ALL listed permissions; when false (default), ANY permission grants access */
  matchAll?: boolean;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Hook to inspect whether the authenticated admin has the requested permission(s).
 * Automatically returns true for super administrators.
 */
export function usePermission(permission: Permission | Permission[], matchAll = false): boolean {
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const isSuperAdmin = useAuthStore((state) => state.admin?.isSuperAdmin ?? false);

  if (isSuperAdmin) {
    return true;
  }

  const permissions = Array.isArray(permission) ? permission : [permission];

  return matchAll
    ? permissions.every((p) => hasPermission(p))
    : permissions.some((p) => hasPermission(p));
}

/**
 * Component to conditionally render UI controls (buttons, tabs, columns) based on RBAC permissions.
 */
export function Can({ permission, matchAll = false, fallback = null, children }: CanProps) {
  const allowed = usePermission(permission, matchAll);

  if (!allowed) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

/**
 * Access Denied screen rendered when an authenticated admin lacks the role/permissions for a section.
 */
export function AccessDenied({
  title = 'Access Restricted',
  description = 'You do not have the necessary permissions assigned to your role to view or manage this section. Contact your Super Administrator to request access.',
}: {
  title?: string;
  description?: string;
  requiredPermission?: Permission | Permission[];
}) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <Card className="w-full max-w-md gap-0 rounded-3xl border-0 bg-surface p-8 text-center shadow-none sm:p-10">
        <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-danger-soft text-danger">
          <ShieldWarning size={32} weight="duotone" />
        </div>

        <h2 className="mt-5 text-[22px] font-bold tracking-[-0.02em] text-foreground">{title}</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted">{description}</p>

        <div className="mt-8 flex justify-center gap-3">
          <Link href="/">
            <AppButton
              variant="tertiary"
              startContent={<ArrowLeft weight="bold" />}
              label="Return to Overview"
            />
          </Link>
        </div>
      </Card>
    </div>
  );
}

/**
 * Route / page level guard that verifies active authentication session and role permissions.
 * Redirects unauthenticated visitors to /login and renders clean AccessDenied if forbidden by role.
 */
export function PermissionGuard({
  permission,
  matchAll = false,
  children,
}: {
  permission: Permission | Permission[];
  matchAll?: boolean;
  children: React.ReactNode;
}) {
  const admin = useAuthStore((state) => state.admin);
  const accessToken = useAuthStore((state) => state.accessToken);
  const isLoading = useAuthStore((state) => state.isLoading);
  const [isClient, setIsClient] = React.useState(false);

  React.useEffect(() => {
    setIsClient(true);
  }, []);

  React.useEffect(() => {
    if (isClient && !isLoading && !accessToken && !admin) {
      redirectToLogin();
    }
  }, [isClient, isLoading, accessToken, admin]);

  // If admin is already present in client state, grant immediate access without waiting
  if (admin) {
    if (admin.isSuperAdmin || (admin as any).role === 'SUPER_ADMIN' || admin.permissions?.includes('*' as any)) {
      return <>{children}</>;
    }
    const permissions = Array.isArray(permission) ? permission : [permission];
    const hasAccess = matchAll
      ? permissions.every((p) => admin.permissions?.includes(p))
      : permissions.some((p) => admin.permissions?.includes(p));

    if (!hasAccess) {
      return <AccessDenied />;
    }
    return <>{children}</>;
  }

  // Initial SSR or hydration phase when admin profile is still loading
  if (!isClient || isLoading) {
    return (
      <div className="space-y-6 animate-pulse p-4 sm:p-6">
        <div className="h-8 bg-muted/60 rounded-xl w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 bg-muted/40 rounded-2xl" />
          ))}
        </div>
        <div className="h-72 bg-muted/30 rounded-2xl" />
      </div>
    );
  }

  // Not logged in: hold render while redirecting to /login
  if (!accessToken && !admin) {
    return (
      <div className="space-y-6 animate-pulse p-4 sm:p-6">
        <div className="h-8 bg-muted/60 rounded-xl w-64" />
        <div className="h-72 bg-muted/30 rounded-2xl" />
      </div>
    );
  }

  return <>{children}</>;
}
