"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RefreshCw, MapPin, Building, Calendar, AlertTriangle, Search, ExternalLink, ArrowUpDown, ArrowUp, ArrowDown, Briefcase, Layers } from "lucide-react";
import { getPendingJRs, refreshJRCandidates } from "@/app/actions/pending-tasks-actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { FilterMultiSelect } from "@/components/ui/filter-multi-select";

// Helper for formatting date as dd - Mmm - YYYY
function formatDate(dateString: string | null) {
    if (!dateString) return "N/A";
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    const day = String(d.getDate()).padStart(2, '0');
    const month = d.toLocaleString('en-US', { month: 'short' });
    const year = d.getFullYear();
    return `${day} - ${month} - ${year}`;
}

export default function JRMaintenanceBoard() {
    const [jrs, setJrs] = useState<any[]>([]);
    const [filteredJrs, setFilteredJrs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);
    const [selectedBUs, setSelectedBUs] = useState<string[]>([]);
    const [selectedSubBUs, setSelectedSubBUs] = useState<string[]>([]);
    const [selectedPositions, setSelectedPositions] = useState<string[]>([]);
    const [selectedAging, setSelectedAging] = useState<string[]>([]);

    const uniqueBUs = Array.from(new Set(jrs.map(jr => jr.bu).filter(Boolean))).sort() as string[];
    const uniqueSubBUs = Array.from(new Set(jrs.map(jr => jr.sub_bu).filter(Boolean))).sort() as string[];
    const uniquePositions = Array.from(new Set(jrs.map(jr => jr.position_jr).filter(Boolean))).sort() as string[];

    async function loadData() {
        setLoading(true);
        const res = await getPendingJRs();
        if (res.success) {
            setJrs(res.data);
            setFilteredJrs(res.data);
        } else {
            toast.error("Failed to load JR Maintenance Board");
        }
        setLoading(false);
    }

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        let filtered = jrs;

        if (selectedBUs.length > 0) {
            filtered = filtered.filter(jr => selectedBUs.includes(jr.bu));
        }

        if (selectedSubBUs.length > 0) {
            filtered = filtered.filter(jr => selectedSubBUs.includes(jr.sub_bu));
        }

        if (selectedPositions.length > 0) {
            filtered = filtered.filter(jr => selectedPositions.includes(jr.position_jr));
        }

        if (selectedAging.length > 0) {
            filtered = filtered.filter(jr => {
                const isOver6 = jr.agingMonths >= 6;
                if (selectedAging.includes("Over 6 Months") && isOver6) return true;
                if (selectedAging.includes("Under 6 Months") && !isOver6) return true;
                return false;
            });
        }

        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(jr => 
                (jr.jr_id?.toLowerCase() || "").includes(term) ||
                (jr.position_jr?.toLowerCase() || "").includes(term) ||
                (jr.bu?.toLowerCase() || "").includes(term) ||
                (jr.sub_bu?.toLowerCase() || "").includes(term)
            );
        }

        setFilteredJrs(filtered);
    }, [searchTerm, jrs, selectedBUs, selectedSubBUs, selectedPositions, selectedAging]);

    const toggleBU = (val: string) => {
        setSelectedBUs(prev => prev.includes(val) ? prev.filter(x => x !== val) : [...prev, val]);
    };

    const toggleSubBU = (val: string) => {
        setSelectedSubBUs(prev => prev.includes(val) ? prev.filter(x => x !== val) : [...prev, val]);
    };

    const togglePosition = (val: string) => {
        setSelectedPositions(prev => prev.includes(val) ? prev.filter(x => x !== val) : [...prev, val]);
    };

    const toggleAging = (val: string) => {
        setSelectedAging(prev => prev.includes(val) ? prev.filter(x => x !== val) : [...prev, val]);
    };

    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const sortedJrs = [...filteredJrs].sort((a, b) => {
        if (!sortConfig) return 0;
        const { key, direction } = sortConfig;
        
        let aVal = a[key];
        let bVal = b[key];
        
        // Handle dates
        if (key === 'agingStart') {
            aVal = new Date(aVal).getTime();
            bVal = new Date(bVal).getTime();
        }

        if (aVal < bVal) {
            return direction === 'asc' ? -1 : 1;
        }
        if (aVal > bVal) {
            return direction === 'asc' ? 1 : -1;
        }
        return 0;
    });

    const SortIcon = ({ columnKey }: { columnKey: string }) => {
        if (sortConfig?.key !== columnKey) return <ArrowUpDown className="ml-1 h-3 w-3 inline text-slate-400 opacity-50" />;
        return sortConfig.direction === 'asc' 
            ? <ArrowUp className="ml-1 h-3 w-3 inline text-indigo-600" /> 
            : <ArrowDown className="ml-1 h-3 w-3 inline text-indigo-600" />;
    };

    const handleRefresh = async (jrId: string) => {
        setRefreshing(jrId);
        toast.promise(refreshJRCandidates(jrId), {
            loading: "Triggering candidate refresh and updating aging...",
            success: (data) => {
                if (data.success) {
                    loadData(); // Reload to reflect new aging
                    return `Successfully refreshed ${data.count} candidates!`;
                }
                throw new Error(data.error);
            },
            error: (err) => `Failed to refresh: ${err.message}`,
            finally: () => setRefreshing(null)
        });
    };

    if (loading) {
        return (
            <Card className="border-none shadow-xl rounded-3xl bg-white overflow-hidden animate-pulse">
                <CardHeader>
                    <div className="h-6 w-1/3 bg-slate-200 rounded-lg mb-2"></div>
                    <div className="h-4 w-1/2 bg-slate-100 rounded-lg"></div>
                </CardHeader>
                <CardContent className="h-[400px]"></CardContent>
            </Card>
        );
    }

    return (
        <Card className="border-none shadow-xl rounded-3xl bg-white overflow-hidden">
            <CardHeader className="bg-slate-50 border-b border-slate-100 px-8 py-6 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                <div>
                    <CardTitle className="text-xl font-black tracking-tight text-slate-800">JR Maintenance Board</CardTitle>
                    <CardDescription className="text-xs font-medium text-slate-500 uppercase tracking-wider mt-1">
                        Manage active job requisitions and ensure candidate pools are fresh
                    </CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto mt-2 xl:mt-0">
                    <FilterMultiSelect
                        label="Position"
                        icon={Briefcase}
                        options={uniquePositions}
                        selected={selectedPositions}
                        onChange={togglePosition}
                    />
                    <FilterMultiSelect
                        label="Business Unit"
                        icon={Building}
                        options={uniqueBUs}
                        selected={selectedBUs}
                        onChange={toggleBU}
                    />
                    <FilterMultiSelect
                        label="Sub BU"
                        icon={Layers}
                        options={uniqueSubBUs}
                        selected={selectedSubBUs}
                        onChange={toggleSubBU}
                    />
                    <FilterMultiSelect
                        label="Aging"
                        icon={AlertTriangle}
                        options={["Over 6 Months", "Under 6 Months"]}
                        selected={selectedAging}
                        onChange={toggleAging}
                    />
                    <div className="relative w-full sm:w-64 shrink-0">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input 
                            placeholder="Search JR, Position, BU..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 bg-white border-slate-200 rounded-xl text-xs font-medium shadow-sm focus-visible:ring-indigo-500"
                        />
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <div className="max-h-[600px] overflow-auto scrollbar-thin relative z-0">
                    <table className="w-full text-left text-[11px] border-collapse">
                        <thead className="bg-slate-900 text-slate-100 sticky top-0 z-20 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1)] outline outline-1 outline-slate-900">
                            <tr>
                                <th className="p-4 font-black uppercase tracking-widest min-w-[120px] cursor-pointer hover:bg-slate-800 transition-colors" onClick={() => handleSort('jr_id')}>
                                    JR Number <SortIcon columnKey="jr_id" />
                                </th>
                                <th className="p-4 font-black uppercase tracking-widest min-w-[200px] cursor-pointer hover:bg-slate-800 transition-colors" onClick={() => handleSort('position_jr')}>
                                    Position <SortIcon columnKey="position_jr" />
                                </th>
                                <th className="p-4 font-black uppercase tracking-widest cursor-pointer hover:bg-slate-800 transition-colors" onClick={() => handleSort('bu')}>
                                    Business Unit <SortIcon columnKey="bu" />
                                </th>
                                <th className="p-4 font-black uppercase tracking-widest text-center cursor-pointer hover:bg-slate-800 transition-colors" onClick={() => handleSort('agingStart')}>
                                    Last Active <SortIcon columnKey="agingStart" />
                                </th>
                                <th className="p-4 font-black uppercase tracking-widest text-center cursor-pointer hover:bg-slate-800 transition-colors" onClick={() => handleSort('agingMonths')}>
                                    Aging <SortIcon columnKey="agingMonths" />
                                </th>
                                <th className="p-4 font-black uppercase tracking-widest text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {sortedJrs.map((jr) => {
                                const isStale = jr.agingMonths >= 6;
                                return (
                                    <tr key={jr.jr_id} className="hover:bg-slate-50 transition-colors group">
                                        <td className="p-4">
                                            <Link 
                                                href={`/requisitions/manage?jr_id=${jr.jr_id}`}
                                                className="inline-flex items-center gap-1.5 font-black text-indigo-600 hover:text-indigo-800 transition-colors hover:underline"
                                            >
                                                {jr.jr_id}
                                                <ExternalLink className="h-3 w-3 opacity-50" />
                                            </Link>
                                        </td>
                                        <td className="p-4">
                                            <div className="font-bold text-slate-800 text-sm leading-tight">{jr.position_jr}</div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-1.5 font-bold text-slate-700">
                                                <Building className="h-3.5 w-3.5 text-slate-400" />
                                                {jr.bu}
                                            </div>
                                            <div className="flex items-center gap-1.5 text-slate-500 mt-1 uppercase tracking-tighter">
                                                <MapPin className="h-3 w-3 opacity-50" />
                                                {jr.sub_bu}
                                            </div>
                                        </td>
                                        <td className="p-4 text-center">
                                            <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-100 rounded-full font-bold text-slate-600">
                                                <Calendar className="h-3 w-3" />
                                                {formatDate(jr.agingStart)}
                                            </div>
                                        </td>
                                        <td className="p-4 text-center">
                                            {isStale ? (
                                                <div className="inline-flex items-center gap-1.5 text-white bg-red-600 border border-red-700 px-3 py-1 rounded-full font-black shadow-md">
                                                    <AlertTriangle className="h-4 w-4 animate-pulse drop-shadow-sm" />
                                                    {jr.agingMonths} Months
                                                </div>
                                            ) : (
                                                <span className="text-slate-400 font-bold">
                                                    {jr.agingMonths > 0 ? `${jr.agingMonths} Months` : '-'}
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-4 text-right">
                                            <Button
                                                onClick={() => handleRefresh(jr.jr_id)}
                                                disabled={refreshing === jr.jr_id}
                                                size="sm"
                                                variant="outline"
                                                className={cn(
                                                    "gap-2 font-bold uppercase tracking-widest text-[10px]",
                                                    isStale ? "border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700" : ""
                                                )}
                                            >
                                                <RefreshCw className={cn("h-3.5 w-3.5", refreshing === jr.jr_id && "animate-spin")} />
                                                {refreshing === jr.jr_id ? "Refreshing..." : "Refresh Candidates"}
                                            </Button>
                                        </td>
                                    </tr>
                                );
                            })}
                            {filteredJrs.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="p-12 text-center text-slate-400 font-bold uppercase tracking-widest">
                                        {searchTerm ? "No results match your search" : "No pending job requisitions found"}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </CardContent>
        </Card>
    );
}
