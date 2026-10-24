'use client';

// src/app/riders/[id]/page.tsx
// Phase 1.5: Passenger (Rider) Profile & Moderation Deep-Dive
// Features:
// - Passenger biographical profile, wallet ledger in ₦, bonus balances, and trip counts
// - Cash payment restriction moderation (`toggleCashSchema`)
// - Passenger ride history ledger with route and fare details
// - Built on HeroUI v3 compound Modal, AppInput, AppTextarea, AppButton, and Satoshi tokens

import React, { Suspense, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  ArrowLeft,
  UsersThree,
  User,
  Phone,
  EnvelopeSimple,
  Wallet,
  Star,
  Path,
  Money,
  MapPin,
  WarningOctagon,
  ShieldCheck,
  CheckCircle,
  XCircle,
  ArrowsClockwise,
  SealCheck,
} from '@phosphor-icons/react';
import { Card, Chip, Modal, Alert } from '@heroui/react';
import { AppButton } from '@/components/ui/app-button';
import { AppTextarea } from '@/components/ui/app-textarea';
import { PermissionGuard, Can } from '@/components/auth/can';
import { DashboardCard, StatDashboardCard } from '@/components/ui/dashboard-card';
import { UserAvatar } from '@/components/ui/user-avatar';
import { DetailList, EmptyState, Page, PageHeader, SectionHeader, StatusPill } from '@/components/ui/page';
import { api } from '@/lib/api';
import { applyApiFormError } from '@/lib/errors';
import { formatKoboToNaira } from '@/lib/utils';
import { formatDate, formatDateTime } from '@/lib/format';
import { AdminRiderDetail } from '@/types/admin';
import {
  toggleCashSchema,
  type ToggleCashInput,
} from '@/lib/schemas/admin.schemas';

interface RiderProfile {
  address: string | null;
  referralCode: string | null;
  referredBy: string | null;
  authProvider: string;
  emailVerifiedAt: string | null;
  phoneVerifiedAt: string | null;
  onboardingCompletedAt: string | null;
  emergencyContacts: number;
  savedPlaces: number;
  completedTrips: number;
  cancelledTrips: number;
  lifetimeSpendKobo: number;
  lastTripAt: string | null;
}

interface RiderTrip {
  id: string;
  status: string;
  fareKobo: number;
  pickupAddress: string;
  destAddress: string;
  createdAt: string;
}

