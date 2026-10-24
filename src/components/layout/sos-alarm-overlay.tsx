'use client';

// src/components/layout/sos-alarm-overlay.tsx
// Full-screen takeover for a live SOS, shown only to admins with `view_sos`.
// The siren repeats until someone responds, the alert resolves, or it is dismissed.

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { MapPin, Phone, Siren, SpeakerHigh, SpeakerSlash } from '@phosphor-icons/react';
import { AppButton } from '@/components/ui/app-button';
import { useAuthStore } from '@/stores/auth-store';
import { useSosAlarmStore, type SosParty } from '@/stores/sos-alarm-store';
import { playEmergencyAlarmSound, unlockAlarmAudio } from '@/lib/alarm-sound';
import { respondToSos } from '@/lib/socket';

function Party({ role, party, raised }: { role: string; party: SosParty | null; raised: boolean }) {
  if (!party) return null;
  return (
    <div className={`rounded-2xl p-4 ${raised ? 'bg-danger/10' : 'bg-surface-secondary'}`}>
      <p className="text-[12px] text-muted">
        {role}
        {raised ? ' · raised it' : ''}
      </p>
      <p className="mt-0.5 truncate text-[15px] font-medium text-foreground">{party.name || 'Unknown'}</p>
      {party.phone ? (
        <a href={`tel:${party.phone}`} className="tabular mt-1 inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-foreground">
          <Phone size={13} weight="duotone" />
          {party.phone}
        </a>
      ) : null}
    </div>
  );
}

export function SosAlarmOverlay() {
  const router = useRouter();
  const canSee = useAuthStore((s) => s.hasPermission('view_sos'));
  const alarms = useSosAlarmStore((s) => s.alarms);
  const clear = useSosAlarmStore((s) => s.clear);
  const muted = useSosAlarmStore((s) => s.muted);
  const setMuted = useSosAlarmStore((s) => s.setMuted);
  const [busy, setBusy] = useState(false);
  const alarm = canSee ? alarms[0] : undefined;

  useEffect(() => unlockAlarmAudio(), []);

  // Siren loop while an alarm is on screen.
  useEffect(() => {
    if (!alarm || muted) return;
    playEmergencyAlarmSound();
    const timer = window.setInterval(playEmergencyAlarmSound, 1800);
    return () => window.clearInterval(timer);
  }, [alarm?.id, muted]);

  if (!alarm) return null;

  const respond = async () => {
    setBusy(true);
    const res = await respondToSos(alarm.id);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error || 'Could not take this SOS');
      return;
    }
    clear(alarm.id);
    router.push(res.ticketId ? `/emergency?ticket=${res.ticketId}` : '/emergency');
  };

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label="SOS alert"
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
    >
      <div className="relative w-full max-w-lg rounded-[28px] bg-surface p-6 sm:p-8">
        <button
          type="button"
          onClick={() => setMuted(!muted)}
          className="absolute right-4 top-4 rounded-full p-2 text-muted hover:bg-default hover:text-foreground"
          aria-label={muted ? 'Unmute alarm' : 'Mute alarm'}
        >
          {muted ? <SpeakerSlash size={18} weight="duotone" /> : <SpeakerHigh size={18} weight="duotone" />}
        </button>

        <div className="flex flex-col items-center text-center">
          <span className="relative flex size-20 items-center justify-center">
            <span className="absolute inset-0 animate-ping rounded-full bg-danger/30" />
            <span className="relative flex size-20 items-center justify-center rounded-full bg-danger text-white">
              <Siren size={38} weight="duotone" />
            </span>
          </span>
          <h2 className="mt-5 text-[24px] font-semibold tracking-[-0.02em] text-foreground">
            {alarm.retry ? 'SOS still waiting' : 'SOS alert'}
          </h2>
          <p className="mt-1 text-[14px] text-muted">
            {alarm.triggeredBy ? `Raised by the ${alarm.triggeredBy}` : 'Someone needs help now'}
            {' · '}
            {new Date(alarm.at).toLocaleTimeString('en-NG', { hour: 'numeric', minute: '2-digit' })}
          </p>
        </div>

        {alarm.message ? (
          <p className="mt-5 rounded-2xl bg-surface-secondary p-4 text-[14px] text-foreground">“{alarm.message}”</p>
        ) : null}

        {alarm.rider || alarm.driver ? (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Party role="Rider" party={alarm.rider} raised={alarm.triggeredBy === 'rider'} />
            <Party role="Driver" party={alarm.driver} raised={alarm.triggeredBy === 'driver'} />
          </div>
        ) : null}

        {alarm.location ? (
          <a
            href={`https://www.google.com/maps?q=${alarm.location.lat},${alarm.location.lng}`}
            target="_blank"
            rel="noreferrer"
            className="tabular mt-4 inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-foreground"
          >
            <MapPin size={14} weight="duotone" />
            {alarm.location.lat.toFixed(5)}, {alarm.location.lng.toFixed(5)}
          </a>
        ) : null}

        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <AppButton variant="danger" className="flex-1" size="lg" label="Respond now" isLoading={busy} onPress={respond} />
          <AppButton
            variant="tertiary"
            className="flex-1"
            size="lg"
            label="Open SOS Center"
            onPress={() => {
              clear(alarm.id);
              router.push('/emergency');
            }}
          />
        </div>
        <div className="mt-3 flex items-center justify-between text-[13px]">
          <span className="text-muted">{alarms.length > 1 ? `${alarms.length - 1} more waiting` : ''}</span>
          <button type="button" onClick={() => clear(alarm.id)} className="text-muted hover:text-foreground">
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
