'use client';

// src/components/support/ticket-conversation.tsx
// The chat column of the support / SOS inbox. Claim-first: an unclaimed
// ticket is read-only until an admin claims it; after that only the claiming
// admin can reply, resolve or reopen it (the backend enforces the same rule).
// Ticket details live in the side panel (TicketDetails), not here.

import React, { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, Lightning, Lock, PaperPlaneRight, ShieldCheck, UserCheck } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { AppButton } from '@/components/ui/app-button';
import { AppTextarea } from '@/components/ui/app-textarea';
import { UserAvatar } from '@/components/ui/user-avatar';
import { Can } from '@/components/auth/can';
import { api } from '@/lib/api';
import { getSocket, joinSupportTicket, leaveSupportTicket } from '@/lib/socket';
import { useAuthStore } from '@/stores/auth-store';
import type { SupportMessageItem, SupportTicketItem, SupportTicketStatus } from '@/types/admin';
import { TicketStatusPill, isActiveSos, isClosed } from './support-meta';

const QUICK_REPLIES = [
  "Thanks for reaching out. I'm looking into this now.",
  'Could you share a bit more detail so I can help faster?',
  "I've checked your trip and wallet records. Here's what I found:",
];

const SOS_QUICK_REPLIES = [
  'Hello, I am with the Kero Safety Team. Are you safe right now?',
  'We have your live GPS location and are monitoring your trip.',
  'We are calling your phone now. Please pick up if it is safe to do so.',
  'Do you need us to send emergency services (112 / Police) to you?',
];

export type TicketDetail = { ticket: SupportTicketItem; messages: SupportMessageItem[] };

export function errorMessage(err: unknown, fallback: string): string {
  const e = err as { message?: string; response?: { data?: { message?: string; error?: { message?: string } } } };
  return e?.response?.data?.error?.message ?? e?.response?.data?.message ?? e?.message ?? fallback;
}

/** System events ("X joined the conversation") as a chip so they stand out from chat. */
export function SystemChip({ text }: { text: string }) {
  return (
    <div className="flex justify-center px-8">
      <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-secondary-soft px-2 py-0.5 text-[11px] leading-4 text-secondary-soft-foreground">
        <ShieldCheck size={11} weight="fill" className="shrink-0" />
        <span className="line-clamp-2">{text}</span>
      </span>
    </div>
  );
}

const dayLabel = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
};

/** Shared query for one ticket + its messages (opening it marks it read). */
export function useTicketDetail(ticketId: string | null) {
  return useQuery<TicketDetail>({
    queryKey: ['admin', 'support', 'ticket', ticketId],
    queryFn: async () => (await api.get<{ data: TicketDetail }>(`/admin/support/tickets/${ticketId}`)).data.data,
    enabled: Boolean(ticketId),
    refetchInterval: 10000,
  });
}

