"use client";

import { toast as sonnerToast } from "sonner";
import { notificationStore, NotificationType } from "./notification-store";

/**
 * Functional Notification Wrapper
 * Triggers a real-time sonner toast AND records it in the history store.
 */
export const toast = {
    success: (message: string, options?: any) => {
        sonnerToast.success(message, options);
        notificationStore.add(message, 'success', options?.description);
    },
    error: (message: string, options?: any) => {
        sonnerToast.error(message, options);
        notificationStore.add(message, 'error', options?.description);
    },
    info: (message: string, options?: any) => {
        sonnerToast.info(message, options);
        notificationStore.add(message, 'info', options?.description);
    },
    warning: (message: string, options?: any) => {
        sonnerToast.warning(message, options);
        notificationStore.add(message, 'warning', options?.description);
    },
    message: (message: string, options?: any) => {
        sonnerToast(message, options);
        notificationStore.add(message, 'info', options?.description);
    },
    loading: (message: string, options?: any) => {
        return sonnerToast.loading(message, options);
    },
    dismiss: (id?: string | number) => {
        sonnerToast.dismiss(id);
    }
};

// Also export default sonner toast for advanced usage if needed
export { sonnerToast };
