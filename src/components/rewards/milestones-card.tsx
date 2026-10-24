'use client';

// src/components/rewards/milestones-card.tsx
// Milestone rewards (backend /admin/rewards). A reward with a trip goal is
// paid automatically by the `rewards:auto-award` job every 15 minutes:
// wallet credit + an inbox/push notice, once per rider or driver.

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Flag, PencilSimple, Plus, Trash } from '@phosphor-icons/react';
import { AppButton } from '@/components/ui/app-button';
import { AppInput } from '@/components/ui/app-input';
import { AppModal } from '@/components/ui/app-modal';
import { AppRowActions } from '@/components/ui/app-row-actions';
import { DashboardCard } from '@/components/ui/dashboard-card';
import { EmptyState, SectionHeader, Segmented, StatusPill } from '@/components/ui/page';
import { Can, usePermission } from '@/components/auth/can';
import { api } from '@/lib/api';
import { formatKoboToNaira } from '@/lib/utils';

type Audience = 'riders' | 'drivers' | 'both';

interface Criteria {
  minTrips?: number;
  tripsInWindow?: number;
  minRating?: number;
  signupDaysAgoMin?: number;
  autoAward?: boolean;
}

interface Reward {
  id: string;
  name: string;
  description: string | null;
  type: string;
  targetAudience: Audience;
  amountKobo: number | null;
  eligibilityCriteria: Criteria | null;
  isActive: boolean;
  startsAt: string;
  endsAt: string | null;
}

interface Form {
  name: string;
  description: string;
  audience: Audience;
  amount: string;
  trips: string;
  count: 'window' | 'lifetime';
  minRating: string;
  minDays: string;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
}

const toLocal = (iso: string) => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

const blank = (): Form => ({
  name: '',
  description: '',
  audience: 'drivers',
  amount: '',
  trips: '',
  count: 'window',
  minRating: '',
  minDays: '',
  startsAt: toLocal(new Date().toISOString()),
  endsAt: '',
  isActive: true,
});

function fromReward(r: Reward): Form {
  const c = r.eligibilityCriteria ?? {};
  return {
    name: r.name,
    description: r.description ?? '',
    audience: r.targetAudience,
    amount: r.amountKobo ? String(r.amountKobo / 100) : '',
    trips: String(c.tripsInWindow ?? c.minTrips ?? ''),
    count: c.tripsInWindow ? 'window' : 'lifetime',
    minRating: c.minRating !== undefined ? String(c.minRating) : '',
    minDays: c.signupDaysAgoMin !== undefined ? String(c.signupDaysAgoMin) : '',
    startsAt: toLocal(r.startsAt),
    endsAt: r.endsAt ? toLocal(r.endsAt) : '',
    isActive: r.isActive,
  };
}

/** One-line summary of the conditions. */
function describe(r: Reward): string {
  const c = r.eligibilityCriteria ?? {};
  const parts: string[] = [];
  if (c.tripsInWindow) parts.push(`${c.tripsInWindow} trips in period`);
  else if (c.minTrips) parts.push(`${c.minTrips} trips total`);
  if (c.minRating !== undefined) parts.push(`${c.minRating}★+`);
  if (c.signupDaysAgoMin !== undefined) parts.push(`${c.signupDaysAgoMin}+ days old`);
  return parts.join(' · ') || 'No conditions';
}

