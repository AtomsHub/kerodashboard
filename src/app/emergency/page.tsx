'use client';

// src/app/emergency/page.tsx
// SOS center: the same three-column inbox as the Help Center, limited to SOS
// tickets. The siren sounds only while an SOS is waiting for a responder;
// once someone claims it the sound stops for everyone.

import React, { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { SpeakerHigh, SpeakerSlash } from '@phosphor-icons/react';
import { Page, StatusPill } from '@/components/ui/page';
import { PermissionGuard } from '@/components/auth/can';
import { SupportInbox } from '@/components/support/support-inbox';
import { api } from '@/lib/api';
import { playEmergencyAlarmSound } from '@/lib/alarm-sound';
import { getSocket } from '@/lib/socket';
import { useSosAlarmStore } from '@/stores/sos-alarm-store';
import type { DetailedSosAlertItem } from '@/types/admin';

export default function EmergencyControlRoomPage() {
  const queryClient = useQueryClient();
  const muted = useSosAlarmStore((s) => s.muted);
  const setMuted = useSosAlarmStore((s) => s.setMuted);

  const { data: alerts = [] } = useQuery<DetailedSosAlertItem[]>({
    queryKey: ['admin', 'sos', 'list'],
    queryFn: async () => {
      const res = await api.get<{ data: DetailedSosAlertItem[] | { alerts: DetailedSosAlertItem[] } }>('/admin/sos');
      const payload = res.data?.data;
      return Array.isArray(payload) ? payload : (payload?.alerts ?? []);
    },
    refetchInterval: 8000,
  });
  const active = alerts.filter((a) => a.status === 'ACTIVE');
  // Once a responder has claimed an alert, it stops sounding.
  const waiting = active.filter((a) => !a.claimedBy && !a.responderId && !a.claimedByName);

  useEffect(() => {
    if (waiting.length === 0 || muted) return;
    playEmergencyAlarmSound();
    const timer = window.setInterval(playEmergencyAlarmSound, 6000);
    return () => window.clearInterval(timer);
  }, [waiting.length, muted]);

  // Refresh on SOS lifecycle events (the socket layer raises the alarm itself).
  useEffect(() => {
    const s = getSocket();
    const refresh = () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'sos'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'support'] });
    };
    const events = ['admin:sos:new', 'admin:sos:triggered', 'admin:sos:responded', 'admin:sos:resolved'];
    events.forEach((e) => s.on(e, refresh));
    return () => events.forEach((e) => s.off(e, refresh));
  }, [queryClient]);

  return (
    <PermissionGuard permission="view_sos">
      <Page>
        <SupportInbox
          mode="sos"
          title="SOS center"
          badge={
            active.length > 0 ? (
              <StatusPill tone="danger" dot pulse>
                {waiting.length > 0 ? `${waiting.length} waiting` : `${active.length} live`}
              </StatusPill>
            ) : undefined
          }
          actions={
            <button
              type="button"
              onClick={() => setMuted(!muted)}
              className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-full text-muted hover:bg-surface-secondary hover:text-foreground"
              aria-label={muted ? 'Turn SOS sound on' : 'Turn SOS sound off'}
              title={muted ? 'SOS sound off' : 'SOS sound on'}
            >
              {muted ? <SpeakerSlash size={18} /> : <SpeakerHigh size={18} weight="fill" />}
            </button>
          }
        />
      </Page>
    </PermissionGuard>
  );
}
