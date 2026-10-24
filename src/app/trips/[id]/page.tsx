'use client';

// src/app/trips/[id]/page.tsx
// Phase 2: Trip Telematics, Locked Fare Breakdown, and Dispute Audit
import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Path,
  CaretLeft,
  ArrowClockwise,
  Prohibit,
  UserCheck,
  User,
  Car,
  MapPin,
  Clock,
  CurrencyNgn,
  ShieldCheck,
  CheckCircle,
  XCircle,
  Copy,
  Check,
  Siren,
  Star,
  Receipt,
  NavigationArrow,
  PhoneCall,
  Calendar,
  Timer,
  ArrowsClockwise,
  WarningCircle,
  ArrowLeft,
} from '@phosphor-icons/react';
import { Card, Chip, Modal, Alert } from '@heroui/react';
import { AppButton } from '@/components/ui/app-button';
import { AppInput } from '@/components/ui/app-input';
import { AppTextarea } from '@/components/ui/app-textarea';
import { PermissionGuard, Can, usePermission } from '@/components/auth/can';
import { AppRowActions } from '@/components/ui/app-row-actions';
import { DashboardCard } from '@/components/ui/dashboard-card';
import { TripRecord, type TripCheckpoint, type TripSosRecord } from '@/components/trips/trip-record';
import { UserAvatar } from '@/components/ui/user-avatar';
import { EmptyState, Page, PageHeader, SectionHeader, StatusPill } from '@/components/ui/page';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { TripMap, type TripPoint } from '@/components/trips/trip-map';
import { applyApiFormError } from '@/lib/errors';
import { AdminTripDetail } from '@/types/admin';
import {
  forceCancelSchema,
  assignDriverSchema,
  type ForceCancelInput,
  type AssignDriverInput,
} from '@/lib/schemas/admin.schemas';

interface TripTracking {
  trip: { polyline: string | null };
  isActive: boolean;
  driverTrail: TripPoint[];
  riderTrail: TripPoint[];
  driverLocation: TripPoint | null;
  riderLocation: TripPoint | null;
  checkpoints?: TripCheckpoint[];
  sosAlerts?: TripSosRecord[];
}

