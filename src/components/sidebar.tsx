"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    LayoutDashboard,
    Users,
    Briefcase,
    Settings,
    LogOut,
    ChevronLeft,
    ChevronRight,
    Plus,
    BarChart3,
    Webhook,
    Network,
    History as HistoryIcon
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Button } from "@/components/ui/button";

const menuItems = [
    { name: "Overview", icon: LayoutDashboard, path: "/" },
    { name: "Dashboard", icon: BarChart3, path: "/dashboard" },
    { name: "Candidates", icon: Users, path: "/candidates" },
    { name: "Job Requisitions", icon: Briefcase, path: "/requisitions" },
    { name: "Org Chart", icon: Network, path: "/org-chart" },
    { name: "Settings", icon: Settings, path: "/settings" },
    { name: "n8n Integration", icon: Webhook, path: "/admin/n8n" },
    { name: "Data Aging Report", icon: HistoryIcon, path: "/reports/aging" },
];


export function Sidebar() {
    const pathname = usePathname();
    const [collapsed, setCollapsed] = useState(false);

    return (
        <aside
            className={cn(
                "relative h-screen border-r transition-all duration-300 flex flex-col z-20 bg-slate-900 text-slate-100",
                collapsed ? "w-20" : "w-64"
            )}
        >
            {/* Branding */}
            <div className="h-16 flex items-center px-6 border-b border-slate-800 shrink-0 overflow-hidden bg-slate-950/30">
                <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/20">
                    <LayoutDashboard className="h-5 w-5 text-white" />
                </div>
                {!collapsed && (
                    <div className="ml-3 flex flex-col">
                        <span className="font-bold text-sm tracking-wide bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
                            CG TALENT HUB
                        </span>
                        <span className="text-[10px] text-slate-500 font-medium">ATS Platform</span>
                    </div>
                )}
            </div>

            {/* Navigation */}
            <nav className="flex-1 py-6 px-3 space-y-2 overflow-y-auto">
                <div className="px-3 mb-2">
                    {!collapsed && <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Main Menu</p>}
                </div>
                {menuItems.map((item) => {
                    const isActive = pathname === item.path ||
                        (item.path !== '/' && pathname.startsWith(item.path));
                    const Icon = item.icon;
                    return (
                        <Link
                            key={item.path}
                            href={item.path}
                            className={cn(
                                "flex items-center h-11 px-3 rounded-lg transition-all group relative overflow-hidden",
                                isActive
                                    ? "bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-md shadow-indigo-900/20"
                                    : "text-slate-400 hover:bg-slate-800 hover:text-white"
                            )}
                        >
                            <Icon className={cn("h-5 w-5 shrink-0 z-10", isActive ? "text-indigo-100" : "group-hover:text-indigo-400 transition-colors")} />
                            {!collapsed && <span className="ml-3 font-medium text-sm z-10">{item.name}</span>}

                            {/* Active Indicator Line */}
                            {isActive && <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-300" />}
                        </Link>
                    );
                })}
            </nav>

            {/* Footer / Toggle */}
            <div className="p-4 border-t border-slate-800 sticky bottom-0 bg-slate-900">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCollapsed(!collapsed)}
                    className="w-full justify-start gap-2 h-10 rounded-lg hover:bg-slate-800 hover:text-white text-slate-400"
                >
                    {collapsed ? <ChevronRight className="h-5 w-5" /> : (
                        <>
                            <ChevronLeft className="h-5 w-5" />
                            <span className="text-xs font-bold uppercase tracking-widest">Collapse Menu</span>
                        </>
                    )}
                </Button>
            </div>
        </aside>
    );
}
