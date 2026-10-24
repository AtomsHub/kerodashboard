'use client';

// src/components/support/ticket-details.tsx
// "Chat details" column of the support / SOS inbox: who the person is, how to
// reach them, the ticket facts, the linked trip and (for SOS) the emergency
// facts and Resolve action. On small screens it is shown inside a modal.

import React, { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowSquareOut,
  CheckCircle,
  Envelope,
  FirstAid,
  MapPin,
  PhoneCall,
  ShieldWarning,
  Siren,
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import { AppButton } from '@/components/ui/app-button';
import { AppModal } from '@/components/ui/app-modal';
import { AppSelect } from '@/components/ui/app-select';
import { AppTextarea } from '@/components/ui/app-textarea';
import { UserAvatar } from '@/components/ui/user-avatar';
import { Can } from '@/components/auth/can';
import { api } from '@/lib/api';
import { formatDate, formatDateTime } from '@/lib/format';
import type { DetailedSosAlertItem } from '@/types/admin';
import { CATEGORY_LABELS, TicketStatusPill, formatRelative, isClosed } from './support-meta';
import { errorMessage, useTicketDetail } from './ticket-conversation';

const EMERGENCY_LINES = [
  { label: 'LASEMA', display: '112 · 767', tel: '112' },
  { label: 'Police RRS', display: '0806 515 4338', tel: '08065154338' },
  { label: 'LASTMA', display: '0802 322 4444', tel: '08023224444' },
  { label: 'Fire & Rescue', display: '0803 323 5891', tel: '08033235891' },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border p-4">
      <p className="mb-3 text-[13px] font-semibold text-foreground">{title}</p>
      <div className="space-y-2.5">{children}</div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 text-[13px]">
      <span className="shrink-0 text-muted">{label}</span>
      <span className="min-w-0 text-right text-foreground">{children}</span>
    </div>
  );
}

function CallChip({ phone, label = 'Call' }: { phone: string; label?: string }) {
  return (
    <a
      href={`tel:${phone}`}
      title={phone}
      className="inline-flex h-8 items-center gap-1.5 rounded-full bg-default px-3 text-[12.5px] font-medium text-foreground hover:bg-default-hover"
    >
      <PhoneCall size={14} /> {label}
    </a>
  );
}

