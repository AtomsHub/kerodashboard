'use client';

// src/components/trips/trip-activity.tsx
// What happened around one trip, for support and disputes: who it was offered
// to, who cancelled, calls, the chat, money movements, both ratings, tickets
// and fake-GPS flags. Backed by GET /admin/trips/:id/activity. Shown as a
// list of rows; each opens in a modal.

import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { DashboardCard } from '@/components/ui/dashboard-card';
import { CaretRight } from '@phosphor-icons/react';
import { AppModal } from '@/components/ui/app-modal';
import { EmptyState, SectionHeader, StatusPill, type StatusTone } from '@/components/ui/page';
import { gatewayLabel } from '@/lib/payments';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { INTEGRITY_LABELS, integrityDetail, type IntegrityEvent } from '@/lib/location-integrity';

interface TripActivity {
  cancellation: {
    at: string;
    reason: string | null;
    feeKobo: number | null;
    by: { role: 'rider' | 'driver' | 'admin' | 'system'; name: string | null } | null;
  } | null;
  dropoff: {
    suspicious: boolean;
    reason: string | null;
    distanceFromDropoffKm: number | null;
    autoApproved: boolean;
    confirmedAt: string | null;
  };
  offers: Array<{
    id: string;
    offerIndex: number;
    status: string;
    offeredAt: string;
    respondedAt: string | null;
    declineReason: string | null;
    driver: { id: string; firstname: string | null; lastname: string | null };
  }>;
  driverCancellations: Array<{
    id: string;
    driverId: string;
    driverName: string | null;
    stage: string;
    reason: string | null;
    comment: string | null;
    counted: boolean;
    createdAt: string;
  }>;
  calls: Array<{
    id: string;
    initiator: string;
    status: string;
    startedAt: string | null;
    endedAt: string | null;
    durationSeconds: number | null;
    createdAt: string;
  }>;
  chat: Array<{ id: string; senderRole: string; text: string; sentAt: string }>;
  transactions: Array<{
    id: string;
    reference: string;
    transactionId: string;
    amountKobo: number;
    transactionType: string;
    transactionServices: string;
    gateway: string;
    isCashSettlement: boolean;
    status: string;
    narration: string | null;
    userId: string | null;
    driverId: string | null;
    createdAt: string;
  }>;
  rating: {
    driverRating: number | null;
    driverComment: string | null;
    driverTags: string[];
    driverRatedAt: string | null;
    riderRating: number | null;
    riderComment: string | null;
    riderTags: string[];
    riderRatedAt: string | null;
    isHidden: boolean;
  } | null;
  tickets: Array<{
    id: string;
    ticketNumber: string;
    subject: string;
    category: string;
    status: string;
    priority: string;
    reporterRole: string;
    createdAt: string;
  }>;
  cashDisputes: Array<{ id: string; reason: string; description: string; status: string; createdAt: string }>;
  integrity: Array<Pick<IntegrityEvent, 'id' | 'type' | 'details' | 'createdAt'>>;
}

