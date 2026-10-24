'use client';

// src/app/pricing/surge/page.tsx
// Phase 4: Dynamic Surge Geofencing & Real-Time Multiplier Controller
import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Lightning,
  Plus,
  ArrowClockwise,
  CaretLeft,
  Flame,
  Gauge,
  SlidersHorizontal,
  Clock,
  ShieldCheck,
  CheckCircle,
  XCircle,
  Warning,
  Trash,
  PencilSimple,
  MapPin,
  Car,
  Broadcast,
  DotsThreeVertical,
  Power,
} from '@phosphor-icons/react';
import { Card, Chip, Modal, Dropdown } from '@heroui/react';
import { toast } from 'sonner';
import { AppButton } from '@/components/ui/app-button';
import { AppInput } from '@/components/ui/app-input';
import { AppTextarea } from '@/components/ui/app-textarea';
import { PermissionGuard, Can, usePermission } from '@/components/auth/can';
import { AppRowActions } from '@/components/ui/app-row-actions';
import { DashboardCard, StatDashboardCard } from '@/components/ui/dashboard-card';
import { EmptyState, Page, PageHeader, SectionHeader, Segmented, SkeletonRows, StatusPill } from '@/components/ui/page';
import { PricingTabs } from '@/components/pricing/pricing-tabs';
import { api } from '@/lib/api';
import { applyApiFormError } from '@/lib/errors';
import { SurgeDto, VehicleTypePricingItem } from '@/types/admin';
import {
  createSurgeSchema,
  type CreateSurgeInput,
} from '@/lib/schemas/admin.schemas';

// Preset Lagos geofence zones
const LAGOS_ZONES = [
  { name: 'Murtala Muhammed Airport (MM2/Intl)', x: 180, y: 130, defaultMultiplier: 1.8 },
  { name: 'Victoria Island / Ikoyi Financial District', x: 260, y: 240, defaultMultiplier: 2.0 },
  { name: 'Lekki Phase 1 / Expressway Corridor', x: 340, y: 250, defaultMultiplier: 1.6 },
  { name: 'Yaba Tech Cluster & Surulere', x: 210, y: 190, defaultMultiplier: 1.4 },
  { name: 'Ikeja City Mall & Alausa Secretariat', x: 200, y: 110, defaultMultiplier: 1.5 },
];

