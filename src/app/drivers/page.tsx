'use client';

// src/app/drivers/page.tsx
// Phase 1.1: Driver Directory & Fleet Roster
// Features:
// - Paginated driver table with filters (verification, status, vehicle type, rating)
// - Real-time metrics HUD (Total, Verified, Pending Review, Suspended)
// - Quick search by name, phone, plate, email
// - Soft & Hard suspension modal with `suspendDriverSchema` validation
// - Bulk suspension modal (up to 50 drivers) with `bulkSuspendSchema`
// - Link to 3-Stage KYC Review Queue with badge counter
// - Built on HeroUI v3 compound Modal, AppInput, AppTextarea, AppButton, and Satoshi tokens

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  SteeringWheel,
  ShieldCheck,
  WarningOctagon,
  IdentificationCard,
  MagnifyingGlass,
  Funnel,
  ArrowsClockwise,
  Phone,
  Star,
  CheckCircle,
  XCircle,
  DownloadSimple,
  PencilSimple,
  Trash,
  X,
  CaretLeft,
  CaretRight,
  User,
  Car,
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
import { formatNumber } from '@/lib/utils';
import { EmptyState, Page, PageHeader, Segmented, StatusPill, TablePagination } from '@/components/ui/page';
import { UserAvatar } from '@/components/ui/user-avatar';
import { PermissionGuard, Can } from '@/components/auth/can';
import { SortableTh, useTableSort } from '@/components/ui/sortable-th';
import { EmailStatusPill, KycStatusPill, kycStatusOf } from '@/components/drivers/verification-pills';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { applyApiFormError } from '@/lib/errors';
import { AdminDriverListItem } from '@/types/admin';
import {
  suspendDriverSchema,
  bulkSuspendSchema,
  type SuspendDriverInput,
  type BulkSuspendInput,
} from '@/lib/schemas/admin.schemas';

interface DriverStats {
  total: number;
  verified: number;
  pendingKyc: number;
  suspended: number;
  online: number;
  onTrip: number;
  newThisWeek?: number;
}

