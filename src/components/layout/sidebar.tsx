'use client';

// src/components/layout/sidebar.tsx
import React, { Suspense } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Pulse,
  SquaresFour,
  Broadcast,
  SteeringWheel,
  UsersThree,
  Path,
  Siren,
  Wallet,
  ChartLineUp,
  Megaphone,
  ShieldCheck,
  GearSix,
  ClockCounterClockwise,
  SignOut,
  X,
  Car,
  IdentificationCard,
  ImageSquare,
  Gift,
  SlidersHorizontal,
  Buildings,
  Compass,
  CreditCard,
  Receipt,
  ChartPieSlice,
  UserCircle,
  Headset,
  ListMagnifyingGlass,
  Coins,
  ChartBar,
  Sliders,
  CheckSquare,
  ShieldWarning,
  XCircle,
  Percent,
  Bank,
  type Icon as PhosphorIcon,
} from '@phosphor-icons/react';
import { Avatar, Tooltip } from '@heroui/react';
import { useAuthStore } from '@/stores/auth-store';
import { useUIStore } from '@/stores/ui-store';
import { Permission } from '@/types/admin';

interface NavItem {
  label: string;
  href: string;
  icon: PhosphorIcon;
  permission?: Permission;
  live?: boolean;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Operations',
    items: [
      { label: 'Overview', href: '/', icon: SquaresFour, permission: 'view_dashboard' },
      { label: 'Live Watch', href: '/live-watch', icon: Broadcast, permission: 'view_live_watch', live: true },
      { label: 'Operating Corridors', href: '/corridors', icon: Compass, permission: 'view_fleet' },
      { label: 'Trips & Dispatch', href: '/trips', icon: Path, permission: 'view_trips' },
    ],
  },
  {
    title: 'Support',
    items: [
      { label: 'Overview', href: '/support/overview', icon: ChartPieSlice, permission: 'view_support' },
      { label: 'Help Center', href: '/support', icon: Headset, permission: 'view_support' },
      { label: 'SOS Center', href: '/emergency', icon: Siren, permission: 'view_sos' },
    ],
  },
  {
    title: 'People',
    items: [
      { label: 'Drivers', href: '/drivers', icon: SteeringWheel, permission: 'view_drivers' },
      { label: 'KYC & Verification', href: '/drivers/review-queue', icon: IdentificationCard, permission: 'view_drivers' },
      { label: 'Riders', href: '/riders', icon: UsersThree, permission: 'view_riders' },
      { label: 'Internal HR', href: '/hr', icon: IdentificationCard, permission: 'hr_view_employees' },
    ],
  },
  {
    title: 'Finance & Regulatory',
    items: [
      { label: 'Finance Overview', href: '/finance', icon: Wallet, permission: 'view_transactions' },
      { label: 'Payment Issues', href: '/finance/payment-issues', icon: ListMagnifyingGlass, permission: 'view_transactions' },
      { label: 'Payment Ledger', href: '/finance/payments', icon: CreditCard, permission: 'view_transactions' },
      { label: 'Wallets', href: '/finance/wallets', icon: Coins, permission: 'view_ledger' },
      { label: 'Approvals', href: '/finance/approvals', icon: CheckSquare, permission: 'view_ledger' },
      { label: 'Financial Reports', href: '/finance/reports', icon: ChartBar, permission: 'view_financial_reports' },
      { label: 'Payment Settings', href: '/finance/payment-settings', icon: Sliders, permission: 'view_payment_settings' },
      { label: 'Bank Accounts', href: '/finance/bank-accounts', icon: Bank, permission: 'view_payment_settings' },
      { label: 'Lagos State Revenue', href: '/finance/lagos', icon: Buildings, permission: 'view_transactions' },
      { label: 'Settlements & Payouts', href: '/finance/settlements', icon: Receipt, permission: 'view_transactions' },
    ],
  },
  {
    title: 'Growth & Marketing',
    items: [
      { label: 'Surge & Pricing', href: '/pricing', icon: ChartLineUp, permission: 'view_pricing' },
      { label: 'Push Campaigns', href: '/push', icon: Megaphone, permission: 'view_push_notifications' },
      { label: 'Banners & Ads', href: '/banners', icon: ImageSquare, permission: 'view_push_notifications' },
      { label: 'Rewards & Milestones', href: '/rewards', icon: Gift, permission: 'view_pricing' },
    ],
  },
  {
    title: 'System & Security',
    items: [
      { label: 'Dispatch', href: '/config/dispatch', icon: SlidersHorizontal, permission: 'view_dispatch_config' },
      { label: 'Cancellations', href: '/config/cancellation', icon: XCircle, permission: 'view_dispatch_config' },
      { label: 'Anti-fraud', href: '/config/fraud', icon: ShieldWarning, permission: 'view_dispatch_config' },
      { label: 'Roles & Staff', href: '/roles', icon: ShieldCheck, permission: 'view_roles' },
      { label: 'Audit Trail', href: '/audit', icon: ClockCounterClockwise, permission: 'view_admin_users' },
      { label: 'Server Monitor', href: '/system/monitor', icon: Pulse, permission: 'view_server_monitor' },
    ],
  },
  {
    // No permission: every admin sees this, whatever their role.
    title: 'Account',
    items: [{ label: 'My account', href: '/account', icon: UserCircle }],
  },
];