export default function SurgePage() {
  const router = useRouter();
  const [surgeView, setSurgeView] = useState<'rules' | 'map'>('rules');
  const canActivate = usePermission('activate_surge');
  const canDeactivate = usePermission('deactivate_surge');
  const canDelete = usePermission('delete_surge');
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSurge, setSelectedSurge] = useState<SurgeDto | null>(null);

  // Multiplier Slider Modal
  const [isMultiplierModalOpen, setIsMultiplierModalOpen] = useState(false);
  const [editingSurgeForMultiplier, setEditingSurgeForMultiplier] = useState<SurgeDto | null>(null);
  const [newMultiplierVal, setNewMultiplierVal] = useState<number>(1.5);

  // ── Query: Surge Rules ──────────────────────────────────────────────
  const {
    data: surgesData,
    isLoading: isSurgesLoading,
    refetch: refetchSurges,
    isFetching,
  } = useQuery<SurgeDto[]>({
    queryKey: ['admin', 'surge'],
    queryFn: async () => {
      try {
        const res = await api.get<{
          data: { surges: SurgeDto[] } | SurgeDto[];
        }>('/admin/surge');
        const raw = res.data?.data;
        if (raw && !Array.isArray(raw) && Array.isArray(raw.surges)) {
          return raw.surges;
        }
        if (Array.isArray(raw)) {
          return raw;
        }
      } catch (err) {
        throw err;
      }
      return [];
    },
  });

  // ── Query: Vehicle Types ────────────────────────────────────────────
  const { data: vehicleTypes } = useQuery<VehicleTypePricingItem[]>({
    queryKey: ['admin', 'vehicle-types'],
    queryFn: async () => {
      try {
        const res = await api.get<{
          data: VehicleTypePricingItem[];
        }>('/pricing/vehicle-types');
        return res.data?.data || [];
      } catch (err) {
        throw err;
      }
    },
  });

  // ── Form State ──────────────────────────────────────────────────────
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    setError,
    setValue,
  } = useForm<CreateSurgeInput>({
    resolver: zodResolver(createSurgeSchema) as any,
    defaultValues: {
      vehicleTypeId: '',
      name: 'Ikeja MM2 Airport Peak',
      currentMultiplier: 1.5,
      maxMultiplier: 3.0,
      reason: 'Elevated booking requests exceeding active driver supply',
      isActive: true,
    },
  });

  // ── Mutation: Create Surge ──────────────────────────────────────────
  const createSurgeMutation = useMutation({
    mutationFn: async (values: CreateSurgeInput) => {
      const res = await api.post('/admin/surge', values);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Surge zone deployed and active in rider fare preview.');
      setIsModalOpen(false);
      reset();
      refetchSurges();
    },
    onError: (err: any) => {
      applyApiFormError(err, { setError });
    },
  });

  // ── Mutation: Activate Surge ────────────────────────────────────────
  const activateSurgeMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.put(`/admin/surge/${id}/activate`);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Surge zone activated.');
      refetchSurges();
    },
    onError: (err: any) => {
      toast.error(`Could not activate surge: ${err?.message || 'Error'}`);
    },
  });

  // ── Mutation: Deactivate Surge ──────────────────────────────────────
  const deactivateSurgeMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.put(`/admin/surge/${id}/deactivate`);
      return res.data;
    },
    onSuccess: () => {
      toast.info('Surge zone deactivated.');
      refetchSurges();
    },
    onError: (err: any) => {
      toast.error(`Could not deactivate surge: ${err?.message || 'Error'}`);
    },
  });

  // ── Mutation: Update Multiplier ─────────────────────────────────────
  const updateMultiplierMutation = useMutation({
    mutationFn: async ({ id, multiplier }: { id: string; multiplier: number }) => {
      const res = await api.put(`/admin/surge/${id}/multiplier`, { multiplier });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Surge multiplier calibrated.');
      setIsMultiplierModalOpen(false);
      setEditingSurgeForMultiplier(null);
      refetchSurges();
    },
    onError: (err: any) => {
      toast.error(`Multiplier adjustment failed: ${err?.message || 'Error'}`);
    },
  });

  // ── Mutation: Delete Surge ──────────────────────────────────────────
  const deleteSurgeMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(`/admin/surge/${id}`);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Surge zone configuration deleted.');
      refetchSurges();
    },
    onError: (err: any) => {
      toast.error(`Failed to delete surge: ${err?.message || 'Error'}`);
    },
  });

  const onSubmit = (values: any) => {
    createSurgeMutation.mutate(values as CreateSurgeInput);
  };

  const openMultiplierModal = (surge: SurgeDto) => {
    setEditingSurgeForMultiplier(surge);
    setNewMultiplierVal(surge.currentMultiplier);
    setIsMultiplierModalOpen(true);
  };

  const activeSurges = (surgesData || []).filter((s) => s.isActive);
  const highestMultiplier = activeSurges.reduce(
    (max, s) => Math.max(max, s.currentMultiplier),
    1.0,
  );

  return (
    <PermissionGuard permission="view_surge">
      <Page>
          <PageHeader
            title="Pricing"
            description="Surge multipliers for busy zones."
            actions={
              <>
                <AppButton
                  variant="tertiary"
                  isIconOnly
                  aria-label="Refresh"
                  startContent={<ArrowClockwise />}
                  onPress={() => refetchSurges()}
                />
                <Can permission="create_surge">
                  <AppButton
                    variant="brand"
                    startContent={<Plus weight="bold" />}
                    label="New surge"
                    onPress={() => {
                      setValue('vehicleTypeId', vehicleTypes?.[0]?.id || '');
                      setIsModalOpen(true);
                    }}
                  />
                </Can>
              </>
            }
          />

          <PricingTabs />

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <StatDashboardCard label="Active surges" icon={Flame} variant="wallet" value={activeSurges.length} hint="Applied to new requests" />
            <StatDashboardCard label="Highest now" icon={Gauge} value={`${highestMultiplier.toFixed(1)}×`} hint="Peak active multiplier" />
            <StatDashboardCard
              label="Ending automatically"
              icon={Clock}
              value={activeSurges.filter((s) => s.autoDeactivateAt).length}
              hint="Active surges with an end time"
            />
            <StatDashboardCard
              label="Highest cap"
              icon={SlidersHorizontal}
              value={(surgesData || []).length ? `${Math.max(...(surgesData || []).map((s) => s.maxMultiplier)).toFixed(1)}×` : '—'}
              hint="Max multiplier allowed"
            />
          </div>

          <Segmented
            aria-label="View"
            value={surgeView}
            onChange={setSurgeView}
            options={[
              { key: 'rules', label: 'Surge rules', count: (surgesData || []).length },
              { key: 'map', label: 'Zone map' },
            ]}
          />

          {surgeView === 'rules' ? (
            <>
          <DashboardCard className="overflow-hidden p-0">
            <SectionHeader
              className="p-6 pb-4"
              title="Surge rules"
              actions={<span className="tabular text-[13px] text-muted">{(surgesData || []).length} rules</span>}
            />

            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Zone</th>
                    <th>Class</th>
                    <th>Multiplier</th>
                    <th>Cap</th>
                    <th>Status</th>
                    <th>Reason</th>
                    <th>Ends</th>
                    <th className="w-12" />
                  </tr>
                </thead>
                <tbody>
                  {isSurgesLoading ? (
                    <SkeletonRows cols={8} />
                  ) : (surgesData?.length ?? 0) === 0 ? (
                    <tr>
                      <td colSpan={8}>
                        <EmptyState icon={Lightning} title="No surge rules" description="Standard fares apply everywhere." />
                      </td>
                    </tr>
                  ) : (
                    surgesData?.map((surge) => (
                      <tr key={surge.id}>
                        <td className="font-medium text-foreground">{surge.name || 'Surge zone'}</td>
                        <td className="text-foreground">{surge.vehicleTypeName}</td>
                        <td>
                          <button
                            type="button"
                            onClick={() => openMultiplierModal(surge)}
                            className="tabular inline-flex cursor-pointer items-center gap-1 font-bold text-foreground hover:underline"
                          >
                            {surge.currentMultiplier.toFixed(1)}×
                            <PencilSimple className="size-3 text-muted" />
                          </button>
                        </td>
                        <td className="tabular text-muted">{surge.maxMultiplier.toFixed(1)}×</td>
                        <td>
                          <StatusPill tone={surge.isActive ? 'brand' : 'neutral'} dot pulse={surge.isActive}>
                            {surge.isActive ? 'Active' : 'Inactive'}
                          </StatusPill>
                        </td>
                        <td className="max-w-xs truncate text-muted">{surge.reason || 'Peak demand'}</td>
                        <td className="tabular whitespace-nowrap text-muted">
                          {surge.autoDeactivateAt
                            ? new Date(surge.autoDeactivateAt).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })
                            : 'Manual'}
                        </td>
                        <td className="text-right">
                          <AppRowActions
                            items={[
                              {
                                key: 'multiplier',
                                label: 'Change multiplier',
                                icon: <PencilSimple size={14} />,
                                onClick: () => openMultiplierModal(surge),
                              },
                              surge.isActive
                                ? {
                                    key: 'deactivate',
                                    label: 'Deactivate',
                                    icon: <Power size={14} />,
                                    disabled: !canDeactivate,
                                    onClick: () => deactivateSurgeMutation.mutate(surge.id),
                                  }
                                : {
                                    key: 'activate',
                                    label: 'Activate',
                                    icon: <Power size={14} />,
                                    disabled: !canActivate,
                                    onClick: () => activateSurgeMutation.mutate(surge.id),
                                  },
                              {
                                key: 'delete',
                                label: 'Delete',
                                icon: <Trash size={14} />,
                                danger: true,
                                disabled: !canDelete,
                                onClick: () => {
                                  if (confirm(`Delete surge for ${surge.name}?`)) deleteSurgeMutation.mutate(surge.id);
                                },
                              },
                            ]}
                          />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </DashboardCard>
            </>
          ) : (
            <>
          <DashboardCard>
            <SectionHeader title="Lagos zones" description="Highlighted zones have an active surge" />

            <div className="relative mt-5 flex h-64 w-full items-center justify-center overflow-hidden rounded-2xl bg-surface-secondary">
              <svg className="h-full w-full" viewBox="0 0 500 300">
                <defs>
                  <radialGradient id="surgePulse" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="var(--secondary)" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="var(--secondary)" stopOpacity="0" />
                  </radialGradient>
                </defs>

                <path
                  d="M 50 150 Q 150 140 220 180 T 320 220 T 450 250"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-separator"
                  strokeDasharray="4 4"
                />

                {LAGOS_ZONES.map((zone) => {
                  const isActive = activeSurges.some((s) => s.name?.includes(zone.name.split(' ')[0]));
                  return (
                    <g key={zone.name}>
                      {isActive && <circle cx={zone.x} cy={zone.y} r="45" fill="url(#surgePulse)" className="animate-pulse" />}
                      <circle
                        cx={zone.x}
                        cy={zone.y}
                        r="16"
                        className={isActive ? 'fill-secondary-soft stroke-secondary' : 'fill-surface stroke-separator'}
                        strokeWidth="2"
                      />
                      <circle cx={zone.x} cy={zone.y} r="4" className={isActive ? 'fill-secondary' : 'fill-muted'} />
                      <text x={zone.x} y={zone.y - 24} textAnchor="middle" className="fill-foreground text-[11px] font-medium">
                        {zone.name.split('/')[0]}
                      </text>
                      {isActive && (
                        <text x={zone.x} y={zone.y + 32} textAnchor="middle" className="tabular fill-foreground text-[11px] font-bold">
                          {zone.defaultMultiplier}×
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>
            </div>
          </DashboardCard>
            </>
          )}

          {/* ════════════════════════════════════════════════════════════════
              MODAL: DEPLOY SURGE ZONE (Centered Compound)
             ════════════════════════════════════════════════════════════════ */}
          <Modal>
            <Modal.Backdrop
              isOpen={isModalOpen}
              onOpenChange={(open) => {
                if (!open) setIsModalOpen(false);
              }}
            >
              <Modal.Container placement="center" size="lg">
                <Modal.Dialog className="rounded-3xl bg-overlay p-7 max-w-xl mx-auto">
                  <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div className="flex items-center gap-3 pb-4">
                      <div>
                        <h3 className="text-[18px] font-bold tracking-[-0.02em] text-foreground">
                          Deploy Dynamic Surge Zone
                        </h3>
                        <p className="mt-1 text-[13px] text-muted">
                          Activate elevated fare multipliers across designated zones to incentivize driver routing.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-semibold text-foreground block mb-1">
                          Vehicle Tier *
                        </label>
                        <select
                          {...register('vehicleTypeId')}
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
                        label="Zone / Event Descriptor"
                        isRequired
                        placeholder="e.g. Ikeja MM2 Airport Peak"
                        {...register('name')}
                        errorMessage={errors.name?.message}
                      />

                      <div className="flex flex-col gap-4">
                        <AppInput
                          label="Current Multiplier (1.1x – 5.0x)"
                          isRequired
                          type="number"
                          step="0.1"
                          placeholder="e.g. 1.8"
                          {...register('currentMultiplier')}
                          errorMessage={errors.currentMultiplier?.message}
                        />
                        <AppInput
                          label="Max Cap Ceiling (1.1x – 5.0x)"
                          isRequired
                          type="number"
                          step="0.1"
                          placeholder="e.g. 3.0"
                          {...register('maxMultiplier')}
                          errorMessage={errors.maxMultiplier?.message}
                        />
                      </div>

                      <AppTextarea
                        label="Justification / Traffic Conditions"
                        placeholder="e.g. Persistent flight arrival surges with severe rainstorm..."
                        rows={2}
                        {...register('reason')}
                        errorMessage={errors.reason?.message}
                      />
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-4">
                      <AppButton
                        variant="outline"
                        size="sm"
                        type="button"
                        onClick={() => setIsModalOpen(false)}
                      >
                        Cancel
                      </AppButton>
                      <AppButton
                        variant="primary"
                        size="sm"
                        type="submit"
                        isLoading={isSubmitting || createSurgeMutation.isPending}
                      >
                        Deploy Surge Rule
                      </AppButton>
                    </div>
                  </form>
                </Modal.Dialog>
              </Modal.Container>
            </Modal.Backdrop>
          </Modal>

          {/* ════════════════════════════════════════════════════════════════
              MODAL: QUICK CALIBRATE MULTIPLIER (Centered Compound)
             ════════════════════════════════════════════════════════════════ */}
          <Modal>
            <Modal.Backdrop
              isOpen={isMultiplierModalOpen}
              onOpenChange={(open) => {
                if (!open) {
                  setIsMultiplierModalOpen(false);
                  setEditingSurgeForMultiplier(null);
                }
              }}
            >
              <Modal.Container placement="center" size="sm">
                <Modal.Dialog className="rounded-3xl bg-overlay p-7 max-w-sm mx-auto">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div>
                        <h3 className="text-[18px] font-bold tracking-[-0.02em] text-foreground">
                          Calibrate Multiplier
                        </h3>
                        <p className="mt-1 text-[13px] text-muted">
                          {editingSurgeForMultiplier?.name}
                        </p>
                      </div>
                    </div>

                    <div className="text-center py-4 bg-surface-secondary rounded-2xl border-0">
                      <span className="text-4xl font-extrabold tabular text-warning">
                        {newMultiplierVal.toFixed(1)}x
                      </span>
                      <p className="text-xs text-muted mt-1">
                        Applied to base, distance, and duration fares
                      </p>
                    </div>

                    <div className="space-y-2">
                      <input
                        type="range"
                        min="1.0"
                        max="5.0"
                        step="0.1"
                        value={newMultiplierVal}
                        onChange={(e) => setNewMultiplierVal(parseFloat(e.target.value))}
                        className="w-full accent-secondary cursor-pointer"
                      />
                      <div className="flex justify-between text-xs text-muted tabular">
                        <span>1.0x (Standard)</span>
                        <span>3.0x</span>
                        <span>5.0x (Ceiling)</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-3">
                      <AppButton
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setIsMultiplierModalOpen(false);
                          setEditingSurgeForMultiplier(null);
                        }}
                      >
                        Cancel
                      </AppButton>
                      <AppButton
                        variant="primary"
                        size="sm"
                        isLoading={updateMultiplierMutation.isPending}
                        onClick={() => {
                          if (!editingSurgeForMultiplier) return;
                          updateMultiplierMutation.mutate({
                            id: editingSurgeForMultiplier.id,
                            multiplier: newMultiplierVal,
                          });
                        }}
                      >
                        Apply Multiplier
                      </AppButton>
                    </div>
                  </div>
                </Modal.Dialog>
              </Modal.Container>
            </Modal.Backdrop>
          </Modal>
        </Page>
    </PermissionGuard>
  );
}