export default function DriversPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [verificationFilter, setVerificationFilter] = useState<string>('all');
  const [vehicleTypeFilter, setVehicleTypeFilter] = useState<string>('all');
  const [selectedDriverIds, setSelectedDriverIds] = useState<string[]>([]);

  // Modals
  const [suspendingDriver, setSuspendingDriver] = useState<AdminDriverListItem | null>(null);
  const [isBulkSuspendOpen, setIsBulkSuspendOpen] = useState(false);
  const [suspensionAlert, setSuspensionAlert] = useState<string | null>(null);

  // Online first, then most recently seen.
  const { sort, toggle: toggleSort } = useTableSort<'activity' | 'name' | 'rating' | 'createdAt'>(
    { key: 'activity', order: 'desc' },
    () => setPage(1),
  );

  // ── Query: Drivers List ─────────────────────────────────────────────
  /** Filters shared by the list and the CSV export. */
  const filterParams = () => {
    const params = new URLSearchParams({ sortBy: sort.key, sortOrder: sort.order });
    if (search.trim()) params.set('search', search.trim());
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (verificationFilter === 'verified') params.set('isVerified', 'true');
    if (verificationFilter === 'unverified') params.set('isVerified', 'false');
    if (verificationFilter === 'suspended') params.set('isSuspended', 'true');
    if (vehicleTypeFilter !== 'all') params.set('vehicleTypeId', vehicleTypeFilter);
    return params;
  };

  // Export: authenticated POST to the backend, then save the CSV it returns.
  const [isExporting, setIsExporting] = useState(false);
  const exportCsv = async () => {
    setIsExporting(true);
    try {
      const res = await api.post<string>(`/admin/drivers/bulk/export?${filterParams().toString()}`, undefined, {
        responseType: 'text',
      });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv;charset=utf-8;' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `kero-drivers-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message ?? 'Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  const {
    data,
    isLoading,
    refetch,
    isFetching,
  } = useQuery<{ total: number; page: number; drivers: AdminDriverListItem[] }>({
    queryKey: [
      'admin',
      'drivers',
      page,
      limit,
      search,
      statusFilter,
      verificationFilter,
      vehicleTypeFilter,
      sort,
    ],
    queryFn: async () => {
      const params = filterParams();
      params.set('page', String(page));
      params.set('limit', String(limit));

      const res = await api.get<{ data: { total: number; page: number; drivers: AdminDriverListItem[] } }>(
        `/admin/drivers?${params.toString()}`,
      );
      return res.data?.data ?? { total: 0, page: 1, drivers: [] };
    },
  });

  const drivers = useMemo(() => {
    const list = [...(data?.drivers ?? [])];
    return list.sort((a, b) => {
      // 1. Online always at the top
      if (a.isOnline && !b.isOnline) return -1;
      if (!a.isOnline && b.isOnline) return 1;

      // 2. In-trip or Available before Unavailable
      if (a.status !== b.status) {
        if (a.status === 'AVAILABLE' || a.status === 'IN_TRIP') return -1;
        if (b.status === 'AVAILABLE' || b.status === 'IN_TRIP') return 1;
      }

      // 3. Sort by lastSeenAt / lastActivityAt (most recent first)
      const aTime = a.lastSeenAt || a.lastActivityAt ? new Date(a.lastSeenAt || a.lastActivityAt!).getTime() : 0;
      const bTime = b.lastSeenAt || b.lastActivityAt ? new Date(b.lastSeenAt || b.lastActivityAt!).getTime() : 0;
      if (aTime !== bTime) return bTime - aTime;

      // 4. Fallback to createdAt (newest first)
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [data?.drivers]);
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / limit) || 1;

  // ── Query: Review Queue Count ───────────────────────────────────────
  const { data: queueData } = useQuery<{ total: number }>({
    queryKey: ['admin', 'drivers', 'review-queue-count'],
    queryFn: async () => {
      const res = await api.get<{ data: { total: number } }>('/admin/drivers/review-queue?limit=1');
      return res.data?.data ?? { total: 0 };
    },
    refetchInterval: 30000,
  });

  // ── Query: Headline stats ───────────────────────────────────────────
  const { data: stats, isLoading: statsLoading } = useQuery<DriverStats>({
    queryKey: ['admin', 'drivers', 'stats'],
    queryFn: async () => (await api.get<{ data: DriverStats }>('/admin/drivers/stats')).data.data,
    refetchInterval: 30000,
  });

  // ── Form: Suspend Driver ────────────────────────────────────────────
  const suspendForm = useForm<SuspendDriverInput>({
    resolver: zodResolver(suspendDriverSchema),
    defaultValues: {
      reason: '',
      type: 'soft',
    },
  });

  const suspendMutation = useMutation({
    mutationFn: async (payload: SuspendDriverInput) => {
      if (!suspendingDriver) return;
      const res = await api.put(`/admin/drivers/${suspendingDriver.id}/suspend`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'drivers'] });
      setSuspendingDriver(null);
      suspendForm.reset();
      setSuspensionAlert(null);
    },
    onError: (err) => {
      applyApiFormError(err, {
        setError: suspendForm.setError,
        setFormError: setSuspensionAlert,
      });
    },
  });

  // ── Form: Bulk Suspend ──────────────────────────────────────────────
  const bulkSuspendForm = useForm<BulkSuspendInput>({
    resolver: zodResolver(bulkSuspendSchema),
    defaultValues: {
      driverIds: [],
      reason: '',
      type: 'soft',
    },
  });

  const bulkSuspendMutation = useMutation({
    mutationFn: async (payload: BulkSuspendInput) => {
      const res = await api.post('/admin/drivers/bulk/suspend', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'drivers'] });
      setIsBulkSuspendOpen(false);
      setSelectedDriverIds([]);
      bulkSuspendForm.reset();
    },
  });

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedDriverIds(drivers.map((d) => d.id));
    } else {
      setSelectedDriverIds([]);
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedDriverIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  return (
    <PermissionGuard permission="view_drivers">
        <Page>
          <PageHeader
            title="Drivers"
            description="Your driver fleet, live status and verification."
            actions={
              <>
                <AppButton
                  variant="tertiary"
                  startContent={<DownloadSimple />}
                  label="Export"
                  isLoading={isExporting}
                  onPress={exportCsv}
                />
                <AppButton
                  variant="brand"
                  startContent={<IdentificationCard />}
                  label={`Review queue${(queueData?.total ?? 0) > 0 ? ` · ${queueData?.total}` : ''}`}
                  onPress={() => router.push('/drivers/review-queue')}
                />
              </>
            }
          />

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
            <StatDashboardCard
              label="Total drivers"
              icon={SteeringWheel}
              variant="wallet"
              loading={statsLoading}
              value={formatNumber(stats?.total)}
              hint={stats?.newThisWeek !== undefined ? `+${formatNumber(stats.newThisWeek)} this week` : 'Registered accounts'}
            />
            <StatDashboardCard
              label="Online now"
              icon={Broadcast}
              loading={statsLoading}
              value={formatNumber(stats?.online)}
              hint={stats?.onTrip !== undefined ? `${formatNumber(stats.onTrip)} on a trip` : 'Connected to the app'}
            />
            <StatDashboardCard
              label="Verified"
              icon={ShieldCheck}
              loading={statsLoading}
              value={formatNumber(stats?.verified)}
              hint={`${formatNumber(stats?.pendingKyc)} waiting for review`}
            />
            <StatDashboardCard
              label="Suspended"
              icon={WarningOctagon}
              loading={statsLoading}
              value={formatNumber(stats?.suspended)}
              hint="Blocked from dispatch"
            />
          </div>

          <DashboardCard className="overflow-hidden p-0">
            <div className="flex flex-col gap-4 p-6 pb-4 lg:flex-row lg:items-center lg:justify-between">
              <Segmented
                size="sm"
                aria-label="Verification"
                value={verificationFilter}
                onChange={(key) => {
                  setVerificationFilter(key);
                  setPage(1);
                }}
                options={[
                  { key: 'all', label: 'All' },
                  { key: 'verified', label: 'KYC approved' },
                  { key: 'unverified', label: 'Not approved' },
                  { key: 'suspended', label: 'Suspended' },
                ]}
              />

              <div className="flex flex-wrap items-center gap-2">
                <div className="w-36">
                  <AppSelect
                    size="sm"
                    aria-label="Status"
                    options={[
                      { key: 'all', label: 'All statuses' },
                      { key: 'AVAILABLE', label: 'Available' },
                      { key: 'IN_TRIP', label: 'In trip' },
                      { key: 'UNAVAILABLE', label: 'Unavailable' },
                    ]}
                    selectedKey={statusFilter}
                    onSelectionChange={(key) => {
                      setStatusFilter(key);
                      setPage(1);
                    }}
                  />
                </div>

                <div className="w-56">
                  <AppInput
                    size="sm"
                    placeholder="Search drivers"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                    startContent={<MagnifyingGlass />}
                    endContent={
                      search ? (
                        <button
                          type="button"
                          onClick={() => {
                            setSearch('');
                            setPage(1);
                          }}
                          className="cursor-pointer text-muted hover:text-foreground"
                        >
                          <X size={12} />
                        </button>
                      ) : null
                    }
                  />
                </div>
              </div>
            </div>

            {selectedDriverIds.length > 0 && (
              <div className="mx-6 mb-4 flex items-center justify-between rounded-2xl bg-default px-4 py-2.5 text-[13px] font-medium text-foreground">
                <span>{selectedDriverIds.length} selected</span>
                <div className="flex items-center gap-2">
                  <AppButton size="sm" variant="ghost" label="Clear" onPress={() => setSelectedDriverIds([])} />
                  <AppButton
                    size="sm"
                    variant="danger"
                    startContent={<WarningOctagon />}
                    label="Suspend"
                    onPress={() => {
                      bulkSuspendForm.setValue('driverIds', selectedDriverIds);
                      setIsBulkSuspendOpen(true);
                    }}
                  />
                </div>
              </div>
            )}

            {/* Data Table */}
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="w-10">
                      <input
                        type="checkbox"
                        checked={drivers.length > 0 && selectedDriverIds.length === drivers.length}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        className="rounded"
                      />
                    </th>
                    <SortableTh label="Driver" sortKey="name" firstOrder="asc" sort={sort} onSort={toggleSort} />
                    <th>Vehicle</th>
                    <SortableTh label="Rating" sortKey="rating" sort={sort} onSort={toggleSort} />
                    <th>Status</th>
                    <SortableTh label="Last seen" sortKey="activity" sort={sort} onSort={toggleSort} />
                    <th>Email</th>
                    <th>KYC</th>
                    <th className="w-12" />
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <tr key={i}>
                        <td colSpan={9}>
                          <Skeleton className="h-6 w-full rounded-lg" />
                        </td>
                      </tr>
                    ))
                  ) : drivers.length === 0 ? (
                    <tr>
                      <td colSpan={9}>
                        <EmptyState icon={SteeringWheel} title="No drivers found" description="Try a different filter or search." />
                      </td>
                    </tr>
                  ) : (
                    drivers.map((driver) => {
                      const isSelected = selectedDriverIds.includes(driver.id);
                      const isLive = Boolean(driver.isOnline);

                      const formatLastActive = (dateStr?: string | Date | null) => {
                        if (!dateStr) return 'Never';
                        const d = new Date(dateStr);
                        if (isNaN(d.getTime())) return 'Never';
                        const diffMins = Math.floor((Date.now() - d.getTime()) / 60000);
                        if (diffMins < 1) return 'Just now';
                        if (diffMins < 60) return `${diffMins}m ago`;
                        const diffHours = Math.floor(diffMins / 60);
                        if (diffHours < 24) return `${diffHours}h ago`;
                        return `${Math.floor(diffHours / 24)}d ago`;
                      };

                      const statusTone = driver.isSuspended
                        ? 'danger'
                        : driver.status === 'AVAILABLE'
                          ? 'success'
                          : driver.status === 'IN_TRIP'
                            ? 'accent'
                            : 'neutral';
                      const statusLabel = driver.isSuspended
                        ? 'Suspended'
                        : driver.status === 'IN_TRIP'
                          ? 'In trip'
                          : driver.status === 'AVAILABLE'
                            ? 'Available'
                            : driver.status === 'BACKGROUND'
                              ? 'In background'
                              : 'Unavailable';

                      return (
                        <tr key={driver.id} className={isSelected ? 'bg-surface-secondary' : ''}>
                          <td>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelect(driver.id)}
                              className="rounded"
                            />
                          </td>

                          <td>
                            <div className="flex items-center gap-3">
                              <UserAvatar
                                src={driver.avatarUrl || driver.selfieUrl}
                                name={`${driver.firstname || ''} ${driver.lastname || ''}`}
                                size="sm"
                              />
                              <div className="min-w-0">
                                <Link
                                  href={`/drivers/${driver.id}`}
                                  className="block truncate font-medium text-foreground hover:underline"
                                >
                                  {driver.firstname} {driver.lastname}
                                </Link>
                                <p className="tabular truncate text-xs text-muted">{driver.phone ?? driver.email}</p>
                              </div>
                            </div>
                          </td>

                          <td>
                            {driver.vehicle ? (
                              <div>
                                <p className="tabular font-medium text-foreground">{driver.vehicle.licensePlate}</p>
                                <p className="text-xs text-muted">
                                  {driver.vehicle.model}
                                  {driver.vehicle.vehicleType?.name ? ` · ${driver.vehicle.vehicleType.name}` : ''}
                                </p>
                              </div>
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </td>

                          <td>
                            <div className="flex items-center gap-1 font-medium text-foreground">
                              <Star size={14} weight="fill" className="text-secondary" />
                              <span className="tabular">{Number(driver.rating).toFixed(1)}</span>
                            </div>
                            <span className="tabular text-xs text-muted">{driver.totalTrips} trips</span>
                          </td>

                          <td>
                            <StatusPill tone={statusTone} dot>
                              {statusLabel}
                            </StatusPill>
                          </td>

                          <td>
                            {isLive ? (
                              <StatusPill tone="success" dot pulse>
                                Online
                              </StatusPill>
                            ) : (
                              <span className="tabular text-muted">
                                {formatLastActive(driver.lastSeenAt || driver.lastActivityAt)}
                              </span>
                            )}
                          </td>

                          <td>
                            <EmailStatusPill short verified={driver.emailVerified ?? driver.isVerified} />
                          </td>
                          <td>
                            <KycStatusPill short status={kycStatusOf(driver)} />
                          </td>

                          <td className="text-right">
                            <AppRowActions
                              items={[
                                {
                                  key: 'dossier',
                                  label: 'View profile',
                                  icon: <User size={14} />,
                                  href: `/drivers/${driver.id}`,
                                },
                                ...(!driver.isSuspended
                                  ? [
                                      {
                                        key: 'suspend',
                                        label: 'Suspend',
                                        icon: <WarningOctagon size={14} />,
                                        danger: true,
                                        onClick: () => {
                                          setSuspensionAlert(null);
                                          suspendForm.reset({ reason: '', type: 'soft' });
                                          setSuspendingDriver(driver);
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

            <TablePagination
              page={page}
              totalPages={totalPages}
              summary={`${drivers.length} of ${total} drivers`}
              onChange={setPage}
            />
          </DashboardCard>

          {/* ── MODAL: Suspend Single Driver ─────────────────────────── */}
          {suspendingDriver && (
            <Modal>
              <Modal.Backdrop
                isOpen={Boolean(suspendingDriver)}
                onOpenChange={(open) => !open && setSuspendingDriver(null)}
              >
                <Modal.Container placement="center" size="md">
                  <Modal.Dialog className="rounded-3xl bg-overlay p-7 w-full max-w-md">
                    <Modal.Header className="flex items-start justify-between gap-4 pb-2">
                      <div>
                        <Modal.Heading className="text-[18px] font-bold tracking-[-0.02em] text-foreground">
                          Suspend Driver Account
                        </Modal.Heading>
                        <p className="mt-1 text-[13px] text-muted">
                          {suspendingDriver.firstname} {suspendingDriver.lastname} (
                          {suspendingDriver.phone})
                        </p>
                      </div>
                    </Modal.Header>

                    <Modal.Body className="py-4 flex flex-col gap-4">
                      {suspensionAlert && (
                        <Alert status="danger">
                          <Alert.Indicator />
                          <Alert.Content>
                            <Alert.Title>{suspensionAlert}</Alert.Title>
                          </Alert.Content>
                        </Alert>
                      )}

                      <form
                        id="suspend-driver-form"
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
                            <option value="soft">Soft Suspension (Flagged account, warnings)</option>
                            <option value="hard">Hard Suspension (Blocks dispatch & takes driver offline)</option>
                          </select>
                        </div>

                        <AppInput
                          label="Duration in Hours (Optional)"
                          placeholder="e.g. 24 for 1 day, 72 for 3 days"
                          type="number"
                          errorMessage={suspendForm.formState.errors.durationHours?.message}
                          {...suspendForm.register('durationHours', { valueAsNumber: true })}
                        />

                        <AppTextarea
                          label="Official Reason"
                          placeholder="Provide the documented compliance, safety, or regulatory justification..."
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
                        onPress={() => setSuspendingDriver(null)}
                        isDisabled={suspendMutation.isPending}
                      />
                      <AppButton
                        variant="danger"
                        type="submit"
                        form="suspend-driver-form"
                        label={suspendMutation.isPending ? 'Suspending...' : 'Confirm Suspension'}
                        isLoading={suspendMutation.isPending}
                      />
                    </Modal.Footer>
                  </Modal.Dialog>
                </Modal.Container>
              </Modal.Backdrop>
            </Modal>
          )}

          {/* ── MODAL: Bulk Suspend ───────────────────────────────────── */}
          {isBulkSuspendOpen && (
            <Modal>
              <Modal.Backdrop
                isOpen={isBulkSuspendOpen}
                onOpenChange={(open) => !open && setIsBulkSuspendOpen(false)}
              >
                <Modal.Container placement="center" size="md">
                  <Modal.Dialog className="rounded-3xl bg-overlay p-7 w-full max-w-md">
                    <Modal.Header className="flex items-start justify-between gap-4 pb-2">
                      <div>
                        <Modal.Heading className="text-[18px] font-bold tracking-[-0.02em] text-foreground">
                          Bulk Suspend Drivers
                        </Modal.Heading>
                        <p className="mt-1 text-[13px] text-muted">
                          Applying suspension to {selectedDriverIds.length} driver accounts
                        </p>
                      </div>
                    </Modal.Header>

                    <Modal.Body className="py-4 flex flex-col gap-4">
                      <form
                        id="bulk-suspend-form"
                        onSubmit={bulkSuspendForm.handleSubmit((d) => bulkSuspendMutation.mutate(d))}
                        className="flex flex-col gap-4"
                      >
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[13px] font-medium text-foreground select-none">
                            Suspension Severity <span className="text-danger">*</span>
                          </label>
                          <select
                            {...bulkSuspendForm.register('type')}
                            className="w-full h-11 rounded-xl border border-field-border bg-field text-foreground px-3.5 text-sm outline-none focus:border-focus focus:ring-1 focus:ring-focus/30 transition-colors"
                          >
                            <option value="soft">Soft Suspension</option>
                            <option value="hard">Hard Suspension</option>
                          </select>
                        </div>

                        <AppTextarea
                          label="Official Reason"
                          placeholder="Document the administrative reason for this bulk suspension..."
                          isRequired
                          rows={3}
                          errorMessage={bulkSuspendForm.formState.errors.reason?.message}
                          {...bulkSuspendForm.register('reason')}
                        />
                      </form>
                    </Modal.Body>

                    <Modal.Footer className="flex items-center justify-end gap-2 pt-2">
                      <AppButton
                        variant="tertiary"
                        label="Cancel"
                        onPress={() => setIsBulkSuspendOpen(false)}
                      />
                      <AppButton
                        variant="danger"
                        type="submit"
                        form="bulk-suspend-form"
                        label={bulkSuspendMutation.isPending ? 'Processing...' : 'Execute Bulk Suspend'}
                        isLoading={bulkSuspendMutation.isPending}
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
