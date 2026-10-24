'use client';

// src/app/fleet/zones/page.tsx
// Phase 5: Fleet Zones & Geofenced Staging Depots
import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  MapPin,
  Car,
  Plus,
  ArrowClockwise,
  CaretLeft,
  Buildings,
  IdentificationBadge,
  CheckCircle,
  XCircle,
  Trash,
  PencilSimple,
  ShieldCheck,
  NavigationArrow,
  ArrowRight,
} from '@phosphor-icons/react';
import { Card, Chip, Modal } from '@heroui/react';
import { toast } from 'sonner';
import { AppButton } from '@/components/ui/app-button';
import { AppInput } from '@/components/ui/app-input';
import { AppTextarea } from '@/components/ui/app-textarea';
import { AppRowActions } from '@/components/ui/app-row-actions';
import { DashboardCard, StatDashboardCard } from '@/components/ui/dashboard-card';
import { Page, PageHeader } from '@/components/ui/page';
import { FleetTabs } from '@/components/fleet/fleet-tabs';
import { PermissionGuard, Can } from '@/components/auth/can';
import { api } from '@/lib/api';
import { applyApiFormError } from '@/lib/errors';
import { FleetZoneItem } from '@/types/admin';
import {
  createFleetZoneSchema,
  type CreateFleetZoneInput,
} from '@/lib/schemas/admin.schemas';

