'use client';

// src/app/config/dispatch/page.tsx
// Dispatch settings: how drivers are ranked for a ride request, how far the
// search reaches and how long each offer stays open. Read-only by default —
// admins switch to Edit explicitly so nothing changes by accident.

import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  CheckCircle,
  FloppyDisk,
  HandPointing,
  NavigationArrow,
  PencilSimple,
  Star,
  WarningOctagon,
  WifiHigh,
  type Icon as PhosphorIcon,
} from '@phosphor-icons/react';
import { Modal } from '@heroui/react';
import { AppButton } from '@/components/ui/app-button';
import { DashboardCard } from '@/components/ui/dashboard-card';
import { DetailList, Page, PageHeader, SectionHeader, StatusPill } from '@/components/ui/page';
import { Can } from '@/components/auth/can';
import { api } from '@/lib/api';

interface DispatchWeights {
  etaWeight: number;
  driverRatingWeight: number;
  completionRateWeight: number;
  socketOnlineWeight: number;
  acceptanceRateWeight: number;
}

interface DispatchRadiusConfig {
  searchRadiusInitialKm: number;
  searchRadiusStepKm: number;
  searchRadiusMaxKm: number;
  offerTimeoutSeconds: number;
  batchDispatchSize: number;
}

const DEFAULT_WEIGHTS: DispatchWeights = {
  etaWeight: 0.35,
  driverRatingWeight: 0.2,
  completionRateWeight: 0.2,
  socketOnlineWeight: 0.15,
  acceptanceRateWeight: 0.1,
};

const DEFAULT_RADIUS: DispatchRadiusConfig = {
  searchRadiusInitialKm: 2.0,
  searchRadiusStepKm: 1.5,
  searchRadiusMaxKm: 8.0,
  offerTimeoutSeconds: 15,
  batchDispatchSize: 3,
};

const WEIGHT_FIELDS: { key: keyof DispatchWeights; label: string; hint: string; icon: PhosphorIcon }[] = [
  { key: 'etaWeight', label: 'Pickup distance', hint: 'Nearest drivers first', icon: NavigationArrow },
  { key: 'driverRatingWeight', label: 'Driver rating', hint: 'Average star rating', icon: Star },
  { key: 'completionRateWeight', label: 'Completion rate', hint: 'Trips finished without cancelling', icon: CheckCircle },
  { key: 'socketOnlineWeight', label: 'Connection quality', hint: 'Stable, responsive app', icon: WifiHigh },
  { key: 'acceptanceRateWeight', label: 'Acceptance rate', hint: 'Offers accepted', icon: HandPointing },
];

const RADIUS_FIELDS: {
  key: keyof DispatchRadiusConfig;
  label: string;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
}[] = [
  { key: 'searchRadiusInitialKm', label: 'Starting radius', min: 1, max: 5, step: 0.5, format: (v) => `${v.toFixed(1)} km` },
  { key: 'searchRadiusStepKm', label: 'Widen by', min: 0.5, max: 3, step: 0.5, format: (v) => `${v.toFixed(1)} km` },
  { key: 'searchRadiusMaxKm', label: 'Maximum radius', min: 5, max: 15, step: 1, format: (v) => `${v.toFixed(1)} km` },
  { key: 'offerTimeoutSeconds', label: 'Offer timeout', min: 10, max: 45, step: 5, format: (v) => `${v}s` },
  { key: 'batchDispatchSize', label: 'Drivers offered at once', min: 1, max: 5, step: 1, format: (v) => String(v) },
];

