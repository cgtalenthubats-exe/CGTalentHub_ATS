"use client";

import React, { useEffect, useState } from "react";
import { getTrackingData, TrackingStats } from "@/app/actions/tracking";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BarChart3, Clock, Briefcase, Webhook } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import JRMaintenanceBoard from "./JRMaintenanceBoard";
import OrgChartAlerts from "@/app/OrgChartAlerts";

export default function PendingTasksPage() {
    const router = useRouter();
    const [tracking, setTracking] = useState<TrackingStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchData() {
            setLoading(true);
            try {
                const trackData = await getTrackingData({});
                setTracking(trackData);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, []);

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

            {/* 2 & 3. Distributions moved to Overview */}

            {/* 4. Pipeline Performance */}
            <div className="grid gap-8 lg:grid-cols-5 pt-8 border-t border-slate-100 italic duration-1000">
                <div className="lg:col-span-5 mb-2">
                    <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                        <BarChart3 className="h-5 w-5 text-indigo-500" />
                        Pipeline Performance
                    </h3>
                </div>
                
                {/* Recruitment Funnel */}
                <Card className="lg:col-span-3 border-none ring-1 ring-slate-200 bg-white shadow-2xl rounded-3xl overflow-hidden">
                    <CardHeader className="border-b bg-slate-50 px-8 py-6">
                        <div className="flex justify-between items-center">
                            <div>
                                <CardTitle className="text-xl font-black tracking-tight text-slate-800">Recruitment Funnel</CardTitle>
                                <CardDescription className="text-xs font-medium text-slate-500 uppercase tracking-wider mt-1">Real-time candidate distribution</CardDescription>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                className="text-[10px] font-black uppercase tracking-widest bg-white"
                                onClick={() => router.push('/requisitions/tracking')}
                            >
                                Full Analytics <BarChart3 className="ml-2 w-3.5 h-3.5" />
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="p-8 space-y-6">
                        {loading ? (
                            <div className="h-[300px] w-full flex items-center justify-center animate-pulse bg-slate-50 rounded-2xl" />
                        ) : (
                            tracking?.funnelData.slice(0, 6).map((stage) => (
                                <div key={stage.status} className="space-y-2 group">
                                    <div className="flex justify-between items-end">
                                        <div className="flex items-center gap-3">
                                            <div className="w-1.5 h-4 rounded-full" style={{ backgroundColor: stage.color || '#cbd5e1' }} />
                                            <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider font-mono">{stage.status}</span>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span className="text-[9px] font-bold text-slate-400">AVG: {stage.avgDays} days</span>
                                            <span className="text-xl font-black text-slate-900">{stage.count}</span>
                                        </div>
                                    </div>
                                    <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden shadow-inner">
                                        <div
                                            className="h-full rounded-full transition-all duration-1000 ease-out shadow-sm"
                                            style={{
                                                width: `${tracking.funnelData[0]?.count > 0 ? (stage.count / tracking.funnelData[0].count) * 100 : 0}%`,
                                                backgroundColor: stage.color || '#6366f1'
                                            }}
                                        />
                                    </div>
                                </div>
                            ))
                        )}
                        {!loading && (!tracking || tracking.funnelData.length === 0) && (
                            <div className="h-[300px] flex flex-col items-center justify-center text-slate-400 gap-2">
                                <Briefcase className="w-12 h-12 opacity-20" />
                                <p className="text-xs font-bold uppercase tracking-widest">No recruitment data available</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Status Aging */}
                <Card className="lg:col-span-2 border-none ring-1 ring-slate-200 bg-white shadow-2xl rounded-3xl overflow-hidden">
                    <CardHeader className="border-b bg-slate-50 px-8 py-6 flex flex-row items-center justify-between">
                        <div>
                            <CardTitle className="text-xl font-black tracking-tight text-slate-800">Status Aging</CardTitle>
                            <CardDescription className="text-xs font-medium text-slate-500 uppercase tracking-wider mt-1">Average days per stage</CardDescription>
                        </div>
                        <Clock className="h-5 w-5 text-slate-400" />
                    </CardHeader>
                    <CardContent className="p-0">
                        <table className="w-full text-[11px]">
                            <thead className="bg-slate-900 text-slate-100">
                                <tr>
                                    <th className="px-6 py-3 text-left font-black uppercase tracking-widest">Stage</th>
                                    <th className="px-6 py-3 text-center font-black uppercase tracking-widest">Mean</th>
                                    <th className="px-6 py-3 text-center font-black uppercase tracking-widest">Peak</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {tracking?.funnelData.filter(d => d.count > 0).map((d) => (
                                    <tr key={d.status} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4 font-bold text-slate-700 uppercase tracking-tighter">{d.status}</td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-md font-black font-mono">{d.avgDays}d</span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="bg-rose-50 text-rose-700 px-2 py-1 rounded-md font-black font-mono">{d.maxDays}d</span>
                                        </td>
                                    </tr>
                                ))}
                                {!loading && tracking?.funnelData.filter(d => d.count > 0).length === 0 && (
                                    <tr>
                                        <td colSpan={3} className="px-6 py-20 text-center text-slate-300 italic text-xs">
                                            No active recruitment cycles to track aging
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </CardContent>
                </Card>
            </div>

            {/* 5. OrgChart Verification Tasks */}
            <div className="mt-8 pt-8 border-t border-slate-100">
                <OrgChartAlerts />
            </div>
        </div>
    );
}
