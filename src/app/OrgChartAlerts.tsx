"use client";

import React, { useEffect, useState } from "react";
import { getOrgChartVerificationAlerts } from "@/app/actions/dashboard";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowRight, Building2, AlertCircle } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";

export default function OrgChartAlerts() {
    const [alerts, setAlerts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function load() {
            setLoading(true);
            try {
                const data = await getOrgChartVerificationAlerts();
                // Filter to only shows items with pending nodes
                setAlerts(data.filter((a: any) => a.pending_nodes > 0));
            } catch (error) {
                console.error("Failed to load org chart alerts:", error);
            }
            setLoading(false);
        }
        load();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8 bg-white rounded-3xl border border-slate-100 shadow-sm">
                <Loader2 className="h-5 w-5 text-blue-600 animate-spin mr-3" />
                <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Checking verification status...</span>
            </div>
        );
    }

    if (alerts.length === 0) return null;

    return (
        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
        >
            <div className="flex items-center gap-2 px-1">
                <AlertCircle className="h-5 w-5 text-red-500" />
                <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Action Required: OrgChart Verification</h3>
            </div>
            
            <Card className="border-none ring-1 ring-slate-200 bg-white shadow-2xl rounded-3xl overflow-hidden">
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 border-b border-slate-100">
                                <tr>
                                    <th className="px-6 py-4 text-left font-black text-slate-500 uppercase tracking-widest text-[10px]">Company Name</th>
                                    <th className="px-6 py-4 text-center font-black text-slate-500 uppercase tracking-widest text-[10px]">Pending Items</th>
                                    <th className="px-6 py-4 text-center font-black text-slate-500 uppercase tracking-widest text-[10px]">Progress</th>
                                    <th className="px-6 py-4 text-right font-black text-slate-500 uppercase tracking-widest text-[10px]">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {alerts.map((alert) => (
                                    <tr key={alert.upload_id} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="bg-slate-100 p-2 rounded-lg group-hover:bg-blue-50 transition-colors">
                                                    <Building2 className="h-4 w-4 text-slate-400 group-hover:text-blue-500" />
                                                </div>
                                                <span className="font-bold text-slate-700">{alert.company_name}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <Badge className="bg-red-50 text-red-600 border-red-100 font-black px-2 py-0.5 text-[10px]">
                                                {alert.pending_nodes} Nodes
                                            </Badge>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3 justify-center">
                                                <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                    <div 
                                                        className="h-full bg-blue-500 rounded-full" 
                                                        style={{ width: `${alert.progress}%` }}
                                                    />
                                                </div>
                                                <span className="text-[10px] font-black text-slate-400">{alert.progress}%</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <Link href={`/org-chart?id=${alert.upload_id}`}>
                                                <Button size="sm" className="bg-slate-900 hover:bg-blue-600 text-white font-black uppercase text-[9px] tracking-widest h-8 rounded-lg outline-none">
                                                    Verify <ArrowRight className="ml-1.5 w-3 h-3" />
                                                </Button>
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </motion.div>
    );
}
