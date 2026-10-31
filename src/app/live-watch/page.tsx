'use client';

// src/app/live-watch/page.tsx
// Real-Time Operations Command Center (Live Watch).
// Features:
// - Interactive Telemetry Radar Map projected over Lagos operating zones
// - Live socket ingestion (`driver:location`, `admin:driver:location:update`, `trip:status:change`)
// - Real-time fleet HUD: Online Drivers, In-Flight Trips, Available, Utilization %
// - Filtering by vehicle class, driver status, and search query
// - Interactive slide-over drawer with driver telemetry, in-flight trip progress, and instant actions
// - Built on HeroUI compound components, Phosphor duotone icons, Satoshi font, and Kero semantic tokens

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Broadcast,
  SteeringWheel,
  Path,
  NavigationArrow,
  MapPin,
  MagnifyingGlass,
  Funnel,
  ArrowsClockwise,
  Phone,
  Star,
  Car,
  ShieldCheck,
  X,
  Circle,
  Pulse,
  WarningOctagon,
  ArrowRight,
  User,
  CurrencyNgn,
  Clock,
} from '@phosphor-icons/react';
import { Card, Chip, Modal } from '@heroui/react';
import { AppButton } from '@/components/ui/app-button';
import { AppInput } from '@/components/ui/app-input';
import { AppSelect } from '@/components/ui/app-select';
import { DashboardCard, StatDashboardCard } from '@/components/ui/dashboard-card';
import { Page, PageHeader, SectionHeader, Segmented, StatusPill } from '@/components/ui/page';
import { UserAvatar } from '@/components/ui/user-avatar';
import { RealLiveMap } from '@/components/live-watch/real-live-map';
import { PermissionGuard } from '@/components/auth/can';
import { api } from '@/lib/api';
import { getAdminSocket } from '@/lib/socket';
import { formatKoboToNaira } from '@/lib/utils';
import { LiveTrip, OnlineDriver } from '@/types/admin';



/** Driver status as shown in the online drivers table. */
const DRIVER_STATE: Record<string, { label: string; tone: 'success' | 'accent' | 'warning' | 'neutral' }> = {
  AVAILABLE: { label: 'Free', tone: 'success' },
  IN_TRIP: { label: 'On a trip', tone: 'accent' },
  BACKGROUND: { label: 'App in background', tone: 'warning' },
};

