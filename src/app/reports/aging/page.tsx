"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, RefreshCw, Search } from "lucide-react";
import { getAgingStats, deleteCandidates, refreshCandidate, getUnusedStats, getUnusedCandidates } from "@/app/actions/report-actions";
import { AgingStatsChart } from "@/components/reports/AgingStatsChart";
import { AgingCandidateTable } from "@/components/reports/AgingCandidateTable";
import { ReportCandidateTable } from "@/components/reports/ReportCandidateTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/lib/notifications";

export default function DataQualityPage() {
    const [activeTab, setActiveTab] = useState("aging");

    return (
        <div className="container mx-auto py-8">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800">Data Quality Dashboard</h1>
                    <p className="text-slate-500">Analyze data freshness and clean up unused profiles.</p>
                </div>
            </div>

            <Tabs defaultValue="aging" value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                <TabsList>
                    <TabsTrigger value="aging">Data Aging Analysis</TabsTrigger>
                    <TabsTrigger value="usage">Unused Profiles</TabsTrigger>
                </TabsList>

                <TabsContent value="aging" className="space-y-4">
                    <AgingReportView />
                </TabsContent>

                <TabsContent value="usage" className="space-y-4">
                    <UsageReportView />
                </TabsContent>
            </Tabs>
        </div>
    );
}

// --- SUB-COMPONENTS ---

function AgingReportView() {
    const [stats, setStats] = useState<any>(null);
    const [candidates, setCandidates] = useState<any[]>([]);
    const [loadingStats, setLoadingStats] = useState(true);
    const [loadingList, setLoadingList] = useState(true);

    const [activeGroup, setActiveGroup] = useState<'fresh' | '1-3m' | '4-6m' | '6m+'>('6m+');
    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [totalCount, setTotalCount] = useState(0);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    const loadData = async () => {
        setLoadingStats(true);
        const s = await getAgingStats();
        setStats(s);
        setLoadingStats(false);
    };

    const fetchList = async () => {
        setLoadingList(true);
        try {
            const res = await fetch('/api/candidates/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    filters: { agingGroup: activeGroup },
                    search: searchTerm,
                    page: currentPage,
                    pageSize: pageSize
                })
            });
            const result = await res.json();
            setCandidates(result.data || []);
            setTotalCount(result.total || 0);
        } finally {
            setLoadingList(false);
        }
    };

    useEffect(() => { loadData(); }, []);

    useEffect(() => {
        setCurrentPage(1);
        setSelectedIds([]);
    }, [activeGroup, searchTerm]);

    useEffect(() => {
        const t = setTimeout(fetchList, 300);
        return () => clearTimeout(t);
    }, [activeGroup, searchTerm, currentPage, pageSize]);

    // Actions
    const handleDelete = async () => {
        if (!confirm(`Delete ${selectedIds.length} candidates?`)) return;
        const res = await deleteCandidates(selectedIds);
        if (res.success) {
            toast.success("Deleted successfully");
            setSelectedIds([]);
            loadData();
            fetchList();
        } else {
            toast.error(res.error);
        }
    };

    const handleRefresh = async () => {
        if (!confirm(`Refresh ${selectedIds.length} candidates?`)) return;
        let count = 0;
        for (const id of selectedIds) {
            const c = candidates.find(x => x.candidate_id === id);
            if (c?.linkedin) {
                await refreshCandidate(id, c.name || c.candidate_name, c.linkedin);
                count++;
            }
        }
        toast.success(`Queued ${count} refreshes`);
        setSelectedIds([]);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold tracking-tight">Data Aging Overview</h2>
                <Button variant="outline" size="sm" onClick={() => { loadData(); fetchList(); }}>
                    <RefreshCw className="h-4 w-4 mr-2" /> Refresh
                </Button>
            </div>

            {stats && (
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <SummaryCard title="Total Candidates" value={stats.total} />
                    <SummaryCard title="Fresh (< 1 Mo)" value={stats.fresh} color="text-emerald-600" isActive={activeGroup === 'fresh'} onClick={() => setActiveGroup('fresh')} />
                    <SummaryCard title="1-3 Months" value={stats.months1to3} color="text-yellow-600" isActive={activeGroup === '1-3m'} onClick={() => setActiveGroup('1-3m')} />
                    <SummaryCard title="4-6 Months" value={stats.months4to6} color="text-orange-600" isActive={activeGroup === '4-6m'} onClick={() => setActiveGroup('4-6m')} />
                    <SummaryCard title="6+ Months" value={stats.months6plus} color="text-red-600" isActive={activeGroup === '6m+'} onClick={() => setActiveGroup('6m+')} />
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div className="lg:col-span-1">
                    <Card>
                        <CardHeader><CardTitle>Distribution</CardTitle></CardHeader>
                        <CardContent className="h-[300px] flex items-center justify-center">
                            {stats && <AgingStatsChart stats={stats} />}
                        </CardContent>
                    </Card>
                </div>
                <div className="lg:col-span-3 space-y-4">
                    <div className="flex justify-between items-center bg-white p-3 rounded-lg border shadow-sm">
                        <div className="flex items-center gap-2 font-bold text-sm text-slate-700">
                            <span>{getGroupLabel(activeGroup)}</span>
                            <span className="bg-slate-100 px-2 py-0.5 rounded-full text-xs text-slate-500">{totalCount} Found</span>
                        </div>
                        <div className="relative w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input className="pl-9 h-9 text-xs" placeholder="Search..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                        </div>
                    </div>

                    <AgingCandidateTable
                        candidates={candidates}
                        loading={loadingList}
                        selectedIds={selectedIds}
                        onSelectAll={(checked) => setSelectedIds(checked ? candidates.map(c => c.candidate_id) : [])}
                        onSelectOne={(id, checked) => setSelectedIds(prev => checked ? [...prev, id] : prev.filter(x => x !== id))}
                        onDelete={handleDelete}
                        onRefresh={handleRefresh}
                    />

                    <PaginationControls
                        page={currentPage}
                        pageSize={pageSize}
                        total={totalCount}
                        onPageChange={setCurrentPage}
                        onPageSizeChange={setPageSize}
                    />
                </div>
            </div>
        </div>
    );
}

function UsageReportView() {
    const [stats, setStats] = useState<any>(null);
    const [candidates, setCandidates] = useState<any[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [totalCount, setTotalCount] = useState(0);
    const [searchTerm, setSearchTerm] = useState("");

    const refreshMsg = () => {
        loadStats();
        fetchCandidates();
    };

    const loadStats = async () => {
        const s = await getUnusedStats();
        setStats(s);
    };

    const fetchCandidates = async () => {
        const res = await getUnusedCandidates(currentPage, pageSize, searchTerm);
        setCandidates(res.data);
        setTotalCount(res.total);
    };

    useEffect(() => { loadStats(); }, []);
    useEffect(() => {
        const t = setTimeout(fetchCandidates, 300);
        return () => clearTimeout(t);
    }, [currentPage, pageSize, searchTerm]);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold tracking-tight">Unused Candidates (No Job Assigned)</h2>
                <Button variant="outline" size="sm" onClick={refreshMsg}>
                    <RefreshCw className="h-4 w-4 mr-2" /> Refresh
                </Button>
            </div>

            {stats && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <SummaryCard title="Total Candidates" value={stats.total} />
                    <SummaryCard title="Used (In Jobs)" value={stats.used} color="text-indigo-600" />
                    <SummaryCard title="Unused (Orphaned)" value={stats.unused} color="text-rose-600" isHighlight />
                </div>
            )}

            <div className="space-y-4">
                <div className="flex justify-between items-center bg-white p-3 rounded-lg border shadow-sm">
                    <span className="font-bold text-sm text-slate-700">Unused Profiles List</span>
                    <div className="relative w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input className="pl-9 h-9 text-xs" placeholder="Search unused..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                    </div>
                </div>

                <ReportCandidateTable
                    title="Unused Candidates"
                    candidates={candidates}
                    onDataChanged={refreshMsg}
                    // Search is handled externally by parent (searchTerm state) via displayCandidates logic or just re-fetching
                    // The generic ReportCandidateTable supports display logic. 
                    // However, we are doing SERVER SIDE search here.
                    // The ReportCandidateTable I modified supports search prop? Yes.
                    // But actually we want it to just display our 'candidates' list which IS already filtered server-side.
                    // We don't need to pass search prop if we feed it correct data.
                    // BUT ReportCandidateTable has internal filter logic by default.
                    // I updated it to use `displayCandidates = onSearch ? candidates : ...`
                    // So if I pass onSearch prop, it uses raw data.
                    search={searchTerm}
                    onSearch={setSearchTerm} // Pass setter to use "Controlled Mode"
                />

                <PaginationControls
                    page={currentPage}
                    pageSize={pageSize}
                    total={totalCount}
                    onPageChange={setCurrentPage}
                    onPageSizeChange={setPageSize}
                />
            </div>
        </div>
    );
}

