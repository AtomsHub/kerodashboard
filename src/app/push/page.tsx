'use client';

// src/app/push/page.tsx
// Phase 6: Targeted Push Broadcast Campaigns & Automated Passenger Engagement
import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Bell,
  PaperPlaneTilt,
  Plus,
  ArrowClockwise,
  Pause,
  Play,
  Trash,
  Clock,
  CheckCircle,
  Eye,
  Users,
  DeviceMobile,
  Megaphone,
  CaretLeft,
  CalendarCheck,
  ShieldCheck,
  DotsThreeVertical,
  PencilSimple,
} from '@phosphor-icons/react';
import { Card, Chip, Modal, Dropdown } from '@heroui/react';
import { toast } from 'sonner';
import { AppButton } from '@/components/ui/app-button';
import { AppInput } from '@/components/ui/app-input';
import { AppTextarea } from '@/components/ui/app-textarea';
import { PermissionGuard, Can, usePermission } from '@/components/auth/can';
import { AppRowActions } from '@/components/ui/app-row-actions';
import { DashboardCard, StatDashboardCard } from '@/components/ui/dashboard-card';
import { DetailList, EmptyState, Page, PageHeader, SectionHeader, Segmented, SkeletonRows, StatusPill } from '@/components/ui/page';
import { AppModal } from '@/components/ui/app-modal';
import { api } from '@/lib/api';
import { applyApiFormError } from '@/lib/errors';
import { PushCampaignItem } from '@/types/admin';
import {
  createPushCampaignSchema,
  type CreatePushCampaignInput,
} from '@/lib/schemas/admin.schemas';

/** ISO -> value for <input type="datetime-local"> in local time. */
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const STATUS: Record<string, { label: string; tone?: 'success' | 'warning' | 'danger' }> = {
  sent: { label: 'Sent', tone: 'success' },
  scheduled: { label: 'Scheduled', tone: 'warning' },
  sending: { label: 'Sending', tone: 'warning' },
  paused: { label: 'Paused' },
  failed: { label: 'Failed', tone: 'danger' },
  draft: { label: 'Draft' },
};

