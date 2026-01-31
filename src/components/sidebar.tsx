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
    BarChart3
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Button } from "@/components/ui/button";

const menuItems = [
    { name: "Overview", icon: LayoutDashboard, path: "/" },
    { name: "Dashboard", icon: BarChart3, path: "/dashboard" }, // Renamed from Analytics
    { name: "Candidates", icon: Users, path: "/candidates" },
    { name: "Job Requisitions", icon: Briefcase, path: "/requisitions" },
    { name: "Jobs Reference", icon: LayoutDashboard, path: "/jobs" },
    { name: "Settings", icon: Settings, path: "/settings" },
];

export function Sidebar() {
    const pathname = usePathname();
    const [collapsed, setCollapsed] = useState(false);

    return (
        <aside
            className={cn(
                "relative h-screen border-r bg-card transition-all duration-300 flex flex-col z-20",
                collapsed ? "w-20" : "w-64"
            )}
        >
            {/* Branding */}
            <div className="h-16 flex items-center px-6 border-b shrink-0 overflow-hidden">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0">
                    <LayoutDashboard className="h-5 w-5 text-white" />
                </div>
                {!collapsed && (
                    <span className="ml-3 font-bold text-sm tracking-tight truncate">
                        CG TALENT HUB
                    </span>
                )}
            </div>

            {/* Navigation */}
            <nav className="flex-1 py-6 px-3 space-y-2 overflow-y-auto">
                {menuItems.map((item) => {
                    const isActive = pathname === item.path;
                    const Icon = item.icon;
                    return (
                        <Link
                            key={item.path}
                            href={item.path}
                            className={cn(
                                "flex items-center h-11 px-3 rounded-xl transition-all group",
                                isActive
                                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                            )}
                        >
                            <Icon className={cn("h-5 w-5 shrink-0", isActive ? "" : "group-hover:scale-110 transition-transform")} />
                            {!collapsed && <span className="ml-3 font-semibold text-sm">{item.name}</span>}
                            {!collapsed && isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white opacity-50" />}
                        </Link>
                    );
                })}
            </nav>

            {/* Footer / Toggle */}
            <div className="p-4 border-t sticky bottom-0 bg-card">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCollapsed(!collapsed)}
                    className="w-full justify-start gap-2 h-10 rounded-xl"
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
