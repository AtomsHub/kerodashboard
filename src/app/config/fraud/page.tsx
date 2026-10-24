'use client';

// src/app/config/fraud/page.tsx
// Phase 7.3: Anti-Fraud, Hardware Fingerprinting & Device Security Hardening
import React, { useState } from 'react';
import { toast } from 'sonner';
import {
  ShieldWarning,
  ArrowCounterClockwise,
  FloppyDisk,
  DeviceMobile,
  MapPinLine,
  WarningCircle,
  CheckCircle,
  Prohibit,
  Fingerprint,
  Cpu,
  Globe,
  Radioactive,
  LockKey,
  PencilSimple,
} from '@phosphor-icons/react';
import { Chip, Modal } from '@heroui/react';
import { AppButton } from '@/components/ui/app-button';
import { AppInput } from '@/components/ui/app-input';
import { ConfigTabs } from '@/components/config/config-tabs';
import { AppRowActions } from '@/components/ui/app-row-actions';
import { DashboardCard } from '@/components/ui/dashboard-card';
import { EmptyState, Page, PageHeader, SectionHeader, StatusPill } from '@/components/ui/page';

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (val: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 rounded-full p-0.5 transition-colors ${
        checked ? 'bg-secondary' : 'bg-default'
      } ${disabled ? 'cursor-default opacity-60' : 'cursor-pointer'}`}
    >
      <span className={`size-5 rounded-full bg-surface transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  );
}

interface FlaggedDevice {
  id: string;
  hardwareFingerprint: string;
  associatedUser: string;
  userType: 'driver' | 'rider';
  reason: string;
  detectedAt: string;
  status: 'blocked' | 'quarantined';
}

const INITIAL_FLAGGED: FlaggedDevice[] = [];

