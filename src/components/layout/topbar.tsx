'use client';

// src/components/layout/topbar.tsx
import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Bell,
  List,
  SidebarSimple,
  Siren,
  SpeakerHigh,
  SpeakerSlash,
  Checks,
  Moon,
  Sun,
  BellSlash,
  UserCircle,
  SignOut,
} from '@phosphor-icons/react';
import { Avatar, Popover, ListBox, Badge, Dropdown } from '@heroui/react';
import { useNotificationStore } from '@/stores/notification-store';
import { useAuthStore } from '@/stores/auth-store';
import { useUIStore } from '@/stores/ui-store';
import { useSosAlarmStore } from '@/stores/sos-alarm-store';
import { AppButton } from '@/components/ui/app-button';
import { CommandMenu } from './command-menu';

function initials(name?: string) {
  if (!name) return 'A';
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function timeAgo(date: string) {
  const diff = Math.max(0, Date.now() - new Date(date).getTime());
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export function Topbar() {
  const { admin, logout } = useAuthStore();
  const router = useRouter();
  const { notifications, unreadCount, markAsRead, markAllAsRead, activeSosAlerts } = useNotificationStore();
  const { toggleSidebar, toggleMobileDrawer, isSidebarCollapsed, isDarkMode, toggleDarkMode } = useUIStore();
  const sosMuted = useSosAlarmStore((s) => s.muted);
  const setSosMuted = useSosAlarmStore((s) => s.setMuted);

  return (
    <header className="sticky top-0 z-30 flex h-[72px] shrink-0 items-center gap-3 bg-overlay/80 px-4 backdrop-blur-xl sm:px-6 lg:px-8 border-b border-border/40">
      {/* Left: navigation toggles + search */}
      <AppButton
        isIconOnly
        variant="ghost"
        aria-label="Open menu"
        className="md:hidden"
        onPress={toggleMobileDrawer}
      >
        <List size={20} />
      </AppButton>
      <AppButton
        isIconOnly
        variant="ghost"
        aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className="hidden md:inline-flex"
        onPress={toggleSidebar}
      >
        <SidebarSimple size={20} />
      </AppButton>

      <div className="min-w-0 flex-1">
        <CommandMenu />
      </div>

      {/* SOS ticker */}
      {activeSosAlerts.length > 0 && (
        <div className="hidden h-9 items-center rounded-full bg-danger text-[13px] font-medium text-danger-foreground sm:flex">
          <Link href="/emergency" className="flex h-full items-center gap-2 rounded-l-full pl-4 pr-3 hover:bg-black/10">
            <Siren size={18} weight="fill" className="animate-pulse" />
            {activeSosAlerts.length} active SOS
          </Link>
          <button
            type="button"
            onClick={() => setSosMuted(!sosMuted)}
            className="flex h-full cursor-pointer items-center rounded-r-full border-l border-white/25 pl-2.5 pr-3.5 hover:bg-black/10"
            aria-label={sosMuted ? 'Unmute SOS sound' : 'Mute SOS sound'}
            title={sosMuted ? 'Unmute SOS sound' : 'Mute SOS sound'}
          >
            {sosMuted ? <SpeakerSlash size={17} weight="fill" /> : <SpeakerHigh size={17} weight="fill" />}
          </button>
        </div>
      )}

      {/* Right: actions */}
      <div className="flex items-center gap-1.5">
        <AppButton
          isIconOnly
          variant="ghost"
          aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          onPress={toggleDarkMode}
        >
          {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
        </AppButton>

        {/* Notifications: HeroUI Popover + ListBox */}
        <Popover>
          <Popover.Trigger>
            <AppButton isIconOnly variant="ghost" aria-label={`Notifications, ${unreadCount} unread`}>
              <Badge.Anchor>
                <Bell size={20} />
                {unreadCount > 0 && (
                  <Badge size="sm" className="bg-secondary text-secondary-foreground">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </Badge>
                )}
              </Badge.Anchor>
            </AppButton>
          </Popover.Trigger>

          <Popover.Content placement="bottom end" className="w-[360px] overflow-hidden rounded-2xl bg-overlay p-0">
            <Popover.Dialog className="p-0 outline-none">
              <div className="flex items-center justify-between px-5 pb-3 pt-4">
                <div>
                  <p className="text-[15px] font-bold text-foreground">Notifications</p>
                  <p className="text-xs text-muted">
                    {unreadCount > 0 ? `${unreadCount} unread` : 'You are all caught up'}
                  </p>
                </div>
                {unreadCount > 0 && (
                  <AppButton
                    size="sm"
                    variant="ghost"
                    startContent={<Checks />}
                    label="Mark all read"
                    onPress={() => markAllAsRead()}
                  />
                )}
              </div>

              <div className="max-h-[380px] overflow-y-auto px-2 pb-2">
                {notifications.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
                    <span className="grid size-12 place-items-center rounded-2xl bg-default text-muted">
                      <BellSlash size={24} />
                    </span>
                    <p className="text-[13px] font-medium text-foreground">No notifications yet</p>
                    <p className="text-xs text-muted">New trips, KYC submissions and SOS alerts appear here.</p>
                  </div>
                ) : (
                  <ListBox
                    aria-label="Notifications"
                    selectionMode="none"
                    onAction={(key) => {
                      markAsRead(String(key));
                      const link = notifications.find((n) => n.id === String(key))?.link;
                      if (link) router.push(link);
                    }}
                  >
                    {notifications.map((item) => (
                      <ListBox.Item
                        key={item.id}
                        id={item.id}
                        textValue={item.title}
                        className="items-start gap-3 rounded-xl px-3 py-3"
                      >
                        <span
                          className={`mt-1.5 size-2 shrink-0 rounded-full ${
                            item.isRead ? 'bg-transparent' : 'bg-secondary'
                          }`}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-3">
                            <span
                              className={`truncate text-[13px] ${
                                item.isRead ? 'text-muted' : 'font-medium text-foreground'
                              }`}
                            >
                              {item.title}
                            </span>
                            <span className="shrink-0 text-[11px] text-muted">{timeAgo(item.createdAt)}</span>
                          </div>
                          <p className="mt-0.5 line-clamp-2 text-xs text-muted">{item.message}</p>
                        </div>
                      </ListBox.Item>
                    ))}
                  </ListBox>
                )}
              </div>
            </Popover.Dialog>
          </Popover.Content>
        </Popover>

        {/* Profile */}
        <Dropdown>
          <Dropdown.Trigger
            aria-label="Account"
            className="ml-2 flex cursor-pointer items-center gap-3 border-l border-separator pl-4 text-left outline-none"
          >
              <div className="hidden text-right lg:block">
                <p className="text-[13px] font-medium leading-tight text-foreground">
                  {admin?.fullname || 'Admin User'}
                </p>
                <p className="text-xs text-muted">{admin?.roleLabel || 'Operations Staff'}</p>
              </div>
              <Avatar size="sm" className="bg-secondary text-secondary-foreground">
                <Avatar.Fallback className="text-xs font-bold">{initials(admin?.fullname)}</Avatar.Fallback>
              </Avatar>
          </Dropdown.Trigger>
          <Dropdown.Popover placement="bottom end" className="min-w-[190px] rounded-2xl bg-overlay p-1">
            <Dropdown.Menu
              aria-label="Account"
              onAction={(key) => {
                if (key === 'account') router.push('/account');
                if (key === 'signout') void logout();
              }}
            >
              <Dropdown.Item id="account" textValue="My account" className="rounded-xl px-3 py-2 text-[13px]">
                <UserCircle size={16} />
                My account
              </Dropdown.Item>
              <Dropdown.Item id="signout" textValue="Sign out" className="rounded-xl px-3 py-2 text-[13px] text-danger">
                <SignOut size={16} />
                Sign out
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown>
      </div>
    </header>
  );
}