// --- HELPERS ---

function SummaryCard({ title, value, color, isActive, isHighlight, onClick }: any) {
    return (
        <Card
            className={`cursor-pointer transition-all hover:border-slate-400 hover:shadow-md 
                ${isActive ? 'ring-2 ring-primary border-primary' : ''}
                ${isHighlight ? 'border-rose-200 bg-rose-50/50' : ''}
            `}
            onClick={onClick}
        >
            <CardHeader className="pb-2"><CardTitle className={`text-sm font-medium ${color}`}>{title}</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold">{value}</div></CardContent>
        </Card>
    );
}

function PaginationControls({ page, pageSize, total, onPageChange, onPageSizeChange }: any) {
    return (
        <div className="flex items-center justify-end gap-2 text-sm text-slate-500">
            <span>Rows per page:</span>
            <select className="border rounded p-1 text-xs" value={pageSize} onChange={(e) => onPageSizeChange(Number(e.target.value))}>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
            </select>
            <div className="flex gap-1">
                <Button size="sm" variant="outline" disabled={page === 1} onClick={() => onPageChange(page - 1)}>Prev</Button>
                <span className="flex items-center px-2">Page {page} of {Math.ceil(total / pageSize) || 1}</span>
                <Button size="sm" variant="outline" disabled={page * pageSize >= total} onClick={() => onPageChange(page + 1)}>Next</Button>
            </div>
        </div>
    );
}

function getGroupLabel(group: string) {
    if (group === 'fresh') return 'Fresh (< 1 Mo)';
    if (group === '1-3m') return '1-3 Months';
    if (group === '4-6m') return '4-6 Months';
    if (group === '6m+') return '6+ Months';
    return group;
}
