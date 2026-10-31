'use client';

// src/app/trips/page.tsx
// Phase 2: Trips Master Ledger & Priority Ride Dispatch
import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Path,
  MagnifyingGlass,
  ArrowClockwise,
  Plus,
  Funnel,
  Prohibit,
  UserCheck,
  Eye,
  Copy,
  Check,
  CaretLeft,
  CaretRight,
  MapPin,
  Clock,
  Money,
  Siren,
  Car,
  User,
  WarningCircle,
  CurrencyNgn,
  ShieldCheck,
  CheckCircle,
  XCircle,
  PaperPlaneTilt,
  DotsThreeVertical,
  Broadcast,
} from '@phosphor-icons/react';
import { Card, Chip, Modal, Alert, Dropdown, Skeleton } from '@heroui/react';
import { AppButton } from '@/components/ui/app-button';
import { AppInput } from '@/components/ui/app-input';
import { AppTextarea } from '@/components/ui/app-textarea';
import { AppSelect } from '@/components/ui/app-select';
import { AppRowActions } from '@/components/ui/app-row-actions';
import { DashboardCard, StatDashboardCard } from '@/components/ui/dashboard-card';
import { formatKoboToNaira, formatNumber } from '@/lib/utils';
import { TripFiltersDrawer } from '@/components/trips/trip-filters-drawer';
import { EmptyState, Page, PageHeader, Segmented, StatusPill, TablePagination } from '@/components/ui/page';
import { UserAvatar } from '@/components/ui/user-avatar';
import { PermissionGuard, Can } from '@/components/auth/can';
import { SortableTh, useTableSort } from '@/components/ui/sortable-th';
import { api } from '@/lib/api';
import { applyApiFormError } from '@/lib/errors';
import { AdminTripListItem } from '@/types/admin';
import {
  forceCancelSchema,
  assignDriverSchema,
  dispatchTripSchema,
  type ForceCancelInput,
  type AssignDriverInput,
  type DispatchTripInput,
} from '@/lib/schemas/admin.schemas';

type TabStatus = 'ALL' | 'SEARCHING' | 'DRIVER_ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'SOS';

interface TripStats {
  total: number;
  inProgress: number;
  searching: number;
  completedToday: number;
  cancelledToday: number;
  cancelRateToday: number;
  sosActive: number;
  grossTodayKobo: number;
}