export default function FleetZonesPage() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<FleetZoneItem | null>(null);

  // ── Query: Fleet Zones ──────────────────────────────────────────────
  const {
    data: zones,
    isLoading,
    refetch,
    isFetching,
  } = useQuery<FleetZoneItem[]>({
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

  // ── Form State ──────────────────────────────────────────────────────
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    setError,
  } = useForm<CreateFleetZoneInput>({
    resolver: zodResolver(createFleetZoneSchema) as any,
    defaultValues: {
      name: '',
      description: '',
    },
  });

  // ── Mutation: Save Zone (Create / Update) ───────────────────────────
  const saveZoneMutation = useMutation({
    mutationFn: async (values: CreateFleetZoneInput) => {
      if (editingZone) {
        const res = await api.put(`/admin/fleet/zones/${editingZone.id}`, values);
        return res.data;
      } else {
        const res = await api.post('/admin/fleet/zones', {
          ...values,
          boundaries: { type: 'Polygon', coordinates: [] },
        });
        return res.data;
      }
    },
    onSuccess: () => {
      toast.success(editingZone ? 'Fleet zone updated.' : 'New depot registered.');
      setIsModalOpen(false);
      setEditingZone(null);
      reset();
      refetch();
    },
    onError: (err: any) => {
      applyApiFormError(err, { setError });
    },
  });

  // ── Mutation: Delete Zone ───────────────────────────────────────────
  const deleteZoneMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(`/admin/fleet/zones/${id}`);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Fleet zone decommissioned.');
      refetch();
    },
    onError: (err: any) => {
      toast.error(`Could not delete fleet zone: ${err?.message || 'Error'}`);
    },
  });

  const onSubmit = (values: any) => {
    saveZoneMutation.mutate(values as CreateFleetZoneInput);
  };

  const openModal = (zone?: FleetZoneItem) => {
    if (zone) {
      setEditingZone(zone);
      reset({
        name: zone.name,
        description: zone.description,
      });
    } else {
      setEditingZone(null);
      reset({
        name: '',
        description: '',
      });
    }
    setIsModalOpen(true);
  };

  const totalVehiclesInZones = (zones || []).reduce((acc, z) => acc + z.vehicleCount, 0);
  const totalDriversInZones = (zones || []).reduce((acc, z) => acc + z.driverCount, 0);

  return (
    <PermissionGuard permission="view_fleet">
      <Page>
          <PageHeader
            title="Fleet"
            description="Depots and yards where vehicles are staged."
            actions={
              <>
                <AppButton
                  variant="tertiary"
                  isIconOnly
                  aria-label="Refresh"
                  startContent={<ArrowClockwise className={isFetching ? 'animate-spin' : ''} />}
                  onPress={() => refetch()}
                />
                <Can permission="manage_fleet">
                  <AppButton variant="brand" startContent={<Plus weight="bold" />} label="Add depot" onPress={() => openModal()} />
                </Can>
              </>
            }
          />

          <FleetTabs />

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <StatDashboardCard label="Depots" icon={Buildings} variant="wallet" value={(zones || []).length} hint="Across Lagos" />
            <StatDashboardCard label="Vehicles staged" icon={Car} value={totalVehiclesInZones} hint="Mainland and island" />
            <StatDashboardCard label="Depot drivers" icon={IdentificationBadge} value={totalDriversInZones} hint="On regional shifts" />
            <StatDashboardCard label="Empty depots" icon={MapPin} value={(zones || []).filter((z) => z.vehicleCount === 0).length} hint="No vehicles staged" />
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {(zones || []).map((zone) => (
              <DashboardCard key={zone.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-default text-foreground">
                      <Buildings size={20} />
                    </span>
                    <div className="min-w-0">
                      <h3 className="truncate text-[16px] font-bold text-foreground">{zone.name}</h3>
                      {zone.description && <p className="truncate text-[13px] text-muted">{zone.description}</p>}
                    </div>
                  </div>
                  <Can permission="manage_fleet">
                    <AppRowActions
                      items={[
                        {
                          key: 'edit',
                          label: 'Edit depot',
                          icon: <PencilSimple size={14} />,
                          onClick: () => openModal(zone),
                        },
                        {
                          key: 'delete',
                          label: 'Remove depot',
                          icon: <Trash size={14} />,
                          danger: true,
                          onClick: () => {
                            if (confirm(`Remove depot "${zone.name}"?`)) deleteZoneMutation.mutate(zone.id);
                          },
                        },
                      ]}
                    />
                  </Can>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-surface-secondary p-4">
                    <div className="text-[13px] text-muted">Vehicles</div>
                    <div className="tabular mt-1 text-[20px] font-bold text-foreground">{zone.vehicleCount}</div>
                  </div>
                  <div className="rounded-2xl bg-surface-secondary p-4">
                    <div className="text-[13px] text-muted">Drivers</div>
                    <div className="tabular mt-1 text-[20px] font-bold text-foreground">{zone.driverCount}</div>
                  </div>
                </div>

                <Link
                  href={`/fleet?status=all&search=${encodeURIComponent(zone.name.split(' ')[0])}`}
                  className="mt-5 inline-flex items-center gap-1 text-[13px] font-medium text-link hover:underline"
                >
                  View vehicles <ArrowRight size={12} weight="bold" />
                </Link>
              </DashboardCard>
            ))}
          </div>

          {/* ════════════════════════════════════════════════════════════════
              MODAL: REGISTER / EDIT DEPOT (Centered Compound)
             ════════════════════════════════════════════════════════════════ */}
          <Modal>
            <Modal.Backdrop
              isOpen={isModalOpen}
              onOpenChange={(open) => {
                if (!open) {
                  setIsModalOpen(false);
                  setEditingZone(null);
                }
              }}
            >
              <Modal.Container placement="center" size="md">
                <Modal.Dialog className="rounded-3xl bg-overlay p-7 max-w-lg mx-auto">
                  <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div className="flex items-center gap-3 pb-4">
                      <div>
                        <h3 className="text-[18px] font-bold tracking-[-0.02em] text-foreground">
                          {editingZone ? 'Edit Fleet Depot' : 'Register New Fleet Depot'}
                        </h3>
                        <p className="mt-1 text-[13px] text-muted">
                          Establish a physical staging yard and regional dispatch base.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <AppInput
                        label="Depot Name"
                        isRequired
                        placeholder="e.g. Lekki Phase 1 Holding Yard"
                        {...register('name')}
                        errorMessage={errors.name?.message}
                      />

                      <AppTextarea
                        label="Depot Purpose & Facilities"
                        isRequired
                        placeholder="e.g. Dedicated holding yard for island drivers with fast battery charging & inspection ramp..."
                        rows={3}
                        {...register('description')}
                        errorMessage={errors.description?.message}
                      />
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-3">
                      <AppButton
                        variant="outline"
                        size="sm"
                        type="button"
                        onClick={() => {
                          setIsModalOpen(false);
                          setEditingZone(null);
                        }}
                      >
                        Cancel
                      </AppButton>
                      <AppButton
                        variant="primary"
                        size="sm"
                        type="submit"
                        isLoading={isSubmitting || saveZoneMutation.isPending}
                      >
                        {editingZone ? 'Save Changes' : 'Register Yard'}
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