function RiderDetailContent() {
  const routeParams = useParams<{ id: string }>();
  const riderId = routeParams?.id ?? '';
  const queryClient = useQueryClient();

  const [isCashModalOpen, setIsCashModalOpen] = useState(false);
  const [modalAlert, setModalAlert] = useState<string | null>(null);

  // ── Query: Rider Profile ────────────────────────────────────────────
  const { data, isLoading, refetch } = useQuery<{ rider: AdminRiderDetail }>({
    queryKey: ['admin', 'rider', riderId],
    queryFn: async () => {
      try {
        const res = await api.get<{ data: { rider: AdminRiderDetail } }>(
          `/admin/riders/${riderId}`,
        );
        if (res.data?.data?.rider) {
          return res.data.data;
        }
      } catch (err: any) {
        // Fallback to searching rider list if direct endpoint returned 404
      }

      // Fallback: search /admin/riders?search=${riderId}
      const listRes = await api.get<{ data: { riders: any[] } }>(
        `/admin/riders?search=${encodeURIComponent(riderId)}&limit=1`,
      );
      const matched = listRes.data?.data?.riders?.[0];
      if (matched) {
        const fallbackRider: AdminRiderDetail = {
          id: matched.id ?? riderId,
          fullname: matched.fullname ?? 'Passenger Account',
          email: matched.email ?? null,
          phone: matched.phone ?? null,
          isVerified: matched.isVerified ?? true,
          isSuspended: matched.isSuspended ?? false,
          cashPaymentBlocked: matched.cashPaymentBlocked ?? matched.isCashBlocked ?? false,
          walletBalance: matched.walletBalance ?? matched.walletBalanceKobo ?? 0,
          bonusBalance: matched.bonusBalance ?? matched.bonusBalanceKobo ?? 0,
          riderRating: matched.riderRating ?? matched.rating ?? 5.0,
          riderRatingCount: matched.riderRatingCount ?? 1,
          totalTrips: matched.totalTrips ?? 0,
          createdAt: matched.createdAt ?? new Date().toISOString(),
          recentTrips: [],
        };
        return { rider: fallbackRider };
      }
      throw new Error('Passenger not found');
    },
  });

  const rider = data?.rider;

  // ── Query: Personal details + recent trips ──
  const { data: extras } = useQuery<{ profile: RiderProfile; recentTrips: RiderTrip[] }>({
    queryKey: ['admin', 'rider', riderId, 'profile'],
    queryFn: async () =>
      (await api.get<{ data: { profile: RiderProfile; recentTrips: RiderTrip[] } }>(`/admin/riders/${riderId}/profile`)).data
        .data,
    enabled: Boolean(riderId),
  });
  const profile = extras?.profile;
  const recentTrips: RiderTrip[] = extras?.recentTrips ?? [];

  // ── Form: Toggle Cash ───────────────────────────────────────────────
  const cashForm = useForm<ToggleCashInput>({
    resolver: zodResolver(toggleCashSchema),
    defaultValues: {
      blocked: true,
      reason: '',
    },
  });

  const toggleCashMutation = useMutation({
    mutationFn: async (payload: ToggleCashInput) => {
      const res = await api.put(`/admin/riders/${riderId}/toggle-cash`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'rider', riderId] });
      setIsCashModalOpen(false);
      cashForm.reset();
      setModalAlert(null);
    },
    onError: (err) => {
      applyApiFormError(err, {
        setError: cashForm.setError,
        setFormError: setModalAlert,
      });
    },
  });

  if (isLoading) {
    return (
      <Page>
        <div className="h-20 w-72 animate-pulse rounded-2xl bg-surface" />
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-36 animate-pulse rounded-3xl bg-surface" />
          ))}
        </div>
      </Page>
    );
  }

  if (!rider) {
    return (
      <Page>
        <DashboardCard>
          <EmptyState
            icon={UsersThree}
            title="Rider not found"
            description="This profile doesn't exist or couldn't be loaded."
            action={
              <Link href="/riders">
                <AppButton variant="tertiary" label="Back to riders" />
              </Link>
            }
          />
        </DashboardCard>
      </Page>
    );
  }

  return (
    <PermissionGuard permission="view_riders">
      <Page>
          <PageHeader
            back={
              <Link href="/riders" className="inline-flex items-center gap-1 hover:text-foreground">
                <ArrowLeft size={14} /> Riders
              </Link>
            }
            leading={<UserAvatar src={rider.avatarUrl || rider.profileImage} name={rider.fullname} size="lg" />}
            title={rider.fullname ?? 'Passenger'}
            badge={
              <div className="flex items-center gap-1.5">
                <StatusPill tone={rider.isSuspended ? 'danger' : 'success'} dot>
                  {rider.isSuspended ? 'Suspended' : 'Active'}
                </StatusPill>
                {rider.cashPaymentBlocked && <StatusPill tone="warning">Cash blocked</StatusPill>}
              </div>
            }
            description={`Member since ${new Date(rider.createdAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}`}
            actions={
              <Can permission="suspend_rider">
                <AppButton
                  variant="tertiary"
                  startContent={<Money />}
                  label={rider.cashPaymentBlocked ? 'Allow cash' : 'Block cash'}
                  onPress={() => {
                    setModalAlert(null);
                    cashForm.reset({ blocked: !rider.cashPaymentBlocked, reason: '' });
                    setIsCashModalOpen(true);
                  }}
                />
              </Can>
            }
          />

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
            <StatDashboardCard
              label="Wallet"
              icon={Wallet}
              variant="wallet"
              value={formatKoboToNaira(rider.walletBalance)}
              hint={`${formatKoboToNaira(rider.bonusBalance)} bonus`}
            />
            <StatDashboardCard
              label="Lifetime spend"
              icon={Money}
              value={profile ? formatKoboToNaira(profile.lifetimeSpendKobo) : '—'}
              hint="On completed trips"
            />
            <StatDashboardCard
              label="Trips"
              icon={Path}
              value={(profile?.completedTrips ?? rider.totalTrips ?? 0).toLocaleString()}
              hint={profile ? `${profile.cancelledTrips ?? 0} cancelled` : 'Completed'}
            />
            <StatDashboardCard
              label="Rating"
              icon={Star}
              value={Number(rider.riderRating ?? 0).toFixed(1)}
              hint={`${rider.riderRatingCount ?? 0} driver ratings`}
            />
          </div>

          <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-3">
            <DashboardCard>
              <SectionHeader title="Personal" />
              <DetailList
                className="mt-5"
                items={[
                  {
                    label: 'Phone',
                    value: (
                      <span className="inline-flex items-center gap-1.5">
                        {rider.phone ?? '—'}
                        {profile?.phoneVerifiedAt && <SealCheck size={14} weight="fill" className="text-success" />}
                      </span>
                    ),
                  },
                  {
                    label: 'Email',
                    value: (
                      <span className="inline-flex items-center gap-1.5">
                        {rider.email ?? '—'}
                        {profile?.emailVerifiedAt && <SealCheck size={14} weight="fill" className="text-success" />}
                      </span>
                    ),
                  },
                  { label: 'Address', value: profile?.address ?? '—' },
                  { label: 'Emergency contacts', value: profile ? String(profile.emergencyContacts) : '—' },
                  { label: 'Saved places', value: profile ? String(profile.savedPlaces) : '—' },
                ]}
              />
            </DashboardCard>

            <DashboardCard>
              <SectionHeader title="Account" />
              <DetailList
                className="mt-5"
                items={[
                  { label: 'Joined', value: formatDate(rider.createdAt) },
                  { label: 'Last trip', value: formatDateTime(profile?.lastTripAt) },
                  { label: 'Onboarded', value: formatDate(profile?.onboardingCompletedAt) },
                  { label: 'Sign-in', value: profile?.authProvider === 'google' ? 'Google' : profile ? 'Email & password' : '—' },
                  { label: 'Referral code', value: profile?.referralCode ?? '—' },
                  { label: 'Referred by', value: profile?.referredBy ?? '—' },
                  { label: 'Payments', value: rider.cashPaymentBlocked ? 'Wallet & card only' : 'Cash, wallet & card' },
                  { label: 'Rider ID', value: rider.id },
                ]}
              />
            </DashboardCard>

            <DashboardCard>
              <SectionHeader title="Recent trips" />
              <ul className="mt-4">
                {recentTrips.length === 0 ? (
                  <EmptyState icon={Path} title="No trips yet" className="py-8" />
                ) : (
                  recentTrips.map((trip) => (
                    <li key={trip.id}>
                      <Link
                        href={`/trips/${trip.id}`}
                        className="-mx-2 flex items-center justify-between gap-3 rounded-2xl px-2 py-2.5 transition-colors hover:bg-surface-secondary"
                      >
                        <div className="min-w-0">
                          <span className="block truncate text-[14px] font-medium text-foreground">{trip.destAddress}</span>
                          <p className="tabular text-xs text-muted">{formatDateTime(trip.createdAt)}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <span className="tabular text-[14px] font-medium text-foreground">{formatKoboToNaira(trip.fareKobo)}</span>
                          <p className="text-xs capitalize text-muted">{trip.status.toLowerCase().replace(/_/g, ' ')}</p>
                        </div>
                      </Link>
                    </li>
                  ))
                )}
              </ul>
            </DashboardCard>
          </div>

          {/* ── MODAL: Toggle Cash Payment Block ──────────────────────── */}
          {isCashModalOpen && (
            <Modal>
              <Modal.Backdrop
                isOpen={isCashModalOpen}
                onOpenChange={(open) => !open && setIsCashModalOpen(false)}
              >
                <Modal.Container placement="center" size="md">
                  <Modal.Dialog className="rounded-3xl bg-overlay p-7 w-full max-w-md">
                    <Modal.Header className="flex items-start justify-between gap-4 pb-2">
                      <Modal.Heading className="text-[18px] font-bold tracking-[-0.02em] text-foreground">
                        {rider.cashPaymentBlocked
                          ? 'Unblock Cash Payments'
                          : 'Block Cash Payments'}
                      </Modal.Heading>
                    </Modal.Header>

                    <Modal.Body className="py-4 flex flex-col gap-4">
                      {modalAlert && (
                        <Alert status="danger">
                          <Alert.Indicator />
                          <Alert.Content>
                            <Alert.Title>{modalAlert}</Alert.Title>
                          </Alert.Content>
                        </Alert>
                      )}

                      <form
                        id="toggle-cash-detail-form"
                        onSubmit={cashForm.handleSubmit((d) => toggleCashMutation.mutate(d))}
                        className="flex flex-col gap-4"
                      >
                        <p className="text-[13px] text-muted">
                          {!rider.cashPaymentBlocked
                            ? 'Blocking cash will force this rider to pay with digital methods (Wallet or Card) only. A documented reason is required.'
                            : 'Unblocking cash allows this passenger to pay with physical cash again.'}
                        </p>

                        {!rider.cashPaymentBlocked && (
                          <AppTextarea
                            label="Reason for Blocking Cash"
                            placeholder="Provide details on outstanding dispute, fake notes, or driver complaint..."
                            isRequired
                            rows={3}
                            errorMessage={cashForm.formState.errors.reason?.message}
                            {...cashForm.register('reason')}
                          />
                        )}
                      </form>
                    </Modal.Body>

                    <Modal.Footer className="flex items-center justify-end gap-2 pt-2">
                      <AppButton
                        variant="tertiary"
                        label="Cancel"
                        onPress={() => setIsCashModalOpen(false)}
                      />
                      <AppButton
                        variant={rider.cashPaymentBlocked ? 'primary' : 'danger'}
                        type="submit"
                        form="toggle-cash-detail-form"
                        label={
                          toggleCashMutation.isPending
                            ? 'Updating...'
                            : rider.cashPaymentBlocked
                            ? 'Unblock Cash'
                            : 'Block Cash'
                        }
                        isLoading={toggleCashMutation.isPending}
                      />
                    </Modal.Footer>
                  </Modal.Dialog>
                </Modal.Container>
              </Modal.Backdrop>
            </Modal>
          )}
        </Page>
      </PermissionGuard>
  );
}

export default function RiderDetailPage() {
  return (
    <Suspense
        fallback={
          <div className="flex min-h-[400px] items-center justify-center">
            <span className="text-sm text-muted animate-pulse">Loading passenger profile...</span>
          </div>
        }
      >
        <RiderDetailContent />
      </Suspense>
  );
}
