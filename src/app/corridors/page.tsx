'use client';

// src/app/corridors/page.tsx
// Operating Corridors & Service Areas Management Page.
// Displays active launch areas (e.g. Ilorin South), destination policies,
// full-screen interactive click-to-draw geofence creation flow, and details configuration.

import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import {
  Compass,
  ArrowClockwise,
  Plus,
  MapPin,
  ShieldCheck,
  Check,
  Copy,
  PencilSimple,
  ToggleLeft,
  ToggleRight,
  Path,
  MagnifyingGlass,
  SlidersHorizontal,
} from '@phosphor-icons/react';
import { Chip, Modal, Skeleton } from '@heroui/react';
import { AppButton } from '@/components/ui/app-button';
import { AppInput } from '@/components/ui/app-input';
import { AppTextarea } from '@/components/ui/app-textarea';
import { AppSelect } from '@/components/ui/app-select';
import { AppRowActions } from '@/components/ui/app-row-actions';
import { DashboardCard, StatDashboardCard } from '@/components/ui/dashboard-card';
import { EmptyState, Page, PageHeader, Segmented, StatusPill } from '@/components/ui/page';
import { CorridorEditorMap } from '@/components/corridors/corridor-editor-map';
import { PermissionGuard } from '@/components/auth/can';
import { api } from '@/lib/api';
import { applyApiFormError } from '@/lib/errors';
import { ServiceAreaItem, ServiceAreaStatus, ServiceAreaDestinationPolicy } from '@/types/admin';

interface CorridorDetailsFormInput {
  name: string;
  description: string;
  destinationPolicy: ServiceAreaDestinationPolicy;
  priority: number;
}