const naira = (kobo: number | null | undefined) =>
  `₦${((kobo ?? 0) / 100).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const OFFER_TONE: Record<string, StatusTone> = {
  ACCEPTED: 'success',
  DECLINED: 'danger',
  EXPIRED: 'warning',
  SUPERSEDED: 'neutral',
  PENDING: 'accent',
};

const MONEY_TONE: Record<string, StatusTone> = {
  COMPLETED: 'success',
  PENDING: 'warning',
  PROCESSING: 'accent',
  FAILED: 'danger',
  REFUNDED: 'neutral',
  PARTIAL: 'warning',
};

const CALL_LABEL: Record<string, string> = {
  INITIATED: 'Not answered',
  RINGING: 'Not answered',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Answered',
  NO_ANSWER: 'Not answered',
  BUSY: 'Busy',
  CANCELED: 'Cancelled',
  FAILED: 'Failed',
};

const humanise = (s: string) => s.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

const duration = (seconds: number | null) => {
  if (!seconds) return null;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m ? `${m}m ${s}s` : `${s}s`;
};

function Row({ children, at }: { children: React.ReactNode; at?: string | null }) {
  return (
    <li className="flex items-start justify-between gap-3 py-2.5">
      <div className="min-w-0 flex-1">{children}</div>
      {at && <span className="tabular shrink-0 text-[12px] text-muted">{formatDateTime(at)}</span>}
    </li>
  );
}

function Stars({ value }: { value: number | null }) {
  if (value === null) return <span className="text-[13px] text-muted">Not rated</span>;
  return (
    <span className="tabular text-[14px] font-semibold text-foreground">
      ★ {value}
      <span className="font-normal text-muted"> / 5</span>
    </span>
  );
}

export function useTripActivity(tripId: string) {
  return useQuery<TripActivity>({
    queryKey: ['admin', 'trip-activity', tripId],
    queryFn: async () => (await api.get<{ data: TripActivity }>(`/admin/trips/${tripId}/activity`)).data.data,
    refetchInterval: 30_000,
  });
}

/** One extra row supplied by the page (fare breakdown, trip record). */
export interface DetailRow {
  key: string;
  label: string;
  summary: string;
  title?: string;
  content: React.ReactNode;
}

const count = (n: number, one: string, many = `${one}s`) => (n === 0 ? `No ${many}` : `${n} ${n === 1 ? one : many}`);

/**
 * Everything about the trip as a list: text on the left, caret on the right;
 * each row opens in a modal. Cancellation / bad drop-off notes stay visible.
 */
export function TripDetailsList({ tripId, extraRows = [] }: { tripId: string; extraRows?: DetailRow[] }) {
  const { data, isLoading } = useTripActivity(tripId);
  const [open, setOpen] = useState<string | null>(null);
  const issueCount = (data?.tickets.length ?? 0) + (data?.cashDisputes.length ?? 0) + (data?.integrity.length ?? 0);

  const rows: DetailRow[] = [
    ...extraRows,
    {
      key: 'dispatch',
      label: 'Drivers offered',
      summary: data ? `${count(data.offers.length, 'driver')} offered${data.driverCancellations.length ? ` · ${data.driverCancellations.length} cancelled` : ''}` : '…',
      title: 'Drivers offered this trip',
      content: data ? <DispatchList data={data} /> : null,
    },
    { key: 'chat', label: 'Chat', summary: data ? count(data.chat.length, 'message') : '…', title: 'Chat', content: data ? <ChatList data={data} /> : null },
    { key: 'calls', label: 'Calls', summary: data ? count(data.calls.length, 'call') : '…', title: 'Calls', content: data ? <CallList data={data} /> : null },
    { key: 'money', label: 'Money', summary: data ? count(data.transactions.length, 'payment') : '…', title: 'Money', content: data ? <MoneyList data={data} /> : null },
    {
      key: 'issues',
      label: 'Tickets and flags',
      summary: data ? count(issueCount, 'issue') : '…',
      title: 'Tickets and flags',
      content: data ? <IssueList data={data} /> : null,
    },
  ];
  const active = rows.find((r) => r.key === open) ?? null;

  return (
    <DashboardCard className="overflow-hidden p-0">
      <SectionHeader className="p-6 pb-2" title="Activity" />

      {data?.cancellation && (
        <div className="mx-6 mb-3 rounded-2xl bg-danger-soft/40 p-3 text-[13px]">
          <p className="font-medium text-foreground">
            Cancelled by{' '}
            {data.cancellation.by
              ? data.cancellation.by.role === 'admin'
                ? `admin${data.cancellation.by.name ? ` (${data.cancellation.by.name})` : ''}`
                : data.cancellation.by.role === 'system'
                  ? 'the system'
                  : `the ${data.cancellation.by.role}`
              : 'unknown'}
            {data.cancellation.feeKobo ? ` · fee ${naira(data.cancellation.feeKobo)}` : ' · no fee'}
          </p>
          <p className="mt-0.5 text-muted">{data.cancellation.reason || 'No reason given.'}</p>
        </div>
      )}
      {data?.dropoff.suspicious && (
        <div className="mx-6 mb-3 rounded-2xl bg-warning-soft/50 p-3 text-[13px]">
          <p className="font-medium text-foreground">Drop-off looked wrong</p>
          <p className="mt-0.5 text-muted">
            {data.dropoff.reason || 'Ended away from the requested drop-off.'}
            {data.dropoff.distanceFromDropoffKm !== null ? ` · ${data.dropoff.distanceFromDropoffKm.toFixed(2)} km from drop-off` : ''}
          </p>
        </div>
      )}

      <ul className="divide-y divide-border">
        {rows.map((row) => (
          <li key={row.key}>
            <button
              type="button"
              onClick={() => setOpen(row.key)}
              disabled={isLoading && !row.content}
              className="flex w-full cursor-pointer items-center justify-between gap-3 px-6 py-3.5 text-left hover:bg-surface-secondary disabled:cursor-default"
            >
              <span className="min-w-0">
                <span className="block text-[14px] font-medium text-foreground">{row.label}</span>
                <span className="block truncate text-[12.5px] text-muted">{row.summary}</span>
              </span>
              <CaretRight size={16} className="shrink-0 text-muted" />
            </button>
          </li>
        ))}
      </ul>

      <AppModal isOpen={Boolean(active)} onOpenChange={(o) => !o && setOpen(null)} size="lg" title={active?.title ?? active?.label ?? ''}>
        {active?.content}
      </AppModal>
    </DashboardCard>
  );
}

function DispatchList({ data }: { data: TripActivity }) {
  if (data.offers.length === 0 && data.driverCancellations.length === 0) return <EmptyState title="No drivers were offered this trip" className="py-8" />;
  return (
    <ul className="divide-y divide-border">
      {data.offers.map((o) => (
        <Row key={o.id} at={o.offeredAt}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="tabular text-[12px] text-muted">#{o.offerIndex + 1}</span>
            <Link href={`/drivers/${o.driver.id}`} className="text-[13.5px] font-medium text-foreground hover:underline">
              {[o.driver.firstname, o.driver.lastname].filter(Boolean).join(' ') || 'Driver'}
            </Link>
            <StatusPill tone={OFFER_TONE[o.status] ?? 'neutral'}>{humanise(o.status.toLowerCase())}</StatusPill>
          </div>
          {o.declineReason && <p className="mt-0.5 text-[12.5px] text-muted">{o.declineReason}</p>}
        </Row>
      ))}
      {data.driverCancellations.map((c) => (
        <Row key={c.id} at={c.createdAt}>
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/drivers/${c.driverId}`} className="text-[13.5px] font-medium text-foreground hover:underline">
              {c.driverName || 'Driver'}
            </Link>
            <StatusPill tone="danger">Cancelled after accepting</StatusPill>
            {!c.counted && <StatusPill>Within grace period</StatusPill>}
          </div>
          <p className="mt-0.5 text-[12.5px] text-muted">
            {humanise(c.stage.toLowerCase())}
            {c.reason ? ` · ${c.reason}` : ''}
            {c.comment ? ` · “${c.comment}”` : ''}
          </p>
        </Row>
      ))}
    </ul>
  );
}

