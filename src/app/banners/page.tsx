'use client';

// src/app/banners/page.tsx
// Phase 6: In-App Promotional Banners & Passenger Mobile Carousel
import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Image,
  Plus,
  ArrowClockwise,
  PencilSimple,
  Trash,
  CheckCircle,
  XCircle,
  Eye,
  CursorClick,
  LinkSimple,
  SlidersHorizontal,
  CaretLeft,
  CalendarCheck,
  ShieldCheck,
  Users,
  Megaphone,
  DotsThreeVertical,
} from '@phosphor-icons/react';
import { Card, Chip, Modal, Dropdown } from '@heroui/react';
import { toast } from 'sonner';
import { AppButton } from '@/components/ui/app-button';
import { AppInput } from '@/components/ui/app-input';
import { PermissionGuard, Can, usePermission } from '@/components/auth/can';
import { AppRowActions } from '@/components/ui/app-row-actions';
import { DashboardCard, StatDashboardCard } from '@/components/ui/dashboard-card';
import { Page, PageHeader, StatusPill } from '@/components/ui/page';
import { api } from '@/lib/api';
import { applyApiFormError } from '@/lib/errors';
import { BannerItem } from '@/types/admin';
import {
  createBannerSchema,
  type CreateBannerInput,
} from '@/lib/schemas/admin.schemas';