export function TicketConversation({
  ticketId,
  headerStart,
  headerActions,
}: {
  ticketId: string;
  /** Left of the title, e.g. a back button on small screens. */
  headerStart?: React.ReactNode;
  /** Right side of the header, e.g. the "Details" button. */
  headerActions?: React.ReactNode;
}) {
  const queryClient = useQueryClient();
  const adminId = useAuthStore((s) => s.admin?.id);
  const [reply, setReply] = useState('');
  const [resolving, setResolving] = useState(false);
  const [showQuick, setShowQuick] = useState(false);
  const [openMsgId, setOpenMsgId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const { data, isLoading } = useTicketDetail(ticketId);
  const ticket = data?.ticket;
  const messages = data?.messages ?? [];

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'support'] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'sos'] });
  };

  // Live updates for this ticket.
  useEffect(() => {
    joinSupportTicket(ticketId);
    const socket = getSocket();
    const onEvent = (payload: { ticketId?: string } | undefined) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'support', 'tickets'] });
      if (!payload?.ticketId || payload.ticketId === ticketId) {
        queryClient.invalidateQueries({ queryKey: ['admin', 'support', 'ticket', ticketId] });
      }
    };
    const events = ['support:message:new', 'support:ticket:updated', 'admin:support:message:new', 'admin:support:ticket:updated'];
    events.forEach((e) => socket.on(e, onEvent));
    return () => {
      leaveSupportTicket(ticketId);
      events.forEach((e) => socket.off(e, onEvent));
    };
  }, [ticketId, queryClient]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length, ticketId]);

  const claim = useMutation({
    mutationFn: async () => (await api.post(`/admin/support/tickets/${ticketId}/claim`, undefined, { silent: true })).data,
    onSuccess: () => {
      toast.success('Claimed. The user has been told you are on it.');
      refresh();
    },
    onError: (err) => toast.error(errorMessage(err, "Couldn't claim this ticket")),
  });

  const setStatus = useMutation({
    mutationFn: async ({ status, resolutionNotes }: { status: SupportTicketStatus; resolutionNotes?: string }) =>
      (
        await api.put(
          `/admin/support/tickets/${ticketId}/status`,
          { status, ...(resolutionNotes ? { resolutionNotes } : {}) },
          { silent: true },
        )
      ).data,
    onSuccess: (_, vars) => {
      toast.success(vars.status === 'resolved' ? 'Ticket resolved' : 'Ticket reopened');
      setResolving(false);
      setNotes('');
      refresh();
    },
    onError: (err) => toast.error(errorMessage(err, "Couldn't update this ticket")),
  });

  const send = useMutation({
    mutationFn: async (text: string) =>
      (await api.post(`/admin/support/tickets/${ticketId}/messages`, { text, messageType: 'text' }, { silent: true })).data,
    onSuccess: () => refresh(),
    onError: (err, text) => {
      // Put the text back so nothing typed is lost.
      setReply((current) => current || text);
      toast.error(errorMessage(err, "Couldn't send your reply"));
    },
  });

  const submitReply = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || send.isPending) return;
    setReply(''); // clear straight away; restored if sending fails
    setShowQuick(false);
    send.mutate(trimmed);
  };

  if (isLoading || !ticket) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted">
        {isLoading ? 'Loading conversation…' : 'Ticket not found.'}
      </div>
    );
  }

  const closed = isClosed(ticket);
  const unclaimed = !ticket.assignedAdminId;
  const mine = ticket.assignedAdminId === adminId;
  const sos = ticket.priority === 'critical_sos';
  const quickReplies = sos ? SOS_QUICK_REPLIES : QUICK_REPLIES;
  const name = ticket.reporter?.name || 'User';

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border px-5 py-3.5">
        {headerStart}
        <UserAvatar src={ticket.reporter?.avatarUrl} name={name} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-foreground">{name}</p>
          <p className="truncate text-[12px] text-muted">
            <span className="capitalize">{ticket.reporterRole}</span> · {ticket.subject}
          </p>
        </div>
        <span className="hidden sm:block">
          <TicketStatusPill ticket={ticket} />
        </span>
        {headerActions}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="scroll-thin min-h-0 flex-1 space-y-2.5 overflow-y-auto px-5 py-4">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted">No messages yet.</div>
        ) : (
          messages.map((msg, i) => {
            const prev = messages[i - 1];
            const newDay = !prev || new Date(prev.createdAt).toDateString() !== new Date(msg.createdAt).toDateString();
            const dayDivider = newDay ? (
              <div className="flex justify-center py-1">
                <span className="rounded-full bg-surface-secondary px-3 py-0.5 text-[11px] text-muted">{dayLabel(msg.createdAt)}</span>
              </div>
            ) : null;

            if (msg.senderRole === 'system' || msg.messageType === 'system_event') {
              return (
                <React.Fragment key={msg.id}>
                  {dayDivider}
                  <SystemChip text={msg.text ?? ''} />
                </React.Fragment>
              );
            }
            const isAdmin = msg.senderRole === 'admin';
            const time = new Date(msg.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
            const expanded = openMsgId === msg.id;
            // Agent messages: has the rider/driver seen it? User messages: when the team saw it.
            const status = isAdmin
              ? msg.readAt
                ? `Read ${new Date(msg.readAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
                : 'Sent'
              : msg.readAt
                ? 'Seen by the team'
                : null;
            return (
              <React.Fragment key={msg.id}>
                {dayDivider}
                <div className={`group flex items-end gap-2 ${isAdmin ? 'flex-row-reverse' : ''}`}>
                  <UserAvatar
                    src={isAdmin ? null : ticket.reporter?.avatarUrl}
                    name={msg.senderName}
                    size="xs"
                    shape="circle"
                    className="mb-0.5 shrink-0"
                  />
                  <div className={`flex min-w-0 max-w-[75%] flex-col ${isAdmin ? 'items-end' : 'items-start'}`}>
                    <button
                      type="button"
                      onClick={() => setOpenMsgId(expanded ? null : msg.id)}
                      className={`cursor-pointer whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-left text-[14px] leading-relaxed ${
                        isAdmin ? 'rounded-br-md bg-secondary text-secondary-foreground' : 'rounded-bl-md bg-surface-secondary text-foreground'
                      }`}
                    >
                      {msg.text}
                    </button>
                    {/* Time + read state: click the bubble to show it. */}
                    <span
                      className={`tabular mt-1 px-1 text-[11px] text-muted transition-opacity ${
                        expanded ? 'opacity-100' : 'h-0 overflow-hidden opacity-0'
                      }`}
                    >
                      {isAdmin ? `${msg.senderName} · ` : ''}
                      {time}
                      {status ? ` · ${status}` : ''}
                    </span>
                  </div>
                </div>
              </React.Fragment>
            );
          })
        )}
      </div>

      {/* Footer: claim gate, resolve panel or composer */}
      <div className="border-t border-border px-5 py-3">
        {unclaimed && !closed ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-[13px] text-muted">
              <Lock size={16} />
              Claim to reply. The user is told who is helping.
            </p>
            <Can permission="respond_support">
              <AppButton
                size="sm"
                variant={isActiveSos(ticket) ? 'danger' : 'brand'}
                startContent={<UserCheck />}
                label="Claim"
                isLoading={claim.isPending}
                onPress={() => claim.mutate()}
              />
            </Can>
          </div>
        ) : !mine && !closed ? (
          <p className="flex items-center gap-2 text-[13px] text-muted">
            <Lock size={16} />
            {ticket.assignedAdminName ?? 'Another admin'} is handling this. Only they can reply.
          </p>
        ) : resolving ? (
          <div className="flex flex-col gap-3">
            <AppTextarea
              label="Resolution note"
              placeholder="Optional. Shown in the chat history."
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <AppButton size="sm" variant="ghost" label="Cancel" onPress={() => setResolving(false)} />
              <AppButton
                size="sm"
                variant="brand"
                startContent={<CheckCircle />}
                label="Mark resolved"
                isLoading={setStatus.isPending}
                onPress={() => setStatus.mutate({ status: 'resolved', resolutionNotes: notes.trim() || undefined })}
              />
            </div>
          </div>
        ) : closed && !mine ? (
          <p className="text-[13px] text-muted">Resolved{ticket.assignedAdminName ? ` by ${ticket.assignedAdminName}` : ''}.</p>
        ) : (
          <Can permission="respond_support">
            {!closed && showQuick && (
              <div className="mb-2 flex flex-col gap-0.5 rounded-2xl bg-surface-secondary p-1.5">
                {quickReplies.map((text) => (
                  <button
                    key={text}
                    type="button"
                    disabled={send.isPending}
                    onClick={() => submitReply(text)}
                    className="cursor-pointer rounded-xl px-3 py-2 text-left text-[13px] text-foreground transition-colors hover:bg-default"
                  >
                    {text}
                  </button>
                ))}
              </div>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submitReply(reply);
              }}
              className="flex items-end gap-2"
            >
              {!closed && (
                <button
                  type="button"
                  onClick={() => setShowQuick((v) => !v)}
                  className={`grid size-11 shrink-0 cursor-pointer place-items-center rounded-2xl ${
                    showQuick ? 'bg-default text-foreground' : 'text-muted hover:bg-surface-secondary hover:text-foreground'
                  }`}
                  aria-label="Quick replies"
                  title="Quick replies"
                >
                  <Lightning size={18} weight="duotone" />
                </button>
              )}
              <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    submitReply(reply);
                  }
                }}
                rows={1}
                placeholder={closed ? 'Reply to reopen this ticket…' : 'Type a message…'}
                className="scroll-thin max-h-32 min-h-11 flex-1 resize-none rounded-2xl bg-field px-4 py-3 text-[14px] text-foreground outline-none placeholder:text-field-placeholder focus:ring-2 focus:ring-secondary/40"
              />
              <AppButton
                type="submit"
                variant="brand"
                isIconOnly
                aria-label="Send reply"
                isDisabled={!reply.trim() || send.isPending}
                startContent={<PaperPlaneRight weight="fill" />}
              />
            </form>
            {mine && !closed && !isActiveSos(ticket) && (
              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setResolving(true)}
                  className="inline-flex cursor-pointer items-center gap-1 text-[12px] text-muted hover:text-foreground"
                >
                  <CheckCircle size={14} /> Resolve ticket
                </button>
              </div>
            )}
            {mine && closed && (
              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  disabled={setStatus.isPending}
                  onClick={() => setStatus.mutate({ status: 'in_progress' })}
                  className="cursor-pointer text-[12px] text-muted hover:text-foreground"
                >
                  Reopen ticket
                </button>
              </div>
            )}
          </Can>
        )}
      </div>
    </div>
  );
}
