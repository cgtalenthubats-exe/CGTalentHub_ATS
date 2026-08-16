"use client";

import React from "react";
import { Webhook } from "lucide-react";
import JRMaintenanceBoard from "./JRMaintenanceBoard";
import OrgChartAlerts from "@/app/OrgChartAlerts";

export default function PendingTasksPage() {

    return (
        <div className="flex flex-col gap-10 bg-slate-50/30 p-4 -m-4 rounded-3xl min-h-screen animate-in fade-in">
            {/* Header */}
            <div className="flex flex-col gap-2">
                <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 flex items-center gap-4">
                    <Webhook className="h-10 w-10 text-indigo-500" />
                    Pending Tasks for Recruiter
                </h1>
                <p className="text-lg text-slate-500 font-medium ml-14">
                    Manage your action items, monitor aging processes, and verify pending data.
                </p>
            </div>

            {/* 1. JR Maintenance Board */}
            <div className="animate-in slide-in-from-bottom-4 duration-700">
                <JRMaintenanceBoard />
            </div>

            {/* OrgChart Verification Tasks */}
            <div className="mt-8 pt-8 border-t border-slate-100">
                <OrgChartAlerts />
            </div>
        </div>
    );
}