export default function LiveWatchPage() {
  const queryClient = useQueryClient();
  const [selectedDriver, setSelectedDriver] = useState<OnlineDriver | null>(null);
  const [selectedTrip, setSelectedTrip] = useState<LiveTrip | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'AVAILABLE' | 'IN_TRIP'>('all');
  const [filterVehicleType, setFilterVehicleType] = useState<string>('all');
  const [search, setSearch] = useState('');
    const [tab, setTab] = useState<'map' | 'trips' | 'drivers'>('map');
  const [isSocketLive, setIsSocketLive] = useState(false);

  // ── Query: Online Drivers ──────────────────────────────────────────
  const {
    data: driversData,
    isLoading: isLoadingDrivers,
    refetch: refetchDrivers,
  } = useQuery<{ total: number; drivers: OnlineDriver[] }>({
    queryKey: ['admin', 'live', 'drivers'],
    queryFn: async () => {
      const res = await api.get<{ data: { total: number; drivers: OnlineDriver[] } }>(
        '/admin/drivers/online',
      );
      return res.data?.data ?? { total: 0, drivers: [] };
    },
    refetchInterval: 15000,
  });

  // ── Query: Active In-Flight Trips ───────────────────────────────────
  const {
    data: tripsData,
    isLoading: isLoadingTrips,
    refetch: refetchTrips,
  } = useQuery<{ total: number; trips: LiveTrip[] }>({
    queryKey: ['admin', 'live', 'trips'],
    queryFn: async () => {
      const res = await api.get<{ data: { total: number; trips: LiveTrip[] } }>(
        '/admin/live-trips',
      );
      return res.data?.data ?? { total: 0, trips: [] };
    },
    refetchInterval: 10000,
  });

  const driversList = driversData?.drivers ?? [];
  const tripsList = tripsData?.trips ?? [];

  // ── Realtime Socket Stream Connection ───────────────────────────────
  useEffect(() => {
    const socket = getAdminSocket();
    if (!socket) return;

    if (socket.connected) {
      setIsSocketLive(true);
      socket.emit('admin:room:join', 'live-watch');
    }

    const onConnect = () => {
      setIsSocketLive(true);
      socket.emit('admin:room:join', 'live-watch');
    };

    const onDisconnect = () => {
      setIsSocketLive(false);
    };

    // Live driver coordinate update from mobile GPS stream
    const onDriverLocationUpdate = (payload: {
      driverId: string;
      lat: number;
      lng: number;
      heading?: number;
      updatedAt?: string;
    }) => {
      queryClient.setQueryData(
        ['admin', 'live', 'drivers'],
        (old: { total: number; drivers: OnlineDriver[] } | undefined) => {
          if (!old) return old;
          return {
            ...old,
            drivers: old.drivers.map((d) => {
              if (d.driverId !== payload.driverId) return d;
              return {
                ...d,
                location: {
                  lat: payload.lat,
                  lng: payload.lng,
                  heading: payload.heading ?? d.location?.heading ?? 0,
                  updatedAt: payload.updatedAt ?? new Date().toISOString(),
                },
              };
            }),
          };
        },
      );
    };

    // Trip lifecycle transition (assigned -> in_progress -> completed/cancelled)
    const onTripStatusChange = () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'live', 'trips'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'live', 'drivers'] });
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('admin:driver:location:update', onDriverLocationUpdate);
    socket.on('driver:location', onDriverLocationUpdate);
    socket.on('admin:trip:status:change', onTripStatusChange);
    socket.on('trip:status:change', onTripStatusChange);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('admin:driver:location:update', onDriverLocationUpdate);
      socket.off('driver:location', onDriverLocationUpdate);
      socket.off('admin:trip:status:change', onTripStatusChange);
      socket.off('trip:status:change', onTripStatusChange);
      socket.emit('admin:room:leave', 'live-watch');
    };
  }, [queryClient]);

  // ── Metrics HUD Calculation ─────────────────────────────────────────
  const totalDrivers = driversList.length;
  const inTripDrivers = driversList.filter((d) => d.status === 'IN_TRIP').length;
  const availableDrivers = driversList.filter((d) => d.status === 'AVAILABLE').length;
  const fleetUtilization = totalDrivers > 0 ? Math.round((inTripDrivers / totalDrivers) * 100) : 0;

  // ── Filter Drivers ──────────────────────────────────────────────────
  const filteredDrivers = useMemo(() => {
    return driversList.filter((driver) => {
      // Status filter
      if (filterStatus !== 'all' && driver.status !== filterStatus) return false;
      // Vehicle type filter
      if (filterVehicleType !== 'all') {
        const type = driver.vehicle?.type?.toLowerCase();
        if (!type || !type.includes(filterVehicleType.toLowerCase())) return false;
      }
      // Text search
      if (search.trim()) {
        const q = search.toLowerCase();
        const fullName = `${driver.firstname ?? ''} ${driver.lastname ?? ''}`.toLowerCase();
        const phone = driver.phone?.toLowerCase() ?? '';
        const plate = driver.vehicle?.licensePlate?.toLowerCase() ?? '';
        const model = driver.vehicle?.model?.toLowerCase() ?? '';
        if (
          !fullName.includes(q) &&
          !phone.includes(q) &&
          !plate.includes(q) &&
          !model.includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [driversList, filterStatus, filterVehicleType, search]);

  return (
    <PermissionGuard permission="view_live_watch">
        <Page className="max-w-[1440px]">
          <PageHeader
            title="Live watch"
            badge={
              <StatusPill tone={isSocketLive ? 'success' : 'neutral'} dot pulse={isSocketLive}>
                {isSocketLive ? 'Live' : 'Polling'}
              </StatusPill>
            }
            description="Drivers and trips moving right now."
            actions={
              <>
                <AppButton
                  variant="tertiary"
                  isIconOnly
                  aria-label="Refresh"
                  startContent={<ArrowsClockwise />}
                  onPress={() => {
                    refetchDrivers();
                    refetchTrips();
                  }}
                />
              </>
            }
          />

          <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
            <StatDashboardCard label="Online drivers" value={totalDrivers} icon={SteeringWheel} hint="Sending location" />
            <StatDashboardCard label="Trips in progress" value={tripsList.length} icon={Path} hint="Riders on board" />
            <StatDashboardCard label="Available" value={availableDrivers} icon={NavigationArrow} hint="Ready for dispatch" />
            <StatDashboardCard
              label="Utilisation"
              value={`${fleetUtilization}%`}
              icon={Pulse}
              hint={`${inTripDrivers} of ${totalDrivers} on a trip`}
            />
          </div>

          <Segmented
            aria-label="Live view"
            value={tab}
            onChange={setTab}
            options={[
              { key: 'map', label: 'Map' },
              { key: 'trips', label: 'Trips in progress', count: tripsList.length },
              { key: 'drivers', label: 'Online drivers', count: filteredDrivers.length },
            ]}
          />

          {tab !== 'trips' && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <Segmented
                size="sm"
                aria-label="Driver status"
                value={filterStatus}
                onChange={setFilterStatus}
                options={[
                  { key: 'all', label: 'All', count: totalDrivers },
                  { key: 'AVAILABLE', label: 'Available', count: availableDrivers },
                  { key: 'IN_TRIP', label: 'On trip', count: inTripDrivers },
                ]}
              />
              <div className="w-40">
                <AppSelect
                  size="sm"
                  aria-label="Vehicle class"
                  options={[
                    { key: 'all', label: 'All vehicles' },
                    { key: 'standard', label: 'Standard' },
                    { key: 'comfort', label: 'Comfort' },
                    { key: 'keke', label: 'Keke' },
                  ]}
                  selectedKey={filterVehicleType}
                  onSelectionChange={(key) => setFilterVehicleType(key)}
                />
              </div>
            </div>

            <div className="w-full sm:w-64">
              <AppInput
                size="sm"
                placeholder="Search driver or plate"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                startContent={<MagnifyingGlass />}
                endContent={
                  search ? (
                    <button type="button" onClick={() => setSearch('')} className="cursor-pointer text-muted hover:text-foreground">
                      <X size={14} />
                    </button>
                  ) : null
                }
              />
            </div>
          </div>
          )}

          {/* Workspace: one full-width view per tab */}
          <div className="flex flex-col gap-6">
            {/* Real Street Map Canvas */}
            {tab === 'map' && (
              <div
                className="relative h-[calc(100vh-320px)] min-h-[560px] overflow-hidden rounded-3xl bg-surface shadow-none"
              >
                <RealLiveMap
                  drivers={filteredDrivers}
                  trips={tripsList}
                  selectedDriver={selectedDriver}
                  selectedTrip={selectedTrip}
                  onSelectDriver={(driver) => {
                    setSelectedDriver(driver);
                    const trip = tripsList.find((t) => t.driver?.id === driver.driverId);
                    setSelectedTrip(trip ?? null);
                  }}
                  onSelectTrip={(trip) => {
                    setSelectedTrip(trip);
                    const driver = driversList.find((d) => d.driverId === trip.driver?.id);
                    setSelectedDriver(driver ?? null);
                  }}
                  isSocketLive={isSocketLive}
                />
              </div>
            )}

            {/* Active Trips Stream & Drivers Roster */}
            {tab !== 'map' && (
              <div className="flex flex-col gap-4">
                {/* Active Trips Card */}
                {tab === 'trips' && (
                <DashboardCard>
                  <SectionHeader
                    title="Trips in progress"
                    actions={<StatusPill tone="brand">{tripsList.length} live</StatusPill>}
                  />

                  <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
                    {tripsList.length === 0 ? (
                      <p className="col-span-full py-10 text-center text-sm text-muted">
                        No active trips currently in transit.
                      </p>
                    ) : (
                      tripsList.map((trip) => (
                        <div
                          key={trip.tripId}
                          onClick={() => {
                            setSelectedTrip(trip);
                            const driver = driversList.find((d) => d.driverId === trip.driver?.id);
                            setSelectedDriver(driver ?? null);
                          }}
                          className={`p-3 rounded-2xl transition-colors cursor-pointer ${
                            selectedTrip?.tripId === trip.tripId
                              ? 'bg-secondary-soft/40'
                              : 'bg-field/40 hover:bg-field/70'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 min-w-0">
                              <UserAvatar
                                src={trip.rider.avatarUrl || trip.rider.profileImage}
                                name={trip.rider.name}
                                size="xs"
                              />
                              <span className="text-xs font-bold text-foreground truncate">
                                {trip.rider.name}
                              </span>
                            </div>
                            <span className="text-xs font-semibold text-secondary tabular shrink-0">
                              {formatKoboToNaira(trip.fare)}
                            </span>
                          </div>

                          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted">
                            <MapPin size={12} className="shrink-0 text-success" />
                            <span className="truncate">{trip.pickup.address}</span>
                          </div>
                          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted">
                            <MapPin size={12} className="shrink-0 text-danger" />
                            <span className="truncate">{trip.destination.address}</span>
                          </div>

                          {trip.driver && (
                            <div className="mt-2 flex items-center justify-between text-[11px] text-muted pt-1">
                              <span>Driver: {trip.driver.name}</span>
                              <span className="tabular text-foreground font-medium">
                                {trip.vehicle?.licensePlate}
                              </span>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </DashboardCard>
                )}

                {/* Online Drivers Card */}
                {tab === 'drivers' && (
                <DashboardCard className="flex-1 overflow-hidden p-0">
                  <SectionHeader
                    className="p-6 pb-4"
                    title="Online drivers"
                    actions={<span className="tabular text-[13px] text-muted">{filteredDrivers.length} shown</span>}
                  />
                  <div className="overflow-x-auto">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Driver</th>
                          <th>Vehicle</th>
                          <th>Status</th>
                          <th>Last update</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredDrivers.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="py-10 text-center text-sm text-muted">
                              No drivers matching filters.
                            </td>
                          </tr>
                        ) : (
                          filteredDrivers.map((driver) => {
                            const state = DRIVER_STATE[driver.status] ?? { label: driver.status.toLowerCase(), tone: 'neutral' as const };
                            return (
                              <tr
                                key={driver.driverId}
                                onClick={() => {
                                  setSelectedDriver(driver);
                                  const trip = tripsList.find((t) => t.driver?.id === driver.driverId);
                                  setSelectedTrip(trip ?? null);
                                }}
                                className={`cursor-pointer ${selectedDriver?.driverId === driver.driverId ? 'bg-accent-soft/40' : ''}`}
                              >
                                <td>
                                  <div className="flex items-center gap-2.5">
                                    <UserAvatar src={driver.avatarUrl || driver.selfieUrl} name={`${driver.firstname} ${driver.lastname}`} size="sm" />
                                    <span className="font-medium text-foreground">
                                      {driver.firstname} {driver.lastname}
                                    </span>
                                  </div>
                                </td>
                                <td className="text-muted">
                                  {driver.vehicle?.model ?? 'Vehicle'} · {driver.vehicle?.licensePlate ?? 'No plate'}
                                </td>
                                <td>
                                  <StatusPill tone={state.tone} dot>
                                    {state.label}
                                  </StatusPill>
                                </td>
                                <td className="tabular text-muted">
                                  {driver.location?.updatedAt ? new Date(driver.location.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </DashboardCard>
                )}
              </div>
            )}
          </div>

          {/* Centered Modal Telemetry Details */}
          <Modal
            isOpen={Boolean(selectedDriver)}
            onOpenChange={(isOpen) => {
              if (!isOpen) {
                setSelectedDriver(null);
                setSelectedTrip(null);
              }
            }}
          >
            <Modal.Backdrop variant="blur">
              <Modal.Container placement="center" size="lg">
                <Modal.Dialog className="rounded-3xl bg-overlay p-7 max-h-[90vh] overflow-y-auto">
                  {selectedDriver && (
                    <>
                      <div className="flex items-start justify-between pb-4">
                        <div className="flex items-center gap-3">
                          <UserAvatar
                            src={selectedDriver.avatarUrl || selectedDriver.selfieUrl}
                            name={`${selectedDriver.firstname} ${selectedDriver.lastname}`}
                            size="lg"
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-[18px] font-bold tracking-[-0.02em] text-foreground">
                                {selectedDriver.firstname} {selectedDriver.lastname}
                              </h3>
                              <Chip
                                size="sm"
                                className={
                                  selectedDriver.status === 'AVAILABLE'
                                    ? 'bg-success-soft text-success font-semibold'
                                    : 'bg-accent-soft text-accent font-semibold'
                                }
                              >
                                {selectedDriver.status}
                              </Chip>
                            </div>
                            <div className="mt-1 flex items-center gap-3 text-xs text-muted">
                              <span className="flex items-center gap-1">
                                <Phone size={13} weight="duotone" />
                                {selectedDriver.phone ?? 'N/A'}
                              </span>
                              <span className="flex items-center gap-1 text-warning">
                                <Star size={13} weight="fill" />
                                {selectedDriver.rating?.toFixed(1) ?? '5.0'}
                              </span>
                              <span className="flex items-center gap-1 tabular">
                                <Car size={13} weight="duotone" />
                                {selectedDriver.vehicle?.licensePlate} ({selectedDriver.vehicle?.model})
                              </span>
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedDriver(null);
                            setSelectedTrip(null);
                          }}
                          className="rounded-xl p-2 text-muted hover:bg-field hover:text-foreground cursor-pointer"
                        >
                          <X size={18} />
                        </button>
                      </div>

                      {/* Active Trip Context (if on trip) */}
                      {selectedTrip ? (
                        <div className="mt-4 rounded-2xl bg-surface-secondary p-5">
                          <div className="flex items-center justify-between">
                            <span className="text-[13px] font-medium text-muted">
                              Current trip
                            </span>
                            <span className="text-sm font-bold text-foreground tabular">
                              {formatKoboToNaira(selectedTrip.fare)}
                            </span>
                          </div>

                          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div>
                              <span className="text-[11px] font-medium text-muted">Passenger</span>
                              <div className="flex items-center gap-2 mt-1">
                                <UserAvatar
                                  src={selectedTrip.rider.avatarUrl || selectedTrip.rider.profileImage}
                                  name={selectedTrip.rider.name}
                                  size="xs"
                                />
                                <p className="text-xs font-bold text-foreground truncate">
                                  {selectedTrip.rider.name} ({selectedTrip.rider.phone ?? 'N/A'})
                                </p>
                              </div>
                            </div>

                            <div>
                              <span className="text-[11px] font-medium text-muted">Route</span>
                              <p className="text-xs text-foreground mt-0.5 truncate">
                                {selectedTrip.pickup.address} → {selectedTrip.destination.address}
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-4 flex items-center justify-between rounded-2xl bg-surface-secondary p-4 text-[13px] text-muted">
                          <span>Available for dispatch.</span>
                          <Link href="/trips">
                            <AppButton
                              variant="brand"
                              size="sm"
                              startContent={<NavigationArrow />}
                              label="Dispatch"
                            />
                          </Link>
                        </div>
                      )}
                    </>
                  )}
                </Modal.Dialog>
              </Modal.Container>
            </Modal.Backdrop>
          </Modal>
        </Page>
      </PermissionGuard>
  );
}
