'use client';

// src/app/pricing/page.tsx
// Phase 4: Tariff Engine & Base Fare Matrix Editor
import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  CurrencyNgn,
  Plus,
  ArrowClockwise,
  PencilSimple,
  Trash,
  CheckCircle,
  XCircle,
  Lightning,
  Car,
  Jeep,
  Bicycle,
  ShieldCheck,
  Percent,
  Clock,
  Gauge,
  SlidersHorizontal,
  WarningCircle,
  DotsThreeVertical,
  Power,
} from '@phosphor-icons/react';
import { Card, Chip, Modal, Dropdown } from '@heroui/react';
import { toast } from 'sonner';
import { AppButton } from '@/components/ui/app-button';
import { AppInput } from '@/components/ui/app-input';
import { AppSelect } from '@/components/ui/app-select';
import { AppModal } from '@/components/ui/app-modal';
import { PermissionGuard, Can, usePermission } from '@/components/auth/can';
import { AppRowActions } from '@/components/ui/app-row-actions';
import { DashboardCard, StatDashboardCard } from '@/components/ui/dashboard-card';
import { EmptyState, Page, PageHeader, SectionHeader, SkeletonRows, StatusPill } from '@/components/ui/page';
import { PricingTabs } from '@/components/pricing/pricing-tabs';
import { api } from '@/lib/api';
import { applyApiFormError } from '@/lib/errors';
import { PricingDto, VehicleTypePricingItem } from '@/types/admin';
import {
  createPricingSchema,
  type CreatePricingInput,
} from '@/lib/schemas/admin.schemas';

