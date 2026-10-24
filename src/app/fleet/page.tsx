'use client';

// src/app/fleet/page.tsx
// Phase 5: Fleet Vehicle Inventory & Driver Asset Assignment
import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Car,
  Jeep,
  Plus,
  ArrowClockwise,
  MagnifyingGlass,
  Funnel,
  Wrench,
  MapPin,
  User,
  UserMinus,
  CheckCircle,
  XCircle,
  Clock,
  WarningCircle,
  ShieldCheck,
  IdentificationBadge,
  CalendarCheck,
  CaretLeft,
  CaretRight,
  DotsThreeVertical,
} from '@phosphor-icons/react';
import { Card, Chip, Modal, Dropdown } from '@heroui/react';
import { toast } from 'sonner';
import { AppButton } from '@/components/ui/app-button';
import { AppInput } from '@/components/ui/app-input';
import { AppRowActions } from '@/components/ui/app-row-actions';
import { DashboardCard, StatDashboardCard } from '@/components/ui/dashboard-card';
import { EmptyState, Page, PageHeader, Segmented, SkeletonRows, StatusPill } from '@/components/ui/page';
import { FleetTabs } from '@/components/fleet/fleet-tabs';
import { AppTextarea } from '@/components/ui/app-textarea';
import { PermissionGuard, Can } from '@/components/auth/can';
import { api } from '@/lib/api';
import { applyApiFormError } from '@/lib/errors';
import {
  FleetVehicleItem,
  FleetVehicleListResponse,
  VehicleTypePricingItem,
  FleetZoneItem,
  AdminDriverListItem,
} from '@/types/admin';
import {
  createVehicleSchema,
  vehicleStatusChangeSchema,
  assignVehicleSchema,
  unassignVehicleSchema,
  type CreateVehicleInput,
  type VehicleStatusChangeInput,
  type AssignVehicleInput,
  type UnassignVehicleInput,
} from '@/lib/schemas/admin.schemas';

