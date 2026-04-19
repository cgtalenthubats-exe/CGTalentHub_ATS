"use client";

import React, { useEffect, useState } from "react";
import { notificationStore, Notification } from "@/lib/notification-store";
import { Bell, Trash2, Check, X, Info, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { getOrgChartVerificationAlerts } from "@/app/actions/dashboard";

export function NotificationCenter() {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [taskAlerts, setTaskAlerts] = useState<any[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isOpen, setIsOpen] = useState(false);

    const refreshTasks = async () => {
        try {
            const tasks = await getOrgChartVerificationAlerts();
            setTaskAlerts(tasks.filter((t: any) => t.pending_nodes > 0));
        } catch (error) {
            console.error("Failed to fetch task alerts for notification center:", error);
        }
    };

    useEffect(() => {
        // Initial load
        setNotifications(notificationStore.getNotifications());
        setUnreadCount(notificationStore.getUnreadCount());
        refreshTasks();

        // Subscribe to updates
        const unsubscribe = notificationStore.subscribe(() => {
            setNotifications([...notificationStore.getNotifications()]);
            setUnreadCount(notificationStore.getUnreadCount());
        });

        return unsubscribe;
    }, []);

    const handleOpenChange = (open: boolean) => {
        setIsOpen(open);
        if (open) {
            notificationStore.markAllAsRead();
            refreshTasks();
        }
    };

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'success': return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
            case 'error': return <AlertCircle className="h-4 w-4 text-rose-500" />;
            case 'warning': return <AlertCircle className="h-4 w-4 text-amber-500" />;
            default: return <Info className="h-4 w-4 text-blue-500" />;
        }
    };

    return (
        <Popover open={isOpen} onOpenChange={handleOpenChange}>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-xl relative hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                    <Bell className="h-5 w-5 text-slate-600 dark:text-slate-300" />
                    {(unreadCount > 0 || taskAlerts.length > 0) && (
                        <span className="absolute top-2 right-2 h-2.5 w-2.5 rounded-full bg-rose-500 border-2 border-white dark:border-slate-900 animate-pulse" />
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-96 p-0 rounded-3xl overflow-hidden border-none shadow-2xl bg-white dark:bg-slate-900 z-[100]" align="end" sideOffset={8}>
                <div className="flex items-center justify-between px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                        <h3 className="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-white">Notification Hub</h3>
                        {(unreadCount > 0 || taskAlerts.length > 0) && (
                            <span className="text-[10px] font-black bg-rose-500 text-white px-1.5 py-0.5 rounded-md">
                                {unreadCount + taskAlerts.length} NEW
                            </span>
                        )}
                    </div>
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => notificationStore.clearAll()}
                        className="h-8 px-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-rose-500"
                    >
                        <Trash2 className="h-3 w-3 mr-1.5" /> Clear History
                    </Button>
                </div>

                <ScrollArea className="h-[500px]">
                    <div className="p-2 space-y-4">
                        {/* Task Alerts Section */}
                        {taskAlerts.length > 0 && (
                            <div className="space-y-2">
                                <h4 className="px-4 pt-2 text-[10px] font-black text-rose-500 uppercase tracking-[0.2em] flex items-center gap-2">
                                    <AlertCircle className="h-3 w-3" /> Action Required
                                </h4>
                                {taskAlerts.map((task) => (
                                    <div key={task.upload_id} className="p-4 rounded-2xl bg-rose-50/50 dark:bg-rose-900/10 border border-rose-100/50 dark:border-rose-900/30 group">
                                        <div className="flex items-start gap-3">
                                            <div className="p-2 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-rose-100 dark:border-rose-900/50">
                                                <Info className="h-4 w-4 text-rose-500" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-bold text-slate-800 dark:text-slate-100">
                                                    Verify OrgChart: {task.company_name}
                                                </p>
                                                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">
                                                    {task.pending_nodes} nodes pending verification
                                                </p>
                                                <div className="flex items-center gap-2 mt-3">
                                                    <a 
                                                        href={`/org-chart?id=${task.upload_id}`} 
                                                        className="text-[10px] font-black uppercase tracking-widest text-white bg-rose-500 hover:bg-rose-600 px-3 py-1.5 rounded-lg transition-colors shadow-sm shadow-rose-200"
                                                    >
                                                        Start Verifying
                                                    </a>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                <div className="mx-4 border-b border-slate-100 dark:border-slate-800 pt-2" />
                            </div>
                        )}

                        {/* Notifications History Section */}
                        <div className="space-y-1">
                            <h4 className="px-4 pt-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Activity History</h4>
                            <AnimatePresence initial={false}>
                                {notifications.length === 0 ? (
                                    <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-2">
                                        <Bell className="h-8 w-8 opacity-10" />
                                        <p className="text-[11px] font-black uppercase tracking-widest text-slate-300">No recent activity</p>
                                    </div>
                                ) : (
                                    notifications.map((n) => (
                                        <motion.div
                                            key={n.id}
                                            initial={{ opacity: 0, x: 20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                            className={cn(
                                                "group p-4 rounded-2xl transition-all duration-200 border border-transparent",
                                                n.read ? "opacity-60" : "bg-white dark:bg-slate-800 shadow-sm border-slate-100 dark:border-slate-700"
                                            )}
                                        >
                                            <div className="flex items-start gap-3">
                                                <div className="mt-0.5 shrink-0">
                                                    {getTypeIcon(n.type)}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-bold text-slate-800 dark:text-slate-100 leading-snug">
                                                        {n.message}
                                                    </p>
                                                    {n.description && (
                                                        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                                                            {n.description}
                                                        </p>
                                                    )}
                                                    <div className="flex items-center gap-1.5 mt-2 text-[9px] font-bold text-slate-400 uppercase tracking-tighter">
                                                        <Clock className="h-3 w-3" />
                                                        {formatDistanceToNow(n.timestamp, { addSuffix: true })}
                                                    </div>
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </ScrollArea>
                
                <div className="p-4 bg-slate-50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-800 text-center">
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">
                        CG Talent Hub Notification Center
                    </p>
                </div>
            </PopoverContent>
        </Popover>
    );
}