export default function AntiFraudConfigPage() {
  const [requireUniqueDevice, setRequireUniqueDevice] = useState(true);
  const [blockEmulators, setBlockEmulators] = useState(true);
  const [blockMockGps, setBlockMockGps] = useState(true);
  const [ghostRidingGuard, setGhostRidingGuard] = useState(true);
  const [maxAccountsPerDevice, setMaxAccountsPerDevice] = useState('1');
  const [sameIpRateLimit, setSameIpRateLimit] = useState('120');
  const [cancellationVelocityThreshold, setCancellationVelocityThreshold] = useState('4');

  const [flaggedDevices, setFlaggedDevices] = useState<FlaggedDevice[]>(INITIAL_FLAGGED);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isConfirmSaveOpen, setIsConfirmSaveOpen] = useState(false);
  const [pendingWhitelistDevice, setPendingWhitelistDevice] = useState<FlaggedDevice | null>(null);

  const handleSave = async () => {
    setIsSaving(true);
    await new Promise((r) => setTimeout(r, 600));
    setIsSaving(false);
    setIsConfirmSaveOpen(false);
    setIsEditing(false);
    toast.success('Anti-fraud security parameters enforced system-wide');
  };

  const handleUnblock = (id: string) => {
    setFlaggedDevices((prev) => prev.filter((d) => d.id !== id));
    setPendingWhitelistDevice(null);
    toast.success(`Device ${id} unblocked and whitelisted`);
  };

  return (
    <Page>
      <PageHeader
        title="Settings"
        description="Device, location and abuse protections."
        badge={isEditing ? <StatusPill tone="brand" dot>Editing</StatusPill> : undefined}
        actions={
          isEditing ? (
            <>
              <AppButton
                variant="tertiary"
                label="Cancel"
                onPress={() => {
                  setRequireUniqueDevice(true);
                  setBlockEmulators(true);
                  setBlockMockGps(true);
                  setGhostRidingGuard(true);
                  setMaxAccountsPerDevice('1');
                  setSameIpRateLimit('120');
                  setCancellationVelocityThreshold('4');
                  setIsEditing(false);
                }}
              />
              <AppButton variant="brand" startContent={<FloppyDisk />} label="Save changes" onPress={() => setIsConfirmSaveOpen(true)} />
            </>
          ) : (
            <AppButton variant="tertiary" startContent={<PencilSimple />} label="Edit" isDisabled />
          )
        }
      />

      <ConfigTabs />

      <DashboardCard className="bg-warning-soft/50">
        <p className="text-[13px] text-foreground">Anti-fraud rules aren’t stored in the backend yet. These are the intended defaults; editing is disabled until an endpoint exists.</p>
      </DashboardCard>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <div className="space-y-5 lg:col-span-7">
          <DashboardCard>
            <SectionHeader title="Device & location checks" description="Stop fake devices and spoofed GPS" />

            <div className="mt-6 space-y-5">
              {[
                {
                  label: 'One device per driver',
                  hint: 'Bind accounts to a hardware ID',
                  icon: DeviceMobile,
                  checked: requireUniqueDevice,
                  onChange: setRequireUniqueDevice,
                },
                {
                  label: 'Block fake GPS',
                  hint: 'Disconnect drivers using mock locations',
                  icon: MapPinLine,
                  checked: blockMockGps,
                  onChange: setBlockMockGps,
                },
                {
                  label: 'Block emulators',
                  hint: 'No sign-ins from desktop emulators',
                  icon: Cpu,
                  checked: blockEmulators,
                  onChange: setBlockEmulators,
                },
                {
                  label: 'Ghost-ride detection',
                  hint: 'Flag trips that move without the rider',
                  icon: Radioactive,
                  checked: ghostRidingGuard,
                  onChange: setGhostRidingGuard,
                },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-default text-foreground">
                      <row.icon size={18} />
                    </span>
                    <div>
                      <p className="text-[14px] font-medium text-foreground">{row.label}</p>
                      <p className="text-xs text-muted">{row.hint}</p>
                    </div>
                  </div>
                  <Toggle checked={row.checked} onChange={row.onChange} disabled={!isEditing} />
                </div>
              ))}
            </div>
          </DashboardCard>

          <DashboardCard>
            <SectionHeader title="Rate limits" description="Slow down referral farming and abuse" />

            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <AppInput
                isDisabled={!isEditing}
                label="Accounts per device"
                type="number"
                value={maxAccountsPerDevice}
                onChange={(e) => setMaxAccountsPerDevice(e.target.value)}
                description="Recommended: 1"
              />
              <AppInput
                isDisabled={!isEditing}
                label="Requests per IP"
                type="number"
                value={sameIpRateLimit}
                onChange={(e) => setSameIpRateLimit(e.target.value)}
                endContent={<span className="text-xs text-muted">/hr</span>}
              />
              <AppInput
                isDisabled={!isEditing}
                label="Cancels to flag"
                type="number"
                value={cancellationVelocityThreshold}
                onChange={(e) => setCancellationVelocityThreshold(e.target.value)}
                description="Within 30 minutes"
              />
            </div>
          </DashboardCard>
        </div>

        <div className="space-y-5 self-start lg:sticky lg:top-24 lg:col-span-5">
          <DashboardCard>
            <SectionHeader
              title="Flagged devices"
              actions={
                <StatusPill tone={flaggedDevices.length > 0 ? 'danger' : 'success'}>
                  <span className="tabular">{flaggedDevices.length}</span>
                </StatusPill>
              }
            />

            {flaggedDevices.length === 0 ? (
              <EmptyState icon={CheckCircle} title="Nothing flagged" className="py-10" />
            ) : (
              <ul className="mt-5 space-y-3">
                {flaggedDevices.map((device) => (
                  <li key={device.id} className="rounded-2xl bg-surface-secondary p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-[14px] font-medium text-foreground">{device.associatedUser}</span>
                          <StatusPill tone={device.status === 'blocked' ? 'danger' : 'warning'}>
                            <span className="capitalize">{device.status}</span>
                          </StatusPill>
                        </div>
                        <p className="mt-1 text-[13px] text-muted">{device.reason}</p>
                        <p className="tabular mt-1 truncate text-xs text-muted">
                          {device.hardwareFingerprint} · {device.detectedAt}
                        </p>
                      </div>
                      <AppRowActions
                        items={[
                          {
                            key: 'whitelist',
                            label: 'Whitelist device',
                            icon: <CheckCircle size={14} />,
                            onClick: () => setPendingWhitelistDevice(device),
                          },
                        ]}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </DashboardCard>

          <DashboardCard>
            <SectionHeader title="Compliance" />
            <ul className="mt-4 space-y-3 text-[13px] text-foreground">
              {['NDPR-compliant device hashing', 'No raw device IDs sent unencrypted', 'OTP challenge on device mismatch'].map(
                (item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <CheckCircle size={16} weight="fill" className="mt-0.5 shrink-0 text-success" />
                    <span>{item}</span>
                  </li>
                ),
              )}
            </ul>
          </DashboardCard>
        </div>
      </div>

      {/* ── Confirmation Modal: Save Security Rules ────────────────────── */}
      <Modal>
        <Modal.Backdrop
          isOpen={isConfirmSaveOpen}
          onOpenChange={(open) => !open && setIsConfirmSaveOpen(false)}
        >
          <Modal.Container placement="center" size="sm">
            <Modal.Dialog className="rounded-3xl bg-overlay p-7">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div>
                    <h3 className="text-[18px] font-bold tracking-[-0.02em] text-foreground">
                      Save security settings
                    </h3>
                    <p className="mt-1 text-[13px] text-muted">
                      Applies to all drivers immediately
                    </p>
                  </div>
                </div>

                <p className="text-[13px] text-muted">
                  Device, GPS and rate-limit rules update for every connected driver.
                </p>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <AppButton
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsConfirmSaveOpen(false)}
                  >
                    Cancel
                  </AppButton>
                  <AppButton
                    variant="primary"
                    size="sm"
                    isLoading={isSaving}
                    onClick={handleSave}
                  >
                    Confirm & Save Rules
                  </AppButton>
                </div>
              </div>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      {/* ── Confirmation Modal: Whitelist Device ───────────────────────── */}
      <Modal>
        <Modal.Backdrop
          isOpen={Boolean(pendingWhitelistDevice)}
          onOpenChange={(open) => !open && setPendingWhitelistDevice(null)}
        >
          <Modal.Container placement="center" size="sm">
            <Modal.Dialog className="rounded-3xl bg-overlay p-7">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div>
                    <h3 className="text-[18px] font-bold tracking-[-0.02em] text-foreground">
                      Whitelist Quarantined Device
                    </h3>
                    <p className="text-xs text-muted tabular">
                      {pendingWhitelistDevice?.hardwareFingerprint}
                    </p>
                  </div>
                </div>

                <p className="text-[13px] text-muted">
                  <span className="font-medium text-foreground">{pendingWhitelistDevice?.associatedUser}</span> will be able to sign in from this device again.
                </p>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <AppButton
                    variant="ghost"
                    size="sm"
                    onClick={() => setPendingWhitelistDevice(null)}
                  >
                    Cancel
                  </AppButton>
                  <AppButton
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      if (pendingWhitelistDevice) {
                        handleUnblock(pendingWhitelistDevice.id);
                      }
                    }}
                  >
                    Confirm Whitelist
                  </AppButton>
                </div>
              </div>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </Page>
  );
}