export function TicketDetails({ ticketId }: { ticketId: string }) {
  const queryClient = useQueryClient();
  const { data } = useTicketDetail(ticketId);
  const ticket = data?.ticket;
  const sosAlertId = ticket?.sosAlertId ?? ticket?.sosAlert?.id ?? null;

  // The SOS list carries both parties' phones and the claim state.
  const { data: sosList } = useQuery<DetailedSosAlertItem[]>({
    queryKey: ['admin', 'sos', 'list'],
    queryFn: async () => {
      const res = await api.get<{ data: DetailedSosAlertItem[] | { alerts: DetailedSosAlertItem[] } }>('/admin/sos');
      const payload = res.data?.data;
      return Array.isArray(payload) ? payload : (payload?.alerts ?? []);
    },
    enabled: Boolean(sosAlertId),
    refetchInterval: 10000,
  });
  const sos = sosAlertId ? sosList?.find((a) => a.id === sosAlertId) : undefined;

  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolution, setResolution] = useState<'resolved' | 'false_alarm'>('resolved');
  const [notes, setNotes] = useState('');
  const resolveSos = useMutation({
    mutationFn: async () =>
      (
        await api.put(
          `/admin/sos/${sosAlertId}/deactivate`,
          { resolution, ...(notes.trim() ? { notes: notes.trim() } : {}) },
          { silent: true },
        )
      ).data,
    onSuccess: () => {
      toast.success('SOS resolved');
      setResolveOpen(false);
      setNotes('');
      queryClient.invalidateQueries({ queryKey: ['admin', 'sos'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'support'] });
    },
    onError: (err) => toast.error(errorMessage(err, "Couldn't resolve this SOS")),
  });

  if (!ticket) {
    return <div className="flex h-full items-center justify-center text-sm text-muted">Loading details…</div>;
  }

  const name = ticket.reporter?.name || 'User';
  const profileHref = ticket.reporterRole === 'driver' ? `/drivers/${ticket.reporterId}` : `/riders/${ticket.reporterId}`;
  const sosActive = Boolean(sosAlertId) && (sos ? sos.status === 'ACTIVE' : ticket.sosAlert?.status === 'active');
  const sosLocation = sos?.location?.lat != null
    ? sos.location
    : ticket.sosAlert
      ? { lat: ticket.sosAlert.latitude, lng: ticket.sosAlert.longitude }
      : null;
  const sosMessage = sos?.message ?? ticket.sosAlert?.message ?? null;
  // The other party on the trip (the reporter's own phone is in Contact).
  // Only when that party is on the trip (a cancelled trip may have no driver).
  const otherParty =
    ticket.reporterRole === 'rider'
      ? sos?.trip?.driver
        ? {
            role: 'Driver',
            name: `${sos.trip.driver.firstname ?? ''} ${sos.trip.driver.lastname ?? ''}`.trim() || 'Driver',
            phone: sos.trip.driver.phone ?? null,
          }
        : null
      : sos?.trip?.rider
        ? { role: 'Rider', name: sos.trip.rider.fullname || 'Rider', phone: sos.trip.rider.phone ?? null }
        : null;

  return (
    <div className="flex flex-col gap-4">
      {/* Person */}
      <div className="flex flex-col items-center gap-2 pt-2 text-center">
        <UserAvatar src={ticket.reporter?.avatarUrl} name={name} size="xl" shape="circle" />
        <div>
          <p className="text-[16px] font-semibold text-foreground">{name}</p>
          <p className="text-[13px] capitalize text-muted">{ticket.reporterRole}</p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {ticket.reporter?.phone && <CallChip phone={ticket.reporter.phone} />}
          <Link
            href={profileHref}
            className="inline-flex h-8 items-center gap-1.5 rounded-full bg-default px-3 text-[12.5px] font-medium text-foreground hover:bg-default-hover"
          >
            Profile <ArrowSquareOut size={13} />
          </Link>
        </div>
      </div>

      {sosAlertId && (
        <section className={`rounded-2xl p-4 ${sosActive ? 'bg-danger-soft/60' : 'bg-surface-secondary'}`}>
          <p className="mb-3 flex items-center gap-1.5 text-[13px] font-semibold text-foreground">
            <Siren size={16} weight="duotone" className={sosActive ? 'text-danger' : 'text-muted'} />
            {sosActive ? 'Live SOS' : 'SOS (closed)'}
          </p>
          <div className="space-y-2.5">
            {sosMessage && <p className="text-[14px] font-medium text-foreground">“{sosMessage}”</p>}
            {sosLocation && (
              <a
                href={`https://www.google.com/maps?q=${sosLocation.lat},${sosLocation.lng}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-[13px] font-medium text-foreground hover:underline"
              >
                <MapPin size={15} weight="duotone" /> Open location in Maps
              </a>
            )}
            {otherParty && (
              <div className="flex items-center justify-between gap-3 text-[13px]">
                <span className="min-w-0 truncate text-foreground">
                  {otherParty.name} <span className="text-muted">· {otherParty.role}</span>
                </span>
                {otherParty.phone && <CallChip phone={otherParty.phone} />}
              </div>
            )}
            <p className="text-[12px] text-muted">
              Raised {formatRelative(sos?.createdAt ?? ticket.sosAlert?.createdAt ?? ticket.createdAt)}
              {sos?.claimedByName || ticket.sosAlert?.claimedByName
                ? ` · handled by ${sos?.claimedByName ?? ticket.sosAlert?.claimedByName}`
                : ' · not claimed yet'}
            </p>
            {sosActive && (
              <Can permission="deactivate_sos">
                <AppButton
                  size="sm"
                  variant="tertiary"
                  className="w-full"
                  startContent={<CheckCircle />}
                  label="Resolve SOS"
                  onPress={() => setResolveOpen(true)}
                />
              </Can>
            )}
          </div>
        </section>
      )}

      <Section title="Contact">
        <Row label="Phone">{ticket.reporter?.phone ?? '—'}</Row>
        <Row label="Email">
          {ticket.reporter?.email ? (
            <a href={`mailto:${ticket.reporter.email}`} className="inline-flex items-center gap-1 hover:underline">
              <Envelope size={13} /> {ticket.reporter.email}
            </a>
          ) : (
            '—'
          )}
        </Row>
      </Section>

      <Section title="Ticket">
        <Row label="Number">
          <span className="tabular">{ticket.ticketNumber}</span>
        </Row>
        <Row label="Status">
          <TicketStatusPill ticket={ticket} />
        </Row>
        <Row label="Topic">{CATEGORY_LABELS[ticket.category] ?? ticket.category}</Row>
        <Row label="Handled by">{ticket.assignedAdminName ?? 'Unclaimed'}</Row>
        <Row label="Opened">{formatDateTime(ticket.createdAt)}</Row>
        {isClosed(ticket) && ticket.resolvedAt && <Row label="Resolved">{formatDateTime(ticket.resolvedAt)}</Row>}
        {ticket.resolutionNotes && <p className="rounded-xl bg-surface-secondary p-3 text-[13px] text-foreground">{ticket.resolutionNotes}</p>}
      </Section>

      {ticket.trip && (
        <Section title="Trip">
          <div className="space-y-1.5 text-[13px]">
            <p className="flex items-start gap-2 text-foreground">
              <span className="mt-1.5 size-2 shrink-0 rounded-full bg-secondary" />
              <span className="line-clamp-2">{ticket.trip.startAddress}</span>
            </p>
            <p className="flex items-start gap-2 text-foreground">
              <span className="mt-1.5 size-2 shrink-0 rounded-sm bg-foreground" />
              <span className="line-clamp-2">{ticket.trip.endAddress}</span>
            </p>
          </div>
          <Row label="Status">
            <span className="capitalize">{ticket.trip.status.toLowerCase().replaceAll('_', ' ')}</span>
          </Row>
          <Row label="Date">{formatDate(ticket.trip.createdAt)}</Row>
          <Link href={`/trips/${ticket.trip.id}`} className="inline-flex items-center gap-1 text-[13px] font-medium text-foreground hover:underline">
            Open trip <ArrowSquareOut size={13} />
          </Link>
        </Section>
      )}

      {sosActive && (
        <Section title="Emergency lines">
          {EMERGENCY_LINES.map((line) => (
            <a key={line.tel} href={`tel:${line.tel}`} className="flex items-center justify-between gap-3 text-[13px] hover:underline">
              <span className="inline-flex items-center gap-2 text-foreground">
                {line.tel === '112' ? <FirstAid size={15} className="text-danger" /> : <ShieldWarning size={15} className="text-muted" />}
                {line.label}
              </span>
              <span className="tabular text-muted">{line.display}</span>
            </a>
          ))}
        </Section>
      )}

      <AppModal
        isOpen={resolveOpen}
        onOpenChange={setResolveOpen}
        size="sm"
        title="Resolve SOS"
        description="Stops the alarms and tells the person their SOS is closed."
        footer={
          <>
            <AppButton variant="tertiary" label="Cancel" onPress={() => setResolveOpen(false)} />
            <AppButton
              variant="brand"
              startContent={<CheckCircle />}
              label="Resolve"
              isLoading={resolveSos.isPending}
              onPress={() => resolveSos.mutate()}
            />
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <AppSelect
            label="Outcome"
            options={[
              { key: 'resolved', label: 'Resolved safely / help sent' },
              { key: 'false_alarm', label: 'False alarm' },
            ]}
            selectedKey={resolution}
            onSelectionChange={(k) => setResolution(k as 'resolved' | 'false_alarm')}
          />
          <AppTextarea
            label="Notes"
            placeholder="What happened and what you did (optional)"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </AppModal>
    </div>
  );
}
