'use client';

// src/components/drivers/driver-kyc-panel.tsx
// KYC on the driver page: overall status, each stage's submitted details,
// the reviewer's decision, signed document links (valid for an hour) and the
// review history. The NIN is never shown; only whether it was provided.

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowSquareOut, CheckCircle, FileImage, XCircle } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { Can } from '@/components/auth/can';
import { AppButton } from '@/components/ui/app-button';
import { AppModal } from '@/components/ui/app-modal';
import { AppSelect } from '@/components/ui/app-select';
import { formatDate, formatDob } from '@/lib/format';
import type { VehicleTypePricingItem } from '@/types/admin';
import { AppTextarea } from '@/components/ui/app-textarea';
import { DashboardCard } from '@/components/ui/dashboard-card';
import { DetailList, EmptyState, SectionHeader, StatusPill, type StatusTone } from '@/components/ui/page';
import { KycStatusPill, type DriverKycStatus } from './verification-pills';

export interface DriverKycSummary {
  status: DriverKycStatus;
  submittedAt: string | null;
  finalDecision: string | null;
  finalDecidedAt: string | null;
  finalDecidedBy: string | null;
  rejectionReason: string | null;
  ninProvided: boolean;
  stages: Array<{
    stage: 'personal' | 'license' | 'vehicle';
    status: string;
    review: {
      decision?: string;
      reason?: string | null;
      reviewedAt?: string | null;
      reviewedBy?: string | null;
      rejectedFields?: string[];
    } | null;
    fields: Array<{ key: string; label: string; value: string }>;
    documents: Array<{ key: string; label: string; url: string }>;
  }>;
  history: Array<Record<string, unknown>>;
}

const STAGE_TITLE = { personal: 'Personal', license: 'Licence', vehicle: 'Vehicle' } as const;

/** Fields an admin can flag per stage (must match the backend's KYC_REVIEW_FIELDS). */
const STAGE_FIELDS: Record<keyof typeof STAGE_TITLE, Array<{ key: string; label: string }>> = {
  personal: [
    { key: 'dateOfBirth', label: 'Date of birth' },
    { key: 'gender', label: 'Gender' },
    { key: 'nin', label: 'NIN' },
    { key: 'portraitPhoto', label: 'Portrait photo' },
  ],
  license: [
    { key: 'licenseNumber', label: 'Licence number' },
    { key: 'licenseExpiry', label: 'Expiry date' },
    { key: 'licenseImage', label: 'Licence photo' },
    { key: 'selfieWithLicense', label: 'Selfie with licence' },
  ],
  vehicle: [
    { key: 'brand', label: 'Brand' },
    { key: 'model', label: 'Model' },
    { key: 'color', label: 'Colour' },
    { key: 'plateNumber', label: 'Plate number' },
    { key: 'productionYear', label: 'Year' },
    { key: 'vehiclePhoto', label: 'Vehicle photo' },
    { key: 'vehicleRegistrationFront', label: 'Registration (front)' },
    { key: 'vehicleRegistrationBack', label: 'Registration (back)' },
  ],
};

const fieldLabel = (stage: keyof typeof STAGE_TITLE, key: string) =>
  STAGE_FIELDS[stage].find((x) => x.key === key)?.label ?? key;

function stageTone(status: string): StatusTone {
  const s = status.toLowerCase();
  if (s === 'approved') return 'success';
  if (s === 'rejected') return 'danger';
  if (s === 'submitted') return 'warning';
  return 'neutral';
}

function stageLabel(status: string): string {
  const s = status.toLowerCase();
  if (s === 'submitted') return 'Awaiting review';
  if (s === 'empty') return 'Not submitted';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Date fields arrive as ISO strings ("2000-09-19T00:00:00.000Z"); show them as dates. */
const DATE_FIELDS = new Set(['dateOfBirth', 'licenseExpiry']);
function fieldValue(key: string, value: string): string {
  if (!DATE_FIELDS.has(key)) return value;
  return key === 'dateOfBirth' ? formatDob(value) : formatDate(value);
}

const fmt = (v?: string | null) =>
  v
    ? new Date(v).toLocaleString('en-NG', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })
    : '—';

