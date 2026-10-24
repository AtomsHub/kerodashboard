'use client';

// src/app/fleet/maintenance/page.tsx
// Phase 5: Vehicle Maintenance, Servicing & Inspection Scheduling
import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Wrench,
  Car,
  Plus,
  ArrowClockwise,
  CaretLeft,
  WarningCircle,
  CheckCircle,
  XCircle,
  Clock,
  ShieldCheck,
  CalendarCheck,
  FirstAid,
  MapPin,
  ArrowsCounterClockwise,
} from '@phosphor-icons/react';
import { Card, Chip, Modal } from '@heroui/react';
import { toast } from 'sonner';
import { AppButton } from '@/components/ui/app-button';
import { AppInput } from '@/components/ui/app-input';
import { AppTextarea } from '@/components/ui/app-textarea';
import { DashboardCard, StatDashboardCard } from '@/components/ui/dashboard-card';
import { EmptyState, Page, PageHeader, SectionHeader, StatusPill } from '@/components/ui/page';
import { FleetTabs } from '@/components/fleet/fleet-tabs';
import { PermissionGuard, Can } from '@/components/auth/can';
import { api } from '@/lib/api';
import { applyApiFormError } from '@/lib/errors';
import {
  FleetHealthResponse,
  FleetVehicleItem,
} from '@/types/admin';