export default function PushNotificationsPage() {
  const canDelete = usePermission('delete_push_notification');
  const canEdit = usePermission('edit_push_notification');
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [composeStep, setComposeStep] = useState<1 | 2>(1);
  const [sendLater, setSendLater] = useState(false);
  const [scheduleValue, setScheduleValue] = useState('');
  // Campaign being edited (or re-sent); null when composing a new one.
  const [editing, setEditing] = useState<PushCampaignItem | null>(null);
  const isResend = Boolean(editing && ['sent', 'failed'].includes(editing.status.toLowerCase()));

  // ── Query: Push Campaigns ───────────────────────────────────────────
  const {
    data: campaignsData,
    isLoading,
    refetch,
    isFetching,
  } = useQuery<PushCampaignItem[]>({
    queryKey: ['admin', 'push-notifications'],
    queryFn: async () => {
      try {
        const res = await api.get<{ data: { campaigns: PushCampaignItem[] } | PushCampaignItem[] }>(
          '/admin/push-notifications',
        );
        const raw = res.data?.data;
        if (raw && !Array.isArray(raw) && Array.isArray(raw.campaigns)) return raw.campaigns;
        if (Array.isArray(raw)) return raw;
      } catch (err) {
        throw err;
      }
      return [];
    },
  });

  // ── Form State ──────────────────────────────────────────────────────
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    watch,
    setError,
    setValue,
    trigger,
  } = useForm<CreatePushCampaignInput>({
    resolver: zodResolver(createPushCampaignSchema) as any,
    defaultValues: {
      title: '',
      body: '',
      targetAudience: 'all',
    },
  });

  const audience = watch('targetAudience') as 'all' | 'riders' | 'drivers';
  const previewTitle = watch('title') || 'Your title';
  const previewBody = watch('body') || 'Your message appears here.';

  // ── Mutation: Create Campaign ───────────────────────────────────────
  const createCampaignMutation = useMutation({
    mutationFn: async (values: CreatePushCampaignInput) => {
      if (editing) {
        // A time (or null = now) puts it back in the send queue.
        const res = await api.put(`/admin/push-notifications/${editing.id}`, {
          title: values.title,
          body: values.body,
          targetAudience: values.targetAudience,
          scheduledAt: sendLater && values.scheduledAt ? values.scheduledAt : null,
        });
        return res.data;
      }
      const res = await api.post('/admin/push-notifications', values);
      return res.data;
    },
    onSuccess: () => {
      toast.success(editing ? (sendLater ? 'Campaign updated' : 'Sending now') : sendLater ? 'Campaign scheduled' : 'Sending now');
      setIsModalOpen(false);
      setEditing(null);
      reset();
      refetch();
    },
    onError: (err: any) => {
      applyApiFormError(err, { setError });
    },
  });

  // ── Mutation: Pause Campaign ────────────────────────────────────────
  const pauseMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.put(`/admin/push-notifications/${id}/pause`);
      return res.data;
    },
    onSuccess: () => {
      toast.info('Campaign paused.');
      refetch();
    },
    onError: (err: any) => {
      toast.error(`Failed to pause campaign: ${err?.message || 'Error'}`);
    },
  });

  // ── Mutation: Resume Campaign ───────────────────────────────────────
  const resumeMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.put(`/admin/push-notifications/${id}/resume`);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Campaign resumed.');
      refetch();
    },
    onError: (err: any) => {
      toast.error(`Failed to resume campaign: ${err?.message || 'Error'}`);
    },
  });

  // ── Mutation: Delete Campaign ───────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(`/admin/push-notifications/${id}`);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Campaign deleted.');
      refetch();
    },
    onError: (err: any) => {
      toast.error(`Failed to delete campaign: ${err?.message || 'Error'}`);
    },
  });

  const onSubmit = (values: any) => {
    createCampaignMutation.mutate(values as CreatePushCampaignInput);
  };
  const submit = () => void handleSubmit(onSubmit)();
  const goNext = async () => {
    if (await trigger(['title', 'body'])) setComposeStep(2);
  };

  /** Open the composer: blank, editing a campaign, or re-sending a sent one. */
  const openCompose = (camp?: PushCampaignItem) => {
    const audienceOf = (a?: string) => (a === 'riders' || a === 'drivers' ? a : 'all');
    const future = camp?.scheduledAt && new Date(camp.scheduledAt).getTime() > Date.now() ? camp.scheduledAt : null;
    reset({
      title: camp?.title ?? '',
      body: camp?.body ?? '',
      targetAudience: audienceOf(camp?.targetAudience),
      scheduledAt: future ?? undefined,
    });
    setEditing(camp ?? null);
    setSendLater(Boolean(future));
    setScheduleValue(future ? toLocalInput(future) : '');
    setComposeStep(1);
    setIsModalOpen(true);
  };

  const campaigns = campaignsData || [];
  const totalDelivered = campaigns.reduce((acc, c) => acc + c.deliveredCount, 0);
  const totalOpened = campaigns.reduce((acc, c) => acc + c.openedCount, 0);
  const averageOpenRate = totalDelivered > 0 ? `${((totalOpened / totalDelivered) * 100).toFixed(1)}%` : '—';

  return (
    <PermissionGuard permission="view_push_notifications">
      <Page>
          <PageHeader
            title="Push campaigns"
            description="Notifications sent to riders and drivers."
            actions={
              <>
                <AppButton variant="tertiary" isIconOnly aria-label="Refresh" startContent={<ArrowClockwise />} onPress={() => refetch()} />
                <Can permission="create_push_notification">
                  <AppButton
                    variant="brand"
                    startContent={<PaperPlaneTilt />}
                    label="New campaign"
                    onPress={() => openCompose()}
                  />
                </Can>
              </>
            }
          />

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <StatDashboardCard label="Campaigns" icon={Megaphone} variant="wallet" value={campaigns.length} hint="All time" />
            <StatDashboardCard label="Delivered" icon={CheckCircle} value={totalDelivered.toLocaleString()} hint="iOS and Android" />
            <StatDashboardCard label="Open rate" icon={Eye} value={averageOpenRate} hint="Average across campaigns" />
            <StatDashboardCard
              label="Scheduled"
              icon={Clock}
              value={campaigns.filter((c) => c.status.toLowerCase() === 'scheduled').length}
              hint="Waiting to send"
            />
          </div>

          <DashboardCard className="overflow-hidden p-0">
            <SectionHeader className="p-6 pb-4" title="Campaigns" />

            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Message</th>
                    <th>Audience</th>
                    <th>When</th>
                    <th>Recipients</th>
                    <th>Opens</th>
                    <th>Status</th>
                    <th className="w-12" />
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <SkeletonRows cols={7} />
                  ) : (campaignsData?.length ?? 0) === 0 ? (
                    <tr>
                      <td colSpan={7}>
                        <EmptyState icon={Bell} title="No campaigns yet" description="Send your first push to riders or drivers." />
                      </td>
                    </tr>
                  ) : (
                    campaignsData?.map((camp) => {
                      const when = camp.sentAt ?? camp.scheduledAt;
                      const st = camp.status.toLowerCase();
                      const pill = STATUS[st] ?? { label: st };
                      return (
                        <tr key={camp.id}>
                          <td className="max-w-sm">
                            <div className="truncate font-medium text-foreground">{camp.title}</div>
                            <div className="truncate text-xs text-muted">{camp.body}</div>
                          </td>
                          <td className="capitalize text-foreground">{camp.targetAudience}</td>
                          <td className="tabular whitespace-nowrap text-muted">
                            {when
                              ? new Date(when).toLocaleDateString('en-NG', {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : 'Instant'}
                          </td>
                          <td className="tabular text-foreground">{camp.totalRecipients.toLocaleString()}</td>
                          <td>
                            {camp.deliveredCount > 0 ? (
                              <div>
                                <div className="tabular font-medium text-foreground">
                                  {((camp.openedCount / camp.deliveredCount) * 100).toFixed(1)}%
                                </div>
                                <div className="tabular text-xs text-muted">{camp.openedCount} opens</div>
                              </div>
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </td>
                          <td>
<StatusPill tone={pill.tone}>{pill.label}</StatusPill>
                          </td>
                          <td className="text-right">
                            <AppRowActions
                              items={[
                                ...(canEdit && (st === 'sent' || st === 'failed')
                                  ? [{ key: 'resend', label: 'Send again', icon: <ArrowClockwise size={14} />, onClick: () => openCompose(camp) }]
                                  : []),
                                ...(canEdit && ['scheduled', 'paused', 'draft'].includes(st)
                                  ? [{ key: 'edit', label: 'Edit', icon: <PencilSimple size={14} />, onClick: () => openCompose(camp) }]
                                  : []),
                                ...(st === 'scheduled'
                                  ? [{ key: 'pause', label: 'Pause', icon: <Pause size={14} />, onClick: () => pauseMutation.mutate(camp.id) }]
                                  : []),
                                ...(st === 'paused'
                                  ? [{ key: 'resume', label: 'Resume', icon: <Play size={14} />, onClick: () => resumeMutation.mutate(camp.id) }]
                                  : []),
                                ...(st !== 'sending'
                                  ? [
                                      {
                                        key: 'delete',
                                        label: 'Delete',
                                        icon: <Trash size={14} />,
                                        danger: true,
                                        disabled: !canDelete,
                                        onClick: () => {
                                          if (confirm(`Delete "${camp.title}"?`)) deleteMutation.mutate(camp.id);
                                        },
                                      },
                                    ]
                                  : []),
                              ]}
                            />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </DashboardCard>

          {/* ════════════════════════════════════════════════════════════════
              MODAL: COMPOSE PUSH CAMPAIGN (Centered Compound)
             ════════════════════════════════════════════════════════════════ */}
          <AppModal
            isOpen={isModalOpen}
            onOpenChange={(open) => {
              if (!open) {
                setIsModalOpen(false);
                setEditing(null);
              }
            }}
            title={composeStep === 1 ? (isResend ? 'Send again' : editing ? 'Edit campaign' : 'New campaign') : 'Who and when'}
            description={composeStep === 1 ? 'Write the notification.' : 'Choose the audience and send time.'}
            step={{ current: composeStep, total: 2 }}
            onSubmit={(e) => {
              // Enter key: step 1 moves on, step 2 sends. Buttons never submit implicitly.
              e.preventDefault();
              if (composeStep === 1) void goNext();
              else submit();
            }}
            footer={
              composeStep === 1 ? (
                <>
                  <AppButton variant="tertiary" type="button" label="Cancel" onPress={() => setIsModalOpen(false)} />
                  <AppButton
                    variant="brand"
                    type="button"
                    label="Next"
                    onPress={() => void goNext()}
                  />
                </>
              ) : (
                <>
                  <AppButton variant="tertiary" type="button" label="Back" onPress={() => setComposeStep(1)} />
                  <AppButton
                    variant="brand"
                    type="button"
                    onPress={submit}
                    label={sendLater ? (editing && !isResend ? 'Save' : 'Schedule') : 'Send now'}
                    isLoading={isSubmitting || createCampaignMutation.isPending}
                  />
                </>
              )
            }
          >
            {composeStep === 1 ? (
              <>
                <AppInput
                  label="Title"
                  isRequired
                  placeholder="e.g. Rain in Ikeja — book early"
                  {...register('title')}
                  errorMessage={errors.title?.message}
                />
                <AppTextarea
                  label="Message"
                  isRequired
                  placeholder="Keep it short and clear"
                  rows={3}
                  {...register('body')}
                  errorMessage={errors.body?.message}
                />
                <div className="rounded-2xl bg-surface-secondary p-4">
                  <p className="mb-2 text-xs text-muted">Preview</p>
                  <div className="rounded-2xl bg-surface p-3.5">
                    <div className="flex items-center justify-between text-[11px] text-muted">
                      <span className="flex items-center gap-1.5 font-bold text-foreground">
                        <span className="grid size-4 place-items-center rounded-md bg-secondary text-[10px] font-black text-secondary-foreground">
                          K
                        </span>
                        Kero
                      </span>
                      <span>now</span>
                    </div>
                    <p className="mt-1.5 text-[13px] font-bold text-foreground">{previewTitle}</p>
                    <p className="line-clamp-2 text-xs text-muted">{previewBody}</p>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="flex flex-col gap-2">
                  <span className="text-[13px] font-medium text-foreground">Audience</span>
                  <Segmented
                    size="sm"
                    aria-label="Audience"
                    value={audience}
                    onChange={(key) => setValue('targetAudience', key)}
                    options={[
                      { key: 'all', label: 'Everyone' },
                      { key: 'riders', label: 'Riders' },
                      { key: 'drivers', label: 'Drivers' },
                    ]}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <span className="text-[13px] font-medium text-foreground">Send</span>
                  <Segmented
                    size="sm"
                    aria-label="Send time"
                    value={sendLater ? 'later' : 'now'}
                    onChange={(key) => {
                      setSendLater(key === 'later');
                      if (key === 'now') {
                        setValue('scheduledAt', undefined);
                        setScheduleValue('');
                      }
                    }}
                    options={[
                      { key: 'now', label: 'Now' },
                      { key: 'later', label: 'Schedule' },
                    ]}
                  />
                </div>

                {sendLater && (
                  <AppInput
                    label="Date and time"
                    type="datetime-local"
                    isRequired
                    min={toLocalInput(new Date().toISOString())}
                    value={scheduleValue}
                    onChange={(e) => {
                      setScheduleValue(e.target.value);
                      setValue('scheduledAt', e.target.value ? new Date(e.target.value).toISOString() : undefined);
                    }}
                    errorMessage={errors.scheduledAt?.message}
                  />
                )}

                <DetailList
                  className="rounded-2xl bg-surface-secondary p-4"
                  items={[
                    { label: 'Title', value: previewTitle },
                    { label: 'Audience', value: audience === 'all' ? 'Everyone' : audience === 'riders' ? 'Riders' : 'Drivers' },
                  ]}
                />
              </>
            )}
          </AppModal>
        </Page>
    </PermissionGuard>
  );
}