function fromApi(configData: Record<string, any> | null | undefined) {
  const w = configData?.driverRankingWeights ?? {};
  const num = (v: unknown, fallback: number) => (typeof v === 'number' ? v : fallback);
  return {
    weights: {
      etaWeight: num(w.etaWeight, DEFAULT_WEIGHTS.etaWeight),
      driverRatingWeight: num(w.ratingWeight, DEFAULT_WEIGHTS.driverRatingWeight),
      completionRateWeight: num(w.completionRateWeight, DEFAULT_WEIGHTS.completionRateWeight),
      socketOnlineWeight: num(w.socketOnlineWeight, DEFAULT_WEIGHTS.socketOnlineWeight),
      acceptanceRateWeight: num(w.acceptanceRateWeight, DEFAULT_WEIGHTS.acceptanceRateWeight),
    },
    radius: {
      searchRadiusInitialKm: num(configData?.searchRadiusKm, DEFAULT_RADIUS.searchRadiusInitialKm),
      searchRadiusStepKm: num(configData?.radiusExpansionStepKm, DEFAULT_RADIUS.searchRadiusStepKm),
      searchRadiusMaxKm: num(configData?.maxSearchRadiusKm, DEFAULT_RADIUS.searchRadiusMaxKm),
      offerTimeoutSeconds: num(configData?.countdownSeconds, DEFAULT_RADIUS.offerTimeoutSeconds),
      batchDispatchSize: num(configData?.maxOffersPerRequest, DEFAULT_RADIUS.batchDispatchSize),
    },
  };
}