export default function OperatingCorridorsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Map Drawing & Creation Flow State
  const [isDrawingMap, setIsDrawingMap] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [editingCorridor, setEditingCorridor] = useState<ServiceAreaItem | null>(null);
  const [drawnPoints, setDrawnPoints] = useState<[number, number][]>([]);
  const [formErrorAlert, setFormErrorAlert] = useState<string | null>(null);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // ── Query: Service Areas ──────────────────────────────────────────
  const {
    data: corridorsData,
    isLoading,
    refetch,
    isFetching,
  } = useQuery<ServiceAreaItem[]>({
    queryKey: ['admin', 'service-areas'],
    queryFn: async () => {
      const res = await api.get<{ data: ServiceAreaItem[] } | ServiceAreaItem[]>('/admin/service-areas');
      const payload = (res.data as any)?.data ?? res.data;
      return Array.isArray(payload) ? payload : [];
    },
  });

  const corridors = corridorsData ?? [];

  // Filtered Corridors
  const filteredCorridors = useMemo(() => {
    return corridors.filter((item) => {
      const matchesSearch =
        search.trim() === '' ||
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        (item.description && item.description.toLowerCase().includes(search.toLowerCase()));

      const matchesStatus =
        statusFilter === 'ALL' || item.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [corridors, search, statusFilter]);

  // Derived Metrics
  const activeCount = corridors.filter((c) => c.status === 'ACTIVE').length;
  const pausedCount = corridors.filter((c) => c.status === 'PAUSED').length;
  const totalBoundaryPoints = corridors.reduce((acc, curr) => {
    if (curr.geometry?.type === 'Polygon') {
      return acc + (curr.geometry.coordinates?.[0]?.length ?? 0);
    }
    return acc;
  }, 0);

  // ── Mutation: Toggle Status ─────────────────────────────────────────
  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: ServiceAreaStatus }) => {
      const res = await api.patch(`/admin/service-areas/${id}/status`, { status });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'service-areas'] });
    },
  });

  // ── Form: Corridor Details ──────────────────────────────────────────
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<CorridorDetailsFormInput>({
    defaultValues: {
      name: '',
      description: '',
      destinationPolicy: 'INSIDE_ONLY',
      priority: 0,
    },
  });

  // Keep form fields synchronized with editingCorridor whenever modal opens
  useEffect(() => {
    if (isDetailsModalOpen) {
      if (editingCorridor) {
        reset({
          name: editingCorridor.name,
          description: editingCorridor.description || '',
          destinationPolicy: editingCorridor.destinationPolicy || 'INSIDE_ONLY',
          priority: editingCorridor.priority ?? 0,
        });
      }
    }
  }, [isDetailsModalOpen, editingCorridor, reset]);

  // Start Creation Flow: Open Full-Screen Map
  const handleStartCreate = () => {
    setEditingCorridor(null);
    setDrawnPoints([]);
    setFormErrorAlert(null);
    reset({
      name: '',
      description: '',
      destinationPolicy: 'INSIDE_ONLY',
      priority: 0,
    });
    setIsDrawingMap(true);
  };

  // Start Edit Flow: Open Full-Screen Map with existing points
  const handleStartEdit = (corridor: ServiceAreaItem) => {
    setEditingCorridor(corridor);
    setFormErrorAlert(null);

    // Extract coordinates if polygon: GeoJSON is [lng, lat], convert to [lat, lng] for Leaflet
    if (corridor.geometry?.type === 'Polygon' && corridor.geometry.coordinates?.[0]) {
      const raw = corridor.geometry.coordinates[0] as number[][];
      const leafletPts: [number, number][] = raw
        .slice(0, raw.length > 1 ? raw.length - 1 : raw.length)
        .map(([lng, lat]) => [lat, lng] as [number, number]);
      setDrawnPoints(leafletPts);
    } else {
      setDrawnPoints([]);
    }

    reset({
      name: corridor.name,
      description: corridor.description || '',
      destinationPolicy: corridor.destinationPolicy,
      priority: corridor.priority || 0,
    });

    setIsDrawingMap(true);
  };

  // When User Finishes Marking Points on Map -> Unmount Map, Open Details Modal
  const handleMapNext = () => {
    if (editingCorridor) {
      reset({
        name: editingCorridor.name,
        description: editingCorridor.description || '',
        destinationPolicy: editingCorridor.destinationPolicy || 'INSIDE_ONLY',
        priority: editingCorridor.priority ?? 0,
      });
    }
    setIsDrawingMap(false);
    setIsDetailsModalOpen(true);
  };

  // Save Corridor Mutation (Create or Update)
  const saveMutation = useMutation({
    mutationFn: async (input: CorridorDetailsFormInput) => {
      if (drawnPoints.length < 3) {
        throw new Error('A corridor boundary requires at least 3 points.');
      }

      // GeoJSON Polygon closed ring: [[lng, lat], ..., [lng0, lat0]]
      const closedCoordinates: [number, number][] = [
        ...drawnPoints.map(([lat, lng]): [number, number] => [lng, lat]),
        [drawnPoints[0][1], drawnPoints[0][0]],
      ];

      const payload = {
        name: input.name.trim(),
        description: input.description?.trim() || undefined,
        destinationPolicy: input.destinationPolicy,
        priority: Number(input.priority) || 0,
        allowedVehicleTypes: [],
        geometry: {
          type: 'Polygon',
          coordinates: [closedCoordinates],
        },
      };

      if (editingCorridor) {
        const res = await api.put(`/admin/service-areas/${editingCorridor.id}`, payload);
        return res.data;
      } else {
        const res = await api.post('/admin/service-areas', payload);
        return res.data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'service-areas'] });
      setIsDetailsModalOpen(false);
      setEditingCorridor(null);
      setDrawnPoints([]);
      setFormErrorAlert(null);
      reset();
    },
    onError: (err) => {
      applyApiFormError(err, {
        setFormError: setFormErrorAlert,
      });
    },
  });

  return (
    <PermissionGuard permission="view_fleet">
      <Page>
        <PageHeader
          title="Corridors"
          description="Where Kero operates and where trips can go."
          actions={
            <>
              <AppButton
                variant="tertiary"
                isIconOnly
                aria-label="Refresh"
                startContent={<ArrowClockwise className={isFetching ? 'animate-spin' : ''} />}
                onPress={() => refetch()}
              />
              <AppButton variant="brand" startContent={<Plus weight="bold" />} label="New corridor" onPress={handleStartCreate} />
            </>
          }
        />

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <StatDashboardCard
            label="Active corridors"
            value={activeCount}
            icon={Compass}
            hint="Accepting trip requests"
            loading={isLoading}
            variant="wallet"
          />
          <StatDashboardCard
            label="Paused or draft"
            value={pausedCount}
            icon={SlidersHorizontal}
            hint="Hidden from dispatch"
            loading={isLoading}
          />
          <StatDashboardCard
            label="Boundary points"
            value={totalBoundaryPoints}
            icon={MapPin}
            hint="Across all corridors"
            loading={isLoading}
          />
          <StatDashboardCard label="Total corridors" value={corridors.length} icon={ShieldCheck} hint="All statuses" loading={isLoading} />
        </div>

        <DashboardCard className="overflow-hidden p-0">
          <div className="flex flex-col gap-4 p-6 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <Segmented
              size="sm"
              aria-label="Status"
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { key: 'ALL', label: 'All' },
                { key: 'ACTIVE', label: 'Active' },
                { key: 'PAUSED', label: 'Paused' },
                { key: 'DRAFT', label: 'Draft' },
              ]}
            />
            <div className="w-full sm:w-64">
              <AppInput
                size="sm"
                placeholder="Search corridors"
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
                  <th>Corridor</th>
                  <th>Status</th>
                  <th>Destinations</th>
                  <th>Points</th>
                  <th>Priority</th>
                  <th className="w-12" />
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={6}>
                        <Skeleton className="h-6 w-full rounded-lg" />
                      </td>
                    </tr>
                  ))
                ) : filteredCorridors.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <EmptyState
                        icon={Compass}
                        title="No corridors found"
                        description="Draw a boundary on the map to create one."
                        action={
                          <AppButton
                            variant="tertiary"
                            size="sm"
                            startContent={<Plus weight="bold" />}
                            label="New corridor"
                            onPress={handleStartCreate}
                          />
                        }
                      />
                    </td>
                  </tr>
                ) : (
                  filteredCorridors.map((area) => {
                    const pointCount =
                      area.geometry?.type === 'Polygon' ? area.geometry.coordinates?.[0]?.length ?? 0 : 0;

                    return (
                      <tr key={area.id}>
                        <td>
                          <div className="flex items-center gap-1.5 font-medium text-foreground">
                            <span>{area.name}</span>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(area.id)}
                              className="cursor-pointer text-muted hover:text-foreground"
                              title="Copy corridor ID"
                            >
                              {copiedId === area.id ? <Check size={12} className="text-success" /> : <Copy size={12} />}
                            </button>
                          </div>
                          {area.description && <p className="max-w-sm truncate text-xs text-muted">{area.description}</p>}
                        </td>

                        <td>
                          <StatusPill
                            tone={area.status === 'ACTIVE' ? 'success' : area.status === 'PAUSED' ? 'warning' : 'neutral'}
                            dot
                          >
                            {area.status === 'ACTIVE' ? 'Active' : area.status === 'PAUSED' ? 'Paused' : 'Draft'}
                          </StatusPill>
                        </td>

                        <td className="text-foreground">
                          {area.destinationPolicy === 'INSIDE_ONLY'
                            ? 'Inside only'
                            : area.destinationPolicy === 'OUTBOUND_ALLOWED'
                              ? 'Outbound allowed'
                              : 'Any active area'}
                        </td>

                        <td className="tabular text-muted">{pointCount}</td>

                        <td className="tabular text-muted">{area.priority}</td>

                        <td className="text-right">
                          <AppRowActions
                            items={[
                              {
                                key: 'edit',
                                label: 'Edit boundary',
                                icon: <PencilSimple size={14} />,
                                onClick: () => handleStartEdit(area),
                              },
                              {
                                key: 'toggle_status',
                                label: area.status === 'ACTIVE' ? 'Pause' : 'Activate',
                                icon: area.status === 'ACTIVE' ? <ToggleLeft size={14} /> : <ToggleRight size={14} />,
                                onClick: () =>
                                  statusMutation.mutate({
                                    id: area.id,
                                    status: area.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE',
                                  }),
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

          <div className="px-6 py-4 text-[13px] text-muted">
            {filteredCorridors.length} of {corridors.length} corridors
          </div>
        </DashboardCard>

        {/* ── STEP 1: Full-Screen Interactive Map (Mounts only on Add/Edit) ── */}
        {isDrawingMap && (
          <CorridorEditorMap
            existingCorridors={corridors}
            points={drawnPoints}
            onAddPoint={(pt) => setDrawnPoints((prev) => [...prev, pt])}
            onUpdatePoint={(index, newPt) =>
              setDrawnPoints((prev) => {
                const next = [...prev];
                next[index] = newPt;
                return next;
              })
            }
            onDeletePoint={(index) =>
              setDrawnPoints((prev) => prev.filter((_, i) => i !== index))
            }
            onUndoPoint={() => setDrawnPoints((prev) => prev.slice(0, prev.length - 1))}
            onClearPoints={() => setDrawnPoints([])}
            onNext={handleMapNext}
            onCancel={() => {
              setIsDrawingMap(false);
              setEditingCorridor(null);
              setDrawnPoints([]);
            }}
          />
        )}

        {/* ── STEP 2: Configure Details Modal (Shows after points are chosen) ── */}
        <Modal.Backdrop isOpen={isDetailsModalOpen} onOpenChange={setIsDetailsModalOpen} variant="blur">
          <Modal.Container placement="center" size="md">
            <Modal.Dialog className="rounded-3xl bg-overlay p-7 max-h-[90vh] overflow-y-auto">
              <div>
                <h3 className="text-[18px] font-bold tracking-[-0.02em] text-foreground">
                  {editingCorridor ? 'Edit corridor' : 'New corridor'}
                </h3>
                <p className="mt-1 text-[13px] text-muted">Name it and set how trips can leave the boundary.</p>
              </div>

              <form onSubmit={handleSubmit((data) => saveMutation.mutate(data))} className="mt-4 space-y-4">
                {formErrorAlert && (
                  <div className="p-3 rounded-xl bg-danger-soft text-danger text-xs">
                    {formErrorAlert}
                  </div>
                )}

                {/* Captured Polygon Summary */}
                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-field">
                  <div className="flex items-center gap-2.5">
                    <div className="grid size-7 place-items-center rounded-lg bg-secondary/15 text-secondary">
                      <MapPin size={15} weight="duotone" />
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-foreground">Geofence Boundary</span>
                      <p className="text-[11px] text-muted">
                        {drawnPoints.length} polygon points captured from map
                      </p>
                    </div>
                  </div>
                  <AppButton
                    size="sm"
                    variant="ghost"
                    label="Adjust on Map"
                    onPress={() => {
                      setIsDetailsModalOpen(false);
                      setIsDrawingMap(true);
                    }}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">Corridor Name *</label>
                  <Controller
                    name="name"
                    control={control}
                    rules={{ required: 'Name is required' }}
                    render={({ field }) => (
                      <AppInput
                        placeholder="e.g. Ilorin South Expansion, Lagos Island Metro"
                        value={field.value ?? ''}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        errorMessage={errors.name?.message}
                      />
                    )}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">Description</label>
                  <Controller
                    name="description"
                    control={control}
                    render={({ field }) => (
                      <AppTextarea
                        placeholder="Brief description of the operating area coverage..."
                        value={field.value ?? ''}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                      />
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-foreground">Destination Policy *</label>
                    <Controller
                      name="destinationPolicy"
                      control={control}
                      render={({ field }) => (
                        <AppSelect
                          selectedKey={field.value}
                          onSelectionChange={(key) => {
                            if (key) field.onChange(key as ServiceAreaDestinationPolicy);
                          }}
                          options={[
                            { key: 'INSIDE_ONLY', label: 'Inside Only (Strict Boundary)' },
                            { key: 'OUTBOUND_ALLOWED', label: 'Allow Outbound Dropoffs' },
                            { key: 'ANY_ACTIVE_SERVICE_AREA', label: 'Any Active Service Area' },
                          ]}
                        />
                      )}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-foreground">Dispatch Priority</label>
                    <Controller
                      name="priority"
                      control={control}
                      render={({ field }) => (
                        <AppInput
                          type="number"
                          placeholder="0"
                          value={String(field.value ?? 0)}
                          onChange={(e) => field.onChange(Number(e.target.value) || 0)}
                          onBlur={field.onBlur}
                        />
                      )}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-4">
                  <AppButton
                    variant="ghost"
                    onPress={() => {
                      setIsDetailsModalOpen(false);
                      setEditingCorridor(null);
                    }}
                    label="Cancel"
                  />
                  <AppButton
                    type="submit"
                    variant="primary"
                    isLoading={saveMutation.isPending}
                    label={editingCorridor ? 'Update Corridor' : 'Save Corridor'}
                  />
                </div>
              </form>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Page>
    </PermissionGuard>
  );
}