export default function TripsMasterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<TabStatus>('ALL');
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'WALLET' | 'CASH' | 'CARD'>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [fareMin, setFareMin] = useState('');
  const [fareMax, setFareMax] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Modals
  const [cancellingTrip, setCancellingTrip] = useState<AdminTripListItem | null>(null);
  const [assigningTrip, setAssigningTrip] = useState<AdminTripListItem | null>(null);
  // Opened directly from the overview via /trips?dispatch=1
  const [isDispatchModalOpen, setIsDispatchModalOpen] = useState(() => searchParams?.get('dispatch') === '1');
  const [cancelAlert, setCancelAlert] = useState<string | null>(null);
  const [assignAlert, setAssignAlert] = useState<string | null>(null);
  const [dispatchAlert, setDispatchAlert] = useState<string | null>(null);

  // Copy helper
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // ── Query: Trips Ledger ─────────────────────────────────────────────
  const { sort, toggle: toggleSort } = useTableSort<'createdAt' | 'fare' | 'status'>(
    { key: 'createdAt', order: 'desc' },
    () => setPage(1),
  );

  const { data, isLoading, refetch, isFetching } = useQuery<{
    total: number;
    page: number;
    trips: AdminTripListItem[];
  }>({
    queryKey: [
      'admin',
      'trips',
      page,
      limit,
      search,
      activeTab,
      paymentFilter,
      dateFrom,
      dateTo,
      fareMin,
      fareMax,
      sort,
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        sortBy: sort.key,
        sortOrder: sort.order,
      });

      if (search.trim()) params.set('search', search.trim());
      if (activeTab === 'SOS') {
        params.set('isSos', 'true');
      } else if (activeTab !== 'ALL') {
        params.set('status', activeTab);
      }
      if (paymentFilter !== 'all') params.set('paymentMethod', paymentFilter);
      if (dateFrom) params.set('dateFrom', new Date(`${dateFrom}T00:00:00`).toISOString());
      if (dateTo) params.set('dateTo', new Date(`${dateTo}T23:59:59`).toISOString());
      if (fareMin) params.set('fareMin', String(Math.round(Number(fareMin) * 100)));
      if (fareMax) params.set('fareMax', String(Math.round(Number(fareMax) * 100)));

      const res = await api.get<{ data: { total: number; page: number; trips: AdminTripListItem[] } }>(
        `/admin/trips?${params.toString()}`,
      );
      return res.data?.data ?? { total: 0, page: 1, trips: [] };
    },
  });

  // ── Query: Headline stats ───────────────────────────────────────────
  const { data: stats, isLoading: statsLoading } = useQuery<TripStats>({
    queryKey: ['admin', 'trips', 'stats'],
    queryFn: async () => (await api.get<{ data: TripStats }>('/admin/trips/stats')).data.data,
    refetchInterval: 15000,
  });

  const trips = data?.trips ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / limit) || 1;

  // ── Form: Force Cancel Trip ─────────────────────────────────────────
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
      if (!cancellingTrip) return;
      const res = await api.post(`/admin/trips/${cancellingTrip.id}/force-cancel`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'trips'] });
      setCancellingTrip(null);
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

  // ── Form: Manual Assign Driver ──────────────────────────────────────
  const assignForm = useForm<AssignDriverInput>({
    resolver: zodResolver(assignDriverSchema),
    defaultValues: {
      driverId: '',
      reason: 'Manual priority dispatch by operations team',
    },
  });

  const assignMutation = useMutation({
    mutationFn: async (payload: AssignDriverInput) => {
      if (!assigningTrip) return;
      const res = await api.post(`/admin/trips/${assigningTrip.id}/assign`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'trips'] });
      setAssigningTrip(null);
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

  // ── Form: Priority Ride Dispatch ────────────────────────────────────
  const dispatchForm = useForm<DispatchTripInput>({
    resolver: zodResolver(dispatchTripSchema),
    defaultValues: {
      riderId: '',
      pickupAddress: '',
      pickupLat: 6.5244,
      pickupLng: 3.3792,
      destAddress: '',
      destLat: 6.4281,
      destLng: 3.4219,
      vehicleTypeId: 'STANDARD',
      paymentMethod: 'WALLET',
      estimatedFareKobo: 250000,
      notes: '',
    },
  });

  const dispatchMutation = useMutation({
    mutationFn: async (payload: DispatchTripInput) => {
      const res = await api.post('/trips/request', {
        riderId: payload.riderId,
        startAddress: payload.pickupAddress,
        startLat: payload.pickupLat,
        startLng: payload.pickupLng,
        endAddress: payload.destAddress,
        endLat: payload.destLat,
        endLng: payload.destLng,
        paymentMethod: payload.paymentMethod,
        vehicleTypeId: payload.vehicleTypeId,
        notes: payload.notes,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'trips'] });
      setIsDispatchModalOpen(false);
      dispatchForm.reset();
      setDispatchAlert(null);
    },
    onError: (err) => {
      applyApiFormError(err, {
        setError: dispatchForm.setError,
        setFormError: setDispatchAlert,
      });
    },
  });

  // Format currency in Naira
  const formatNaira = (kobo: number | null | undefined) => {
    if (kobo === null || kobo === undefined) return '₦0';
    return `₦${(kobo / 100).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const renderStatusBadge = (status: string, sosCount: number) => {
    if (sosCount > 0) {
      return (
        <StatusPill tone="danger" dot pulse>
          SOS
        </StatusPill>
      );
    }

    switch (status) {
      case 'SEARCHING':
        return <StatusPill tone="warning" dot>Searching</StatusPill>;
      case 'DRIVER_ASSIGNED':
      case 'DRIVER_ARRIVING':
        return <StatusPill tone="brand" dot>Driver matched</StatusPill>;
      case 'IN_PROGRESS':
        return <StatusPill tone="accent" dot pulse>In progress</StatusPill>;
      case 'COMPLETED':
        return <StatusPill tone="success">Completed</StatusPill>;
      case 'CANCELLED':
        return <StatusPill tone="danger">Cancelled</StatusPill>;
      default:
        return <StatusPill>{status}</StatusPill>;
    }
  };

  const isActiveTrip = (status: string) => {
    return ['SEARCHING', 'DRIVER_ASSIGNED', 'DRIVER_ARRIVING', 'IN_PROGRESS'].includes(status);
  };

  const hasFilters = Boolean(search || paymentFilter !== 'all' || activeTab !== 'ALL' || fareMin || fareMax || dateFrom || dateTo);

  return (
    <PermissionGuard permission="view_trips">
      <Page>
          <PageHeader
            title="Trips"
            description="Every ride on the platform, live and historical."
            actions={
              <>
                <AppButton
                  variant="tertiary"
                  startContent={<Broadcast />}
                  label="Live watch"
                  onPress={() => router.push('/live-watch')}
                />
                <Can permission="create_pricing">
                  <AppButton
                    variant="brand"
                    startContent={<Plus weight="bold" />}
                    label="New dispatch"
                    onPress={() => setIsDispatchModalOpen(true)}
                  />
                </Can>
              </>
            }
          />

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
            <StatDashboardCard
              label="In progress"
              icon={Path}
              variant="wallet"
              loading={statsLoading}
              value={formatNumber(stats?.inProgress)}
              hint={`${formatNumber(stats?.searching)} looking for a driver`}
            />
            <StatDashboardCard
              label="Completed today"
              icon={CheckCircle}
              loading={statsLoading}
              value={formatNumber(stats?.completedToday)}
              hint={`${formatKoboToNaira(stats?.grossTodayKobo)} in fares`}
            />
            <StatDashboardCard
              label="Cancelled today"
              icon={XCircle}
              loading={statsLoading}
              value={formatNumber(stats?.cancelledToday)}
              hint={`${stats?.cancelRateToday ?? 0}% of finished trips`}
            />
            <StatDashboardCard
              label="Active SOS"
              icon={Siren}
              variant={stats?.sosActive ? 'danger' : 'surface'}
              loading={statsLoading}
              value={formatNumber(stats?.sosActive)}
              hint={`${formatNumber(stats?.total)} trips all time`}
            />
          </div>

          <DashboardCard className="overflow-hidden p-0">
            <div className="flex flex-col gap-3 p-6 pb-4 lg:flex-row lg:items-center lg:justify-between">
              <Segmented
                size="sm"
                aria-label="Trip status"
                className="min-w-0"
                value={activeTab}
                onChange={(key) => {
                  setActiveTab(key);
                  setPage(1);
                }}
                options={[
                  { key: 'ALL', label: 'All' },
                  { key: 'IN_PROGRESS', label: 'In progress' },
                  { key: 'SEARCHING', label: 'Searching' },
                  { key: 'DRIVER_ASSIGNED', label: 'Matched' },
                  { key: 'COMPLETED', label: 'Completed' },
                  { key: 'CANCELLED', label: 'Cancelled' },
                  { key: 'SOS', label: 'SOS' },
                ]}
              />

              <div className="flex shrink-0 items-center gap-2">
                <div className="w-full lg:w-56">
                  <AppInput
                    size="sm"
                    placeholder="Search trips"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                    startContent={<MagnifyingGlass />}
                  />
                </div>
                <TripFiltersDrawer
                  value={{ paymentMethod: paymentFilter, dateFrom, dateTo, fareMin, fareMax }}
                  onApply={(f) => {
                    setPaymentFilter(f.paymentMethod);
                    setDateFrom(f.dateFrom);
                    setDateTo(f.dateTo);
                    setFareMin(f.fareMin);
                    setFareMax(f.fareMax);
                    setPage(1);
                  }}
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <SortableTh label="Trip" sortKey="createdAt" sort={sort} onSort={toggleSort} />
                    <th>Rider</th>
                    <th>Driver</th>
                    <th>Route</th>
                    <SortableTh label="Fare" sortKey="fare" sort={sort} onSort={toggleSort} />
                    <SortableTh label="Status" sortKey="status" firstOrder="asc" sort={sort} onSort={toggleSort} />
                    <th className="w-12" />
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <tr key={i}>
                        <td colSpan={7}>
                          <Skeleton className="h-6 w-full rounded-lg" />
                        </td>
                      </tr>
                    ))
                  ) : trips.length === 0 ? (
                    <tr>
                      <td colSpan={7}>
                        <EmptyState
                          icon={Path}
                          title="No trips found"
                          description={hasFilters ? 'Try a different filter or search.' : 'Trips will appear here as riders book.'}
                        />
                      </td>
                    </tr>
                  ) : (
                    trips.map((trip) => {
                      const canForceCancel = isActiveTrip(trip.status);
                      const isUnassigned = trip.status === 'SEARCHING' || !trip.driver;

                      return (
                        <tr key={trip.id}>
                          <td className="whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <Link href={`/trips/${trip.id}`} className="tabular font-medium text-foreground hover:underline">
                                {trip.id.slice(0, 8)}
                              </Link>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(trip.id)}
                                title="Copy trip ID"
                                className="cursor-pointer text-muted transition-colors hover:text-foreground"
                              >
                                {copiedId === trip.id ? (
                                  <Check weight="bold" className="size-3.5 text-success" />
                                ) : (
                                  <Copy className="size-3.5" />
                                )}
                              </button>
                            </div>
                            <div className="tabular text-xs text-muted">
                              {new Date(trip.createdAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })} ·{' '}
                              {new Date(trip.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </td>

                          <td className="whitespace-nowrap">
                            {trip.rider ? (
                              <Link href={`/riders/${trip.rider.id}`} className="group flex items-center gap-3">
                                <UserAvatar
                                  src={trip.rider.avatarUrl || trip.rider.profileImage}
                                  name={trip.rider.fullname}
                                  size="sm"
                                />
                                <div>
                                  <div className="font-medium text-foreground group-hover:underline">
                                    {trip.rider.fullname || 'Passenger'}
                                  </div>
                                  <div className="tabular text-xs text-muted">{trip.rider.phone || '—'}</div>
                                </div>
                              </Link>
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </td>

                          <td className="whitespace-nowrap">
                            {trip.driver ? (
                              <Link href={`/drivers/${trip.driver.id}`} className="group flex items-center gap-3">
                                <UserAvatar
                                  src={trip.driver.avatarUrl || trip.driver.selfieUrl}
                                  name={`${trip.driver.firstname || ''} ${trip.driver.lastname || ''}`}
                                  size="sm"
                                />
                                <div>
                                  <div className="font-medium text-foreground group-hover:underline">
                                    {trip.driver.firstname} {trip.driver.lastname}
                                  </div>
                                  <div className="tabular text-xs text-muted">
                                    {trip.vehicle?.licensePlate ?? trip.vehicle?.model ?? 'Vehicle'}
                                  </div>
                                </div>
                              </Link>
                            ) : (
                              <span className="text-muted">Unassigned</span>
                            )}
                          </td>

                          <td className="max-w-[260px]">
                            <div className="space-y-1 text-[13px]">
                              <div className="flex items-center gap-2 text-foreground" title={trip.startAddress}>
                                <span className="size-1.5 shrink-0 rounded-full bg-success" />
                                <span className="truncate">{trip.startAddress || 'Origin'}</span>
                              </div>
                              <div className="flex items-center gap-2 text-muted" title={trip.endAddress}>
                                <span className="size-1.5 shrink-0 rounded-full bg-foreground" />
                                <span className="truncate">{trip.endAddress || 'Destination'}</span>
                              </div>
                            </div>
                          </td>

                          <td className="whitespace-nowrap">
                            <div className="tabular font-medium text-foreground">
                              {trip.grandTotalKobo || trip.fareKobo
                                ? formatNaira(trip.grandTotalKobo || trip.fareKobo)
                                : trip.estimatedFareKobo
                                  ? `${formatNaira(trip.estimatedFareKobo)} est.`
                                  : '—'}
                            </div>
                            <div className="text-xs capitalize text-muted">
                              {(trip.paymentMethod || 'wallet').toLowerCase()}
                              {trip.distanceKm ? ` · ${Number(trip.distanceKm).toFixed(1)} km` : ''}
                            </div>
                          </td>

                          <td className="whitespace-nowrap">{renderStatusBadge(trip.status, trip.sosAlertCount)}</td>

                          <td className="whitespace-nowrap text-right">
                            <AppRowActions
                              items={[
                                {
                                  key: 'details',
                                  label: 'View trip',
                                  icon: <Eye size={14} />,
                                  href: `/trips/${trip.id}`,
                                },
                                ...(isUnassigned && canForceCancel
                                  ? [
                                      {
                                        key: 'assign',
                                        label: 'Assign driver',
                                        icon: <UserCheck size={14} />,
                                        onClick: () => setAssigningTrip(trip),
                                      },
                                    ]
                                  : []),
                                ...(canForceCancel
                                  ? [
                                      {
                                        key: 'cancel',
                                        label: 'Cancel trip',
                                        icon: <Prohibit size={14} />,
                                        danger: true,
                                        onClick: () => setCancellingTrip(trip),
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

            <TablePagination
              page={page}
              totalPages={totalPages}
              summary={`${total.toLocaleString()} trips`}
              onChange={setPage}
            />
          </DashboardCard>
      </Page>

        {/* ── Modal: Force Cancel Trip ────────────────────────────────────── */}
        <Modal>
          <Modal.Backdrop
            isOpen={Boolean(cancellingTrip)}
            onOpenChange={(open) => !open && setCancellingTrip(null)}
          >
            <Modal.Container placement="center" size="md">
              <Modal.Dialog className="rounded-3xl bg-overlay p-7">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div>
                      <h3 className="text-[18px] font-bold tracking-[-0.02em] text-foreground">
                        Force-Cancel Active Trip
                      </h3>
                      <p className="text-xs text-muted tabular">
                        Trip ID: {cancellingTrip?.id}
                      </p>
                    </div>
                  </div>

                  {cancelAlert && (
                    <Alert status="danger" className="text-xs">
                      {cancelAlert}
                    </Alert>
                  )}

                  <p className="text-sm text-muted">
                    Terminating an active trip will reset the assigned driver to AVAILABLE, release
                    the dispatch lock, and immediately notify both passengers and driver.
                  </p>

                  <form
                    onSubmit={cancelForm.handleSubmit((values) => cancelMutation.mutate(values))}
                    className="space-y-4"
                  >
                    <AppTextarea
                      label="Cancellation Reason"
                      isRequired
                      placeholder="e.g. Passenger unreachable, vehicle breakdown, security report..."
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
                        <option value="system">System / Operations Intervention</option>
                        <option value="driver">Driver Fault</option>
                        <option value="rider">Rider Fault</option>
                      </select>
                    </div>

                    <div className="space-y-2 pt-2">
                      <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                        <input
                          type="checkbox"
                          {...cancelForm.register('waiveFee')}
                          className="rounded text-primary focus:ring-primary w-4 h-4"
                        />
                        <span>Waive cancellation fee (do not charge penalty)</span>
                      </label>

                      <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                        <input
                          type="checkbox"
                          {...cancelForm.register('refundRider')}
                          className="rounded text-primary focus:ring-primary w-4 h-4"
                        />
                        <span>Refund rider wallet balance if prepaid</span>
                      </label>
                    </div>

                    <div className="flex items-center justify-end gap-2.5 pt-3">
                      <AppButton
                        type="button"
                        variant="ghost"
                        onClick={() => setCancellingTrip(null)}
                      >
                        Abort
                      </AppButton>
                      <AppButton
                        type="submit"
                        variant="danger"
                        isLoading={cancelMutation.isPending}
                        startContent={<Prohibit weight="bold" className="w-4 h-4" />}
                      >
                        Confirm Force Cancel
                      </AppButton>
                    </div>
                  </form>
                </div>
              </Modal.Dialog>
            </Modal.Container>
          </Modal.Backdrop>
        </Modal>

        {/* ── Modal: Manual Driver Assignment ─────────────────────────────── */}
        <Modal>
          <Modal.Backdrop
            isOpen={Boolean(assigningTrip)}
            onOpenChange={(open) => !open && setAssigningTrip(null)}
          >
            <Modal.Container placement="center" size="md">
              <Modal.Dialog className="rounded-3xl bg-overlay p-7">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div>
                      <h3 className="text-[18px] font-bold tracking-[-0.02em] text-foreground">
                        Assign Driver to Trip
                      </h3>
                      <p className="text-xs text-muted tabular">
                        Trip ID: {assigningTrip?.id}
                      </p>
                    </div>
                  </div>

                  {assignAlert && (
                    <Alert status="danger" className="text-xs">
                      {assignAlert}
                    </Alert>
                  )}

                  <p className="text-sm text-muted">
                    Direct assignment bypasses algorithmic broadcast rounds and immediately locks the trip to the designated driver.
                  </p>

                  <form
                    onSubmit={assignForm.handleSubmit((values) => assignMutation.mutate(values))}
                    className="space-y-4"
                  >
                    <AppInput
                      label="Driver ID"
                      isRequired
                      placeholder="e.g. drv_cm123456789 or UUID"
                      errorMessage={assignForm.formState.errors.driverId?.message}
                      {...assignForm.register('driverId')}
                    />

                    <AppInput
                      label="Administrative Reason"
                      placeholder="e.g. VIP dispatch, direct phone escalation"
                      errorMessage={assignForm.formState.errors.reason?.message}
                      {...assignForm.register('reason')}
                    />

                    <div className="flex items-center justify-end gap-2.5 pt-3">
                      <AppButton
                        type="button"
                        variant="ghost"
                        onClick={() => setAssigningTrip(null)}
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

        {/* ── Modal: Priority Ride Dispatch ───────────────────────────────── */}
        <Modal>
          <Modal.Backdrop
            isOpen={isDispatchModalOpen}
            onOpenChange={setIsDispatchModalOpen}
          >
            <Modal.Container placement="center" size="lg">
              <Modal.Dialog className="rounded-3xl bg-overlay p-7 max-h-[90vh] overflow-y-auto">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div>
                      <h3 className="text-[18px] font-bold tracking-[-0.02em] text-foreground">
                        Create Manual Ride Dispatch
                      </h3>
                      <p className="mt-1 text-[13px] text-muted">
                        Initiate an on-demand ride dispatch on behalf of a passenger or corporate account.
                      </p>
                    </div>
                  </div>

                  {dispatchAlert && (
                    <Alert status="danger" className="text-xs">
                      {dispatchAlert}
                    </Alert>
                  )}

                  <form
                    onSubmit={dispatchForm.handleSubmit((values: DispatchTripInput) => dispatchMutation.mutate(values))}
                    className="space-y-4"
                  >
                    <AppInput
                      label="Passenger / Rider ID"
                      isRequired
                      placeholder="Enter rider UUID or User ID"
                      errorMessage={dispatchForm.formState.errors.riderId?.message}
                      {...dispatchForm.register('riderId')}
                    />

                    <div className="flex flex-col gap-4">
                      <AppInput
                        label="Pickup Address"
                        isRequired
                        placeholder="e.g. 12 Adeola Odeku, Victoria Island"
                        errorMessage={dispatchForm.formState.errors.pickupAddress?.message}
                        {...dispatchForm.register('pickupAddress')}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <AppInput
                          label="Pickup Lat"
                          type="number"
                          step="any"
                          errorMessage={dispatchForm.formState.errors.pickupLat?.message}
                          {...dispatchForm.register('pickupLat', { valueAsNumber: true })}
                        />
                        <AppInput
                          label="Pickup Lng"
                          type="number"
                          step="any"
                          errorMessage={dispatchForm.formState.errors.pickupLng?.message}
                          {...dispatchForm.register('pickupLng', { valueAsNumber: true })}
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-4">
                      <AppInput
                        label="Destination Address"
                        isRequired
                        placeholder="e.g. Murtala Muhammed Airport Terminal 2"
                        errorMessage={dispatchForm.formState.errors.destAddress?.message}
                        {...dispatchForm.register('destAddress')}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <AppInput
                          label="Dest Lat"
                          type="number"
                          step="any"
                          errorMessage={dispatchForm.formState.errors.destLat?.message}
                          {...dispatchForm.register('destLat', { valueAsNumber: true })}
                        />
                        <AppInput
                          label="Dest Lng"
                          type="number"
                          step="any"
                          errorMessage={dispatchForm.formState.errors.destLng?.message}
                          {...dispatchForm.register('destLng', { valueAsNumber: true })}
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-4">
                      <div>
                        <label className="text-xs font-semibold text-muted mb-1 block">
                          Vehicle Tier *
                        </label>
                        <select
                          {...dispatchForm.register('vehicleTypeId')}
                          className="w-full h-11 px-3 text-sm bg-background rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        >
                          <option value="STANDARD">Kero Standard</option>
                          <option value="COMFORT">Kero Comfort</option>
                          <option value="KEKE">Kero Keke</option>
                          <option value="DELIVERY">Kero Delivery</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-muted mb-1 block">
                          Payment Method *
                        </label>
                        <select
                          {...dispatchForm.register('paymentMethod')}
                          className="w-full h-11 px-3 text-sm bg-background rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        >
                          <option value="WALLET">Passenger Wallet Balance</option>
                        </select>
                      </div>
                    </div>

                    <AppInput
                      label="Internal Operations Notes"
                      placeholder="e.g. Requested VIP priority dispatch"
                      errorMessage={dispatchForm.formState.errors.notes?.message}
                      {...dispatchForm.register('notes')}
                    />

                    <div className="flex items-center justify-end gap-2.5 pt-3">
                      <AppButton
                        type="button"
                        variant="ghost"
                        onClick={() => setIsDispatchModalOpen(false)}
                      >
                        Cancel
                      </AppButton>
                      <AppButton
                        type="submit"
                        variant="primary"
                        isLoading={dispatchMutation.isPending}
                        startContent={<PaperPlaneTilt weight="bold" className="w-4 h-4" />}
                      >
                        Dispatch Ride
                      </AppButton>
                    </div>
                  </form>
                </div>
              </Modal.Dialog>
            </Modal.Container>
          </Modal.Backdrop>
        </Modal>
    </PermissionGuard>
  );
}