export function MilestonesCard() {
  const queryClient = useQueryClient();
  const canDelete = usePermission('delete_reward');
  const canEdit = usePermission('edit_reward');
  const [editing, setEditing] = useState<Reward | 'new' | null>(null);
  const [form, setForm] = useState<Form>(blank);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  const { data: rewards, isLoading } = useQuery<Reward[]>({
    queryKey: ['admin', 'rewards'],
    queryFn: async () => (await api.get<{ data: Reward[] }>('/admin/rewards?includeInactive=true')).data.data,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin', 'rewards'] });

  const save = useMutation({
    mutationFn: async () => {
      const trips = Number(form.trips);
      const amount = Number(form.amount);
      if (!form.name.trim()) throw new Error('Add a name.');
      if (!(amount > 0)) throw new Error('Add a reward amount.');
      if (!(trips > 0)) throw new Error('Add a trip goal.');
      if (form.count === 'window' && !form.endsAt) throw new Error('A "during this period" goal needs an end date.');
      const criteria: Criteria = {
        ...(form.count === 'window' ? { tripsInWindow: trips } : { minTrips: trips }),
        ...(form.minRating ? { minRating: Number(form.minRating) } : {}),
        ...(form.minDays ? { signupDaysAgoMin: Number(form.minDays) } : {}),
        autoAward: true,
      };
      const body = {
        name: form.name.trim(),
        ...(form.description.trim() ? { description: form.description.trim() } : {}),
        type: 'wallet_credit',
        targetAudience: form.audience,
        amountKobo: Math.round(amount * 100),
        eligibilityCriteria: criteria,
        isActive: form.isActive,
        startsAt: new Date(form.startsAt).toISOString(),
      };
      if (editing && editing !== 'new') {
        await api.put(`/admin/rewards/${editing.id}`, {
          ...body,
          endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
        });
      } else {
        await api.post('/admin/rewards', {
          ...body,
          ...(form.endsAt ? { endsAt: new Date(form.endsAt).toISOString() } : {}),
        });
      }
    },
    onSuccess: () => {
      toast.success(editing === 'new' ? 'Milestone created' : 'Milestone saved');
      setEditing(null);
      refresh();
    },
    onError: (err: any) => setError(err?.response?.data?.error?.message ?? err?.message ?? 'Could not save'),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => api.delete(`/admin/rewards/${id}`),
    onSuccess: () => {
      toast.success('Milestone turned off');
      refresh();
    },
    onError: (err: any) => toast.error(err?.response?.data?.error?.message ?? 'Could not remove'),
  });

  const open = (r?: Reward) => {
    setForm(r ? fromReward(r) : blank());
    setError(null);
    setEditing(r ?? 'new');
  };

  const now = Date.now();
  const stateOf = (r: Reward) =>
    !r.isActive
      ? { label: 'Off' as const }
      : new Date(r.startsAt).getTime() > now
        ? { label: 'Upcoming' as const, tone: 'warning' as const }
        : r.endsAt && new Date(r.endsAt).getTime() < now
          ? { label: 'Ended' as const }
          : { label: 'Live' as const, tone: 'success' as const };

  return (
    <DashboardCard className="overflow-hidden p-0">
      <div className="flex items-start justify-between gap-3 p-6 pb-4">
        <SectionHeader title="Milestones" description="Paid automatically when the goal is met" />
        <Can permission="create_reward">
          <AppButton variant="brand" size="sm" startContent={<Plus />} label="New milestone" onPress={() => open()} />
        </Can>
      </div>
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Milestone</th>
              <th>For</th>
              <th>Goal</th>
              <th>Reward</th>
              <th>Ends</th>
              <th>Status</th>
              <th className="w-12" />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7}>
                  <div className="h-24 animate-pulse rounded-2xl bg-surface-secondary" />
                </td>
              </tr>
            ) : !rewards?.length ? (
              <tr>
                <td colSpan={7}>
                  <EmptyState icon={Flag} title="No milestones yet" />
                </td>
              </tr>
            ) : (
              rewards.map((r) => {
                const st = stateOf(r);
                return (
                  <tr key={r.id}>
                    <td className="max-w-xs">
                      <div className="truncate font-medium text-foreground">{r.name}</div>
                      {r.description && <div className="truncate text-xs text-muted">{r.description}</div>}
                    </td>
                    <td className="capitalize text-foreground">{r.targetAudience === 'both' ? 'Everyone' : r.targetAudience}</td>
                    <td className="text-muted">{describe(r)}</td>
                    <td className="tabular text-foreground">{r.amountKobo ? formatKoboToNaira(r.amountKobo) : '—'}</td>
                    <td className="tabular whitespace-nowrap text-muted">
                      {r.endsAt ? new Date(r.endsAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' }) : 'No end'}
                    </td>
                    <td>
                      <StatusPill tone={st.tone}>{st.label}</StatusPill>
                    </td>
                    <td className="text-right">
                      <AppRowActions
                        items={[
                          ...(canEdit ? [{ key: 'edit', label: 'Edit', icon: <PencilSimple size={14} />, onClick: () => open(r) }] : []),
                          ...(r.isActive
                            ? [
                                {
                                  key: 'off',
                                  label: 'Turn off',
                                  icon: <Trash size={14} />,
                                  danger: true,
                                  disabled: !canDelete,
                                  onClick: () => {
                                    if (confirm(`Turn off "${r.name}"? People already paid keep their reward.`)) remove.mutate(r.id);
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

      <AppModal
        isOpen={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        title={editing === 'new' ? 'New milestone' : 'Edit milestone'}
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          save.mutate();
        }}
        footer={
          <>
            <AppButton variant="tertiary" type="button" label="Cancel" onPress={() => setEditing(null)} />
            <AppButton variant="brand" type="submit" label="Save" isLoading={save.isPending} />
          </>
        }
      >
        <AppInput label="Name" isRequired placeholder="e.g. Weekend 20" value={form.name} onChange={(e) => set('name', e.target.value)} />
        <AppInput label="Description" placeholder="Optional" value={form.description} onChange={(e) => set('description', e.target.value)} />
        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-medium text-foreground">For</span>
          <Segmented
            size="sm"
            aria-label="Audience"
            value={form.audience}
            onChange={(k) => set('audience', k)}
            options={[
              { key: 'drivers', label: 'Drivers' },
              { key: 'riders', label: 'Riders' },
              { key: 'both', label: 'Everyone' },
            ]}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <AppInput label="Trip goal" type="number" min={1} isRequired value={form.trips} onChange={(e) => set('trips', e.target.value)} />
          <AppInput label="Reward (₦)" type="number" min={1} isRequired value={form.amount} onChange={(e) => set('amount', e.target.value)} />
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-medium text-foreground">Count trips</span>
          <Segmented
            size="sm"
            aria-label="Count trips"
            value={form.count}
            onChange={(k) => set('count', k)}
            options={[
              { key: 'window', label: 'During this period' },
              { key: 'lifetime', label: 'All time' },
            ]}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <AppInput label="Starts" type="datetime-local" isRequired value={form.startsAt} onChange={(e) => set('startsAt', e.target.value)} />
          <AppInput label="Ends" type="datetime-local" value={form.endsAt} onChange={(e) => set('endsAt', e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <AppInput
            label="Min rating"
            type="number"
            step="0.1"
            min={0}
            max={5}
            placeholder="Any"
            value={form.minRating}
            onChange={(e) => set('minRating', e.target.value)}
          />
          <AppInput
            label="Min account age (days)"
            type="number"
            min={0}
            placeholder="Any"
            value={form.minDays}
            onChange={(e) => set('minDays', e.target.value)}
          />
        </div>
        <label className="flex cursor-pointer items-center justify-between rounded-2xl bg-surface-secondary px-4 py-3">
          <span className="text-[14px] text-foreground">Live</span>
          <input type="checkbox" className="size-4 accent-[var(--secondary)]" checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} />
        </label>
        {error && <p className="text-[13px] text-danger">{error}</p>}
      </AppModal>
    </DashboardCard>
  );
}