export default function FleetPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<FleetVehicleItem | null>(null);

  // ── Query: Fleet Vehicles ───────────────────────────────────────────
  const {
    data: fleetData,
    isLoading,
    refetch,
    isFetching,
  } = useQuery<FleetVehicleListResponse>({
    queryKey: ['admin', 'fleet', 'vehicles', page, limit, search, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      if (search.trim()) params.set('search', search.trim());
      if (statusFilter !== 'all') params.set('status', statusFilter);

      try {
        const res = await api.get<{ data: FleetVehicleListResponse }>('/admin/fleet/vehicles?' + params.toString());
        if (res.data?.data?.vehicles) {
          return res.data.data;
        }
      } catch (err) {
        throw err;
      }
      throw new Error('Unexpected response from server');
    },
  });

  // ── Query: Vehicle Types ────────────────────────────────────────────
  const { data: vehicleTypes } = useQuery<VehicleTypePricingItem[]>({
    queryKey: ['admin', 'vehicle-types'],
    queryFn: async () => {
      try {
        const res = await api.get<{ data: VehicleTypePricingItem[] }>('/pricing/vehicle-types');
        return res.data?.data || [];
      } catch (err) {
        throw err;
      }
    },
  });

  // ── Query: Fleet Zones ──────────────────────────────────────────────
  const { data: fleetZones } = useQuery<FleetZoneItem[]>({
    queryKey: ['admin', 'fleet', 'zones'],
    queryFn: async () => {
      try {
        const res = await api.get<{ data: { zones: FleetZoneItem[] } | FleetZoneItem[] }>('/admin/fleet/zones');
        const raw = res.data?.data;
        if (raw && !Array.isArray(raw) && Array.isArray(raw.zones)) return raw.zones;
        if (Array.isArray(raw)) return raw;
      } catch (err) {
        throw err;
      }
      return [];
    },
  });

  // ── Query: Available Drivers for Assignment ─────────────────────────
  const { data: availableDrivers } = useQuery<AdminDriverListItem[]>({
    queryKey: ['admin', 'drivers', 'unassigned'],
    queryFn: async () => {
      try {
        const res = await api.get<{ data: { drivers: AdminDriverListItem[] } }>('/admin/drivers?limit=50&status=active');
        return res.data?.data?.drivers || [];
      } catch (err) {
        throw err;
      }
    },
  });

  // ── Form: Create Vehicle ────────────────────────────────────────────
  const {
    register: registerVehicle,
    handleSubmit: handleVehicleSubmit,
    formState: { errors: vehicleErrors, isSubmitting: isCreatingVehicle },
    reset: resetVehicleForm,
    setError: setVehicleError,
  } = useForm<CreateVehicleInput>({
    resolver: zodResolver(createVehicleSchema) as any,
    defaultValues: {
      licensePlate: '',
      brand: 'Toyota',
      model: 'Corolla',
      color: 'Silver',
      year: 2021,
      capacity: 4,
      vehicleTypeId: '',
      isOwnerVehicle: false,
    },
  });

  // ── Form: Change Vehicle Status ─────────────────────────────────────
  const {
    register: registerStatus,
    handleSubmit: handleStatusSubmit,
    formState: { errors: statusErrors, isSubmitting: isUpdatingStatus },
    reset: resetStatusForm,
    setError: setStatusError,
  } = useForm<VehicleStatusChangeInput>({
    resolver: zodResolver(vehicleStatusChangeSchema) as any,
    defaultValues: {
      status: 'maintenance',
      reason: 'Scheduled brake pad replacement & 5,000km oil service',
    },
  });

  // ── Form: Assign Vehicle ────────────────────────────────────────────
  const {
    register: registerAssign,
    handleSubmit: handleAssignSubmit,
    formState: { errors: assignErrors, isSubmitting: isAssigning },
    reset: resetAssignForm,
    setError: setAssignError,
  } = useForm<AssignVehicleInput>({
    resolver: zodResolver(assignVehicleSchema) as any,
    defaultValues: {
      driverId: '',
      vehicleId: '',
      reason: 'Driver shift allocation',
    },
  });

  // ── Mutation: Create Vehicle ────────────────────────────────────────
  const createVehicleMutation = useMutation({
    mutationFn: async (values: CreateVehicleInput) => {
      const res = await api.post('/admin/fleet/vehicles', values);
      return res.data;
    },
    onSuccess: () => {
      toast.success('New fleet vehicle registered.');
      setIsAddModalOpen(false);
      resetVehicleForm();
      refetch();
    },
    onError: (err: any) => {
      applyApiFormError(err, { setError: setVehicleError });
    },
  });

  // ── Mutation: Change Status ─────────────────────────────────────────
  const statusMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: VehicleStatusChangeInput }) => {
      const res = await api.put(`/admin/fleet/vehicles/${id}/status`, data);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Vehicle operational status updated.');
      setIsStatusModalOpen(false);
      setSelectedVehicle(null);
      refetch();
    },
    onError: (err: any) => {
      applyApiFormError(err, { setError: setStatusError });
    },
  });

  // ── Mutation: Assign Driver ─────────────────────────────────────────
  const assignMutation = useMutation({
    mutationFn: async (data: AssignVehicleInput) => {
      const res = await api.post('/admin/fleet/assign', data);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Driver assigned to vehicle.');
      setIsAssignModalOpen(false);
      setSelectedVehicle(null);
      refetch();
    },
    onError: (err: any) => {
      applyApiFormError(err, { setError: setAssignError });
    },
  });

  // ── Mutation: Unassign Driver ───────────────────────────────────────
  const unassignMutation = useMutation({
    mutationFn: async (data: UnassignVehicleInput) => {
      const res = await api.post('/admin/fleet/unassign', data);
      return res.data;
    },
    onSuccess: () => {
      toast.info('Driver unassigned from vehicle.');
      refetch();
    },
    onError: (err: any) => {
      toast.error(`Unassignment failed: ${err?.message || 'Error'}`);
    },
  });

  const onVehicleSubmit = (values: any) => {
    createVehicleMutation.mutate(values as CreateVehicleInput);
  };

  const onStatusSubmit = (values: any) => {
    if (!selectedVehicle) return;
    statusMutation.mutate({ id: selectedVehicle.id, data: values as VehicleStatusChangeInput });
  };

  const onAssignSubmit = (values: any) => {
    assignMutation.mutate(values as AssignVehicleInput);
  };

  const openAssignModal = (vehicle: FleetVehicleItem) => {
    setSelectedVehicle(vehicle);
    resetAssignForm({
      vehicleId: vehicle.id,
      driverId: availableDrivers?.[0]?.id || '',
      reason: `Assigned vehicle ${vehicle.licensePlate} (${vehicle.model})`,
    });
    setIsAssignModalOpen(true);
  };

  const openStatusModal = (vehicle: FleetVehicleItem) => {
    setSelectedVehicle(vehicle);
    resetStatusForm({
      status: vehicle.status === 'maintenance' ? 'available' : 'maintenance',
      reason: vehicle.status === 'maintenance' ? 'Maintenance complete. Returned to active fleet.' : 'Scheduled servicing and inspection.',
    });
    setIsStatusModalOpen(true);
  };

  const totalCount = fleetData?.total ?? 0;
  const availableCount = (fleetData?.vehicles || []).filter((v) => v.status === 'available').length;
  const assignedCount = (fleetData?.vehicles || []).filter((v) => v.status === 'assigned').length;
  const maintenanceCount = (fleetData?.vehicles || []).filter((v) => v.status === 'maintenance').length;

  return (
    <PermissionGuard permission="view_fleet">
      <Page>
          <PageHeader
            title="Fleet"
            description="Company vehicles, assignments and inspections."
            actions={
              <>
                <AppButton
                  variant="tertiary"
                  isIconOnly
                  aria-label="Refresh"
                  startContent={<ArrowClockwise />}
                  onPress={() => refetch()}
                />
                <Can permission="manage_fleet">
                  <AppButton
                    variant="brand"
                    startContent={<Plus weight="bold" />}
                    label="Add vehicle"
                    onPress={() => {
                      resetVehicleForm({
                        licensePlate: '',
                        brand: 'Toyota',
                        model: 'Corolla',
                        color: 'Silver Grey',
                        year: 2021,
                        capacity: 4,
                        vehicleTypeId: vehicleTypes?.[0]?.id || '',
                        fleetZoneId: fleetZones?.[0]?.id || '',
                        isOwnerVehicle: false,
                      });
                      setIsAddModalOpen(true);
                    }}
                  />
                </Can>
              </>
            }
          />

          <FleetTabs />

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <StatDashboardCard label="Vehicles" icon={Car} variant="wallet" value={totalCount} hint="Kero Lagos fleet" />
            <StatDashboardCard label="Assigned" icon={IdentificationBadge} value={assignedCount} hint="On the road" />
            <StatDashboardCard label="In the yard" icon={Clock} value={availableCount} hint="Ready to pair" />
            <StatDashboardCard label="In maintenance" icon={Wrench} value={maintenanceCount} hint="Servicing or inspection" />
          </div>

          <DashboardCard className="overflow-hidden p-0">
            <div className="flex flex-col gap-4 p-6 pb-4 lg:flex-row lg:items-center lg:justify-between">
              <Segmented
                size="sm"
                aria-label="Status"
                value={statusFilter}
                onChange={setStatusFilter}
                options={[
                  { key: 'all', label: 'All' },
                  { key: 'available', label: 'Available' },
                  { key: 'assigned', label: 'Assigned' },
                  { key: 'maintenance', label: 'Maintenance' },
                  { key: 'decommissioned', label: 'Retired' },
                ]}
              />
              <div className="w-full lg:w-64">
                <AppInput
                  size="sm"
                  placeholder="Search plate, model or driver"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  startContent={<MagnifyingGlass />}
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Vehicle</th>
                    <th>Model</th>
                    <th>Class</th>
                    <th>Depot</th>
                    <th>Driver</th>
                    <th>Status</th>
                    <th>Inspection</th>
                    <th className="w-12" />
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <SkeletonRows cols={8} />
                  ) : (fleetData?.vehicles.length ?? 0) === 0 ? (
                    <tr>
                      <td colSpan={8}>
                        <EmptyState icon={Car} title="No vehicles found" description="Try a different filter or search." />
                      </td>
                    </tr>
                  ) : (
                    fleetData?.vehicles.map((v) => {
                      const overdue = v.nextInspectionDue && new Date(v.nextInspectionDue) < new Date();
                      return (
                        <tr key={v.id}>
                          <td>
                            <div className="tabular font-medium text-foreground">{v.licensePlate}</div>
                            <div className="text-xs text-muted">
                              {v.color} · {v.year}
                            </div>
                          </td>
                          <td>
                            <div className="text-foreground">
                              {v.brand ? `${v.brand} ` : ''}
                              {v.model}
                            </div>
                            <div className="text-xs text-muted">{v.isOwnerVehicle ? 'Partner owned' : 'Kero owned'}</div>
                          </td>
                          <td className="text-foreground">{v.vehicleType?.name || 'Standard'}</td>
                          <td className="text-muted">{v.fleetZone?.name || '—'}</td>
                          <td>
                            {v.driver ? (
                              <div>
                                <div className="text-foreground">
                                  {v.driver.firstname} {v.driver.lastname}
                                </div>
                                <div className="tabular text-xs text-muted">{v.driver.phone || v.driver.id}</div>
                              </div>
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </td>
                          <td>
                            {v.status === 'assigned' ? (
                              <StatusPill tone="success" dot>Assigned</StatusPill>
                            ) : v.status === 'available' ? (
                              <StatusPill tone="brand" dot>Available</StatusPill>
                            ) : v.status === 'maintenance' ? (
                              <StatusPill tone="warning" dot>Maintenance</StatusPill>
                            ) : (
                              <StatusPill dot>Retired</StatusPill>
                            )}
                          </td>
                          <td className={`tabular whitespace-nowrap ${overdue ? 'font-medium text-danger' : 'text-muted'}`}>
                            {v.nextInspectionDue
                              ? new Date(v.nextInspectionDue).toLocaleDateString('en-NG', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                })
                              : '—'}
                          </td>
                          <td className="text-right">
                            <Can permission="manage_fleet">
                              <AppRowActions
                                items={[
                                  v.driver
                                    ? {
                                        key: 'unassign',
                                        label: 'Unassign driver',
                                        icon: <UserMinus size={14} />,
                                        onClick: () => {
                                          if (confirm(`Unassign driver from ${v.licensePlate}?`)) {
                                            unassignMutation.mutate({
                                              driverId: v.driver!.id,
                                              vehicleId: v.id,
                                              reason: 'Administrative unassignment',
                                            });
                                          }
                                        },
                                      }
                                    : {
                                        key: 'assign',
                                        label: 'Assign driver',
                                        icon: <User size={14} />,
                                        onClick: () => openAssignModal(v),
                                      },
                                  {
                                    key: 'status',
                                    label: 'Change status',
                                    icon: <Wrench size={14} />,
                                    onClick: () => openStatusModal(v),
                                  },
                                ]}
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

          {/* ════════════════════════════════════════════════════════════════
              MODAL: REGISTER FLEET VEHICLE (Centered Compound)
             ════════════════════════════════════════════════════════════════ */}
          <Modal>
            <Modal.Backdrop
              isOpen={isAddModalOpen}
              onOpenChange={(open) => {
                if (!open) setIsAddModalOpen(false);
              }}
            >
              <Modal.Container placement="center" size="lg">
                <Modal.Dialog className="rounded-3xl bg-overlay p-7 max-w-xl mx-auto">
                  <form onSubmit={handleVehicleSubmit(onVehicleSubmit)} className="space-y-4">
                    <div className="flex items-center gap-3 pb-4">
                      <div>
                        <h3 className="text-[18px] font-bold tracking-[-0.02em] text-foreground">
                          Register Fleet Vehicle
                        </h3>
                        <p className="mt-1 text-[13px] text-muted">
                          Onboard corporate asset or partner vehicle into the Kero inventory.
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col gap-4">
                      <AppInput
                        label="License Plate Number"
                        isRequired
                        placeholder="e.g. EKY-782-AA"
                        {...registerVehicle('licensePlate')}
                        errorMessage={vehicleErrors.licensePlate?.message}
                      />

                      <div>
                        <label className="text-xs font-semibold text-foreground block mb-1">
                          Vehicle Tier *
                        </label>
                        <select
                          {...registerVehicle('vehicleTypeId')}
                          className="w-full h-10 px-3 rounded-lg bg-background text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                          {(vehicleTypes || []).map((vt) => (
                            <option key={vt.id} value={vt.id}>
                              {vt.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <AppInput
                        label="Make / Brand"
                        placeholder="e.g. Toyota"
                        {...registerVehicle('brand')}
                        errorMessage={vehicleErrors.brand?.message}
                      />

                      <AppInput
                        label="Model"
                        isRequired
                        placeholder="e.g. Corolla 1.8 Elegance"
                        {...registerVehicle('model')}
                        errorMessage={vehicleErrors.model?.message}
                      />

                      <AppInput
                        label="Body Color"
                        isRequired
                        placeholder="e.g. Silver Grey"
                        {...registerVehicle('color')}
                        errorMessage={vehicleErrors.color?.message}
                      />

                      <AppInput
                        label="Manufacture Year"
                        isRequired
                        type="number"
                        placeholder="e.g. 2021"
                        {...registerVehicle('year', { valueAsNumber: true })}
                        errorMessage={vehicleErrors.year?.message}
                      />

                      <div>
                        <label className="text-xs font-semibold text-foreground block mb-1">
                          Assigned Fleet Depot
                        </label>
                        <select
                          {...registerVehicle('fleetZoneId')}
                          className="w-full h-10 px-3 rounded-lg bg-background text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                          {(fleetZones || []).map((fz) => (
                            <option key={fz.id} value={fz.id}>
                              {fz.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <AppInput
                        label="Passenger Capacity"
                        isRequired
                        type="number"
                        placeholder="e.g. 4"
                        {...registerVehicle('capacity', { valueAsNumber: true })}
                        errorMessage={vehicleErrors.capacity?.message}
                      />
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-4">
                      <AppButton
                        variant="outline"
                        size="sm"
                        type="button"
                        onClick={() => setIsAddModalOpen(false)}
                      >
                        Cancel
                      </AppButton>
                      <AppButton
                        variant="primary"
                        size="sm"
                        type="submit"
                        isLoading={isCreatingVehicle || createVehicleMutation.isPending}
                      >
                        Register Asset
                      </AppButton>
                    </div>
                  </form>
                </Modal.Dialog>
              </Modal.Container>
            </Modal.Backdrop>
          </Modal>

          {/* ════════════════════════════════════════════════════════════════
              MODAL: ASSIGN DRIVER TO ASSET (Centered Compound)
             ════════════════════════════════════════════════════════════════ */}
          <Modal>
            <Modal.Backdrop
              isOpen={isAssignModalOpen}
              onOpenChange={(open) => {
                if (!open) {
                  setIsAssignModalOpen(false);
                  setSelectedVehicle(null);
                }
              }}
            >
              <Modal.Container placement="center" size="md">
                <Modal.Dialog className="rounded-3xl bg-overlay p-7 max-w-md mx-auto">
                  <form onSubmit={handleAssignSubmit(onAssignSubmit)} className="space-y-4">
                    <div className="flex items-center gap-3 pb-4">
                      <div>
                        <h3 className="text-[18px] font-bold tracking-[-0.02em] text-foreground">
                          Assign Vehicle to Driver
                        </h3>
                        <p className="text-xs text-muted tabular">
                          {selectedVehicle?.licensePlate} ({selectedVehicle?.model})
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-semibold text-foreground block mb-1">
                          Select Verified Driver *
                        </label>
                        <select
                          {...registerAssign('driverId')}
                          className="w-full h-10 px-3 rounded-lg bg-background text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                          {(availableDrivers || []).map((drv) => (
                            <option key={drv.id} value={drv.id}>
                              {drv.firstname} {drv.lastname} ({drv.phone || drv.email})
                            </option>
                          ))}
                        </select>
                      </div>

                      <AppTextarea
                        label="Assignment Reason / Shift"
                        placeholder="e.g. Standard weekly lease shift allocation"
                        rows={2}
                        {...registerAssign('reason')}
                        errorMessage={assignErrors.reason?.message}
                      />
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-3">
                      <AppButton
                        variant="outline"
                        size="sm"
                        type="button"
                        onClick={() => {
                          setIsAssignModalOpen(false);
                          setSelectedVehicle(null);
                        }}
                      >
                        Cancel
                      </AppButton>
                      <AppButton
                        variant="primary"
                        size="sm"
                        type="submit"
                        isLoading={isAssigning || assignMutation.isPending}
                      >
                        Confirm Assignment
                      </AppButton>
                    </div>
                  </form>
                </Modal.Dialog>
              </Modal.Container>
            </Modal.Backdrop>
          </Modal>

          {/* ════════════════════════════════════════════════════════════════
              MODAL: CHANGE VEHICLE STATUS (Centered Compound)
             ════════════════════════════════════════════════════════════════ */}
          <Modal>
            <Modal.Backdrop
              isOpen={isStatusModalOpen}
              onOpenChange={(open) => {
                if (!open) {
                  setIsStatusModalOpen(false);
                  setSelectedVehicle(null);
                }
              }}
            >
              <Modal.Container placement="center" size="md">
                <Modal.Dialog className="rounded-3xl bg-overlay p-7 max-w-md mx-auto">
                  <form onSubmit={handleStatusSubmit(onStatusSubmit)} className="space-y-4">
                    <div className="flex items-center gap-3 pb-4">
                      <div>
                        <h3 className="text-[18px] font-bold tracking-[-0.02em] text-foreground">
                          Update Vehicle Operational Status
                        </h3>
                        <p className="text-xs text-muted tabular">
                          {selectedVehicle?.licensePlate} ({selectedVehicle?.model})
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-semibold text-foreground block mb-1">
                          Operational Status *
                        </label>
                        <select
                          {...registerStatus('status')}
                          className="w-full h-10 px-3 rounded-lg bg-background text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                          <option value="available">Available in Yard (Ready)</option>
                          <option value="maintenance">Under Maintenance (Offline)</option>
                          <option value="decommissioned">Decommissioned (Retired)</option>
                        </select>
                      </div>

                      <AppTextarea
                        label="Reason for Status Change"
                        isRequired
                        placeholder="State reason (e.g. Scheduled oil change, accident repair, brake overhaul)..."
                        rows={2}
                        {...registerStatus('reason')}
                        errorMessage={statusErrors.reason?.message}
                      />
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-3">
                      <AppButton
                        variant="outline"
                        size="sm"
                        type="button"
                        onClick={() => {
                          setIsStatusModalOpen(false);
                          setSelectedVehicle(null);
                        }}
                      >
                        Cancel
                      </AppButton>
                      <AppButton
                        variant="primary"
                        size="sm"
                        type="submit"
                        isLoading={isUpdatingStatus || statusMutation.isPending}
                      >
                        Save Status
                      </AppButton>
                    </div>
                  </form>
                </Modal.Dialog>
              </Modal.Container>
            </Modal.Backdrop>
          </Modal>
        </Page>
    </PermissionGuard>
  );
}