function initials(name?: string) {
  if (!name) return 'A';
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function SidebarContent({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const { admin, hasPermission, logout } = useAuthStore();

  const groups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter(
      (item) =>
        !item.permission ||
        admin?.isSuperAdmin ||
        (admin as { role?: string } | null)?.role === 'SUPER_ADMIN' ||
        hasPermission(item.permission),
    ),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      {/* Brand */}
      <div className={`flex h-[72px] shrink-0 items-center ${collapsed ? 'justify-center px-3' : 'px-6'}`}>
        {collapsed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/favicon.png" alt="Kero" className="size-9 rounded-xl" />
        ) : (
          <div className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/kero-logo-white.svg" alt="Kero" className="h-7 w-auto" />
            <span className="rounded-full bg-sidebar-hover px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-sidebar-muted">
              Admin
            </span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="scrollbar-none flex-1 overflow-y-auto px-3 pb-4">
        {groups.map((group) => (
          <div key={group.title} className="mt-5 first:mt-1">
            {collapsed ? (
              <div className="mx-auto mb-2 h-px w-6 bg-sidebar-border" />
            ) : (
              <p className="mb-2 px-3 text-[11px] font-medium uppercase tracking-[0.14em] text-sidebar-muted">
                {group.title}
              </p>
            )}

            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== '/' &&
                    pathname.startsWith(item.href) &&
                    !group.items.some(
                      (other) =>
                        other.href !== item.href &&
                        other.href.length > item.href.length &&
                        pathname.startsWith(other.href)
                    ));
                const ItemIcon = item.icon;

                const link = (
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={isActive ? 'page' : undefined}
                    className={`group relative flex h-10 items-center rounded-xl text-[14px] transition-colors ${
                      collapsed ? 'justify-center' : 'gap-3 px-3'
                    } ${
                      isActive
                        ? 'bg-sidebar-active font-medium text-sidebar-active-foreground'
                        : 'text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-foreground'
                    }`}
                  >
                    <ItemIcon size={20} weight="duotone" className="shrink-0" />
                    {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
                    {item.live && (
                      <span
                        className={`relative flex size-2 ${collapsed ? 'absolute right-2.5 top-2.5' : ''}`}
                      >
                        <span className="absolute inline-flex size-full animate-ping rounded-full bg-danger opacity-60" />
                        <span className="relative inline-flex size-2 rounded-full bg-danger" />
                      </span>
                    )}
                  </Link>
                );

                return (
                  <li key={item.href}>
                    {collapsed ? (
                      <Tooltip delay={0}>
                        <Tooltip.Trigger>{link}</Tooltip.Trigger>
                        <Tooltip.Content placement="right">{item.label}</Tooltip.Content>
                      </Tooltip>
                    ) : (
                      link
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Profile */}
      <div className="shrink-0 border-t border-sidebar-border p-3">
        <div className={`flex items-center rounded-2xl p-2 ${collapsed ? 'flex-col gap-2' : 'gap-3'}`}>
          <Avatar size="sm" className="shrink-0 bg-sidebar-active text-sidebar-active-foreground">
            <Avatar.Fallback className="text-xs font-bold">{initials(admin?.fullname)}</Avatar.Fallback>
          </Avatar>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-sidebar-foreground">
                {admin?.fullname || 'Admin User'}
              </p>
              <p className="truncate text-xs text-sidebar-muted">{admin?.roleLabel || 'Staff'}</p>
            </div>
          )}
          <button
            type="button"
            onClick={() => logout()}
            aria-label="Sign out"
            title="Sign out"
            className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-lg text-sidebar-muted transition-colors hover:bg-sidebar-hover hover:text-danger"
          >
            <SignOut size={18} weight="duotone" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function Sidebar() {
  const { isSidebarCollapsed, isMobileDrawerOpen, setMobileDrawerOpen } = useUIStore();

  return (
    <>
      {/* Desktop: collapsible rail */}
      <aside
        className={`sticky top-0 hidden h-full shrink-0 transition-[width] duration-300 ease-out md:block ${
          isSidebarCollapsed ? 'w-[76px]' : 'w-[264px]'
        }`}
      >
        <Suspense fallback={<div className="h-full bg-sidebar" />}>
          <SidebarContent collapsed={isSidebarCollapsed} />
        </Suspense>
      </aside>

      {/* Mobile & tablet: drawer */}
      {isMobileDrawerOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="absolute inset-0 bg-backdrop backdrop-blur-sm"
            onClick={() => setMobileDrawerOpen(false)}
            aria-hidden="true"
          />
          <div className="relative h-full w-[280px] max-w-[85vw] animate-in slide-in-from-left duration-300">
            <Suspense fallback={<div className="h-full bg-sidebar" />}>
              <SidebarContent collapsed={false} onNavigate={() => setMobileDrawerOpen(false)} />
            </Suspense>
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(false)}
              aria-label="Close menu"
              className="absolute right-3 top-5 grid size-8 cursor-pointer place-items-center rounded-lg text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-foreground"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