function historyText(entry: Record<string, unknown>): { title: string; detail: string | null; at: string | null } {
  const action = String(entry.action ?? entry.decision ?? entry.event ?? 'Update');
  const stage = entry.stage ? ` · ${String(entry.stage)}` : '';
  const reason = entry.reason ? String(entry.reason) : null;
  const by = entry.reviewedBy ?? entry.by ?? entry.adminEmail;
  const at = (entry.at ?? entry.reviewedAt ?? entry.createdAt ?? null) as string | null;
  return {
    title: `${action.replaceAll('_', ' ')}${stage}`,
    detail: [reason, by ? `by ${String(by)}` : null].filter(Boolean).join(' · ') || null,
    at,
  };
}

export function DriverKycPanel({ kyc, driverId }: { kyc: DriverKycSummary | undefined; driverId: string }) {
  const queryClient = useQueryClient();
  const [rejecting, setRejecting] = useState<DriverKycSummary['stages'][number]['stage'] | null>(null);
  const [reason, setReason] = useState('');
  const [flagged, setFlagged] = useState<string[]>([]);

  // This driver's page, the lists, the KYC queue and dashboard counts.
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'driver', driverId] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'drivers'] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'kyc'] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
  };
  const errorText = (err: unknown, fallback: string) => {
    const e = err as { message?: string; response?: { data?: { message?: string; error?: { message?: string } } } };
    return e?.response?.data?.error?.message ?? e?.response?.data?.message ?? e?.message ?? fallback;
  };

  const reviewStage = useMutation({
    mutationFn: async (input: {
      stage: string;
      decision: 'approved' | 'rejected';
      reason?: string;
      rejectedFields?: string[];
    }) =>
      (
        await api.put(
          `/admin/drivers/${driverId}/review/${input.stage}`,
          {
            decision: input.decision,
            ...(input.reason ? { reason: input.reason } : {}),
            ...(input.rejectedFields?.length ? { rejectedFields: input.rejectedFields } : {}),
          },
          { silent: true },
        )
      ).data,
    onSuccess: (_, input) => {
      toast.success(input.decision === 'approved' ? 'Stage approved' : 'Stage rejected');
      setRejecting(null);
      setReason('');
      setFlagged([]);
      refresh();
    },
    onError: (err) => toast.error(errorText(err, "Couldn't save the review")),
  });

  const publish = useMutation({
    mutationFn: async (input: { vehicleTypeId?: string } = {}) =>
      (
        await api.post(
          `/admin/drivers/${driverId}/final-review`,
          input.vehicleTypeId ? { vehicleTypeId: input.vehicleTypeId } : undefined,
          { silent: true },
        )
      ).data,
    onSuccess: () => {
      toast.success('Decision sent to the driver');
      setApproving(false);
      refresh();
    },
    onError: (err) => toast.error(errorText(err, "Couldn't publish the decision")),
  });

  // Vehicle classes come from the fare table, so a class added there shows up
  // here without any change to this screen.
  const [approving, setApproving] = useState(false);
  const [vehicleTypeId, setVehicleTypeId] = useState<string | undefined>(undefined);
  const vehicleTypes = useQuery<VehicleTypePricingItem[]>({
    queryKey: ['admin', 'vehicle-types'],
    queryFn: async () => (await api.get<{ data: VehicleTypePricingItem[] }>('/pricing/vehicle-types')).data?.data ?? [],
    enabled: approving,
  });
  const classOptions = (vehicleTypes.data ?? []).map((t) => ({
    key: t.id,
    label: t.name,
    ...(t.description ? { description: t.description } : {}),
  }));
  // Default to Standard (or the only/first class) once the list arrives.
  const selectedClass =
    vehicleTypeId ??
    (vehicleTypes.data ?? []).find((t) => t.name.toLowerCase() === 'standard')?.id ??
    classOptions[0]?.key;

  if (!kyc) return null;
  const nothingSubmitted = kyc.stages.every((s) => s.status === 'empty' && s.documents.length === 0);
  const statusOf = (s: DriverKycSummary['stages'][number]) => s.status.toLowerCase();
  // The final decision can go out once nothing is waiting on a stage review.
  const readyToPublish =
    kyc.status === 'in_review' && kyc.stages.every((s) => ['approved', 'rejected'].includes(statusOf(s)));
  const anyRejected = kyc.stages.some((s) => statusOf(s) === 'rejected');

  return (
    <DashboardCard>
      <SectionHeader
        title="KYC"
        description={
          kyc.submittedAt ? `Submitted ${fmt(kyc.submittedAt)}` : 'Identity, licence and vehicle checks.'
        }
        actions={
          <>
            <KycStatusPill status={kyc.status} />
            {readyToPublish && (
              <Can permission="final_approve_driver">
                <AppButton
                  size="sm"
                  variant="brand"
                  label={anyRejected ? 'Send rejection' : 'Approve driver'}
                  isLoading={publish.isPending}
                  onPress={() => {
                    if (anyRejected) {
                      publish.mutate({});
                    } else {
                      setVehicleTypeId(undefined);
                      setApproving(true);
                    }
                  }}
                />
              </Can>
            )}
          </>
        }
      />

      {readyToPublish && (
        <p className="mt-4 rounded-2xl bg-secondary-soft px-4 py-3 text-[13px] text-foreground">
          {anyRejected
            ? 'All stages are reviewed. The driver will be told what to fix.'
            : 'All stages are approved. Approve the driver to let them go online.'}
        </p>
      )}

      {kyc.status === 'rejected' && kyc.rejectionReason && (
        <p className="mt-4 rounded-2xl bg-danger-soft px-4 py-3 text-[13px] text-danger">
          Rejected: {kyc.rejectionReason}
        </p>
      )}

      {nothingSubmitted ? (
        <EmptyState
          icon={FileImage}
          title="Nothing submitted yet"
          description="Documents appear here once the driver completes a KYC stage in the app."
        />
      ) : (
        <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-3">
          {kyc.stages.map((stage) => (
            <div key={stage.stage} className="flex flex-col gap-4 rounded-2xl bg-surface-secondary p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[14px] font-semibold text-foreground">{STAGE_TITLE[stage.stage]}</p>
                <StatusPill tone={stageTone(stage.status)} dot>
                  {stageLabel(stage.status)}
                </StatusPill>
              </div>

              {stage.fields.length > 0 || (stage.stage === 'personal' && kyc.ninProvided) ? (
                <DetailList
                  items={[
                    ...stage.fields.map((f) => ({ label: f.label, value: fieldValue(f.key, f.value) })),
                    ...(stage.stage === 'personal' && kyc.ninProvided
                      ? [{ label: 'NIN', value: 'Provided (encrypted)' }]
                      : []),
                  ]}
                />
              ) : (
                <p className="text-[13px] text-muted">No details submitted.</p>
              )}

              {stage.documents.length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  {stage.documents.map((doc) => (
                    <a
                      key={doc.key}
                      href={doc.url}
                      target="_blank"
                      rel="noreferrer"
                      className="group relative block overflow-hidden rounded-xl bg-surface"
                      title={`Open ${doc.label}`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={doc.url} alt={doc.label} className="aspect-[4/3] w-full object-cover transition-opacity group-hover:opacity-80" />
                      <span className="flex items-center justify-between gap-1 px-2.5 py-1.5 text-[12px] text-foreground">
                        <span className="truncate">{doc.label}</span>
                        <ArrowSquareOut size={12} className="shrink-0 text-muted" />
                      </span>
                    </a>
                  ))}
                </div>
              )}

              {statusOf(stage) === 'submitted' && (
                <Can permission="review_driver_stage">
                  <div className="mt-auto flex gap-2 pt-1">
                    <AppButton
                      size="sm"
                      variant="ghost"
                      className="flex-1 text-danger"
                      startContent={<XCircle />}
                      label="Reject"
                      onPress={() => {
                        setReason('');
                        setFlagged([]);
                        setRejecting(stage.stage);
                      }}
                    />
                    <AppButton
                      size="sm"
                      variant="tertiary"
                      className="flex-1"
                      startContent={<CheckCircle />}
                      label="Approve"
                      isLoading={reviewStage.isPending && reviewStage.variables?.stage === stage.stage}
                      onPress={() => reviewStage.mutate({ stage: stage.stage, decision: 'approved' })}
                    />
                  </div>
                </Can>
              )}

              {stage.review?.decision && stage.review.decision !== 'pending' && (
                <p className="text-[12px] text-muted">
                  {stage.review.decision === 'approved' ? 'Approved' : 'Rejected'}
                  {stage.review.reviewedAt ? ` ${fmt(stage.review.reviewedAt)}` : ''}
                  {stage.review.reviewedBy ? ` by ${stage.review.reviewedBy}` : ''}
                  {stage.review.reason ? ` · ${stage.review.reason}` : ''}
                </p>
              )}
              {stage.review?.decision === 'rejected' && (stage.review.rejectedFields?.length ?? 0) > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {stage.review.rejectedFields!.map((key) => (
                    <span key={key} className="rounded-full bg-danger-soft px-2.5 py-0.5 text-[12px] text-danger">
                      {fieldLabel(stage.stage, key)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-6">
        <p className="text-[13px] font-medium text-foreground">History</p>
        {kyc.history.length === 0 && !kyc.finalDecidedAt ? (
          <p className="mt-2 text-[13px] text-muted">No review decisions yet.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {kyc.finalDecidedAt && (
              <li className="flex items-start gap-3 text-[13px]">
                <span className="mt-1.5 size-2 shrink-0 rounded-full bg-secondary" />
                <span className="flex-1">
                  <span className="text-foreground">Final decision: {kyc.finalDecision ?? '—'}</span>
                  {kyc.finalDecidedBy && <span className="text-muted"> · by {kyc.finalDecidedBy}</span>}
                </span>
                <span className="shrink-0 text-muted">{fmt(kyc.finalDecidedAt)}</span>
              </li>
            )}
            {kyc.history.map((entry, i) => {
              const h = historyText(entry);
              return (
                <li key={i} className="flex items-start gap-3 text-[13px]">
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-default" />
                  <span className="flex-1">
                    <span className="capitalize text-foreground">{h.title}</span>
                    {h.detail && <span className="text-muted"> · {h.detail}</span>}
                  </span>
                  <span className="shrink-0 text-muted">{fmt(h.at)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <AppModal
        isOpen={Boolean(rejecting)}
        onOpenChange={(open) => !open && setRejecting(null)}
        size="sm"
        title={`Reject ${rejecting ? STAGE_TITLE[rejecting].toLowerCase() : 'stage'}`}
        description="The driver sees the reason and the fields you mark when the decision is sent."
        footer={
          <>
            <AppButton variant="tertiary" label="Cancel" onPress={() => setRejecting(null)} />
            <AppButton
              variant="danger"
              label="Reject stage"
              isDisabled={!reason.trim()}
              isLoading={reviewStage.isPending}
              onPress={() =>
                rejecting &&
                reviewStage.mutate({ stage: rejecting, decision: 'rejected', reason: reason.trim(), rejectedFields: flagged })
              }
            />
          </>
        }
      >
        {rejecting && (
          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-medium text-foreground">What needs fixing?</span>
            <div className="flex flex-wrap gap-2">
              {STAGE_FIELDS[rejecting].map((field) => {
                const on = flagged.includes(field.key);
                return (
                  <button
                    key={field.key}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setFlagged((cur) => (on ? cur.filter((k) => k !== field.key) : [...cur, field.key]))}
                    className={`cursor-pointer rounded-full px-3 py-1.5 text-[13px] transition-colors ${
                      on ? 'bg-danger text-white' : 'bg-surface-secondary text-foreground hover:bg-default'
                    }`}
                  >
                    {field.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <AppTextarea
          label="Reason"
          placeholder="e.g. The licence photo is blurry"
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </AppModal>

      <AppModal
        isOpen={approving}
        onOpenChange={(open) => !open && setApproving(false)}
        size="sm"
        title="Approve driver"
        description="Pick the vehicle class. The driver only gets ride requests for this class."
        footer={
          <>
            <AppButton variant="tertiary" label="Cancel" onPress={() => setApproving(false)} />
            <AppButton
              variant="brand"
              label="Approve driver"
              isDisabled={!selectedClass}
              isLoading={publish.isPending}
              onPress={() => selectedClass && publish.mutate({ vehicleTypeId: selectedClass })}
            />
          </>
        }
      >
        <AppSelect
          label="Vehicle class"
          placeholder={vehicleTypes.isLoading ? 'Loading classes…' : 'Select a class'}
          options={classOptions}
          {...(selectedClass ? { selectedKey: selectedClass } : {})}
          onSelectionChange={setVehicleTypeId}
          isDisabled={vehicleTypes.isLoading || classOptions.length === 0}
          isRequired
          {...(vehicleTypes.isError
            ? { error: "Couldn't load vehicle classes. Close and try again." }
            : !vehicleTypes.isLoading && classOptions.length === 0
              ? { error: 'No vehicle classes in the fare table yet.' }
              : {})}
        />
      </AppModal>
    </DashboardCard>
  );
}
