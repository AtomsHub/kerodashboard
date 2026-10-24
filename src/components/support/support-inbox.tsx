'use client';

// src/components/support/support-inbox.tsx
// Three-column inbox shared by the Help Center and the SOS center:
//   conversations list | chat | chat details
// Below xl the details move into a modal ("Details" button); below lg the
// list and the chat take turns (back button in the chat header).

import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ChatCircleDots, Info, MagnifyingGlass, X } from '@phosphor-icons/react';
import { AppButton } from '@/components/ui/app-button';
import { AppInput } from '@/components/ui/app-input';
import { AppModal } from '@/components/ui/app-modal';
import { UserAvatar } from '@/components/ui/user-avatar';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import type { SupportTicketItem, SupportTicketListResponse } from '@/types/admin';
import { formatRelative, isActiveSos, isClosed } from './support-meta';
import { TicketConversation } from './ticket-conversation';
import { TicketDetails } from './ticket-details';

type Tab = 'OPEN' | 'UNCLAIMED' | 'MINE' | 'SOS' | 'RESOLVED';

const TABS: Record<'support' | 'sos', Array<{ key: Tab; label: string }>> = {
  support: [
    { key: 'OPEN', label: 'Open' },
    { key: 'UNCLAIMED', label: 'Unclaimed' },
    { key: 'MINE', label: 'Mine' },
    { key: 'RESOLVED', label: 'Resolved' },
  ],
  sos: [
    { key: 'OPEN', label: 'Active' },
    { key: 'MINE', label: 'Mine' },
    { key: 'RESOLVED', label: 'Closed' },
  ],
};

