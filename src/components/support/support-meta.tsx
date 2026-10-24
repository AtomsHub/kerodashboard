'use client';

// src/components/support/support-meta.tsx
// Labels and status pills shared by the support queue, quick view and page.

import React from 'react';
import { StatusPill } from '@/components/ui/page';
import type { SupportTicketItem } from '@/types/admin';

/** Matches the backend's categories (support.schemas.ts). */
export const CATEGORY_LABELS: Record<string, string> = {
  sos_emergency: 'SOS emergency',
  trip_issue: 'Trip issue',
  payment_dispute: 'Payment',
  lost_item: 'Lost item',
  driver_behavior: 'Driver behaviour',
  rider_behavior: 'Rider behaviour',
  account_kyc: 'Account & KYC',
  other: 'Other',
};

export const isClosed = (t: Pick<SupportTicketItem, 'status'>) => ['resolved', 'closed'].includes(t.status);

/**
 * A live emergency: an SOS ticket whose SOS alert is still active. A user
 * replying after the SOS was closed reopens the ticket, but that is a normal
 * follow-up chat, not a live SOS.
 */
export const isActiveSos = (t: Pick<SupportTicketItem, 'priority' | 'status' | 'sosAlert'>) =>
  t.priority === 'critical_sos' && !isClosed(t) && (t.sosAlert ? t.sosAlert.status === 'active' : true);

export function formatRelative(iso?: string | null): string {
  if (!iso) return '—';
  const diff = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (diff < 60) return 'just now';
  const mins = Math.floor(diff / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function TicketStatusPill({ ticket }: { ticket: SupportTicketItem }) {
  if (isActiveSos(ticket)) {
    return (
      <StatusPill tone="danger" dot pulse>
        SOS
      </StatusPill>
    );
  }
  if (isClosed(ticket)) return <StatusPill tone="success">Resolved</StatusPill>;
  if (!ticket.assignedAdminId) {
    return (
      <StatusPill tone="warning" dot>
        Unclaimed
      </StatusPill>
    );
  }
  if (ticket.status === 'waiting_on_user') return <StatusPill tone="neutral">Waiting on user</StatusPill>;
  return (
    <StatusPill tone="accent" dot>
      In progress
    </StatusPill>
  );
}