function TripDetailContent() {
  const params = useParams();
  const tripId = params.id as string;
  const router = useRouter();
  const queryClient = useQueryClient();
  const canCancel = usePermission('force_cancel_trip');

  const [copied, setCopied] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [cancelAlert, setCancelAlert] = useState<string | null>(null);
  const [assignAlert, setAssignAlert] = useState<string | null>(null);

  const copyTripId = () => {
    navigator.clipboard.writeText(tripId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Query: Trip Detail ─────────────────────────────────────────────
  const { data: trip, isLoading, refetch, isFetching } = useQuery<AdminTripDetail>({
    queryKey: ['admin', 'trips', tripId],
    queryFn: async () => {
      // First attempt backend trip detail route
      const res = await api.get<{ data: AdminTripDetail }>(`/trips/${tripId}`);
      return res.data?.data;
    },
    enabled: Boolean(tripId),
  });

  // ── Map: recorded breadcrumbs + last known positions ────────────────
  const tripIsActive = Boolean(trip && ['DRIVER_ASSIGNED', 'DRIVER_ARRIVING', 'IN_PROGRESS'].includes(trip.status));
  const { data: tracking } = useQuery<TripTracking>({
    queryKey: ['admin', 'trips', tripId, 'tracking'],
    queryFn: async () => (await api.get<{ data: TripTracking }>(`/admin/trips/${tripId}/tracking`)).data.data,
    enabled: Boolean(tripId),
    // Socket events keep markers live; this re-sync catches missed pings.
    refetchInterval: tripIsActive ? 30000 : false,
  });

  // ── Live positions from the admin live-watch socket room ────────────
  const [socketDriver, setSocketDriver] = useState<TripPoint | null>(null);
  const [socketRider, setSocketRider] = useState<TripPoint | null>(null);

  useEffect(() => {
    if (!tripId || !tripIsActive) return;
    const socket = getSocket();
    type LocationPayload = { tripId: string; latitude: number; longitude: number; heading?: number; timestamp?: number };
    const toPoint = (p: LocationPayload): TripPoint => ({
      lat: p.latitude,
      lng: p.longitude,
      heading: p.heading ?? null,
      timestamp: new Date(p.timestamp ?? Date.now()).toISOString(),
    });
    const onDriver = (p: LocationPayload) => {
      if (p?.tripId === tripId) setSocketDriver(toPoint(p));
    };
    const onRider = (p: LocationPayload) => {
      if (p?.tripId === tripId) setSocketRider(toPoint(p));
    };
    socket.on('admin:trip:location:update', onDriver);
    socket.on('admin:rider:location:update', onRider);
    return () => {
      socket.off('admin:trip:location:update', onDriver);
      socket.off('admin:rider:location:update', onRider);
    };
  }, [tripId, tripIsActive]);

  const liveDriver = socketDriver ?? tracking?.driverLocation ?? null;
  const liveRider = socketRider ?? tracking?.riderLocation ?? null;
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    if (!tripIsActive) return;
    const id = setInterval(() => setNowTick(Date.now()), 5000);
    return () => clearInterval(id);
  }, [tripIsActive]);
  const lastPingSeconds = liveDriver?.timestamp
    ? Math.max(0, Math.round((nowTick - new Date(liveDriver.timestamp).getTime()) / 1000))
    : null;
  const lastPingLabel =
    lastPingSeconds === null ? 'now' : lastPingSeconds < 60 ? `${lastPingSeconds}s ago` : `${Math.round(lastPingSeconds / 60)}m ago`;

  // ── Form: Force Cancel ──────────────────────────────────────────────
  const cancelForm = useForm<ForceCancelInput>({
    resolver: zodResolver(forceCancelSchema),
    defaultValues: {
      reason: '',
      cancelBy: 'system',
      waiveFee: true,
      refundRider: true,
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (payload: ForceCancelInput) => {
      const res = await api.post(`/admin/trips/${tripId}/force-cancel`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'trips', tripId] });
      setIsCancelModalOpen(false);
      cancelForm.reset();
      setCancelAlert(null);
    },
    onError: (err) => {
      applyApiFormError(err, {
        setError: cancelForm.setError,
        setFormError: setCancelAlert,
      });
    },
  });

  // ── Form: Assign Driver ────────────────────────────────────────────
  const assignForm = useForm<AssignDriverInput>({
    resolver: zodResolver(assignDriverSchema),
    defaultValues: {
      driverId: '',
      reason: 'Direct assignment from trip telematics review',
    },
  });

  const assignMutation = useMutation({
    mutationFn: async (payload: AssignDriverInput) => {
      const res = await api.post(`/admin/trips/${tripId}/assign`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'trips', tripId] });
      setIsAssignModalOpen(false);
      assignForm.reset();
      setAssignAlert(null);
    },
    onError: (err) => {
      applyApiFormError(err, {
        setError: assignForm.setError,
        setFormError: setAssignAlert,
      });
    },
  });

  const formatNaira = (kobo: number | null | undefined) => {
    if (kobo === null || kobo === undefined) return '₦0.00';
    return `₦${(kobo / 100).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const isActive = trip && ['SEARCHING', 'DRIVER_ASSIGNED', 'DRIVER_ARRIVING', 'IN_PROGRESS'].includes(trip.status);

  if (isLoading) {
    return (
      <Page>
        <div className="h-20 w-72 animate-pulse rounded-2xl bg-surface" />
        <div className="h-64 animate-pulse rounded-3xl bg-surface" />
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div className="h-80 animate-pulse rounded-3xl bg-surface" />
          <div className="h-80 animate-pulse rounded-3xl bg-surface" />
        </div>
      </Page>
    );
  }

  if (!trip) {
    return (
      <Page>
        <DashboardCard>
          <EmptyState
            icon={WarningCircle}
            title="Trip not found"
            description="This trip doesn't exist or couldn't be loaded."
            action={
              <Link href="/trips">
                <AppButton variant="tertiary" label="Back to trips" />
              </Link>
            }
          />
        </DashboardCard>
      </Page>
    );
  }

  const statusTone =
    trip.status === 'COMPLETED'
      ? 'success'
      : trip.status === 'CANCELLED'
        ? 'danger'
        : trip.status === 'IN_PROGRESS'
          ? 'accent'
          : 'warning';
  const time = (d?: string | Date | null) =>
    d ? new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';

  return (
    <Page>
      <PageHeader
        back={
          <Link href="/trips" className="inline-flex items-center gap-1 hover:text-foreground">
            <ArrowLeft size={14} /> Trips
          </Link>
        }
        title={trip.title || `Trip to ${trip.endAddress?.split(',')[0] || 'destination'}`}
        badge={
          <StatusPill tone={statusTone} dot pulse={trip.status === 'IN_PROGRESS'}>
            <span className="capitalize">{trip.status.toLowerCase().replace(/_/g, ' ')}</span>
          </StatusPill>
        }
        description={
          <span className="tabular inline-flex items-center gap-1.5">
            {trip.id}
            <button type="button" onClick={copyTripId} className="cursor-pointer text-muted hover:text-foreground" title="Copy trip ID">
              {copied ? <Check weight="bold" className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
            </button>
          </span>
        }
        actions={
          <>
            <AppButton
              variant="tertiary"
              isIconOnly
              aria-label="Refresh"
              onPress={() => refetch()}
              isDisabled={isFetching}
              startContent={<ArrowClockwise className={isFetching ? 'animate-spin' : ''} />}
            />
            {isActive && canCancel && (
              <AppRowActions
                size="md"
                items={[
                  {
                    key: 'cancel',
                    label: 'Cancel trip',
                    icon: <Prohibit size={14} />,
                    danger: true,
                    onClick: () => setIsCancelModalOpen(true),
                  },
                ]}
              />
            )}
            {(!trip.driverId || trip.status === 'SEARCHING') && (
              <Can permission="force_cancel_trip">
                <AppButton variant="brand" startContent={<UserCheck />} label="Assign driver" onPress={() => setIsAssignModalOpen(true)} />
              </Can>
            )}
          </>
        }
      />

      <DashboardCard>
        <div className="flex flex-col gap-5 lg:flex-row">
          <div className="relative h-[360px] flex-1 overflow-hidden rounded-2xl bg-surface-secondary lg:h-[420px]">
            <TripMap
              start={{ lat: trip.startLat, lng: trip.startLng }}
              end={{ lat: trip.endLat, lng: trip.endLng }}
              polyline={tracking?.trip.polyline ?? trip.polyline}
              driverTrail={tracking?.driverTrail ?? []}
              riderTrail={tracking?.riderTrail ?? []}
              driverLocation={liveDriver}
              riderLocation={liveRider}
              follow={Boolean(isActive && liveDriver)}
            />

            <div className="pointer-events-none absolute bottom-4 left-4 z-[500] flex max-w-[80%] flex-col gap-2">
              <div className="rounded-2xl bg-surface px-3.5 py-2">
                <div className="flex items-center gap-1.5 text-xs text-muted">
                  <span className="size-1.5 rounded-full bg-success" /> Pickup
                </div>
                <div className="truncate text-[13px] font-medium text-foreground">{trip.startAddress}</div>
              </div>
              <div className="rounded-2xl bg-surface px-3.5 py-2">
                <div className="flex items-center gap-1.5 text-xs text-muted">
                  <span className="size-1.5 rounded-full bg-foreground" /> Drop-off
                </div>
                <div className="truncate text-[13px] font-medium text-foreground">{trip.endAddress}</div>
              </div>
            </div>

            {isActive && (
              <div className="absolute left-4 top-4 z-[500]">
                <StatusPill tone={liveDriver ? 'success' : 'neutral'} dot pulse={Boolean(liveDriver)} className="bg-surface">
                  {liveDriver ? `Live · ${lastPingLabel}` : 'Waiting for location'}
                </StatusPill>
              </div>
            )}
          </div>

          <dl className="grid grid-cols-2 gap-x-6 gap-y-5 text-[13px] lg:w-80">
            {[
              { label: 'Distance', value: trip.distanceKm ? `${Number(trip.distanceKm).toFixed(1)} km` : '—' },
              { label: 'Duration', value: trip.durationMinutes ? `${Math.round(Number(trip.durationMinutes))} min` : '—' },
              { label: 'Payment', value: ((p) => p.charAt(0) + p.slice(1).toLowerCase())(trip.paymentMethod || 'WALLET') },
              { label: 'Settlement', value: trip.isCashTrip ? 'Cash' : 'Digital' },
              { label: 'Requested', value: time(trip.createdAt) },
              { label: 'Started', value: time(trip.startTime) },
              { label: 'Ended', value: time(trip.endTime) },
            ].map((row) => (
              <div key={row.label}>
                <dt className="text-xs text-muted">{row.label}</dt>
                <dd className="tabular mt-0.5 font-medium text-foreground">{row.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </DashboardCard>

      <TripRecord checkpoints={tracking?.checkpoints} sosAlerts={tracking?.sosAlerts} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <div className="space-y-5 lg:col-span-7">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <DashboardCard>
              <SectionHeader
                title="Rider"
                actions={
                  <Link href={`/riders/${trip.riderId}`} className="text-[13px] font-medium text-link hover:underline">
                    View
                  </Link>
                }
              />
              <div className="mt-4 flex items-center gap-3">
                <UserAvatar name={trip.rider.fullname || 'Passenger'} size="md" />
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-medium text-foreground">{trip.rider.fullname || 'Passenger'}</p>
                  <p className="tabular text-xs text-muted">
                    {trip.rider.phone || '—'} · ★ {trip.rider.rating ? trip.rider.rating.toFixed(1) : '5.0'}
                  </p>
                </div>
              </div>
            </DashboardCard>

            <DashboardCard>
              <SectionHeader
                title="Driver"
                actions={
                  trip.driverId ? (
                    <Link href={`/drivers/${trip.driverId}`} className="text-[13px] font-medium text-link hover:underline">
                      View
                    </Link>
                  ) : undefined
                }
              />
              {trip.driver ? (
                <div className="mt-4 flex items-center gap-3">
                  <UserAvatar name={`${trip.driver.firstname} ${trip.driver.lastname}`} size="md" />
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-medium text-foreground">
                      {trip.driver.firstname} {trip.driver.lastname}
                    </p>
                    <p className="tabular text-xs text-muted">
                      {trip.driver.vehicle?.model || 'Vehicle'}
                      {trip.driver.vehicle?.licensePlate ? ` · ${trip.driver.vehicle.licensePlate}` : ''}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-[13px] text-muted">Not assigned yet.</p>
              )}
            </DashboardCard>
          </div>

          {trip.rating && (
            <DashboardCard>
              <SectionHeader
                title="Rider feedback"
                actions={
                  <span className="tabular text-[14px] font-bold text-foreground">
                    ★ {trip.rating.driverRating}
                    <span className="font-normal text-muted"> / 5</span>
                  </span>
                }
              />
              {trip.rating.driverComment ? (
                <p className="mt-4 text-[14px] text-foreground">&ldquo;{trip.rating.driverComment}&rdquo;</p>
              ) : (
                <p className="mt-4 text-[13px] text-muted">No written review.</p>
              )}
              {trip.rating.driverTags && trip.rating.driverTags.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {trip.rating.driverTags.map((tag, i) => (
                    <StatusPill key={i}>{tag}</StatusPill>
                  ))}
                </div>
              )}
            </DashboardCard>
          )}

          {trip.status === 'CANCELLED' && (
            <DashboardCard className="bg-danger-soft/40">
              <SectionHeader title="Cancelled" />
              <p className="mt-3 text-[14px] text-foreground">{trip.cancelReason || 'No reason given.'}</p>
              {trip.cancelledAt && (
                <p className="tabular mt-1 text-xs text-muted">{new Date(trip.cancelledAt).toLocaleString('en-GB')}</p>
              )}
            </DashboardCard>
          )}
        </div>

        <div className="space-y-5 self-start lg:sticky lg:top-24 lg:col-span-5">
          <DashboardCard>
            <SectionHeader title="Fare" description="Locked at booking" />

            <dl className="mt-5 space-y-3 text-[13px]">
              {[
                { label: 'Base fare', value: formatNaira(trip.baseFareKobo), show: true },
                {
                  label: `Distance · ${trip.distanceKm ? Number(trip.distanceKm).toFixed(1) : 0} km`,
                  value: formatNaira(trip.distanceFareKobo),
                  show: true,
                },
                { label: 'Time', value: formatNaira(trip.timeFareKobo), show: true },
                {
                  label: `Surge · ${trip.surgeMultiplier?.toFixed(2)}×`,
                  value: `+${formatNaira(trip.surgeFareKobo)}`,
                  show: Boolean(trip.surgeMultiplier && trip.surgeMultiplier > 1),
                },
                {
                  label: 'Waiting',
                  value: formatNaira(trip.waitTimeFeeKobo),
                  show: trip.waitTimeFeeKobo !== null && trip.waitTimeFeeKobo > 0,
                },
                { label: 'Discount', value: `−${formatNaira(trip.driverDiscountKobo)}`, show: trip.driverDiscountKobo > 0 },
              ]
                .filter((row) => row.show)
                .map((row) => (
                  <div key={row.label} className="flex justify-between">
                    <dt className="text-muted">{row.label}</dt>
                    <dd className="tabular font-medium text-foreground">{row.value}</dd>
                  </div>
                ))}
              <div className="flex items-center justify-between rounded-2xl bg-surface-secondary px-4 py-3">
                <dt className="font-medium text-foreground">Total</dt>
                <dd className="tabular text-[18px] font-bold text-foreground">{formatNaira(trip.grandTotalKobo ?? trip.fareKobo)}</dd>
              </div>
            </dl>

            <h3 className="mt-6 text-[13px] font-medium text-foreground">Split</h3>
            <dl className="mt-3 space-y-3 text-[13px]">
              <div className="flex justify-between">
                <dt className="text-muted">Lagos road tax</dt>
                <dd className="tabular text-foreground">{formatNaira(trip.lagosCommissionKobo)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Kero commission</dt>
                <dd className="tabular text-foreground">{formatNaira(trip.keroCommissionKobo)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Driver earnings</dt>
                <dd className="tabular font-medium text-foreground">{formatNaira(trip.driverEarningsKobo)}</dd>
              </div>
              {trip.isCashTrip && trip.actualCashCollectedKobo !== null && (
                <div className="flex justify-between">
                  <dt className="text-muted">Cash collected</dt>
                  <dd className="tabular font-medium text-foreground">{formatNaira(trip.actualCashCollectedKobo)}</dd>
                </div>
              )}
            </dl>
          </DashboardCard>
        </div>
      </div>

      {/* ── Modal: Force Cancel ─────────────────────────────────────────── */}
      <Modal>
        <Modal.Backdrop
          isOpen={isCancelModalOpen}
          onOpenChange={setIsCancelModalOpen}
        >
          <Modal.Container placement="center" size="md">
            <Modal.Dialog className="rounded-3xl bg-overlay p-7">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div>
                    <h3 className="text-[18px] font-bold tracking-[-0.02em] text-foreground">
                      Force-Cancel Trip
                    </h3>
                    <p className="text-xs text-muted tabular">
                      Trip ID: {tripId}
                    </p>
                  </div>
                </div>

                {cancelAlert && (
                  <Alert status="danger" className="text-xs">
                    {cancelAlert}
                  </Alert>
                )}

                <p className="text-sm text-muted">
                  Terminating this trip will reset any assigned driver to AVAILABLE, unlock their dispatch queue, and trigger immediate push alerts.
                </p>

                <form
                  onSubmit={cancelForm.handleSubmit((values) => cancelMutation.mutate(values))}
                  className="space-y-4"
                >
                  <AppTextarea
                    label="Cancellation Reason"
                    isRequired
                    placeholder="Provide a detailed administrative reason for audit logs..."
                    errorMessage={cancelForm.formState.errors.reason?.message}
                    {...cancelForm.register('reason')}
                  />

                  <div>
                    <label className="text-xs font-semibold text-muted mb-1 block">
                      Cancel Attributed To
                    </label>
                    <select
                      {...cancelForm.register('cancelBy')}
                      className="w-full h-11 px-3 text-sm bg-background rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    >
                      <option value="system">System / Operations Discretion</option>
                      <option value="driver">Driver Default</option>
                      <option value="rider">Passenger Default</option>
                    </select>
                  </div>

                  <div className="space-y-2 pt-2">
                    <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                      <input
                        type="checkbox"
                        {...cancelForm.register('waiveFee')}
                        className="rounded text-primary focus:ring-primary w-4 h-4"
                      />
                      <span>Waive cancellation fee penalty</span>
                    </label>

                    <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                      <input
                        type="checkbox"
                        {...cancelForm.register('refundRider')}
                        className="rounded text-primary focus:ring-primary w-4 h-4"
                      />
                      <span>Refund passenger wallet balance</span>
                    </label>
                  </div>

                  <div className="flex items-center justify-end gap-2.5 pt-3">
                    <AppButton
                      type="button"
                      variant="ghost"
                      onClick={() => setIsCancelModalOpen(false)}
                    >
                      Abort
                    </AppButton>
                    <AppButton
                      type="submit"
                      variant="danger"
                      isLoading={cancelMutation.isPending}
                      startContent={<Prohibit weight="bold" className="w-4 h-4" />}
                    >
                      Confirm Cancel
                    </AppButton>
                  </div>
                </form>
              </div>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      {/* ── Modal: Assign Driver ────────────────────────────────────────── */}
      <Modal>
        <Modal.Backdrop
          isOpen={isAssignModalOpen}
          onOpenChange={setIsAssignModalOpen}
        >
          <Modal.Container placement="center" size="md">
            <Modal.Dialog className="rounded-3xl bg-overlay p-7">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div>
                    <h3 className="text-[18px] font-bold tracking-[-0.02em] text-foreground">
                      Manual Driver Assignment
                    </h3>
                    <p className="text-xs text-muted tabular">
                      Trip ID: {tripId}
                    </p>
                  </div>
                </div>

                {assignAlert && (
                  <Alert status="danger" className="text-xs">
                    {assignAlert}
                  </Alert>
                )}

                <form
                  onSubmit={assignForm.handleSubmit((values) => assignMutation.mutate(values))}
                  className="space-y-4"
                >
                  <AppInput
                    label="Driver ID"
                    isRequired
                    placeholder="Enter driver UUID or ID"
                    errorMessage={assignForm.formState.errors.driverId?.message}
                    {...assignForm.register('driverId')}
                  />

                  <AppInput
                    label="Assignment Reason"
                    placeholder="e.g. VIP dispatch, driver on phone with rider"
                    errorMessage={assignForm.formState.errors.reason?.message}
                    {...assignForm.register('reason')}
                  />

                  <div className="flex items-center justify-end gap-2.5 pt-3">
                    <AppButton
                      type="button"
                      variant="ghost"
                      onClick={() => setIsAssignModalOpen(false)}
                    >
                      Cancel
                    </AppButton>
                    <AppButton
                      type="submit"
                      variant="primary"
                      isLoading={assignMutation.isPending}
                      startContent={<UserCheck weight="bold" className="w-4 h-4" />}
                    >
                      Assign Driver
                    </AppButton>
                  </div>
                </form>
              </div>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </Page>
  );
}

export default function TripDetailPage() {
  return (
    <PermissionGuard permission="view_trip_detail">
      <Suspense
          fallback={
            <div className="space-y-6 animate-pulse">
              <div className="h-8 bg-surface-secondary rounded-xl w-64" />
              <div className="h-64 bg-surface-secondary rounded-3xl w-full" />
            </div>
          }
        >
          <TripDetailContent />
        </Suspense>
    </PermissionGuard>
  );
}
