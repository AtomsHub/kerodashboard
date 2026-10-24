// src/stores/notification-store.ts
import { create } from 'zustand';
import { AppNotification, SosAlertItem } from '@/types/admin';
import { getSocket } from '@/lib/socket';

interface NotificationState {
  notifications: AppNotification[];
  unreadCount: number;
  activeSosAlerts: SosAlertItem[];
  addNotification: (notification: AppNotification) => void;
  markAsRead: (notificationId: string) => void;
  markAllAsRead: () => void;
  addSosAlert: (alert: SosAlertItem) => void;
  resolveSosAlert: (emergencyId: string) => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  unreadCount: 0,
  activeSosAlerts: [],

  addNotification: (notification) =>
    set((state) =>
      state.notifications.some((n) => n.id === notification.id)
        ? state
        : {
            notifications: [notification, ...state.notifications].slice(0, 100),
            unreadCount: state.unreadCount + (notification.isRead ? 0 : 1),
          },
    ),

  markAsRead: (notificationId) => {
    const socket = getSocket();
    if (socket.connected) {
      socket.emit('admin:notification:read', { notificationId });
    }
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === notificationId ? { ...n, isRead: true } : n
      ),
      unreadCount: Math.max(0, state.unreadCount - 1),
    }));
  },

  markAllAsRead: () => {
    const socket = getSocket();
    if (socket.connected) {
      socket.emit('admin:notification:read-all', {});
    }
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
      unreadCount: 0,
    }));
  },

  addSosAlert: (alert) =>
    set((state) => ({
      activeSosAlerts: [alert, ...state.activeSosAlerts.filter((a) => a.id !== alert.id)],
    })),

  resolveSosAlert: (emergencyId) =>
    set((state) => ({
      activeSosAlerts: state.activeSosAlerts.filter((a) => a.id !== emergencyId),
    })),
}));