export default function DispatchConfigPage() {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [weights, setWeights] = useState<DispatchWeights>(DEFAULT_WEIGHTS);
  const [radiusConfig, setRadiusConfig] = useState<DispatchRadiusConfig>(DEFAULT_RADIUS);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

  const { data: configData, isLoading, isError } = useQuery({
    queryKey: ['admin', 'dispatch-config'],
    queryFn: async () => {
      const res = await api.get('/admin/dispatch-config');
      return res.data?.data ?? null;
    },
  });

  const saved = fromApi(configData);

  // Sync the form with the saved config whenever it loads and we're not editing.
  useEffect(() => {
    if (isEditing) return;
    const next = fromApi(configData);
    setWeights(next.weights);
    setRadiusConfig(next.radius);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configData, isEditing]);

  const totalWeight = Number(Object.values(weights).reduce((a, b) => a + b, 0).toFixed(2));
  const isValidSum = Math.abs(totalWeight - 1) < 0.001;

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await api.put('/admin/dispatch-config', {
        searchRadiusKm: radiusConfig.searchRadiusInitialKm,
        maxSearchRadiusKm: radiusConfig.searchRadiusMaxKm,
        radiusExpansionStepKm: radiusConfig.searchRadiusStepKm,
        countdownSeconds: radiusConfig.offerTimeoutSeconds,
        maxOffersPerRequest: radiusConfig.batchDispatchSize,
        driverRankingWeights: {
          etaWeight: weights.etaWeight,
          ratingWeight: weights.driverRatingWeight,
          completionRateWeight: weights.completionRateWeight,
          socketOnlineWeight: weights.socketOnlineWeight,
          acceptanceRateWeight: weights.acceptanceRateWeight,
        },
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Dispatch settings saved');
      queryClient.invalidateQueries({ queryKey: ['admin', 'dispatch-config'] });
      setIsConfirmModalOpen(false);
      setIsEditing(false);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Could not save dispatch settings');
    },
  });

  const cancelEditing = () => {
    setWeights(saved.weights);
    setRadiusConfig(saved.radius);
    setIsEditing(false);
  };

  return (
    <Page>
      <PageHeader
        title="Settings"
        description="How drivers are matched to ride requests."
        badge={isEditing ? <StatusPill tone="brand" dot>Editing</StatusPill> : undefined}
        actions={
          isEditing ? (
            <>
              <AppButton variant="tertiary" label="Cancel" onPress={cancelEditing} />
              <AppButton
                variant="brand"
                startContent={<FloppyDisk />}
                label="Save changes"
                isDisabled={!isValidSum}
                onPress={() => setIsConfirmModalOpen(true)}
              />
            </>
          ) : (
            <Can permission="manage_dispatch_config">
              <AppButton
                variant="tertiary"
                startContent={<PencilSimple />}
                label="Edit"
                isDisabled={isLoading || isError}
                onPress={() => setIsEditing(true)}
              />
            </Can>
          )
        }
      />


      {isError && (
        <DashboardCard className="bg-warning-soft/50">
          <p className="text-[13px] text-foreground">Couldn’t load the saved settings. Editing is disabled until they load.</p>
        </DashboardCard>
      )}

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-12">
        <DashboardCard className="lg:col-span-7">
          <SectionHeader
            title="Match weights"
            description="What matters most when choosing a driver"
            actions={
              isEditing ? (
                <StatusPill tone={isValidSum ? 'success' : 'danger'}>
                  <span className="tabular">{(totalWeight * 100).toFixed(0)}% of 100%</span>
                </StatusPill>
              ) : undefined
            }
          />

          <div className="mt-6 space-y-6">
            {WEIGHT_FIELDS.map((field) => {
              const pct = Math.round(weights[field.key] * 100);
              return (
                <div key={field.key}>
                  <div className="mb-2 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-default text-foreground">
                        <field.icon size={18} />
                      </span>
                      <div>
                        <p className="text-[14px] font-medium text-foreground">{field.label}</p>
                        <p className="text-xs text-muted">{field.hint}</p>
                      </div>
                    </div>
                    <span className="tabular text-[14px] font-bold text-foreground">{pct}%</span>
                  </div>
                  {isEditing ? (
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={weights[field.key]}
                      onChange={(e) =>
                        setWeights((prev) => ({ ...prev, [field.key]: Number(parseFloat(e.target.value).toFixed(2)) }))
                      }
                      className="w-full"
                      aria-label={field.label}
                    />
                  ) : (
                    <div className="h-1 w-full overflow-hidden rounded-full bg-default">
                      <div className="h-full rounded-full bg-secondary" style={{ width: `${pct}%` }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </DashboardCard>

        <DashboardCard className="lg:col-span-5">
          <SectionHeader title="Search & offers" description="How far to look and how long drivers have" />

          {isEditing ? (
            <div className="mt-6 space-y-6">
              {RADIUS_FIELDS.map((field) => (
                <div key={field.key}>
                  <div className="mb-2 flex items-center justify-between text-[14px]">
                    <span className="font-medium text-foreground">{field.label}</span>
                    <span className="tabular font-bold text-foreground">{field.format(radiusConfig[field.key])}</span>
                  </div>
                  <input
                    type="range"
                    min={field.min}
                    max={field.max}
                    step={field.step}
                    value={radiusConfig[field.key]}
                    onChange={(e) => setRadiusConfig((prev) => ({ ...prev, [field.key]: parseFloat(e.target.value) }))}
                    className="w-full"
                    aria-label={field.label}
                  />
                </div>
              ))}
            </div>
          ) : (
            <DetailList
              className="mt-5"
              items={RADIUS_FIELDS.map((field) => ({ label: field.label, value: field.format(radiusConfig[field.key]) }))}
            />
          )}
        </DashboardCard>
      </div>

      <Modal isOpen={isConfirmModalOpen} onOpenChange={setIsConfirmModalOpen}>
        <Modal.Backdrop variant="blur">
          <Modal.Container placement="center" size="sm">
            <Modal.Dialog className="max-w-md rounded-3xl bg-overlay p-7">
              <div>
                <div>
                  <h3 className="text-[18px] font-bold tracking-[-0.02em] text-foreground">Save dispatch settings?</h3>
                  <p className="mt-1 text-[13px] text-muted">New ride requests will use these settings immediately.</p>
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <AppButton
                  variant="tertiary"
                  label="Cancel"
                  onPress={() => setIsConfirmModalOpen(false)}
                  isDisabled={saveMutation.isPending}
                />
                <AppButton variant="brand" label="Save" isLoading={saveMutation.isPending} onPress={() => saveMutation.mutate()} />
              </div>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </Page>
  );
}