export function SupportInbox({
  mode,
  initialTicketId = null,
  title,
  badge,
  actions,
}: {
  mode: 'support' | 'sos';
  initialTicketId?: string | null;
  /** Small page title shown at the top of the conversations column. */
  title: string;
  /** Next to the title, e.g. the live SOS count. */
  badge?: React.ReactNode;
  /** Right side of the title row, e.g. the SOS sound toggle. */
  actions?: React.ReactNode;
}) {
  const adminId = useAuthStore((s) => s.admin?.id);
  const [tab, setTab] = useState<Tab>('OPEN');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(initialTicketId);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const { data, isLoading } = useQuery<SupportTicketListResponse>({
    queryKey: ['admin', 'support', 'tickets', search],
    queryFn: async () => {
      const params: Record<string, string | number> = { page: 1, limit: 100 };
      if (search.trim()) params.search = search.trim();
      return (await api.get<{ data: SupportTicketListResponse }>('/admin/support/tickets', { params })).data.data;
    },
    refetchInterval: 10000,
  });

  // SOS center only shows emergency tickets.
  const tickets = useMemo(() => {
    const all = data?.tickets ?? [];
    return mode === 'sos' ? all.filter((t) => t.priority === 'critical_sos') : all;
  }, [data, mode]);

  const matches = (t: SupportTicketItem, key: Tab) => {
    // SOS center: "Active" means the emergency itself is live, whatever the
    // ticket status (a reply after the SOS closed must not make it active).
    if (mode === 'sos') {
      if (key === 'OPEN') return isActiveSos(t);
      if (key === 'MINE') return isActiveSos(t) && t.assignedAdminId === adminId;
      return !isActiveSos(t);
    }
    if (key === 'OPEN') return !isClosed(t);
    if (key === 'UNCLAIMED') return !isClosed(t) && !t.assignedAdminId;
    if (key === 'MINE') return !isClosed(t) && t.assignedAdminId === adminId;
    if (key === 'SOS') return isActiveSos(t);
    return isClosed(t);
  };
  const visible = tickets
    .filter((t) => matches(t, tab))
    // Live SOS first, then most recent activity.
    .sort((a, b) => {
      const sa = isActiveSos(a) ? 1 : 0;
      const sb = isActiveSos(b) ? 1 : 0;
      if (sa !== sb) return sb - sa;
      return new Date(b.lastMessageAt ?? b.createdAt).getTime() - new Date(a.lastMessageAt ?? a.createdAt).getTime();
    });

  // /emergency?ticket=… opens that SOS (read before the URL is rewritten below).
  useEffect(() => {
    if (initialTicketId || typeof window === 'undefined') return;
    const fromUrl = new URLSearchParams(window.location.search).get('ticket');
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (fromUrl) setSelectedId(fromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the URL shareable without a full navigation.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = mode === 'support' ? (selectedId ? `/support/${selectedId}` : '/support') : `/emergency${selectedId ? `?ticket=${selectedId}` : ''}`;
    if (window.location.pathname + window.location.search !== url) window.history.replaceState(null, '', url);
  }, [selectedId, mode]);

  const select = (id: string | null) => {
    setSelectedId(id);
    setDetailsOpen(false);
  };

  return (
    <div className="grid h-[calc(100dvh-120px)] min-h-[520px] grid-cols-1 overflow-hidden rounded-3xl bg-surface lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)_320px]">
      {/* ── Conversations ── */}
      <aside className={`min-h-0 flex-col border-border lg:flex lg:border-r ${selectedId ? 'hidden' : 'flex'}`}>
        <div className="flex items-center justify-between gap-2 px-5 pt-4">
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="truncate text-[17px] font-semibold tracking-[-0.01em] text-foreground">{title}</h1>
            {badge}
          </div>
          {actions}
        </div>
        <div className="flex gap-4 border-b border-border px-5 pt-3">
          {TABS[mode].map((t) => {
            const count = tickets.filter((x) => matches(x, t.key)).length;
            const on = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`-mb-px cursor-pointer border-b-2 pb-3 text-[13px] font-medium transition-colors ${
                  on ? 'border-secondary text-foreground' : 'border-transparent text-muted hover:text-foreground'
                }`}
              >
                {t.label}
                {count > 0 && <span className="tabular ml-1 text-[11px] text-muted">{count}</span>}
              </button>
            );
          })}
        </div>
        <div className="px-4 py-3">
          <AppInput
            size="sm"
            placeholder="Search by name or ticket"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            startContent={<MagnifyingGlass />}
            endContent={
              search ? (
                <button type="button" onClick={() => setSearch('')} className="cursor-pointer text-muted hover:text-foreground" aria-label="Clear search">
                  <X size={14} />
                </button>
              ) : null
            }
          />
        </div>
        <ul className="scroll-thin min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <li key={i} className="mx-2 my-1 h-16 animate-pulse rounded-2xl bg-surface-secondary" />
            ))
          ) : visible.length === 0 ? (
            <li className="px-4 py-10 text-center text-[13px] text-muted">
              {mode === 'sos' ? 'No SOS here. The siren sounds the moment one comes in.' : 'No conversations here.'}
            </li>
          ) : (
            visible.map((t) => {
              const on = t.id === selectedId;
              const sos = isActiveSos(t);
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => select(t.id)}
                    className={`flex w-full cursor-pointer items-start gap-3 rounded-2xl px-3 py-3 text-left transition-colors ${
                      on ? 'bg-secondary-soft' : sos ? 'bg-danger-soft/40 hover:bg-danger-soft/60' : 'hover:bg-surface-secondary'
                    }`}
                  >
                    <span className="relative shrink-0">
                      <UserAvatar src={t.reporter?.avatarUrl} name={t.reporter?.name || 'User'} size="md" shape="circle" />
                      {sos && <span className="absolute -right-0.5 -top-0.5 size-3 animate-pulse rounded-full border-2 border-surface bg-danger" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-[14px] font-medium text-foreground">{t.reporter?.name || 'User'}</span>
                        <span className="tabular shrink-0 text-[11px] text-muted">{formatRelative(t.lastMessageAt || t.createdAt)}</span>
                      </span>
                      <span className="mt-0.5 flex items-center justify-between gap-2">
                        <span className="truncate text-[12.5px] text-muted">{t.lastMessagePreview || t.subject}</span>
                        {t.unreadByAdmin > 0 && (
                          <span className="tabular grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-danger px-1.5 text-[11px] font-semibold text-white">
                            {t.unreadByAdmin > 99 ? '99+' : t.unreadByAdmin}
                          </span>
                        )}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </aside>

      {/* ── Chat ── */}
      <section className={`min-h-0 flex-col lg:flex ${selectedId ? 'flex' : 'hidden'}`}>
        {selectedId ? (
          <TicketConversation
            key={selectedId}
            ticketId={selectedId}
            headerStart={
              <AppButton
                isIconOnly
                size="sm"
                variant="ghost"
                aria-label="Back to conversations"
                className="lg:hidden"
                onPress={() => select(null)}
                startContent={<ArrowLeft />}
              />
            }
            headerActions={
              <AppButton
                isIconOnly
                size="sm"
                variant="ghost"
                aria-label="Chat details"
                className="xl:hidden"
                onPress={() => setDetailsOpen(true)}
                startContent={<Info />}
              />
            }
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
            <span className="grid size-14 place-items-center rounded-2xl bg-surface-secondary text-muted">
              <ChatCircleDots size={28} weight="duotone" />
            </span>
            <p className="text-[15px] font-semibold text-foreground">Select a conversation</p>
            <p className="max-w-xs text-[13px] text-muted">
              Pick a {mode === 'sos' ? 'SOS' : 'ticket'} on the left to see the chat and its details.
            </p>
          </div>
        )}
      </section>

      {/* ── Chat details (wide screens) ── */}
      <aside className="hidden min-h-0 flex-col border-l border-border xl:flex">
        <div className="border-b border-border px-5 py-4">
          <p className="text-[15px] font-semibold text-foreground">Chat details</p>
        </div>
        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-4">
          {selectedId ? (
            <TicketDetails ticketId={selectedId} />
          ) : (
            <p className="pt-10 text-center text-[13px] text-muted">Details of the selected conversation show here.</p>
          )}
        </div>
      </aside>

      {/* ── Chat details (smaller screens) ── */}
      <AppModal isOpen={detailsOpen && Boolean(selectedId)} onOpenChange={setDetailsOpen} size="md" title="Chat details">
        {selectedId && (
          <div className="scroll-thin max-h-[70vh] overflow-y-auto pr-1">
            <TicketDetails ticketId={selectedId} />
          </div>
        )}
      </AppModal>
    </div>
  );
}
