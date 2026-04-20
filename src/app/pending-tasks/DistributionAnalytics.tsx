"use client";

import { useEffect, useState } from "react";
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { getDistributionStats } from "@/app/actions/pending-tasks-actions";

export default function DistributionAnalytics() {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchStats() {
            setLoading(true);
            const res = await getDistributionStats();
            if (res.success) {
                setData(res);
            }
            setLoading(false);
        }
        fetchStats();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center p-20 bg-white/50 rounded-3xl border border-slate-100 shadow-sm animate-pulse">
                <Loader2 className="h-8 w-8 text-blue-600 animate-spin mr-3" />
                <span className="text-sm font-black uppercase tracking-widest text-slate-500">Aggregating Market Distributions...</span>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in duration-500">
            <DistributionChart 
                data={data?.industryDist || []} 
                title="Market Industry Distribution" 
                description="Concentration of talent across sectors (Full Scope)"
                color="#10b981"
            />
            <DistributionChart 
                data={data?.groupDist || []} 
                title="Business Group Distribution" 
                description="Talent allocation by business units (Full Scope)"
                color="#f59e0b"
            />
            <DistributionChart 
                data={data?.jobGroupDist || []} 
                title="Job Grouping Distribution" 
                description="Categorization of talent core expertise (Full Scope)"
                color="#6366f1"
            />
            <DistributionChart 
                data={data?.jobFuncDist || []} 
                title="Job Function Distribution" 
                description="Detailed drill-down of operational roles (Full Scope)"
                color="#ec4899"
            />
        </div>
    );
}

function DistributionChart({ data, title, description, color }: any) {
    // Sort and take top 10 for better visualization
    const chartData = [...data].sort((a, b) => b.count - a.count).slice(0, 10);

    return (
        <Card className="border-none ring-1 ring-slate-200 bg-white shadow-xl rounded-3xl overflow-hidden hover:shadow-2xl transition-all">
            <CardHeader className="bg-slate-50/50 pb-2">
                <CardTitle className="text-lg font-black tracking-tight text-slate-800">{title}</CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{description}</CardDescription>
            </CardHeader>
            <CardContent className="h-[400px] pt-6">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} layout="vertical" margin={{ left: 40, right: 30 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                        <XAxis type="number" hide />
                        <YAxis 
                            dataKey="name" 
                            type="category" 
                            width={120} 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fontSize: 9, fontWeight: 'bold', fill: '#64748b' }}
                        />
                        <Tooltip 
                            cursor={{ fill: '#f8fafc' }}
                            contentStyle={{ 
                                borderRadius: '16px', 
                                border: 'none', 
                                boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.1)',
                                fontSize: '12px',
                                fontWeight: 'bold'
                            }}
                        />
                        <Bar 
                            dataKey="count" 
                            fill={color} 
                            radius={[0, 8, 8, 0]} 
                            barSize={20}
                            animationDuration={1500}
                        >
                            {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fillOpacity={1 - (index * 0.05)} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
}