export default function PricingPage() {
  const router = useRouter();
  const canEdit = usePermission('edit_pricing');
  const canToggle = usePermission('toggle_pricing');
  const canDelete = usePermission('delete_pricing');
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pricingStep, setPricingStep] = useState<1 | 2>(1);
  const [editingPricing, setEditingPricing] = useState<PricingDto | null>(null);

  // ── Query: Pricing Configs List ─────────────────────────────────────
  const {
    data: pricingData,
    isLoading: isPricingLoading,
    refetch: refetchPricing,
    isFetching,
  } = useQuery<PricingDto[]>({
    queryKey: ['admin', 'pricing'],
    queryFn: async () => {
      try {
        const res = await api.get<{
          data: { pricing: PricingDto[] } | PricingDto[];
        }>('/admin/pricing');
        const raw = res.data?.data;
        if (raw && !Array.isArray(raw) && Array.isArray(raw.pricing)) {
          return raw.pricing;
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

  // ── Query: Available Vehicle Types ──────────────────────────────────
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
    watch,
    trigger,
  } = useForm<CreatePricingInput>({
    resolver: zodResolver(createPricingSchema) as any,
    defaultValues: {
      vehicleTypeId: '',
      baseFareKobo: 50000,
      pricePerKmKobo: 12000,
      pricePerMinuteKobo: 2500,
      minimumFareKobo: 100000,
      keroCommissionRate: 18,
      cancellationFeeKobo: 50000,
      waitingChargePerMinuteKobo: 3000,
      lagosFlatCostPerTripKobo: 5000,
      isActive: true,
    },
  });

  // ── Open Add/Edit Modal ─────────────────────────────────────────────
  const openModal = (pricing?: PricingDto) => {
    setPricingStep(1);
    if (pricing) {
      setEditingPricing(pricing);
      reset({
        vehicleTypeId: pricing.vehicleTypeId,
        baseFareKobo: pricing.baseFareKobo,
        pricePerKmKobo: pricing.pricePerKmKobo,
        pricePerMinuteKobo: pricing.pricePerMinuteKobo,
        minimumFareKobo: pricing.minimumFareKobo,
        keroCommissionRate: pricing.keroCommissionRate,
        cancellationFeeKobo: pricing.cancellationFeeKobo,
        waitingChargePerMinuteKobo: pricing.waitingChargePerMinuteKobo,
        lagosFlatCostPerTripKobo: pricing.lagosFlatCostPerTripKobo,
        isActive: pricing.isActive,
      });
    } else {
      setEditingPricing(null);
      reset({
        vehicleTypeId: vehicleTypes?.[0]?.id || '',
        baseFareKobo: 50000,
        pricePerKmKobo: 12000,
        pricePerMinuteKobo: 2500,
        minimumFareKobo: 100000,
        keroCommissionRate: 18,
        cancellationFeeKobo: 50000,
        waitingChargePerMinuteKobo: 3000,
        lagosFlatCostPerTripKobo: 5000,
        isActive: true,
      });
    }
    setIsModalOpen(true);
  };

  // ── Mutation: Save Pricing (Create / Update) ─────────────────────────
  const savePricingMutation = useMutation({
    mutationFn: async (values: CreatePricingInput) => {
      if (editingPricing) {
        const res = await api.put(`/admin/pricing/${editingPricing.id}`, values);
        return res.data;
      } else {
        const res = await api.post('/admin/pricing', values);
        return res.data;
      }
    },
    onSuccess: () => {
      toast.success(
        editingPricing
          ? 'Tariff matrix successfully updated.'
          : 'New vehicle pricing matrix created and activated.',
      );
      setIsModalOpen(false);
      setEditingPricing(null);
      refetchPricing();
    },
    onError: (err: any) => {
      applyApiFormError(err, { setError });
    },
  });

  // ── Mutation: Toggle Active Status ───────────────────────────────────
  const toggleStatusMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.put(`/admin/pricing/${id}/toggle`);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Tariff active status toggled.');
      refetchPricing();
    },
    onError: (err: any) => {
      toast.error(`Failed to toggle tariff status: ${err?.message || 'Error'}`);
    },
  });

  // ── Mutation: Delete Pricing ─────────────────────────────────────────
  const deletePricingMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(`/admin/pricing/${id}`);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Tariff configuration archived.');
      refetchPricing();
    },
    onError: (err: any) => {
      toast.error(`Could not archive tariff: ${err?.message || 'Error'}`);
    },
  });

  const onSubmit = (values: any) => {
    savePricingMutation.mutate(values as CreatePricingInput);
  };

  const getVehicleIcon = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes('keke') || lower.includes('tricycle')) {
      return <Bicycle className="w-5 h-5 text-warning" weight="duotone" />;
    }
    if (lower.includes('comfort') || lower.includes('sedan')) {
      return <Car className="w-5 h-5 text-primary" weight="duotone" />;
    }
    if (lower.includes('standard') || lower.includes('compact')) {
      return <Jeep className="w-5 h-5 text-success" weight="duotone" />;
    }
    return <Car className="w-5 h-5 text-muted" weight="duotone" />;
  };

  return (
    <PermissionGuard permission="view_pricing">
      <Page>
          <PageHeader
            title="Pricing"
            description="Fares, rates and commission per vehicle class."
            actions={
              <>
                <AppButton
                  variant="tertiary"
                  isIconOnly
                  aria-label="Refresh"
                  startContent={<ArrowClockwise />}
                  onPress={() => refetchPricing()}
                />
                <Can permission="create_pricing">
                  <AppButton variant="brand" startContent={<Plus weight="bold" />} label="New class" onPress={() => openModal()} />
                </Can>
              </>
            }
          />

          <PricingTabs />

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <StatDashboardCard
              label="Vehicle classes"
              icon={Car}
              variant="wallet"
              value={(pricingData || []).length}
              hint={`${(pricingData || []).filter((p) => p.isActive).length} active`}
            />
            <StatDashboardCard
              label="Avg. take rate"
              icon={Percent}
              value={
                (pricingData || []).length
                  ? `${((pricingData || []).reduce((a, p) => a + Number(p.keroCommissionRate || 0), 0) / (pricingData || []).length).toFixed(1)}%`
                  : '—'
              }
              hint="Across vehicle classes"
            />
            <StatDashboardCard
              label="Highest base fare"
              icon={CurrencyNgn}
              value={
                (pricingData || []).length
                  ? `₦${(Math.max(...(pricingData || []).map((p) => p.baseFareKobo)) / 100).toLocaleString('en-NG')}`
                  : '—'
              }
              hint="Most expensive class"
            />
            <StatDashboardCard
              label="Inactive classes"
              icon={Lightning}
              value={(pricingData || []).filter((p) => !p.isActive).length}
              hint="Hidden from riders"
            />
          </div>

          <DashboardCard className="overflow-hidden p-0">
            <SectionHeader className="p-6 pb-4" title="Fare table" description="All amounts in naira" />

            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Class</th>
                    <th>Base</th>
                    <th>Per km</th>
                    <th>Per min</th>
                    <th>Minimum</th>
                    <th>Waiting</th>
                    <th>Cancel fee</th>
                    <th>Take rate</th>
                    <th>Status</th>
                    <th className="w-12" />
                  </tr>
                </thead>
                <tbody>
                  {isPricingLoading ? (
                    <SkeletonRows cols={10} />
                  ) : (pricingData?.length ?? 0) === 0 ? (
                    <tr>
                      <td colSpan={10}>
                        <EmptyState icon={CurrencyNgn} title="No vehicle classes yet" />
                      </td>
                    </tr>
                  ) : (
                    pricingData?.map((pricing) => {
                      const naira = (kobo: number) =>
                        `₦${(kobo / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
                      return (
                        <tr key={pricing.id}>
                          <td>
                            <div className="flex items-center gap-3">
                              <span className="grid size-9 place-items-center rounded-xl bg-default text-foreground">
                                {getVehicleIcon(pricing.vehicleTypeName)}
                              </span>
                              <span className="font-medium text-foreground">{pricing.vehicleTypeName}</span>
                            </div>
                          </td>
                          <td className="tabular whitespace-nowrap font-medium text-foreground">{naira(pricing.baseFareKobo)}</td>
                          <td className="tabular whitespace-nowrap text-foreground">{naira(pricing.pricePerKmKobo)}</td>
                          <td className="tabular whitespace-nowrap text-foreground">{naira(pricing.pricePerMinuteKobo)}</td>
                          <td className="tabular whitespace-nowrap text-foreground">{naira(pricing.minimumFareKobo)}</td>
                          <td className="tabular whitespace-nowrap text-muted">{naira(pricing.waitingChargePerMinuteKobo)}</td>
                          <td className="tabular whitespace-nowrap text-muted">{naira(pricing.cancellationFeeKobo)}</td>
                          <td className="tabular font-medium text-foreground">{pricing.keroCommissionRate}%</td>
                          <td>
                            <StatusPill tone={pricing.isActive ? 'success' : 'neutral'} dot>
                              {pricing.isActive ? 'Active' : 'Inactive'}
                            </StatusPill>
                          </td>
                          <td className="text-right">
                            <AppRowActions
                              items={[
                                {
                                  key: 'edit',
                                  label: 'Edit',
                                  icon: <PencilSimple size={14} />,
                                  disabled: !canEdit,
                                  onClick: () => openModal(pricing),
                                },
                                {
                                  key: 'toggle',
                                  label: pricing.isActive ? 'Deactivate' : 'Activate',
                                  icon: <Power size={14} />,
                                  disabled: !canToggle,
                                  onClick: () => toggleStatusMutation.mutate(pricing.id),
                                },
                                {
                                  key: 'delete',
                                  label: 'Archive',
                                  icon: <Trash size={14} />,
                                  danger: true,
                                  disabled: !canDelete,
                                  onClick: () => {
                                    if (confirm(`Archive fares for ${pricing.vehicleTypeName}?`)) {
                                      deletePricingMutation.mutate(pricing.id);
                                    }
                                  },
                                },
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
          </DashboardCard>

          {/* ════════════════════════════════════════════════════════════════
              MODAL: ADD / EDIT TARIFF MATRIX (Centered Compound)
             ════════════════════════════════════════════════════════════════ */}
          <AppModal
            isOpen={isModalOpen}
            onOpenChange={(open) => {
              if (!open) {
                setIsModalOpen(false);
                setEditingPricing(null);
              }
            }}
            title={editingPricing ? `Edit ${editingPricing.vehicleTypeName}` : 'New class'}
            description={pricingStep === 1 ? 'Fares in kobo (₦1 = 100).' : 'Fees and Kero’s share.'}
            step={{ current: pricingStep, total: 2 }}
            onSubmit={handleSubmit(onSubmit)}
            footer={
              pricingStep === 1 ? (
                <>
                  <AppButton
                    variant="tertiary"
                    type="button"
                    label="Cancel"
                    onPress={() => {
                      setIsModalOpen(false);
                      setEditingPricing(null);
                    }}
                  />
                  <AppButton
                    variant="brand"
                    type="button"
                    label="Next"
                    onPress={async () => {
                      if (await trigger(['vehicleTypeId', 'baseFareKobo', 'pricePerKmKobo', 'pricePerMinuteKobo', 'minimumFareKobo']))
                        setPricingStep(2);
                    }}
                  />
                </>
              ) : (
                <>
                  <AppButton variant="tertiary" type="button" label="Back" onPress={() => setPricingStep(1)} />
                  <AppButton
                    variant="brand"
                    type="submit"
                    label={editingPricing ? 'Save' : 'Create class'}
                    isLoading={isSubmitting || savePricingMutation.isPending}
                  />
                </>
              )
            }
          >
            {pricingStep === 1 ? (
              <>
                <AppSelect
                  label="Vehicle class"
                  isRequired
                  isDisabled={!!editingPricing}
                  placeholder="Choose a class"
                  selectedKey={watch('vehicleTypeId')}
                  onSelectionChange={(key) => setValue('vehicleTypeId', key, { shouldValidate: true })}
                  options={(vehicleTypes || []).map((vt) => ({ key: vt.id, label: vt.name }))}
                  error={errors.vehicleTypeId?.message}
                />
                <AppInput label="Base fare" isRequired type="number" {...register('baseFareKobo')} errorMessage={errors.baseFareKobo?.message} />
                <AppInput label="Per km" isRequired type="number" {...register('pricePerKmKobo')} errorMessage={errors.pricePerKmKobo?.message} />
                <AppInput
                  label="Per minute"
                  isRequired
                  type="number"
                  {...register('pricePerMinuteKobo')}
                  errorMessage={errors.pricePerMinuteKobo?.message}
                />
                <AppInput
                  label="Minimum fare"
                  isRequired
                  type="number"
                  {...register('minimumFareKobo')}
                  errorMessage={errors.minimumFareKobo?.message}
                />
              </>
            ) : (
              <>
                <AppInput
                  label="Kero commission (%)"
                  isRequired
                  type="number"
                  {...register('keroCommissionRate')}
                  errorMessage={errors.keroCommissionRate?.message}
                />
                <AppInput
                  label="Cancellation fee"
                  type="number"
                  {...register('cancellationFeeKobo')}
                  errorMessage={errors.cancellationFeeKobo?.message}
                />
                <AppInput
                  label="Waiting charge per minute"
                  type="number"
                  {...register('waitingChargePerMinuteKobo')}
                  errorMessage={errors.waitingChargePerMinuteKobo?.message}
                />
                <AppInput
                  label="Lagos road tax per trip"
                  type="number"
                  {...register('lagosFlatCostPerTripKobo')}
                  errorMessage={errors.lagosFlatCostPerTripKobo?.message}
                />
              </>
            )}
          </AppModal>
        </Page>
    </PermissionGuard>
  );
}