function ChatList({ data }: { data: TripActivity }) {
  if (data.chat.length === 0) return <EmptyState title="No messages" className="py-8" />;
  return (
    <div className="space-y-2">
      {data.chat.map((m) => (
        <div key={m.id} className={`flex ${m.senderRole === 'driver' ? 'justify-end' : 'justify-start'}`}>
          <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-[13px] ${m.senderRole === 'driver' ? 'bg-accent-soft text-foreground' : 'bg-surface-secondary text-foreground'}`}>
            <p className="text-[11px] font-medium capitalize text-muted">{m.senderRole}</p>
            <p className="whitespace-pre-wrap break-words">{m.text}</p>
            <p className="tabular mt-0.5 text-right text-[11px] text-muted">{formatDateTime(m.sentAt)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function CallList({ data }: { data: TripActivity }) {
  if (data.calls.length === 0) return <EmptyState title="No calls" className="py-8" />;
  return (
    <ul className="divide-y divide-border">
      {data.calls.map((c) => (
        <Row key={c.id} at={c.createdAt}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13.5px] font-medium capitalize text-foreground">{c.initiator} called</span>
            <StatusPill tone={c.status === 'COMPLETED' ? 'success' : c.status === 'IN_PROGRESS' ? 'accent' : 'warning'}>
              {CALL_LABEL[c.status] ?? humanise(c.status.toLowerCase())}
            </StatusPill>
            {duration(c.durationSeconds) && <span className="tabular text-[12px] text-muted">{duration(c.durationSeconds)}</span>}
          </div>
        </Row>
      ))}
    </ul>
  );
}

function MoneyList({ data }: { data: TripActivity }) {
  if (data.transactions.length === 0) return <EmptyState title="No money moved for this trip" className="py-8" />;
  return (
    <ul className="divide-y divide-border">
      {data.transactions.map((t) => (
        <Row key={t.id} at={t.createdAt}>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`tabular text-[13.5px] font-semibold ${t.transactionType === 'credit' ? 'text-success' : 'text-foreground'}`}>
              {t.transactionType === 'credit' ? '+' : '−'}
              {naira(t.amountKobo)}
            </span>
            <span className="text-[13px] text-foreground">{humanise(t.transactionServices)}</span>
            <StatusPill tone={MONEY_TONE[t.status] ?? 'neutral'}>{humanise(t.status.toLowerCase())}</StatusPill>
          </div>
          <p className="tabular mt-0.5 truncate text-[12px] text-muted">
            {t.userId ? 'Rider' : t.driverId ? 'Driver' : '—'} · {gatewayLabel(t.gateway)} · {t.reference}
          </p>
        </Row>
      ))}
    </ul>
  );
}

function IssueList({ data }: { data: TripActivity }) {
  if (data.tickets.length + data.cashDisputes.length + data.integrity.length === 0) {
    return <EmptyState title="No tickets, disputes or location flags" className="py-8" />;
  }
  return (
    <ul className="divide-y divide-border">
      {data.tickets.map((t) => (
        <Row key={t.id} at={t.createdAt}>
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/support/${t.id}`} className="text-[13.5px] font-medium text-foreground hover:underline">
              {t.ticketNumber} · {t.subject}
            </Link>
            <StatusPill tone={t.status === 'resolved' || t.status === 'closed' ? 'success' : 'warning'}>{humanise(t.status)}</StatusPill>
          </div>
          <p className="mt-0.5 text-[12.5px] capitalize text-muted">
            {t.reporterRole} · {humanise(t.category)}
          </p>
        </Row>
      ))}
      {data.cashDisputes.map((d) => (
        <Row key={d.id} at={d.createdAt}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13.5px] font-medium text-foreground">Cash dispute · {humanise(d.reason)}</span>
            <StatusPill tone={d.status === 'pending' ? 'warning' : d.status === 'upheld' ? 'danger' : 'neutral'}>{humanise(d.status)}</StatusPill>
          </div>
          <p className="mt-0.5 text-[12.5px] text-muted">{d.description}</p>
        </Row>
      ))}
      {data.integrity.map((e) => (
        <Row key={e.id} at={e.createdAt}>
          <StatusPill tone={INTEGRITY_LABELS[e.type]?.tone ?? 'neutral'}>{INTEGRITY_LABELS[e.type]?.label ?? e.type}</StatusPill>
          <p className="mt-1 text-[12.5px] text-muted">{integrityDetail(e)}</p>
        </Row>
      ))}
    </ul>
  );
}

/** Both reviews: the rider's of the driver and the driver's of the rider. */
export function TripReviewsCard({ tripId }: { tripId: string }) {
  const { data } = useTripActivity(tripId);
  const rating = data?.rating;
  if (!rating) return null;
  const side = (title: string, value: number | null, comment: string | null, tags: string[]) => (
    <div className="rounded-2xl bg-surface-secondary p-4">
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-muted">{title}</p>
        <Stars value={value} />
      </div>
      {comment ? <p className="mt-2 text-[14px] text-foreground">“{comment}”</p> : value !== null && <p className="mt-2 text-[13px] text-muted">No written review.</p>}
      {tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <StatusPill key={tag}>{tag}</StatusPill>
          ))}
        </div>
      )}
    </div>
  );
  return (
    <DashboardCard>
      <SectionHeader title="Reviews" actions={rating.isHidden ? <StatusPill>Hidden</StatusPill> : undefined} />
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {side('Rider rated the driver', rating.driverRating, rating.driverComment, rating.driverTags)}
        {side('Driver rated the rider', rating.riderRating, rating.riderComment, rating.riderTags)}
      </div>
    </DashboardCard>
  );
}