export default function FleetMaintenancePage() {
  const queryClient = useQueryClient();
  const [selectedVehicle, setSelectedVehicle] = useState<FleetVehicleItem | null>(null);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [pendingReturnVehicle, setPendingReturnVehicle] = useState<FleetVehicleItem | null>(null);

  // ── Query: Fleet Health & Alerts ────────────────────────────────────
  const {
    data: healthData,
    isLoading: isHealthLoading,
    refetch: refetchHealth,
    isFetching,
  } = useQuery<FleetHealthResponse>({
    queryKey: ['admin', 'fleet', 'health'],
    queryFn: async () => {
      try {
        const res = await api.get<{ data: FleetHealthResponse }>('/admin/fleet/health');
        if (res.data?.data?.summary) return res.data.data;
      } catch (err) {
        throw err;
      }
      throw new Error('Unexpected response from server');
    },
  });

  // ── Query: Maintenance Vehicles ─────────────────────────────────────
  const { data: maintenanceVehicles, refetch: refetchVehicles } = useQuery<FleetVehicleItem[]>({
    queryKey: ['admin', 'fleet', 'vehicles', 'maintenance'],
    queryFn: async () => {
      try {
        const res = await api.get<{ data: { vehicles: FleetVehicleItem[] } }>('/admin/fleet/vehicles?status=maintenance');
        if (res.data?.data?.vehicles) return res.data.data.vehicles;
      } catch (err) {
        throw err;
      }
      return [];
    },
  });

  // ── Mutation: Return to Service (Available) ─────────────────────────
  const returnToServiceMutation = useMutation({
    mutationFn: async (vehicleId: string) => {
      const res = await api.put(`/admin/fleet/vehicles/${vehicleId}/status`, {
        status: 'available',
        reason: 'Maintenance and inspection completed. Passed roadworthiness test.',
        nextInspectionDue: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Vehicle cleared from maintenance. Returned to active fleet.');
      refetchHealth();
      refetchVehicles();
    },
    onError: (err: any) => {
      toast.error(`Failed to return vehicle to service: ${err?.message || 'Error'}`);
    },
  });

  const summary = healthData?.summary;

  return (
    <PermissionGuard permission="view_fleet">
      <Page>
          <PageHeader
            title="Fleet"
            description="Servicing, inspections and vehicles in the shop."
            actions={
              <AppButton
                variant="tertiary"
                startContent={<ArrowClockwise className={isFetching ? 'animate-spin' : ''} />}
                label="Refresh"
                onPress={() => {
                  refetchHealth();
                  refetchVehicles();
                }}
              />
            }
          />

          <FleetTabs />

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <StatDashboardCard
              label="Operational"
              icon={CheckCircle}
              variant="wallet"
              value={summary ? `${Math.round((summary.activeVehicles / (summary.totalVehicles || 1)) * 100)}%` : '—'}
              hint={`${summary?.activeVehicles ?? 0} of ${summary?.totalVehicles ?? 0} vehicles`}
            />
            <StatDashboardCard label="In the shop" icon={Wrench} value={summary?.maintenanceVehicles ?? 0} hint="Servicing or repairs" />
            <StatDashboardCard
              label="Inspection overdue"
              icon={WarningCircle}
              value={(healthData?.alerts || []).filter((a) => a.type === 'inspection_overdue').length}
              hint="Re-certify before driving"
            />
            <StatDashboardCard label="Unassigned" icon={Car} value={summary?.unassignedVehicles ?? 0} hint="Waiting in depots" />
          </div>

          {(healthData?.alerts || []).length > 0 && (
            <DashboardCard>
              <SectionHeader title="Alerts" description="Vehicles that need attention" />
              <ul className="-mx-2 mt-4 space-y-0.5">
                {(healthData?.alerts || []).map((alert, idx) => (
                  <li
                    key={idx}
                    className="flex items-center justify-between gap-4 rounded-2xl px-2 py-2.5 transition-colors hover:bg-surface-secondary"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className={`grid size-10 shrink-0 place-items-center rounded-xl ${
                          alert.type === 'inspection_overdue'
                            ? 'bg-danger-soft text-danger'
                            : alert.type === 'long_maintenance'
                              ? 'bg-warning-soft text-warning'
                              : 'bg-default text-foreground'
                        }`}
                      >
                        <FirstAid size={20} />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[14px] font-medium text-foreground">{alert.message}</p>
                        <p className="text-xs capitalize text-muted">{alert.type.replace(/_/g, ' ')}</p>
                      </div>
                    </div>
                    {alert.vehicleId && (
                      <Link href={`/fleet?search=${alert.vehicleId}`}>
                        <AppButton size="sm" variant="tertiary" label="View" />
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </DashboardCard>
          )}

          <DashboardCard className="overflow-hidden p-0">
            <SectionHeader
              className="p-6 pb-4"
              title="In the shop"
              actions={
                <span className="tabular text-[13px] text-muted">{(maintenanceVehicles || []).length} work orders</span>
              }
            />

            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Vehicle</th>
                    <th>Model</th>
                    <th>Depot</th>
                    <th>Inspection due</th>
                    <th>Status</th>
                    <th className="text-right" />
                  </tr>
                </thead>
                <tbody>
                  {(maintenanceVehicles || []).length === 0 ? (
                    <tr>
                      <td colSpan={6}>
                        <EmptyState icon={CheckCircle} title="Nothing in the shop" description="Every vehicle is on the road." />
                      </td>
                    </tr>
                  ) : (
                    maintenanceVehicles?.map((v) => {
                      const overdue = v.nextInspectionDue && new Date(v.nextInspectionDue) < new Date();
                      return (
                        <tr key={v.id}>
                          <td className="tabular font-medium text-foreground">{v.licensePlate}</td>
                          <td>
                            <div className="text-foreground">
                              {v.brand} {v.model}
                            </div>
                            <div className="text-xs text-muted">
                              {v.color} · {v.year}
                            </div>
                          </td>
                          <td className="text-muted">{v.fleetZone?.name || '—'}</td>
                          <td className={`tabular whitespace-nowrap ${overdue ? 'font-medium text-danger' : 'text-muted'}`}>
                            {v.nextInspectionDue
                              ? new Date(v.nextInspectionDue).toLocaleDateString('en-NG', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                })
                              : '—'}
                          </td>
                          <td>
                            <StatusPill tone="warning" dot>
                              Servicing
                            </StatusPill>
                          </td>
                          <td className="text-right">
                            <Can permission="manage_fleet">
                              <AppButton
                                size="sm"
                                variant="tertiary"
                                startContent={<CheckCircle />}
                                label="Return to fleet"
                                isLoading={returnToServiceMutation.isPending && returnToServiceMutation.variables === v.id}
                                onPress={() => setPendingReturnVehicle(v)}
                              />
                            </Can>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </DashboardCard>
      </Page>

        {/* ── Confirmation Modal: Return to Active Service ────────────────── */}
        <Modal>
          <Modal.Backdrop
            isOpen={Boolean(pendingReturnVehicle)}
            onOpenChange={(open) => !open && setPendingReturnVehicle(null)}
          >
            <Modal.Container placement="center" size="sm">
              <Modal.Dialog className="rounded-3xl bg-overlay p-7">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div>
                      <h3 className="text-[18px] font-bold tracking-[-0.02em] text-foreground">
                        Return to fleet
                      </h3>
                      <p className="mt-1 text-[13px] text-muted">
                        Asset: <span className="tabular font-bold text-foreground">{pendingReturnVehicle?.licensePlate}</span>
                      </p>
                    </div>
                  </div>

                  <p className="text-[13px] text-muted">
                    This confirms servicing is done and the vehicle is roadworthy.
                  </p>

                  <div className="flex items-center justify-end gap-3 pt-2">
                    <AppButton
                      variant="ghost"
                      size="sm"
                      onClick={() => setPendingReturnVehicle(null)}
                    >
                      Cancel
                    </AppButton>
                    <AppButton
                      variant="primary"
                      size="sm"
                      isLoading={returnToServiceMutation.isPending}
                      onClick={() => {
                        if (pendingReturnVehicle) {
                          returnToServiceMutation.mutate(pendingReturnVehicle.id, {
                            onSettled: () => setPendingReturnVehicle(null),
                          });
                        }
                      }}
                    >
                      Return to fleet
                    </AppButton>
                  </div>
                </div>
              </Modal.Dialog>
            </Modal.Container>
          </Modal.Backdrop>
        </Modal>
    </PermissionGuard>
  );
}
