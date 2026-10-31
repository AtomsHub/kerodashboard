'use client';

// src/app/rewards/page.tsx
// Referral programmes (/admin/referral/config/:role) and milestone rewards
// (/admin/rewards, paid by the rewards:auto-award job).

import React, { useState } from 'react';
import { useMutation, useQueries } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { ArrowClockwise, CurrencyNgn, Gift, PencilSimple, ShieldCheck, UsersThree } from '@phosphor-icons/react';
import { AppButton } from '@/components/ui/app-button';
import { AppInput } from '@/components/ui/app-input';
import { MoneyInput } from '@/components/ui/money-input';
import { AppModal } from '@/components/ui/app-modal';
import { DashboardCard, StatDashboardCard } from '@/components/ui/dashboard-card';
import { DetailList, Page, PageHeader, SectionHeader, StatusPill } from '@/components/ui/page';
import { PermissionGuard, Can } from '@/components/auth/can';
import { api } from '@/lib/api';
import { applyApiFormError } from '@/lib/errors';
import { formatKoboToNaira } from '@/lib/utils';
import { ReferralConfigDto } from '@/types/admin';
import { MilestonesCard } from '@/components/rewards/milestones-card';
import { updateReferralConfigSchema, type UpdateReferralConfigInput } from '@/lib/schemas/admin.schemas';

type Role = 'rider' | 'driver';
const ROLES: Role[] = ['rider', 'driver'];
const ROLE_LABEL: Record<Role, string> = { rider: 'Riders', driver: 'Drivers' };

function Switch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full p-0.5 transition-colors ${
        checked ? 'bg-secondary' : 'bg-default'
      }`}
    >
      <span className={`size-5 rounded-full bg-surface transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  );
}

