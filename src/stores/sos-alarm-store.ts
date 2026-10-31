// src/stores/sos-alarm-store.ts
// Live SOS alarms that take over the screen until someone responds,
// the alert is resolved, or this admin dismisses it.
import { create } from 'zustand';

export interface SosParty {
  id: string;
  name: string;
  phone: string;
}

export interface LiveSos {
  id: string;
  tripId: string | null;
  ticketId: string | null;
  triggeredBy: 'rider' | 'driver' | null;
  rider: SosParty | null;
  driver: SosParty | null;
  location: { lat: number; lng: number } | null;
  message: string | null;
  retry: boolean;
  at: number;
}

interface SosAlarmState {
  alarms: LiveSos[];
  /** One mute for every SOS siren in the app (overlay, SOS center, header). */
  muted: boolean;
  raise: (alarm: LiveSos) => void;
  clear: (id: string) => void;
  setMuted: (muted: boolean) => void;
}

export const useSosAlarmStore = create<SosAlarmState>((set) => ({
  alarms: [],
  muted: false,
  // A brand-new SOS always un-mutes so it can't be missed.
  raise: (alarm) =>
    set((s) => ({
      alarms: [alarm, ...s.alarms.filter((a) => a.id !== alarm.id)],
      muted: s.alarms.some((a) => a.id === alarm.id) ? s.muted : false,
    })),
  clear: (id) => set((s) => ({ alarms: s.alarms.filter((a) => a.id !== id) })),
  setMuted: (muted) => set({ muted }),
}));

/** The `admin:sos:triggered` socket payload (current and older shapes). */
interface RawSos {
  emergencyId?: string | number;
  id?: string | number;
  tripId?: string | null;
  ticketId?: string | null;
  triggeredBy?: 'rider' | 'driver' | null;
  rider?: SosParty | null;
  driver?: SosParty | null;
  location?: { lat?: number; lng?: number; latitude?: number; longitude?: number } | null;
  lat?: number | null;
  lng?: number | null;
  message?: string | null;
  retry?: boolean;
  timestamp?: number;
}

/** Accepts the backend `admin:sos:triggered` payload (and the older `id` shape). */
export function toLiveSos(p: RawSos | null | undefined): LiveSos | null {
  if (!p) return null;
  const id = p.emergencyId ?? p.id;
  if (!id) return null;
  const loc = p.location ?? (p.lat != null ? { lat: p.lat, lng: p.lng ?? undefined } : null);
  return {
    id: String(id),
    tripId: p.tripId ?? null,
    ticketId: p.ticketId ?? null,
    triggeredBy: p.triggeredBy ?? null,
    rider: p.rider ?? null,
    driver: p.driver ?? null,
    location:
      loc && typeof loc.lat === 'number'
        ? { lat: loc.lat, lng: loc.lng ?? 0 }
        : loc && typeof loc.latitude === 'number'
          ? { lat: loc.latitude, lng: loc.longitude ?? 0 }
          : null,
    message: p.message ?? null,
    retry: Boolean(p.retry),
    at: typeof p.timestamp === 'number' ? p.timestamp : Date.now(),
  };
}
