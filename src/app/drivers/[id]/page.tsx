'use client';

// src/app/drivers/[id]/page.tsx
// Phase 1.3: Driver Profile & Dossier Deep-Dive
// Features:
// - Comprehensive driver dossier (personal, vehicle, rating tier, wallet balances)
// - Document verification status and inspection summary
// - Suspension management (Soft / Hard suspension and Unsuspend action)
// - Revoke verification status (`unverifyDriverSchema`)
// - Recent trips ledger with fare and status
// - Compliance audit trail of actions taken on this driver

import React, { Suspense, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  ArrowLeft,
  User,
  Phone,
  EnvelopeSimple,
  CalendarBlank,
  Star,
  Wallet,
  Car,
  WarningOctagon,
  ShieldCheck,
  ShieldWarning,
  CheckCircle,
  XCircle,
  ClockCounterClockwise,
  Path,
  ArrowsClockwise,
  CurrencyNgn,
  SealCheck,
} from '@phosphor-icons/react';
import { Card, Chip, Modal, Alert } from '@heroui/react';
import { AppButton } from '@/components/ui/app-button';
import { AppInput } from '@/components/ui/app-input';
import { AppTextarea } from '@/components/ui/app-textarea';
import { PermissionGuard, Can, usePermission } from '@/components/auth/can';
import { AppRowActions } from '@/components/ui/app-row-actions';
import { DashboardCard, StatDashboardCard } from '@/components/ui/dashboard-card';
import { DriverKycPanel } from '@/components/drivers/driver-kyc-panel';
import { DriverLocationIntegrityCard } from '@/components/drivers/driver-location-integrity-card';
import { EmailStatusPill, KycStatusPill, kycStatusOf } from '@/components/drivers/verification-pills';
import { UserAvatar } from '@/components/ui/user-avatar';
import { DetailList, EmptyState, Page, PageHeader, SectionHeader, StatusPill } from '@/components/ui/page';
import { api } from '@/lib/api';
import { applyApiFormError } from '@/lib/errors';
import { formatKoboToNaira } from '@/lib/utils';
import { capitalise, formatDate, formatDateTime, formatDob } from '@/lib/format';
import { AdminDriverDetail } from '@/types/admin';
import {
  suspendDriverSchema,
  unsuspendDriverSchema,
  unverifyDriverSchema,
  type SuspendDriverInput,
  type UnsuspendDriverInput,
  type UnverifyDriverInput,
} from '@/lib/schemas/admin.schemas';

interface DriverProfile {
  gender: string | null;
  dateOfBirth: string | null;
  drivingCity: string | null;
  address: string | null;
  licenseNumber: string | null;
  licenseExpiry: string | null;
  referralCode: string | null;
  referredBy: string | null;
  authProvider: string;
  emailVerifiedAt: string | null;
  phoneVerifiedAt: string | null;
  onboardingCompletedAt: string | null;
  kycSubmittedAt: string | null;
  acceptanceRate: number;
  cancellationCount24h: number;
  bank: { bankName: string; accountName: string; isVerified: boolean } | null;
  completedTrips: number;
  cancelledTrips: number;
  lifetimeEarningsKobo: number;
}

