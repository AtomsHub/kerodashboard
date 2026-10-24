// src/lib/socket.ts
// Realtime Socket.IO client for Kero Admin Operations & Telemetry.
// Connects with JWT Bearer handshake, manages admin room subscriptions,
// handles first-responder SOS emergency claiming (Redis SETNX lock),
// and bridges realtime server events directly to TanStack Query cache invalidations.

import { io, Socket } from 'socket.io-client';
import { type QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { API_BASE_URL } from './api';
import { getAccessToken, useAuthStore } from '@/stores/auth-store';
import { useNotificationStore } from '@/stores/notification-store';
import { SosAlertItem, AppNotification } from '@/types/admin';
import { toLiveSos, useSosAlarmStore } from '@/stores/sos-alarm-store';

export type AdminRoom = 'live-watch' | 'kyc' | 'sos' | 'operations' | 'notifications' | 'support';

let socket: Socket | null = null;
let currentToken: string | null = null;

/**
 * Get or initialize the singleton Socket.IO instance.
 * Lazily configures authentication with the active admin access token.
 */
export function getSocket(): Socket {
  const token = getAccessToken();

  if (!socket) {
    currentToken = token;
    socket = io(API_BASE_URL, {
      auth: (cb) => {
        cb({ token: getAccessToken() });
      },
      withCredentials: true,
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 15,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      transports: ['websocket', 'polling'],
    });

    // Logging & connection lifecycle
    socket.on('connect', () => {
      // Backend automatically joins all admin rooms on connect
      // but client-side explicit subscription guarantees synchronization
      subscribeToAdminRoom('notifications');
      subscribeToAdminRoom('sos');
      subscribeToAdminRoom('operations');
      subscribeToAdminRoom('kyc');
      subscribeToAdminRoom('support');
    });

    let lastRefreshAttempt = 0;
    socket.on('connect_error', (err) => {
      console.warn('Admin Socket connection error:', err.message);
      const now = Date.now();
      if (
        (err.message.includes('Unauthorized') ||
          err.message.includes('jwt') ||
          err.message.includes('expired')) &&
        now - lastRefreshAttempt > 10000
      ) {
        lastRefreshAttempt = now;
        useAuthStore.getState().fetchAdminMe(true).then(() => {
          if (socket && !socket.connected) {
            socket.connect();
          }
        });
      }
    });
  } else if (token !== currentToken) {
    currentToken = token;
    socket.auth = { token };
    if (socket.connected) {
      socket.disconnect().connect();
    }
  }

  return socket;
}

export const getAdminSocket = getSocket;

/**
 * Explicitly subscribe to an admin room with acknowledgment.
 */
export function subscribeToAdminRoom(room: AdminRoom) {
  const s = getSocket();
  if (s.connected) {
    s.emit(`admin:subscribe:${room}`, {}, (ack: { ok: boolean; error?: string }) => {
      if (!ack?.ok) {
        console.warn(`Failed to subscribe to admin:${room}`, ack?.error);
      }
    });
  }
}

/**
 * Explicitly unsubscribe from an admin room.
 */
export function unsubscribeFromAdminRoom(room: AdminRoom) {
  const s = getSocket();
  if (s.connected) {
    s.emit(`admin:unsubscribe:${room}`, {}, (ack: { ok: boolean; error?: string }) => {
      if (!ack?.ok) {
        console.warn(`Failed to unsubscribe from admin:${room}`, ack?.error);
      }
    });
  }
}

/**
 * Join a specific support ticket room for real-time chat messages and typing events.
 */
export function joinSupportTicket(ticketId: string) {
  const s = getSocket();
  if (s.connected && ticketId) {
    s.emit('support:ticket:join', { ticketId });
  }
}

/**
 * Leave a specific support ticket room.
 */
export function leaveSupportTicket(ticketId: string) {
  const s = getSocket();
  if (s.connected && ticketId) {
    s.emit('support:ticket:leave', { ticketId });
  }
}

/**
 * First-responder SOS claim (backed by Redis SETNX in backend).
 */
export function respondToSos(
  emergencyId: string,
): Promise<{ ok: boolean; error?: string; responderName?: string; ticketId?: string | null }> {
  return new Promise((resolve) => {
    const s = getSocket();
    if (!s.connected) {
      resolve({ ok: false, error: 'Socket is not connected to server' });
      return;
    }

    s.emit(
      'admin:sos:respond',
      { emergencyId },
      (ack: {
        ok: boolean;
        error?: string;
        timestamp?: number;
        responderName?: string;
        ticketId?: string | null;
      }) => {
        if (ack?.ok) {
          toast.success('Emergency response claimed! You are now the active responder.');
          resolve({
            ok: true,
            responderName: ack.responderName,
            ticketId: ack.ticketId ?? null,
          });
        } else {
          const msg = ack?.error || 'Failed to claim SOS response';
          toast.error(msg);
          resolve({ ok: false, error: msg });
        }
      },
    );
  });
}

/**
 * Binds all admin backend socket events to TanStack Query cache invalidations
 * and Zustand notification / SOS alert stores.
 */
export function setupAdminSocketListeners(queryClient: QueryClient): () => void {
  const s = getSocket();

  // Events can arrive through more than one admin room; handle each once.
  const seen = new Map<string, number>();
  const firstTime = (key: string) => {
    const now = Date.now();
    for (const [k, at] of seen) if (now - at > 60_000) seen.delete(k);
    if (seen.has(key)) return false;
    seen.set(key, now);
    return true;
  };
  const goTo = (href: string) => {
    if (typeof window !== 'undefined') window.location.assign(href);
  };
  const notify = (n: Omit<AppNotification, 'isRead' | 'createdAt'>) =>
    useNotificationStore.getState().addNotification({ ...n, isRead: false, createdAt: new Date().toISOString() });

  // 1. SOS Emergency Alerts
  // The backend sends `emergencyId` (not `id`); escalation retries re-send
  // the same id, so the dedupe key includes the timestamp for those.
  const onSosTriggered = (payload: any) => {
    const live = toLiveSos(payload);
    if (!live || !firstTime(`sos:${live.id}:${live.retry ? live.at : ''}`)) return;
    queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'sos'] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'support'] });
    if (!useAuthStore.getState().hasPermission('view_sos')) return;
    notify({
      id: `sos:${live.id}`,
      title: live.retry ? 'SOS still waiting' : 'SOS alert',
      message: live.triggeredBy ? `Raised by the ${live.triggeredBy}.` : 'An emergency was reported.',
      category: 'sos',
      link: '/emergency',
    });
    useNotificationStore.getState().addSosAlert({
      id: live.id,
      tripId: live.tripId ?? '',
      triggeredBy: live.triggeredBy ?? 'rider',
      driverId: live.driver?.id ?? '',
      riderId: live.rider?.id ?? '',
      lat: live.location?.lat ?? 0,
      lng: live.location?.lng ?? 0,
      status: 'ACTIVE',
      createdAt: new Date(live.at).toISOString(),
    } as SosAlertItem);
    // Full-screen alarm + siren (see SosAlarmOverlay).
    useSosAlarmStore.getState().raise(live);
  };

  const onSosResponded = (payload: {
    emergencyId: string;
    responderId: string;
    responderName?: string;
    tripId: string;
  }) => {
    useSosAlarmStore.getState().clear(payload.emergencyId);
    queryClient.invalidateQueries({ queryKey: ['admin', 'sos'] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'support'] });
    toast.info('SOS Alert Claimed', {
      description: `Emergency ${payload.emergencyId.slice(-6)} is being handled by ${payload.responderName || 'a team responder'}.`,
    });
  };

  const onSosResolved = (payload: { emergencyId: string }) => {
    useNotificationStore.getState().resolveSosAlert(payload.emergencyId);
    useSosAlarmStore.getState().clear(payload.emergencyId);
    queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'sos'] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'support'] });
    toast.success('SOS Incident Resolved', {
      description: `Emergency ${payload.emergencyId.slice(-6)} closed.`,
    });
  };

  // 2. Support / Help Center Events
  const onSupportTicketNew = (payload: any) => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'support'] });
    const ticket = payload?.ticket;
    if (!ticket?.id || !firstTime(`ticket:${ticket.id}`)) return;
    if (ticket.priority !== 'critical_sos') {
      const link = `/support/${ticket.id}`;
      notify({
        id: `ticket:${ticket.id}`,
        title: `New ticket ${ticket.ticketNumber ?? ''}`.trim(),
        message: ticket.subject || 'Someone asked for help.',
        category: 'system',
        link,
      });
      toast.info(`New ticket ${ticket.ticketNumber ?? ''}`.trim(), {
        description: ticket.subject || 'Someone asked for help.',
        action: { label: 'Open', onClick: () => goTo(link) },
      });
    }
  };

  const onSupportUpdate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'support'] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'sos'] });
  };

  // 3. Trip Lifecycle Telemetry
  const onTripLifecycleChange = () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'trips'] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'live-trips'] });
  };

  // 4. Driver Status & Verification
  const onDriverStatusChange = () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'drivers'] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'drivers', 'online'] });
  };

  // 5. KYC Submissions & Reviews
  const onKycEvent = () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'kyc'] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'drivers'] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'driver'] });
  };

  const onKycSubmitted = (payload: { driverId?: string; driverName?: string; submittedAt?: number }) => {
    onKycEvent();
    if (!payload?.driverId || !firstTime(`kyc:${payload.driverId}:${payload.submittedAt ?? ''}`)) return;
    const name = payload.driverName || 'A driver';
    const link = `/drivers/${payload.driverId}`;
    notify({
      id: `kyc:${payload.driverId}:${payload.submittedAt ?? Date.now()}`,
      title: 'KYC submitted',
      message: `${name} sent their documents for review.`,
      category: 'kyc',
      link,
    });
    toast.info('KYC submitted', {
      description: `${name} sent their documents for review.`,
      action: { label: 'Review', onClick: () => goTo(link) },
    });
  };

  // 6. In-App Notifications
  const onNotificationNew = (notification: AppNotification) => {
    useNotificationStore.getState().addNotification(notification);
    toast.info(notification.title, {
      description: notification.message,
    });
  };

  // Register listeners
  s.on('admin:sos:triggered', onSosTriggered);
  s.on('admin:sos:responded', onSosResponded);
  s.on('admin:sos:resolved', onSosResolved);

  s.on('admin:support:ticket:new', onSupportTicketNew);
  s.on('admin:support:ticket:updated', onSupportUpdate);
  s.on('admin:support:message:new', onSupportUpdate);
  s.on('support:message:new', onSupportUpdate);
  s.on('support:ticket:updated', onSupportUpdate);

  s.on('admin:trip:started', onTripLifecycleChange);
  s.on('admin:trip:completed', onTripLifecycleChange);
  s.on('admin:trip:cancelled', onTripLifecycleChange);

  s.on('admin:driver:status:change', onDriverStatusChange);
  s.on('admin:driver:connected', onDriverStatusChange);
  s.on('admin:driver:disconnected', onDriverStatusChange);

  s.on('admin:kyc:submitted', onKycSubmitted);
  s.on('admin:kyc:stage-approved', onKycEvent);
  s.on('admin:kyc:stage-rejected', onKycEvent);
  s.on('admin:kyc:final-approved', onKycEvent);
  s.on('admin:kyc:queue-count', onKycEvent);

  s.on('admin:notification', onNotificationNew);
  s.on('admin:notification:new', onNotificationNew);

  // Return unbind cleanup
  return () => {
    s.off('admin:sos:triggered', onSosTriggered);
    s.off('admin:sos:responded', onSosResponded);
    s.off('admin:sos:resolved', onSosResolved);
    s.off('admin:support:ticket:new', onSupportTicketNew);
    s.off('admin:support:ticket:updated', onSupportUpdate);
    s.off('admin:support:message:new', onSupportUpdate);
    s.off('support:message:new', onSupportUpdate);
    s.off('support:ticket:updated', onSupportUpdate);
    s.off('admin:trip:started', onTripLifecycleChange);
    s.off('admin:trip:completed', onTripLifecycleChange);
    s.off('admin:trip:cancelled', onTripLifecycleChange);
    s.off('admin:driver:status:change', onDriverStatusChange);
    s.off('admin:driver:connected', onDriverStatusChange);
    s.off('admin:driver:disconnected', onDriverStatusChange);
    s.off('admin:kyc:submitted', onKycSubmitted);
    s.off('admin:kyc:stage-approved', onKycEvent);
    s.off('admin:kyc:stage-rejected', onKycEvent);
    s.off('admin:kyc:final-approved', onKycEvent);
    s.off('admin:kyc:queue-count', onKycEvent);
    s.off('admin:notification', onNotificationNew);
    s.off('admin:notification:new', onNotificationNew);
  };
}