export default function BannersPage() {
  const canToggle = usePermission('toggle_banner');
  const canEdit = usePermission('edit_banner');
  const canDelete = usePermission('delete_banner');
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<BannerItem | null>(null);

  // ── Query: Banners ──────────────────────────────────────────────────
  const {
    data: banners,
    isLoading,
    refetch,
    isFetching,
  } = useQuery<BannerItem[]>({
    queryKey: ['admin', 'banners'],
    queryFn: async () => {
      try {
        const res = await api.get<{ data: { banners: BannerItem[] } | BannerItem[] }>('/admin/banners');
        const raw = res.data?.data;
        if (raw && !Array.isArray(raw) && Array.isArray(raw.banners)) return raw.banners;
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
    watch,
  } = useForm<CreateBannerInput>({
    resolver: zodResolver(createBannerSchema) as any,
    defaultValues: {
      title: '',
      subtitle: '',
      imageUrl: '',
      linkUrl: '',
      targetAudience: 'all',
      priority: 0,
      isActive: true,
    },
  });

  const previewImage = watch('imageUrl') || 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=600&q=80';
  const previewTitle = watch('title') || 'Your In-App Banner Title';
  const previewSubtitle = watch('subtitle') || 'Catchy subtitle and promotional CTA description...';

  // ── Mutation: Save Banner (Create / Update) ─────────────────────────
  const saveBannerMutation = useMutation({
    mutationFn: async (values: CreateBannerInput) => {
      if (editingBanner) {
        const res = await api.put(`/admin/banners/${editingBanner.id}`, values);
        return res.data;
      } else {
        const res = await api.post('/admin/banners', {
          ...values,
          startsAt: values.startsAt || new Date().toISOString(),
        });
        return res.data;
      }
    },
    onSuccess: () => {
      toast.success(editingBanner ? 'Banner updated.' : 'New in-app banner deployed.');
      setIsModalOpen(false);
      setEditingBanner(null);
      reset();
      refetch();
    },
    onError: (err: any) => {
      applyApiFormError(err, { setError });
    },
  });

  // ── Mutation: Toggle Banner Active ──────────────────────────────────
  const toggleBannerMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.put(`/admin/banners/${id}/toggle`);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Banner visibility toggled.');
      refetch();
    },
    onError: (err: any) => {
      toast.error(`Failed to toggle banner: ${err?.message || 'Error'}`);
    },
  });

  // ── Mutation: Delete Banner ─────────────────────────────────────────
  const deleteBannerMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(`/admin/banners/${id}`);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Banner removed from carousel.');
      refetch();
    },
    onError: (err: any) => {
      toast.error(`Could not delete banner: ${err?.message || 'Error'}`);
    },
  });

  const onSubmit = (values: any) => {
    saveBannerMutation.mutate(values as CreateBannerInput);
  };

  const openModal = (banner?: BannerItem) => {
    if (banner) {
      setEditingBanner(banner);
      reset({
        title: banner.title,
        subtitle: banner.subtitle || '',
        imageUrl: banner.imageUrl,
        linkUrl: banner.linkUrl || '',
        targetAudience: (banner.targetAudience as any) || 'all',
        priority: banner.priority,
        isActive: banner.isActive,
      });
    } else {
      setEditingBanner(null);
      reset({
        title: '',
        subtitle: '',
        imageUrl: '',
        linkUrl: '',
        targetAudience: 'all',
        priority: 0,
        isActive: true,
      });
    }
    setIsModalOpen(true);
  };

  const totalImpressions = (banners || []).reduce((acc, b) => acc + b.impressions, 0);
  const totalClicks = (banners || []).reduce((acc, b) => acc + b.clicks, 0);
  const averageCTR = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(1) : '12.9';

  return (
    <PermissionGuard permission="view_banners">
      <Page>
          <PageHeader
            title="Banners"
            description="Promotions shown in the rider and driver apps."
            actions={
              <>
                <AppButton variant="tertiary" isIconOnly aria-label="Refresh" startContent={<ArrowClockwise />} onPress={() => refetch()} />
                <Can permission="create_banner">
                  <AppButton variant="brand" startContent={<Plus weight="bold" />} label="New banner" onPress={() => openModal()} />
                </Can>
              </>
            }
          />

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <StatDashboardCard
              label="Live banners"
              icon={Image}
              variant="wallet"
              value={(banners || []).filter((b) => b.isActive).length}
              hint="Showing in the apps"
            />
            <StatDashboardCard label="Impressions" icon={Eye} value={totalImpressions.toLocaleString()} hint="All banners" />
            <StatDashboardCard label="Clicks" icon={CursorClick} value={totalClicks.toLocaleString()} hint="Tapped through" />
            <StatDashboardCard label="Click-through" icon={SlidersHorizontal} value={`${averageCTR}%`} hint="Average rate" />
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {(banners || []).map((banner) => (
              <DashboardCard key={banner.id} className="overflow-hidden p-0">
                <div className="relative h-40 w-full overflow-hidden bg-default">
                  <img src={banner.imageUrl} alt={banner.title} className="h-full w-full object-cover" />
                  <div className="absolute right-3 top-3">
                    <StatusPill tone={banner.isActive ? 'success' : 'neutral'} className="bg-surface" dot>
                      {banner.isActive ? 'Live' : 'Hidden'}
                    </StatusPill>
                  </div>
                </div>

                <div className="p-6">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-[16px] font-bold text-foreground">{banner.title}</h3>
                      <p className="mt-0.5 line-clamp-1 text-[13px] text-muted">{banner.subtitle || '—'}</p>
                    </div>
                    <AppRowActions
                      items={[
                        {
                          key: 'toggle',
                          label: banner.isActive ? 'Hide' : 'Show',
                          icon: <Eye size={14} />,
                          disabled: !canToggle,
                          onClick: () => toggleBannerMutation.mutate(banner.id),
                        },
                        {
                          key: 'edit',
                          label: 'Edit',
                          icon: <PencilSimple size={14} />,
                          disabled: !canEdit,
                          onClick: () => openModal(banner),
                        },
                        {
                          key: 'delete',
                          label: 'Delete',
                          icon: <Trash size={14} />,
                          danger: true,
                          disabled: !canDelete,
                          onClick: () => {
                            if (confirm(`Delete banner "${banner.title}"?`)) deleteBannerMutation.mutate(banner.id);
                          },
                        },
                      ]}
                    />
                  </div>

                  <dl className="mt-5 grid grid-cols-3 gap-3 text-[13px]">
                    <div>
                      <dt className="text-xs text-muted">Audience</dt>
                      <dd className="mt-0.5 capitalize text-foreground">{banner.targetAudience}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted">Views</dt>
                      <dd className="tabular mt-0.5 text-foreground">{banner.impressions.toLocaleString()}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted">Clicks</dt>
                      <dd className="tabular mt-0.5 text-foreground">{banner.clicks.toLocaleString()}</dd>
                    </div>
                  </dl>
                </div>
              </DashboardCard>
            ))}
          </div>

          {/* ════════════════════════════════════════════════════════════════
              MODAL: CREATE / EDIT BANNER (Centered Compound)
             ════════════════════════════════════════════════════════════════ */}
          <Modal>
            <Modal.Backdrop
              isOpen={isModalOpen}
              onOpenChange={(open) => {
                if (!open) {
                  setIsModalOpen(false);
                  setEditingBanner(null);
                }
              }}
            >
              <Modal.Container placement="center" size="lg">
                <Modal.Dialog className="rounded-3xl bg-overlay p-7 max-w-2xl mx-auto">
                  <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div className="flex items-center gap-3 pb-4">
                      <div>
                        <h3 className="text-[18px] font-bold tracking-[-0.02em] text-foreground">
                          {editingBanner ? 'Edit Promotional Banner' : 'Create In-App Hero Banner'}
                        </h3>
                        <p className="mt-1 text-[13px] text-muted">
                          Configure mobile promotional banner displayed on the passenger and driver home screen.
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col gap-4">
                      {/* Left: Form Fields */}
                      <div className="space-y-3">
                        <AppInput
                          label="Banner Title"
                          isRequired
                          placeholder="e.g. Upgrade to Kero Comfort"
                          {...register('title')}
                          errorMessage={errors.title?.message}
                        />

                        <AppInput
                          label="Subtitle / Supporting Text"
                          placeholder="e.g. 20% off all airport executive trips"
                          {...register('subtitle')}
                          errorMessage={errors.subtitle?.message}
                        />

                        <AppInput
                          label="Banner Image URL / CDN Link"
                          isRequired
                          placeholder="https://... or cdn asset path"
                          {...register('imageUrl')}
                          errorMessage={errors.imageUrl?.message}
                        />

                        <AppInput
                          label="Target Screen Deeplink URL"
                          placeholder="e.g. kero://ride/comfort or https://..."
                          {...register('linkUrl')}
                          errorMessage={errors.linkUrl?.message}
                        />

                        <div className="flex flex-col gap-4">
                          <div>
                            <label className="text-xs font-semibold text-foreground block mb-1">
                              Audience *
                            </label>
                            <select
                              {...register('targetAudience')}
                              className="w-full h-10 px-3 rounded-lg bg-background text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                            >
                              <option value="all">All Users</option>
                              <option value="riders">Riders Only</option>
                              <option value="drivers">Drivers Only</option>
                            </select>
                          </div>

                          <AppInput
                            label="Carousel Priority"
                            type="number"
                            placeholder="e.g. 10 (higher first)"
                            {...register('priority', { valueAsNumber: true })}
                            errorMessage={errors.priority?.message}
                          />
                        </div>
                      </div>

                      {/* Right: Realistic Mobile Carousel Banner Preview */}
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-foreground block">
                          Mobile App Carousel Preview
                        </label>
                        <div className="relative rounded-2xl overflow-hidden h-56 bg-default flex flex-col justify-end p-4 text-white">
                          <img
                            src={previewImage}
                            alt="Preview"
                            className="absolute inset-0 w-full h-full object-cover brightness-75"
                          />
                          <div className="relative z-10 space-y-1">
                            <span className="bg-primary text-primary-foreground text-[11px] font-bold px-2 py-0.5 rounded-full w-fit">
                              SPONSORED
                            </span>
                            <h4 className="font-bold text-sm text-white drop-shadow">
                              {previewTitle}
                            </h4>
                            <p className="text-xs text-white/90 drop-shadow line-clamp-2">
                              {previewSubtitle}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-4">
                      <AppButton
                        variant="outline"
                        size="sm"
                        type="button"
                        onClick={() => {
                          setIsModalOpen(false);
                          setEditingBanner(null);
                        }}
                      >
                        Cancel
                      </AppButton>
                      <AppButton
                        variant="primary"
                        size="sm"
                        type="submit"
                        isLoading={isSubmitting || saveBannerMutation.isPending}
                      >
                        {editingBanner ? 'Save Changes' : 'Deploy Banner'}
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
