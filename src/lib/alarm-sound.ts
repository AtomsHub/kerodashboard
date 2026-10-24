// src/lib/alarm-sound.ts
// Emergency siren via Web Audio. Browsers block audio until the page has had
// a user gesture, so the context is created once and resumed on the first click.

let ctx: AudioContext | null = null;

function context(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctor = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  return ctx;
}

/** Call once on the client so the first SOS can play even if it arrives before any click. */
export function unlockAlarmAudio(): () => void {
  if (typeof window === 'undefined') return () => {};
  const unlock = () => void context()?.resume().catch(() => {});
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
  return () => {
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
  };
}

/** One siren sweep (~1.2s). */
export function playEmergencyAlarmSound(): void {
  const c = context();
  if (!c) return;
  try {
    if (c.state === 'suspended') void c.resume().catch(() => {});
    const t = c.currentTime;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'square';
    for (let i = 0; i < 4; i++) {
      osc.frequency.setValueAtTime(960, t + i * 0.3);
      osc.frequency.setValueAtTime(640, t + i * 0.3 + 0.15);
    }
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.18, t + 0.03);
    gain.gain.setValueAtTime(0.18, t + 1.1);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(t);
    osc.stop(t + 1.2);
  } catch {
    // Audio unavailable; the overlay still shows.
  }
}
