"use client";

export type NotificationType = 'success' | 'error' | 'info' | 'warning';

export interface Notification {
    id: string;
    message: string;
    type: NotificationType;
    timestamp: number;
    read: boolean;
    description?: string;
}

const STORAGE_KEY = 'ats_notifications_v1';
const MAX_HISTORY = 100;
const NOTIFY_EVENT = 'ats_notification_update';

class NotificationStore {
    private notifications: Notification[] = [];

    constructor() {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                try {
                    this.notifications = JSON.parse(saved);
                } catch (e) {
                    this.notifications = [];
                }
            }
        }
    }

    private save() {
        if (typeof window !== 'undefined') {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.notifications.slice(0, MAX_HISTORY)));
            window.dispatchEvent(new CustomEvent(NOTIFY_EVENT));
        }
    }

    add(message: string, type: NotificationType = 'info', description?: string) {
        const newNotification: Notification = {
            id: Math.random().toString(36).substring(2, 11),
            message,
            type,
            timestamp: Date.now(),
            read: false,
            description
        };
        this.notifications = [newNotification, ...this.notifications].slice(0, MAX_HISTORY);
        this.save();
        return newNotification;
    }

    getNotifications() {
        return this.notifications;
    }

    markAllAsRead() {
        this.notifications = this.notifications.map(n => ({ ...n, read: true }));
        this.save();
    }

    clearAll() {
        this.notifications = [];
        this.save();
    }

    getUnreadCount() {
        return this.notifications.filter(n => !n.read).length;
    }

    subscribe(callback: () => void) {
        if (typeof window === 'undefined') return () => {};
        window.addEventListener(NOTIFY_EVENT, callback);
        return () => window.removeEventListener(NOTIFY_EVENT, callback);
    }
}

export const notificationStore = new NotificationStore();
