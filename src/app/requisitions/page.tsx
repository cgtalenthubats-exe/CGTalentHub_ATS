"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import {
    Briefcase,
    UserPlus,
    LayoutList,
    Kanban,
    TableProperties,
    LogOut,
    CheckCircle2,
    Users
} from "lucide-react";

export default function RequisitionsMenuPage() {
    const router = useRouter();

    return (
        <div className="container mx-auto p-6 flex flex-col gap-8 max-w-7xl h-full justify-center">

            <div className="space-y-2">
                <nav className="flex items-center text-sm text-muted-foreground gap-2">
                    <span>Home</span>
                    <span>&gt;</span>
                    <span className="font-semibold text-foreground">Job Requisition Menu</span>
                </nav>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

                {/* 1. Job Requisition Manage (Unified) */}
                <MenuCard
                    title="Job Requisitions Manage"
                    subtitle="List & Feedback"
                    icon={Briefcase}
                    color="bg-orange-100 text-orange-600"
                    onClick={() => router.push('/requisitions/manage')}
                />

                {/* 2. JR Status (Kanban) */}
                <MenuCard
                    title="JR Status"
                    subtitle="Kanban Board"
                    icon={Kanban}
                    color="bg-blue-100 text-blue-600"
                    onClick={() => router.push('/requisitions/manage?tab=kanban')}
                />

                {/* 4. Job Requisition Table (Overview) */}
                <MenuCard
                    title="Job Requisition Table"
                    icon={TableProperties}
                    color="bg-indigo-100 text-indigo-600"
                    onClick={() => router.push('/requisitions/table')}
                />

                {/* 5. Successful Placement */}
                <MenuCard
                    title="Successful Placement Table"
                    icon={CheckCircle2}
                    color="bg-green-100 text-green-600"
                />

                {/* 6. Resignation Table */}
                <MenuCard
                    title="Resignation Table"
                    icon={LogOut}
                    color="bg-red-100 text-red-600"
                />

            </div>
        </div>
    );
}

function MenuCard({
    title,
    subtitle,
    icon: Icon,
    color,
    onClick,
    image
}: {
    title: string;
    subtitle?: string;
    icon: any;
    color: string;
    onClick?: () => void;
    image?: string;
}) {
    return (
        <Card
            onClick={onClick}
            className="group relative cursor-pointer hover:shadow-xl transition-all duration-300 hover:-translate-y-1 overflow-hidden h-[220px] flex flex-col items-center justify-center p-6 border-2 border-transparent hover:border-primary/20"
        >
            <div className={`p-5 rounded-3xl ${color} mb-4 group-hover:scale-110 transition-transform duration-500 shadow-sm`}>
                <Icon className="w-10 h-10" />
            </div>
            <h3 className="font-bold text-center text-slate-800 group-hover:text-primary transition-colors">{title}</h3>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
        </Card>
    );
}