export default function RewardsPage() {
  const [editing, setEditing] = useState<Role | null>(null);

  const results = useQueries({
    queries: ROLES.map((role) => ({
      queryKey: ['admin', 'referral', 'config', role],
      queryFn: async () => (await api.get<{ data: ReferralConfigDto }>(`/admin/referral/config/${role}`)).data.data,
    })),
  });
  const configs: Record<Role, ReferralConfigDto | undefined> = { rider: results[0].data, driver: results[1].data };
  const isLoading = results.some((r) => r.isLoading);
  const isFetching = results.some((r) => r.isFetching);

  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<UpdateReferralConfigInput>({ resolver: zodResolver(updateReferralConfigSchema) });

  const saveMutation = useMutation({
    mutationFn: async (values: UpdateReferralConfigInput) => {
      await api.put(`/admin/referral/config/${editing}`, values);
    },
    onSuccess: () => {
      toast.success('Referral programme saved');
      results.forEach((r) => r.refetch());
      setEditing(null);
    },
    onError: (err) => applyApiFormError(err, { setError }),
  });

  const openEditor = (role: Role) => {
    const c = configs[role];
    if (!c) return;
    reset({
      isActive: c.isActive,
      referrerRewardValueKobo: c.referrerRewardValueKobo,
      referredRewardValueKobo: c.referredRewardValueKobo,
      minTripsForUnlock: c.minTripsForUnlock,
      unlockWindowDays: c.unlockWindowDays,
      requireUniqueDevice: c.requireUniqueDevice,
      requireUniqueBankAccount: c.requireUniqueBankAccount,
    });
    setEditing(role);
  };

  const reward = (type: string | undefined, kobo: number | undefined) =>
    type === 'NONE' ? 'None' : type === 'PERCENTAGE' ? `${(kobo ?? 0) / 100}%` : formatKoboToNaira(kobo);

  return (
    <PermissionGuard permission="view_referral_config">
      <Page>
        <PageHeader
          title="Rewards"
          description="Referral bonuses for riders and drivers."
          actions={
            <AppButton
              variant="tertiary"
              isIconOnly
              aria-label="Refresh"
              startContent={<ArrowClockwise className={isFetching ? 'animate-spin' : ''} />}
              onPress={() => results.forEach((r) => r.refetch())}
            />
          }
        />

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <StatDashboardCard
            label="Rider referral"
            icon={Gift}
            variant="wallet"
            loading={isLoading}
            value={reward(configs.rider?.referrerRewardType, configs.rider?.referrerRewardValueKobo)}
            hint={`After ${configs.rider?.minTripsForUnlock ?? '—'} trip(s) by the new rider`}
          />
          <StatDashboardCard
            label="Driver referral"
            icon={CurrencyNgn}
            loading={isLoading}
            value={reward(configs.driver?.referrerRewardType, configs.driver?.referrerRewardValueKobo)}
            hint={`After ${configs.driver?.minTripsForUnlock ?? '—'} trip(s) by the new driver`}
          />
          <StatDashboardCard
            label="Programmes live"
            icon={UsersThree}
            loading={isLoading}
            value={ROLES.filter((r) => configs[r]?.isActive).length}
            hint="Of 2"
          />
          <StatDashboardCard
            label="Device checks"
            icon={ShieldCheck}
            loading={isLoading}
            value={ROLES.filter((r) => configs[r]?.requireUniqueDevice).length === 2 ? 'On' : 'Partial'}
            hint="One device per account"
          />
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {ROLES.map((role) => {
            const c = configs[role];
            return (
              <DashboardCard key={role}>
                <SectionHeader
                  title={ROLE_LABEL[role]}
                  description={c ? `Updated ${new Date(c.updatedAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}` : undefined}
                  actions={
                    <>
                      {c && <StatusPill tone={c.isActive ? 'success' : 'neutral'} dot>{c.isActive ? 'Live' : 'Paused'}</StatusPill>}
                      <Can permission="manage_referral_config">
                        <AppButton
                          size="sm"
                          variant="tertiary"
                          startContent={<PencilSimple />}
                          label="Edit"
                          isDisabled={!c}
                          onPress={() => openEditor(role)}
                        />
                      </Can>
                    </>
                  }
                />
                {c ? (
                  <DetailList
                    className="mt-5"
                    items={[
                      { label: 'Referrer gets', value: reward(c.referrerRewardType, c.referrerRewardValueKobo) },
                      { label: 'New user gets', value: reward(c.referredRewardType, c.referredRewardValueKobo) },
                      { label: 'Unlocks after', value: `${c.minTripsForUnlock} trip(s)` },
                      { label: 'Within', value: c.unlockWindowDays ? `${c.unlockWindowDays} days` : 'No limit' },
                      { label: 'Max referrals per user', value: c.maxReferralsPerUser ? String(c.maxReferralsPerUser) : 'No limit' },
                      { label: 'One device per account', value: c.requireUniqueDevice ? 'Yes' : 'No' },
                      { label: 'One bank account per user', value: c.requireUniqueBankAccount ? 'Yes' : 'No' },
                    ]}
                  />
                ) : (
                  <div className="mt-5 h-48 animate-pulse rounded-2xl bg-surface-secondary" />
                )}
              </DashboardCard>
            );
          })}
        </div>

        <MilestonesCard />

        <AppModal
          isOpen={editing !== null}
          onOpenChange={(open) => !open && setEditing(null)}
          title={editing ? `${ROLE_LABEL[editing]} referrals` : ''}
          description="Changes apply to new referrals."
          onSubmit={handleSubmit((v) => saveMutation.mutate(v))}
          footer={
            <>
              <AppButton variant="tertiary" type="button" label="Cancel" onPress={() => setEditing(null)} />
              <AppButton variant="brand" type="submit" label="Save" isLoading={saveMutation.isPending} />
            </>
          }
        >
          <Controller
            control={control}
            name="isActive"
            render={({ field }) => (
              <div className="flex items-center justify-between">
                <span className="text-[14px] font-medium text-foreground">Programme live</span>
                <Switch checked={Boolean(field.value)} onChange={field.onChange} />
              </div>
            )}
          />
          <Controller
            control={control}
            name="referrerRewardValueKobo"
            render={({ field }) => (
              <MoneyInput label="Referrer reward" valueKobo={field.value} onChangeKobo={(k) => field.onChange(k ?? 0)} errorMessage={errors.referrerRewardValueKobo?.message} />
            )}
          />
          <Controller
            control={control}
            name="referredRewardValueKobo"
            render={({ field }) => (
              <MoneyInput label="New user reward" valueKobo={field.value} onChangeKobo={(k) => field.onChange(k ?? 0)} errorMessage={errors.referredRewardValueKobo?.message} />
            )}
          />
          <Controller
            control={control}
            name="minTripsForUnlock"
            render={({ field }) => (
              <AppInput
                label="Trips to unlock"
                type="number"
                value={field.value ?? ''}
                onChange={(e) => field.onChange(e.target.value === '' ? undefined : Number(e.target.value))}
                errorMessage={errors.minTripsForUnlock?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="unlockWindowDays"
            render={({ field }) => (
              <AppInput
                label="Days to complete (0 = no limit)"
                type="number"
                value={field.value ?? ''}
                onChange={(e) => field.onChange(e.target.value === '' ? undefined : Number(e.target.value))}
                errorMessage={errors.unlockWindowDays?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="requireUniqueDevice"
            render={({ field }) => (
              <div className="flex items-center justify-between">
                <span className="text-[14px] text-foreground">One device per account</span>
                <Switch checked={Boolean(field.value)} onChange={field.onChange} />
              </div>
            )}
          />
          <Controller
            control={control}
            name="requireUniqueBankAccount"
            render={({ field }) => (
              <div className="flex items-center justify-between">
                <span className="text-[14px] text-foreground">One bank account per user</span>
                <Switch checked={Boolean(field.value)} onChange={field.onChange} />
              </div>
            )}
          />
        </AppModal>
      </Page>
    </PermissionGuard>
  );
}
