'use client';

// src/components/layout/network-banner.tsx
// Thin connection banner across the top of the admin:
// - offline  → red, stays until the connection returns
// - slow     → warning, while the network is degraded
// - restored → green "Back online", then hides itself

import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle, WarningCircle, WifiSlash } from '@phosphor-icons/react';
import { API_BASE_URL } from '@/lib/api';

type NetState = 'ok' | 'offline' | 'slow' | 'restored';

type NetworkInformation = EventTarget & { effectiveType?: string; downlink?: number; rtt?: number };

const SLOW_PROBE_MS = 2500;
const PROBE_INTERVAL_MS = 30_000;

function connectionIsSlow(): boolean {
  const conn = (navigator as Navigator & { connection?: NetworkInformation }).connection;
  if (!conn) return false;
  // Only trust the coarse 2G class; rtt/downlink estimates are rounded and
  // capped by browsers, so real latency comes from the /health probe instead.
  return conn.effectiveType === 'slow-2g' || conn.effectiveType === '2g';
}

export function NetworkBanner() {
  const [state, setState] = useState<NetState>('ok');
  const stateRef = useRef<NetState>('ok');
  const restoreTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const set = (next: NetState) => {
      if (restoreTimer.current) clearTimeout(restoreTimer.current);
      const prev = stateRef.current;
      // Coming back from a bad state: flash green, then hide.
      if (next === 'ok' && (prev === 'offline' || prev === 'slow')) {
        stateRef.current = 'restored';
        setState('restored');
        restoreTimer.current = setTimeout(() => {
          stateRef.current = 'ok';
          setState('ok');
        }, 2000);
        return;
      }
      if (next === 'ok' && prev === 'restored') return;
      stateRef.current = next;
      setState(next);
    };

    const evaluate = () => {
      if (!navigator.onLine) return set('offline');
      set(connectionIsSlow() ? 'slow' : 'ok');
    };

    // Measure real round-trip time to the API as a second slow signal. One
    // slow response can be a cold server, so it takes two in a row to warn.
    let slowStreak = 0;
    const probe = async () => {
      if (!navigator.onLine) return set('offline');
      const started = performance.now();
      try {
        await fetch(`${API_BASE_URL}/health`, { cache: 'no-store' });
        const elapsed = performance.now() - started;
        slowStreak = elapsed > SLOW_PROBE_MS ? slowStreak + 1 : 0;
        set(slowStreak >= 2 || connectionIsSlow() ? 'slow' : 'ok');
      } catch {
        // Server unreachable but device online — not a network problem we can label.
        evaluate();
      }
    };

    const conn = (navigator as Navigator & { connection?: NetworkInformation }).connection;
    window.addEventListener('online', probe);
    window.addEventListener('offline', evaluate);
    conn?.addEventListener('change', evaluate);
    const initial = setTimeout(probe, 0);
    const interval = setInterval(probe, PROBE_INTERVAL_MS);

    return () => {
      window.removeEventListener('online', probe);
      window.removeEventListener('offline', evaluate);
      conn?.removeEventListener('change', evaluate);
      clearTimeout(initial);
      clearInterval(interval);
      if (restoreTimer.current) clearTimeout(restoreTimer.current);
    };
  }, []);

  if (state === 'ok') return null;

  const config = {
    offline: { cls: 'bg-danger text-danger-foreground', icon: WifiSlash, text: 'No internet connection. Changes won’t save until you’re back online.' },
    slow: { cls: 'bg-warning text-warning-foreground', icon: WarningCircle, text: 'Slow connection. Some data may take longer to load.' },
    restored: { cls: 'bg-success text-success-foreground', icon: CheckCircle, text: 'Back online.' },
  }[state];
  const Icon = config.icon;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex h-8 shrink-0 items-center justify-center gap-2 px-4 text-[13px] font-medium ${config.cls}`}
    >
      <Icon size={16} weight="bold" />
      <span className="truncate">{config.text}</span>
    </div>
  );
}
