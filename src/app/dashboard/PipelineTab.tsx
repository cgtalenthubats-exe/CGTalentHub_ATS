"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
    getTrackingData,
    getTrackingFilters,
    TrackingStats
} from "@/app/actions/tracking";
import { Card, CardContent } from "@/components/ui/card";
import { FilterMultiSelect } from "@/components/ui/filter-multi-select";
import { ActiveFilterChips } from "@/components/ui/active-filter-chips";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Briefcase,
    Building2,
    Layers,
    Clock,
    RotateCcw,
    Search,
    Filter,
    Globe,
    BarChart3,
    Users,
    X
} from "lucide-react";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    Cell,
    CartesianGrid
} from "recharts";

const BLUE = "#3b82f6";

export default function PipelineTab() {
    const [stats, setStats] = useState<TrackingStats | null>(null);
    const [loading, setLoading] = useState(true);

    // Master data for dynamic filters
    const [masterData, setMasterData] = useState<{
        rawJrs: any[];
        statuses: string[];
    }>({ rawJrs: [], statuses: [] });

    const [filters, setFilters] = useState({
        jr_id: [] as string[],
        position_jr: [] as string[],
        bu: [] as string[],
        sub_bu: [] as string[],
        status: [] as string[],
    });

    const [jrSearch, setJrSearch] = useState("");

    // --- Dynamic Options Logic (Cascading) ---
    const dynamicOptions = useMemo(() => {
        const { rawJrs } = masterData;
        if (!rawJrs.length) return { jrIds: [], positions: [], bus: [], subBus: [] };

        const getFiltered = (excludeKey?: keyof typeof filters) => {
            return rawJrs.filter(jr => {
                const matchJr = !filters.jr_id.length || excludeKey === 'jr_id' || filters.jr_id.includes(jr.jr_id);
                const matchPos = !filters.position_jr.length || excludeKey === 'position_jr' || filters.position_jr.includes(jr.position_jr);
                const matchBu = !filters.bu.length || excludeKey === 'bu' || filters.bu.includes(jr.bu);
                const matchSub = !filters.sub_bu.length || excludeKey === 'sub_bu' || filters.sub_bu.includes(jr.sub_bu);
                return matchJr && matchPos && matchBu && matchSub;
            });
        };

        return {
            jrIds: Array.from(new Set(getFiltered('jr_id').map(j => j.jr_id))).sort(),
            positions: Array.from(new Set(getFiltered('position_jr').map(j => j.position_jr))).filter(Boolean).sort() as string[],
            bus: Array.from(new Set(getFiltered('bu').map(j => j.bu))).filter(Boolean).sort() as string[],
            subBus: Array.from(new Set(getFiltered('sub_bu').map(j => j.sub_bu))).filter(Boolean).sort() as string[],
        };
    }, [masterData, filters]);

    const toggleFilter = (key: keyof typeof filters, value: string) => {
        setFilters(prev => ({
            ...prev,
            [key]: prev[key].includes(value)
                ? prev[key].filter(v => v !== value)
                : [...prev[key], value]
        }));
    };

    const removeJrFilter = (id: string) => {
        setFilters(prev => ({ ...prev, jr_id: prev.jr_id.filter(v => v !== id) }));
    };

    useEffect(() => {
        async function loadMaster() {
            setMasterData(await getTrackingFilters());
        }
        loadMaster();
    }, []);

    useEffect(() => {
        async function loadData() {
            setLoading(true);
            const res = await getTrackingData(filters);
            setStats(res);
            setLoading(false);
        }
        loadData();
    }, [filters]);

    const handleJrSearch = (e: React.FormEvent) => {
        e.preventDefault();
        const term = jrSearch.trim().toUpperCase();
        if (term) {
            // Support partial search or exact
            const match = masterData.rawJrs.find(j => j.jr_id.toUpperCase() === term);
            if (match && !filters.jr_id.includes(match.jr_id)) {
                setFilters(prev => ({ ...prev, jr_id: [...prev.jr_id, match.jr_id] }));
                setJrSearch("");
            } else if (!match) {
                // Potential feedback if no JR found
            }
        }
    };

    return (
        <div className="space-y-8 bg-[#f8fafc]/30 p-6 rounded-[2.5rem] border border-slate-100">
            {/* dynamic Filter Bar */}
            <div className="flex flex-col gap-6">
                <div className="flex flex-wrap items-center gap-4 bg-white/60 p-4 rounded-3xl backdrop-blur-sm border border-white shadow-sm">
                    {/* Search Style JR ID */}
                    <div className="flex flex-col gap-2">
                        <div className="relative w-full md:w-[240px]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <form onSubmit={handleJrSearch}>
                                <Input
                                    placeholder="Search JR ID..."
                                    value={jrSearch}
                                    onChange={(e) => setJrSearch(e.target.value)}
                                    className="pl-10 h-10 bg-white border-slate-200 rounded-xl shadow-sm focus:ring-primary/20 transition-all font-medium"
                                />
                            </form>
                        </div>
                        {filters.jr_id.length > 0 && (
                            <div className="flex flex-wrap gap-1 max-w-[240px]">
                                {filters.jr_id.map(id => (
                                    <Badge key={id} variant="secondary" className="bg-primary/10 text-primary border-primary/20 pr-1 py-0.5">
                                        {id}
                                        <button onClick={() => removeJrFilter(id)} className="ml-1 hover:text-red-500">
                                            <X className="w-3 h-3" />
                                        </button>
                                    </Badge>
                                ))}
                            </div>
                        )}
                    </div>

                    <FilterMultiSelect label="Position" options={dynamicOptions.positions} selected={filters.position_jr} onChange={(v) => toggleFilter('position_jr', v)} icon={Briefcase} />
                    <FilterMultiSelect label="Business Unit" options={dynamicOptions.bus} selected={filters.bu} onChange={(v) => toggleFilter('bu', v)} icon={Building2} />
                    <FilterMultiSelect label="Sub BU" options={dynamicOptions.subBus} selected={filters.sub_bu} onChange={(v) => toggleFilter('sub_bu', v)} icon={Layers} />
                    <FilterMultiSelect label="Status" options={masterData.statuses} selected={filters.status} onChange={(v) => toggleFilter('status', v)} icon={Filter} />

                    {(filters.jr_id.length > 0 || filters.position_jr.length > 0 || filters.bu.length > 0 || filters.sub_bu.length > 0 || filters.status.length > 0) && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                                setFilters({ jr_id: [], position_jr: [], bu: [], sub_bu: [], status: [] });
                                setJrSearch("");
                            }}
                            className="h-10 px-4 text-destructive font-bold uppercase text-[10px] tracking-widest hover:bg-red-50 rounded-xl"
                        >
                            <RotateCcw className="w-3.5 h-3.5 mr-2" /> Reset
                        </Button>
                    )}

                    <div className="ml-auto hidden xl:block">
                        <div className="text-3xl font-black text-slate-800 tracking-tighter text-right leading-none">CENTRAL<span className="text-slate-400 font-light text-2xl">GROUP</span></div>
                        <div className="h-0.5 w-full bg-slate-800 mt-1"></div>
                    </div>
                </div>

                <ActiveFilterChips groups={[
                    { label: "Position", values: filters.position_jr, onRemove: v => toggleFilter('position_jr', v) },
                    { label: "Business Unit", values: filters.bu, onRemove: v => toggleFilter('bu', v) },
                    { label: "Sub BU", values: filters.sub_bu, onRemove: v => toggleFilter('sub_bu', v) },
                    { label: "Status", values: filters.status, onRemove: v => toggleFilter('status', v) },
                ]} />
            </div>

            {/* Dashboard Content */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                {/* Scorecards and Funnel */}
                <div className="col-span-12 lg:col-span-4 flex flex-col gap-8">
                    {/* Scorecards */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-slate-900 border-2 border-slate-800 rounded-[2rem] p-6 flex flex-col items-center justify-center relative overflow-hidden h-[160px] shadow-xl">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1 z-10">Job Requisitions</span>
                            <span className="text-5xl font-black text-white z-10 tabular-nums">{loading ? "..." : stats?.totalJRs}</span>
                            <Briefcase className="absolute -right-4 -bottom-4 w-24 h-24 text-white/5 -rotate-12" />
                        </div>
                        <div className="bg-blue-600 border-2 border-blue-500 rounded-[2rem] p-6 flex flex-col items-center justify-center relative overflow-hidden h-[160px] shadow-xl">
                            <span className="text-[10px] font-black text-blue-200 uppercase tracking-[0.2em] mb-1 z-10">Total Candidates</span>
                            <span className="text-5xl font-black text-white z-10 tabular-nums">{loading ? "..." : stats?.totalCandidates}</span>
                            <Users className="absolute -right-4 -bottom-4 w-24 h-24 text-white/10 -rotate-12" />
                        </div>
                    </div>

                    <div className="flex-1 flex flex-col">
                        <div className="text-[12px] font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2 px-2">
                            <div className="w-2 h-4 bg-primary rounded-full shadow-sm shadow-primary/50" />
                            Candidate Funnel
                        </div>
                        <div className="border-2 rounded-[2.5rem] border-slate-100 p-8 flex-1 flex flex-col gap-6 bg-white shadow-xl shadow-slate-200/50 max-h-[600px] overflow-y-auto scrollbar-thin">
                            {stats?.funnelData.length === 0 && !loading && <div className="text-center text-slate-300 py-32 font-bold uppercase tracking-widest">Empty Funnel</div>}
                            {stats?.funnelData.map((d, i) => (
                                <div key={i} className="flex items-center text-[10px] relative h-12 group">
                                    <div className="w-[160px] text-right pr-5 z-10 shrink-0">
                                        <span className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-1.5 rounded-xl shadow-sm font-bold truncate block uppercase tracking-tighter text-[9px] group-hover:bg-amber-100 transition-colors">
                                            {d.status} ({d.count})
                                        </span>
                                    </div>
                                    <div className="flex-1 flex items-center justify-start relative">
                                        <div
                                            className="h-8 border border-blue-500 shadow-lg shadow-blue-500/20 transition-all duration-1000 rounded-lg relative overflow-hidden"
                                            style={{
                                                width: `${stats?.funnelData && stats.funnelData.length > 0 ? (d.count / Math.max(...stats.funnelData.map(f => f.count), 1)) * 100 : 0}%`,
                                                backgroundColor: BLUE,
                                                minWidth: d.count > 0 ? '6px' : '0px'
                                            }}
                                        >
                                            <div className="absolute top-0 left-0 w-full h-[35%] bg-white/25" />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Vertical Charts Section */}
                <div className="col-span-12 lg:col-span-8 flex flex-col gap-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 h-[400px]">
                        {/* Candidates by Country (Vertical) */}
                        <Card className="h-full border-2 rounded-[2.5rem] shadow-xl shadow-slate-200/50 bg-white overflow-hidden border-slate-50">
                            <CardContent className="p-8 h-full flex flex-col">
                                <div className="text-[12px] font-black text-slate-800 uppercase tracking-widest mb-8 flex items-center gap-2">
                                    <Globe className="w-5 h-5 text-emerald-500" />
                                    Candidates by Country
                                </div>
                                <div className="flex-1 min-h-0">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={stats?.countryData || []} margin={{ top: 10, right: 10, left: -20, bottom: 40 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                            <XAxis
                                                dataKey="country"
                                                fontSize={10}
                                                axisLine={false}
                                                tickLine={false}
                                                tick={{ fill: '#64748b', fontWeight: 'bold' }}
                                                angle={-45}
                                                textAnchor="end"
                                                interval={0}
                                            />
                                            <YAxis axisLine={false} tickLine={false} fontSize={10} tick={{ fill: '#94a3b8' }} />
                                            <Bar dataKey="count" fill="#10b981" radius={[8, 8, 0, 0]} barSize={24}>
                                                {stats?.countryData.map((entry, index) => <Cell key={index} fill={index % 2 === 0 ? "#10b981" : "#34d399"} />)}
                                            </Bar>
                                            <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </CardContent>
                        </Card>

                        {/* JR_ID by BU (Vertical) */}
                        <Card className="h-full border-2 rounded-[2.5rem] shadow-xl shadow-slate-200/50 bg-white overflow-hidden border-slate-50">
                            <CardContent className="p-8 h-full flex flex-col">
                                <div className="text-[12px] font-black text-slate-800 uppercase tracking-widest mb-8 flex items-center gap-2">
                                    <Building2 className="w-5 h-5 text-indigo-500" />
                                    JR by Business Unit
                                </div>
                                <div className="flex-1 min-h-0">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={stats?.buData || []} margin={{ top: 10, right: 10, left: -20, bottom: 40 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                            <XAxis
                                                dataKey="bu"
                                                fontSize={10}
                                                axisLine={false}
                                                tickLine={false}
                                                tick={{ fill: '#64748b', fontWeight: 'bold' }}
                                                angle={-45}
                                                textAnchor="end"
                                                interval={0}
                                            />
                                            <YAxis axisLine={false} tickLine={false} fontSize={10} tick={{ fill: '#94a3b8' }} />
                                            <Bar dataKey="count" fill="#6366f1" radius={[8, 8, 0, 0]} barSize={24} />
                                            <Tooltip cursor={{ fill: '#f8fafc' }} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Candidate by Industry (Vertical) */}
                    <Card className="flex-1 border-2 rounded-[2.5rem] shadow-xl shadow-slate-200/50 bg-white overflow-hidden border-slate-50 min-h-[450px]">
                        <CardContent className="p-10 flex flex-col h-full">
                            <div className="text-[12px] font-black text-slate-800 uppercase tracking-widest mb-8 flex items-center gap-2">
                                <BarChart3 className="w-5 h-5 text-amber-500" />
                                Candidate by Industry
                            </div>
                            <div className="flex-1 min-h-0">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={stats?.industryData || []} margin={{ top: 10, right: 10, left: -20, bottom: 80 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis
                                            dataKey="industry"
                                            fontSize={8}
                                            axisLine={false}
                                            tickLine={false}
                                            tick={({ x, y, payload }: any) => (
                                                <text x={x} y={y} dy={16} textAnchor="end" fill="#64748b" fontWeight="bold" fontSize={8} transform={`rotate(-45, ${x}, ${y})`}>
                                                    {payload.value.length > 25 ? payload.value.substring(0, 22) + '...' : payload.value}
                                                </text>
                                            )}
                                            interval={0}
                                        />
                                        <YAxis axisLine={false} tickLine={false} fontSize={10} tick={{ fill: '#94a3b8' }} />
                                        <Bar dataKey="count" fill="#3b82f6" radius={[10, 10, 0, 0]} barSize={32}>
                                            {stats?.industryData.map((d, i) => <Cell key={i} fill={BLUE} />)}
                                        </Bar>
                                        <Tooltip cursor={{ fill: '#f8fafc' }} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                    </Card>
                </div>

            </div>

            {/* Footer */}
            <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold uppercase tracking-[0.3em] border-t border-slate-100 pt-10 px-4">
                <div className="flex items-center gap-10">
                    <span className="flex items-center gap-2"><div className="w-2 h-2 bg-slate-300 rounded-full" /> CENTRAL GROUP ATS</span>
                    <span className="flex items-center gap-2"><div className="w-2 h-2 bg-slate-200 rounded-full" /> DATA ANALYTICS V2.0</span>
                </div>
                <div className="flex items-center gap-4 bg-white/80 backdrop-blur-md px-6 py-3 rounded-2xl border border-slate-100 shadow-xl shadow-slate-200/50">
                    <span className="flex items-center gap-2 text-slate-500"><Clock className="w-4 h-4 text-primary" /> Last Updated: {new Date().toLocaleTimeString()}</span>
                </div>
            </div>
        </div>
    );
}