function DriverDetailContent() {
  const routeParams = useParams<{ id: string }>();
  const driverId = routeParams?.id ?? '';
  const queryClient = useQueryClient();
  const canUnverify = usePermission('unverify_driver');

  // Modals state
  const [isSuspendOpen, setIsSuspendOpen] = useState(false);
  const [isUnsuspendOpen, setIsUnsuspendOpen] = useState(false);
  const [isUnverifyOpen, setIsUnverifyOpen] = useState(false);
  const [modalAlert, setModalAlert] = useState<string | null>(null);

  // ── Query: Driver Dossier ───────────────────────────────────────────
  const { data, isLoading, refetch } = useQuery<{ driver: AdminDriverDetail }>({
    queryKey: ['admin', 'driver', driverId],
    queryFn: async () => {
      const res = await api.get<{ data: { driver: AdminDriverDetail } }>(
        `/admin/drivers/${driverId}`,
      );
      return res.data?.data;
    },
  });

  const driver = data?.driver;

  // ── Query: Personal + account details ──
  const { data: profile } = useQuery<DriverProfile>({
    queryKey: ['admin', 'driver', driverId, 'profile'],
    queryFn: async () =>
      (await api.get<{ data: { profile: DriverProfile } }>(`/admin/drivers/${driverId}/profile`)).data.data.profile,
    enabled: Boolean(driverId),
  });

  const personal = (
    driver?.onboardingState as { stages?: { personal?: { data?: Record<string, string> } } } | null | undefined
  )?.stages?.personal?.data;

  // ── Forms ───────────────────────────────────────────────────────────
  const suspendForm = useForm<SuspendDriverInput>({
    resolver: zodResolver(suspendDriverSchema),
    defaultValues: { reason: '', type: 'soft' },
  });

  const unsuspendForm = useForm<UnsuspendDriverInput>({
    resolver: zodResolver(unsuspendDriverSchema),
    defaultValues: { reason: '' },
  });

  const unverifyForm = useForm<UnverifyDriverInput>({
    resolver: zodResolver(unverifyDriverSchema),
    defaultValues: { reason: '' },
  });

  // ── Mutations ───────────────────────────────────────────────────────
  const suspendMutation = useMutation({
    mutationFn: async (payload: SuspendDriverInput) => {
      const res = await api.put(`/admin/drivers/${driverId}/suspend`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'driver', driverId] });
      setIsSuspendOpen(false);
      suspendForm.reset();
      setModalAlert(null);
    },
    onError: (err) => {
      applyApiFormError(err, {
        setError: suspendForm.setError,
        setFormError: setModalAlert,
      });
    },
  });

  const unsuspendMutation = useMutation({
    mutationFn: async (payload: UnsuspendDriverInput) => {
      const res = await api.put(`/admin/drivers/${driverId}/unsuspend`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'driver', driverId] });
      setIsUnsuspendOpen(false);
      unsuspendForm.reset();
      setModalAlert(null);
    },
  });

  const unverifyMutation = useMutation({
    mutationFn: async (payload: UnverifyDriverInput) => {
      const res = await api.put(`/admin/drivers/${driverId}/unverify`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'driver', driverId] });
      setIsUnverifyOpen(false);
      unverifyForm.reset();
      setModalAlert(null);
    },
    onError: (err) => {
      applyApiFormError(err, {
        setError: unverifyForm.setError,
        setFormError: setModalAlert,
      });
    },
  });

  if (isLoading || !driver) {
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

  const isAvailable = driver.status === 'AVAILABLE';

  return (
    <PermissionGuard permission="view_drivers">
      <Page>
          <PageHeader
            back={
              <Link href="/drivers" className="inline-flex items-center gap-1 hover:text-foreground">
                <ArrowLeft size={14} /> Drivers
              </Link>
            }
            leading={
              <UserAvatar
                src={driver.avatarUrl || driver.selfieUrl}
                name={`${driver.firstname} ${driver.lastname}`}
                size="lg"
              />
            }
            title={`${driver.firstname} ${driver.lastname}`}
            badge={
              <div className="flex items-center gap-1.5">
                <StatusPill tone={driver.isSuspended ? 'danger' : isAvailable ? 'success' : 'neutral'} dot>
                  {driver.isSuspended ? 'Suspended' : isAvailable ? 'Available' : driver.status === 'IN_TRIP' ? 'In trip' : driver.status === 'BACKGROUND' ? 'In background' : 'Offline'}
                </StatusPill>
                <EmailStatusPill verified={driver.emailVerified ?? driver.isVerified} />
                <KycStatusPill status={kycStatusOf(driver)} />
              </div>
            }
            description={`Joined ${new Date(driver.createdAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}`}
            actions={
              <>
                {driver.kycVerified && canUnverify && (
                  <AppRowActions
                    size="md"
                    items={[
                      {
                        key: 'revoke',
                        label: 'Revoke KYC approval',
                        icon: <XCircle size={14} />,
                        danger: true,
                        onClick: () => {
                          setModalAlert(null);
                          unverifyForm.reset({ reason: '' });
                          setIsUnverifyOpen(true);
                        },
                      },
                    ]}
                  />
                )}
                {driver.isSuspended ? (
                  <Can permission="unsuspend_driver">
                    <AppButton
                      variant="brand"
                      startContent={<ShieldCheck />}
                      label="Lift suspension"
                      onPress={() => {
                        setModalAlert(null);
                        unsuspendForm.reset({ reason: '' });
                        setIsUnsuspendOpen(true);
                      }}
                    />
                  </Can>
                ) : (
                  <Can permission="suspend_driver">
                    <AppButton
                      variant="tertiary"
                      startContent={<WarningOctagon />}
                      label="Suspend"
                      onPress={() => {
                        setModalAlert(null);
                        suspendForm.reset({ reason: '', type: 'soft' });
                        setIsSuspendOpen(true);
                      }}
                    />
                  </Can>
                )}
              </>
            }
          />

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
            <StatDashboardCard
              label="Wallet"
              icon={Wallet}
              variant="wallet"
              value={formatKoboToNaira(driver.walletBalance)}
              hint={`${formatKoboToNaira(driver.bonusBalance)} bonus`}
            />
            <StatDashboardCard
              label="Lifetime earnings"
              icon={CurrencyNgn}
              value={profile ? formatKoboToNaira(profile.lifetimeEarningsKobo) : '—'}
              hint={`${formatKoboToNaira(driver.outstandingFees)} owed to Kero`}
            />
            <StatDashboardCard
              label="Trips"
              icon={Path}
              value={(profile?.completedTrips ?? driver.totalTrips ?? 0).toLocaleString()}
              hint={
                profile
                  ? `${profile.cancelledTrips ?? 0} cancelled · ${Math.round((profile.acceptanceRate ?? 1) * 100)}% acceptance`
                  : 'Completed'
              }
            />
            <StatDashboardCard
              label="Rating"
              icon={Star}
              value={Number(driver.rating ?? 0).toFixed(1)}
              hint={`${driver.ratingCount ?? 0} reviews · ${driver.tier ?? 'New'} tier`}
            />
          </div>

          <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-3">
            <DashboardCard>
              <SectionHeader title="Personal" />
              <DetailList
                className="mt-5"
                items={[
                  { label: 'Phone', value: driver.phone ?? '—' },
                  {
                    label: 'Email',
                    value: (
                      <span className="inline-flex items-center gap-1.5">
                        {driver.email}
                        {profile?.emailVerifiedAt && <SealCheck size={14} weight="fill" className="text-success" />}
                      </span>
                    ),
                  },
                  { label: 'Gender', value: capitalise(profile?.gender ?? personal?.gender) },
                  { label: 'Date of birth', value: formatDob(profile?.dateOfBirth ?? personal?.dateOfBirth) },
                  { label: 'City', value: profile?.drivingCity ?? personal?.drivingCity ?? '—' },
                  { label: 'Address', value: profile?.address ?? '—' },
                ]}
              />
            </DashboardCard>

            <DashboardCard>
              <SectionHeader title="Account" />
              <DetailList
                className="mt-5"
                items={[
                  { label: 'Joined', value: formatDate(driver.createdAt) },
                  { label: 'Last seen', value: driver.isOnline ? 'Online now' : formatDateTime(driver.lastSeenAt) },
                  { label: 'Onboarded', value: formatDate(profile?.onboardingCompletedAt) },
                  { label: 'KYC submitted', value: formatDate(profile?.kycSubmittedAt ?? driver.kycSubmittedAt) },
                  { label: 'Sign-in', value: profile?.authProvider === 'google' ? 'Google' : profile ? 'Email & password' : '—' },
                  { label: 'Referral code', value: profile?.referralCode ?? '—' },
                  { label: 'Referred by', value: profile?.referredBy ?? '—' },
                  {
                    label: 'Payout bank',
                    value: profile?.bank ? `${profile.bank.bankName} · ${profile.bank.accountName}` : 'Not added',
                  },
                ]}
              />
            </DashboardCard>

            <DashboardCard>
              <SectionHeader title="Vehicle & licence" />
              <DetailList
                className="mt-5"
                items={[
                  { label: 'Vehicle', value: driver.vehicle ? `${driver.vehicle.model} · ${driver.vehicle.year}` : 'None assigned' },
                  { label: 'Colour', value: driver.vehicle?.color ?? '—' },
                  { label: 'Plate', value: driver.vehicle?.licensePlate ?? '—' },
                  { label: 'Class', value: driver.vehicle?.vehicleType?.name ?? '—' },
                  { label: 'Licence no.', value: profile?.licenseNumber ?? '—' },
                  { label: 'Licence expiry', value: formatDate(profile?.licenseExpiry) },
                  { label: 'Cancels (24h)', value: profile ? String(profile.cancellationCount24h) : '—' },
                ]}
              />
            </DashboardCard>
          </div>

          <DriverKycPanel kyc={driver.kyc} driverId={driver.id} />
          <DriverLocationIntegrityCard driverId={driver.id} />

          <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
            <DashboardCard>
              <SectionHeader title="Recent trips" />
              <ul className="mt-4">
                {!driver.recentTrips || driver.recentTrips.length === 0 ? (
                  <EmptyState icon={Path} title="No trips yet" className="py-8" />
                ) : (
                  driver.recentTrips.map((trip) => (
                    <li key={trip.id}>
                      <Link
                        href={`/trips/${trip.id}`}
                        className="-mx-2 flex items-center justify-between gap-3 rounded-2xl px-2 py-2.5 transition-colors hover:bg-surface-secondary"
                      >
                        <div>
                          <span className="tabular text-[14px] font-medium text-foreground">{trip.id.slice(0, 8)}</span>
                          <p className="tabular text-xs text-muted">{formatDateTime(trip.createdAt)}</p>
                        </div>
                        <div className="text-right">
                          <span className="tabular text-[14px] font-medium text-foreground">{formatKoboToNaira(trip.fareKobo)}</span>
                          <p className="text-xs capitalize text-muted">{trip.status.toLowerCase().replace(/_/g, ' ')}</p>
                        </div>
                      </Link>
                    </li>
                  ))
                )}
              </ul>
            </DashboardCard>

            <DashboardCard>
              <SectionHeader title="Admin activity" />
              <ul className="mt-4 space-y-3">
                {!driver.recentActions || driver.recentActions.length === 0 ? (
                  <EmptyState icon={ClockCounterClockwise} title="No changes yet" className="py-8" />
                ) : (
                  driver.recentActions.map((action) => (
                    <li key={action.id} className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <span className="block truncate text-[14px] text-foreground">{action.action}</span>
                        <p className="tabular text-xs text-muted">{formatDateTime(action.createdAt)}</p>
                      </div>
                      <StatusPill tone={action.result === 'success' ? 'success' : 'danger'}>
                        <span className="capitalize">{action.result}</span>
                      </StatusPill>
                    </li>
                  ))
                )}
              </ul>
            </DashboardCard>
          </div>

          {/* ── MODAL: Suspend Driver ─────────────────────────────────── */}
          {isSuspendOpen && (
            <Modal>
              <Modal.Backdrop
                isOpen={isSuspendOpen}
                onOpenChange={(open) => !open && setIsSuspendOpen(false)}
              >
                <Modal.Container placement="center" size="md">
                  <Modal.Dialog className="rounded-3xl bg-overlay p-7 w-full max-w-md">
                    <Modal.Header className="flex items-start justify-between gap-4 pb-2">
                      <Modal.Heading className="text-[18px] font-bold tracking-[-0.02em] text-foreground">
                        Suspend Driver Account
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
                        id="suspend-form"
                        onSubmit={suspendForm.handleSubmit((d) => suspendMutation.mutate(d))}
                        className="flex flex-col gap-4"
                      >
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[13px] font-medium text-foreground select-none">
                            Suspension Severity <span className="text-danger">*</span>
                          </label>
                          <select
                            {...suspendForm.register('type')}
                            className="w-full h-11 rounded-xl border border-field-border bg-field text-foreground px-3.5 text-sm outline-none focus:border-focus focus:ring-1 focus:ring-focus/30 transition-colors"
                          >
                            <option value="soft">Soft Suspension</option>
                            <option value="hard">Hard Suspension (Blocks App Access)</option>
                          </select>
                        </div>

                        <AppInput
                          label="Duration in Hours (Optional)"
                          placeholder="e.g. 48 for 2 days"
                          type="number"
                          errorMessage={suspendForm.formState.errors.durationHours?.message}
                          {...suspendForm.register('durationHours', { valueAsNumber: true })}
                        />

                        <AppTextarea
                          label="Official Reason"
                          placeholder="Document justification for suspension..."
                          isRequired
                          rows={3}
                          errorMessage={suspendForm.formState.errors.reason?.message}
                          {...suspendForm.register('reason')}
                        />
                      </form>
                    </Modal.Body>

                    <Modal.Footer className="flex items-center justify-end gap-2 pt-2">
                      <AppButton
                        variant="tertiary"
                        label="Cancel"
                        onPress={() => setIsSuspendOpen(false)}
                      />
                      <AppButton
                        variant="danger"
                        type="submit"
                        form="suspend-form"
                        label={suspendMutation.isPending ? 'Suspending...' : 'Confirm'}
                        isLoading={suspendMutation.isPending}
                      />
                    </Modal.Footer>
                  </Modal.Dialog>
                </Modal.Container>
              </Modal.Backdrop>
            </Modal>
          )}

          {/* ── MODAL: Unsuspend Driver ───────────────────────────────── */}
          {isUnsuspendOpen && (
            <Modal>
              <Modal.Backdrop
                isOpen={isUnsuspendOpen}
                onOpenChange={(open) => !open && setIsUnsuspendOpen(false)}
              >
                <Modal.Container placement="center" size="md">
                  <Modal.Dialog className="rounded-3xl bg-overlay p-7 w-full max-w-md">
                    <Modal.Header className="flex items-start justify-between gap-4 pb-2">
                      <Modal.Heading className="text-[18px] font-bold tracking-[-0.02em] text-foreground">
                        Lift Suspension
                      </Modal.Heading>
                    </Modal.Header>

                    <Modal.Body className="py-4 flex flex-col gap-4">
                      <form
                        id="unsuspend-form"
                        onSubmit={unsuspendForm.handleSubmit((d) => unsuspendMutation.mutate(d))}
                        className="flex flex-col gap-4"
                      >
                        <AppTextarea
                          label="Notes / Reason for Reinstatement (Optional)"
                          placeholder="e.g. Driver presented corrected documentation or resolved grievance..."
                          rows={3}
                          {...unsuspendForm.register('reason')}
                        />
                      </form>
                    </Modal.Body>

                    <Modal.Footer className="flex items-center justify-end gap-2 pt-2">
                      <AppButton
                        variant="tertiary"
                        label="Cancel"
                        onPress={() => setIsUnsuspendOpen(false)}
                      />
                      <AppButton
                        variant="primary"
                        type="submit"
                        form="unsuspend-form"
                        label={unsuspendMutation.isPending ? 'Reinstating...' : 'Lift Suspension'}
                        isLoading={unsuspendMutation.isPending}
                      />
                    </Modal.Footer>
                  </Modal.Dialog>
                </Modal.Container>
              </Modal.Backdrop>
            </Modal>
          )}

          {/* ── MODAL: Revoke KYC (Unverify) ─────────────────────────── */}
          {isUnverifyOpen && (
            <Modal>
              <Modal.Backdrop
                isOpen={isUnverifyOpen}
                onOpenChange={(open) => !open && setIsUnverifyOpen(false)}
              >
                <Modal.Container placement="center" size="md">
                  <Modal.Dialog className="rounded-3xl bg-overlay p-7 w-full max-w-md">
                    <Modal.Header className="flex items-start justify-between gap-4 pb-2">
                      <Modal.Heading className="text-[18px] font-bold tracking-[-0.02em] text-foreground">
                        Revoke KYC Verification
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
                        id="unverify-form"
                        onSubmit={unverifyForm.handleSubmit((d) => unverifyMutation.mutate(d))}
                        className="flex flex-col gap-4"
                      >
                        <AppTextarea
                          label="Reason for Revoking Verification"
                          placeholder="Document why this driver must re-submit verification..."
                          isRequired
                          rows={3}
                          errorMessage={unverifyForm.formState.errors.reason?.message}
                          {...unverifyForm.register('reason')}
                        />
                      </form>
                    </Modal.Body>

                    <Modal.Footer className="flex items-center justify-end gap-2 pt-2">
                      <AppButton
                        variant="tertiary"
                        label="Cancel"
                        onPress={() => setIsUnverifyOpen(false)}
                      />
                      <AppButton
                        variant="danger"
                        type="submit"
                        form="unverify-form"
                        label={unverifyMutation.isPending ? 'Revoking...' : 'Revoke Verification'}
                        isLoading={unverifyMutation.isPending}
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

export default function DriverDetailPage() {
  return (
    <Suspense
        fallback={
          <div className="flex min-h-[400px] items-center justify-center">
            <span className="text-sm text-muted animate-pulse">Loading driver dossier...</span>
          </div>
        }
      >
        <DriverDetailContent />
      </Suspense>
  );
}
