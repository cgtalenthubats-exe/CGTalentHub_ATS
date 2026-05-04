"use client";

import { useEffect, useState } from "react";
import { 
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar, Cell, Legend, LabelList
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, TrendingUp, Users, Briefcase, FileText, Database, Layers, LayoutGrid, Building2, Globe } from "lucide-react";
import { getDashboardOverviewStats } from "@/app/actions/analytics";
import { getDistributionStats } from "@/app/actions/pending-tasks-actions";

export default function OverviewAnalytics() {
    const [data, setData] = useState<any>(null);
    const [distData, setDistData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [lookbackDays, setLookbackDays] = useState(60);

    useEffect(() => {
        async function fetchStats() {
            setLoading(true);
            try {
                const [stats, dists] = await Promise.all([
                    getDashboardOverviewStats(lookbackDays),
                    getDistributionStats()
                ]);
                setData(stats);
                if (dists.success) {
                    setDistData(dists);
                }
            } catch (error) {
                console.error("Failed to fetch overview stats:", error);
            } finally {
                setLoading(false);
            }
        }
        fetchStats();
    }, [lookbackDays]);

    if (loading && !data) {
        return (
            <div className="flex items-center justify-center p-20 bg-white/50 rounded-3xl border border-slate-100">
                <Loader2 className="h-8 w-8 text-blue-600 animate-spin mr-3" />
                <span className="text-sm font-black uppercase tracking-widest text-slate-500">Loading detailed analytics...</span>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Control Bar for Trends */}
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-black tracking-tight text-slate-800 flex items-center gap-2">
                    <TrendingUp className="h-6 w-6 text-blue-600" />
                    Candidate Pool Growth (Monthly Cumulative)
                </h2>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-100 px-4 py-2 rounded-xl">
                    Last 12 Months
                </div>
            </div>

            {/* Growth Trend Graphs */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <TrendChart 
                    data={data?.candidateGrowth || []} 
                    title="Talent Pool Growth" 
                    description="Monthly cumulative total of active profiles"
                    color="#3b82f6"
                    icon={<Users className="h-4 w-4" />}
                />
                <TrendChart 
                    data={data?.jrGrowth || []} 
                    title="Job Requisition Growth" 
                    description="Monthly cumulative total of job requests"
                    color="#8b5cf6"
                    icon={<Briefcase className="h-4 w-4" />}
                />
            </div>

            {/* NEW: Job Family + Job Group Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
                <DistributionChart 
                    data={distData?.jobFuncDist || []} 
                    title="Job Family" 
                    description="Operational role distribution"
                    color="#ec4899"
                    icon={<LayoutGrid className="h-4 w-4" />}
                />
                <DistributionChart 
                    data={distData?.jobGroupDist || []} 
                    title="Job Group" 
                    description="Core expertise categorization"
                    color="#6366f1"
                    icon={<Layers className="h-4 w-4" />}
                />
            </div>

            {/* NEW: Industry + Company Group Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
                <DistributionChart 
                    data={distData?.industryDist || []} 
                    title="Top 10 Industry" 
                    description="Market sector concentration"
                    color="#10b981"
                    icon={<Building2 className="h-4 w-4" />}
                />
                <DistributionChart 
                    data={distData?.groupDist || []} 
                    title="Company Group" 
                    description="Business unit distribution"
                    color="#f59e0b"
                    icon={<Globe className="h-4 w-4" />}
                />
            </div>
        </div>
    );
}

function TrendChart({ data, title, description, color, icon }: any) {
    const yAxisDomain: [number | string, number | string] = [0, 'auto'];

    return (
        <Card className="border-none ring-1 ring-slate-200 bg-white shadow-2xl rounded-3xl overflow-hidden">
            <CardHeader className="bg-slate-50/50 pb-2">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-white rounded-xl shadow-sm border border-slate-100">
                        {icon}
                    </div>
                    <div>
                        <CardTitle className="text-lg font-black tracking-tight text-slate-800">{title}</CardTitle>
                        <CardDescription className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{description}</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="h-[350px] pt-6 flex flex-col">
                <div className="flex-1 min-h-0">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data} margin={{ top: 20, right: 10, left: 10, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis 
                                dataKey="week" 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{ fontSize: 9, fontWeight: 'bold', fill: '#94a3b8' }} 
                                dy={10}
                            />
                            <YAxis 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{ fontSize: 9, fontWeight: 'bold', fill: '#94a3b8' }} 
                                domain={yAxisDomain}
                                width={45}
                            />
                            <Tooltip 
                                cursor={{ fill: "rgba(241, 245, 249, 0.4)" }}
                                content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                        const d = payload[0].payload;
                                        return (
                                            <div className="bg-white p-3 rounded-2xl shadow-2xl border border-slate-100 animate-in zoom-in duration-200">
                                                <p className="text-[10px] font-black uppercase text-slate-400 mb-1">{d.week}</p>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-lg font-black text-slate-900">{d.count.toLocaleString()}</span>
                                                    {d.addition > 0 && (
                                                        <span className="text-[10px] font-black text-emerald-500 bg-emerald-50 px-1.5 py-0.5 rounded-md">
                                                            +{d.addition}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase">Total Records</p>
                                            </div>
                                        );
                                    }
                                    return null;
                                }}
                            />
                            <Bar 
                                dataKey="count" 
                                fill={color} 
                                radius={[10, 10, 0, 0]} 
                                barSize={40}
                                animationDuration={1500}
                            >
                                <LabelList 
                                    dataKey="addition" 
                                    position="top" 
                                    content={(props: any) => {
                                        const { x, y, value, width } = props;
                                        if (!value || value <= 0) return null;
                                        return (
                                            <g>
                                                <text 
                                                    x={x + width / 2} 
                                                    y={y - 12} 
                                                    fill="#10b981" 
                                                    textAnchor="middle" 
                                                    fontSize={10} 
                                                    fontWeight="900"
                                                >
                                                    +{value}
                                                </text>
                                            </g>
                                        );
                                    }}
                                />
                                {data.map((entry: any, index: number) => (
                                    <Cell key={`cell-${index}`} fillOpacity={0.8 + (index / data.length) * 0.2} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
                {/* Visual Legend for Delta */}
                <div className="mt-4 flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-400 border-t border-slate-50 pt-3">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                            <span>Total Pool</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-emerald-500">
                            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                            <span>+ Monthly Growth</span>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function DistributionChart({ data, title, description, color, icon }: any) {
    // Sort and take top 10 for better visualization
    const chartData = [...data].sort((a, b) => b.count - a.count).slice(0, 10);

    return (
        <Card className="border-none ring-1 ring-slate-200 bg-white shadow-2xl rounded-3xl overflow-hidden hover:shadow-indigo-500/5 transition-all">
            <CardHeader className="bg-slate-50/50 pb-2">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-white rounded-xl shadow-sm border border-slate-100">
                        {icon}
                    </div>
                    <div>
                        <CardTitle className="text-lg font-black tracking-tight text-slate-800">{title}</CardTitle>
                        <CardDescription className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{description}</CardDescription>
                    </div>
                </div>
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
                            {chartData.map((entry: any, index: number) => (
                                <Cell key={`cell-${index}`} fillOpacity={1 - (index * 0.05)} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
}
