"use client";

import { useEffect, useState, useMemo } from "react";
import { getJobRequisitions, getAllCandidatesSummary, getAgingSummary, getUserProfiles } from "@/app/actions/requisitions";
import { JobRequisition } from "@/types/requisition";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Users, Clock, Briefcase, Filter, TrendingUp, ArrowUpDown, Copy, MoreHorizontal, FileText, CheckSquare, Square } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import { FilterMultiSelect } from "@/components/ui/filter-multi-select";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { CreateJobRequisitionForm } from "@/components/create-jr-form";
import { AtsBreadcrumb } from "@/components/ats-breadcrumb";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { CopyJRDialog } from "@/components/copy-jr-dialog";
import { useRouter } from "next/navigation";

export default function RequisitionsPage() {
    const router = useRouter();
    const [jrs, setJrs] = useState<JobRequisition[]>([]);

    // Data for Client-Side Aggregation
    const [allCandidates, setAllCandidates] = useState<{ jr_id: string; status: string }[]>([]);
    const [avgAging, setAvgAging] = useState<number>(0);
    const [userProfiles, setUserProfiles] = useState<Record<string, string>>({}); // email -> real_name

    const [loading, setLoading] = useState(true);
    const [isCreateOpen, setIsCreateOpen] = useState(false);

    // Copy Dialog State
    const [copyDialogOpen, setCopyDialogOpen] = useState(false);
    const [jrToCopy, setJrToCopy] = useState<JobRequisition | null>(null);

    // Filters
    const [search, setSearch] = useState("");
    const [filterBu, setFilterBu] = useState<string[]>([]);
    const [filterSubBu, setFilterSubBu] = useState<string[]>([]);
    const [filterPosition, setFilterPosition] = useState<string[]>([]);
    const [filterJrType, setFilterJrType] = useState<string[]>([]);
    const [filterIsActive, setFilterIsActive] = useState<string[]>([]);
    const [filterCreatedBy, setFilterCreatedBy] = useState<string[]>([]); // New Filter

    // Selection
    const [selectedJrIds, setSelectedJrIds] = useState<Set<string>>(new Set());

    // Sorting
    const [sortConfig, setSortConfig] = useState<{ key: keyof JobRequisition; direction: 'asc' | 'desc' } | null>({ key: 'id', direction: 'desc' });

    useEffect(() => {
        async function load() {
            setLoading(true);
            try {
                // Fetch Data needed for Client-Side Aggregation
                const [dJrs, dCandidates, dAging, dProfiles] = await Promise.all([
                    getJobRequisitions(),
                    getAllCandidatesSummary(),
                    getAgingSummary(),
                    getUserProfiles()
                ]);
                setJrs(dJrs);
                setAllCandidates(dCandidates);
                setAvgAging(dAging);

                // Map profiles
                const profileMap: Record<string, string> = {};
                dProfiles.forEach(p => {
                    if (p.email) profileMap[p.email] = p.real_name || p.email;
                });
                setUserProfiles(profileMap);

            } catch (error) {
                console.error("Failed to load JRs", error);
            }
            setLoading(false);
        }
        load();
    }, []);

    // --- Helper: Toggle ---
    const toggle = (current: string[], value: string, setter: (val: string[]) => void) => {
        if (current.includes(value)) {
            setter(current.filter(c => c !== value));
        } else {
            setter([...current, value]);
        }
    };

    const toggleSelection = (id: string) => {
        const newSet = new Set(selectedJrIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedJrIds(newSet);
    };

    const toggleAllSelection = () => {
        if (selectedJrIds.size === filteredJrs.length) {
            setSelectedJrIds(new Set());
        } else {
            setSelectedJrIds(new Set(filteredJrs.map(j => j.id)));
        }
    };

    // Filter Logic
    const filteredJrs = useMemo(() => {
        return jrs.filter(jr => {
            const mSearch = !search || jr.id.toLowerCase().includes(search.toLowerCase());
            const mPosition = filterPosition.length === 0 || filterPosition.includes(jr.job_title);
            const mBu = filterBu.length === 0 || filterBu.includes(jr.division);
            const mSubBu = filterSubBu.length === 0 || filterSubBu.includes(jr.department);
            const mType = filterJrType.length === 0 || filterJrType.includes(jr.jr_type || 'New');
            const mActive = filterIsActive.length === 0 || filterIsActive.includes(jr.is_active ? 'Active' : 'Inactive');

            // Creator Filter
            // jr.created_by is email. We filter by Real Name if possible.
            // filterCreatedBy contains Real Names (from options).
            const creatorName = userProfiles[jr.created_by || ""] || jr.created_by || "System";
            const mCreator = filterCreatedBy.length === 0 || filterCreatedBy.includes(creatorName);

            return mSearch && mPosition && mBu && mSubBu && mType && mActive && mCreator;
        });
    }, [jrs, search, filterPosition, filterBu, filterSubBu, filterJrType, filterIsActive, filterCreatedBy, userProfiles]);

    // Sorting Logic
    const sortedJrs = useMemo(() => {
        const sorted = [...filteredJrs].sort((a, b) => {
            if (!sortConfig) return 0;
            const { key, direction } = sortConfig;

            let valA = a[key] as any;
            let valB = b[key] as any;

            if (key === 'id') {
                const numA = parseInt(valA.replace('JR', ''), 10);
                const numB = parseInt(valB.replace('JR', ''), 10);
                if (!isNaN(numA) && !isNaN(numB)) {
                    return direction === 'asc' ? numA - numB : numB - numA;
                }
            }

            if (typeof valA === 'string') valA = valA.toLowerCase();
            if (typeof valB === 'string') valB = valB.toLowerCase();

            if (valA < valB) return direction === 'asc' ? -1 : 1;
            if (valA > valB) return direction === 'asc' ? 1 : -1;
            return 0;
        });
        return sorted;
    }, [filteredJrs, sortConfig]);

    const requestSort = (key: keyof JobRequisition) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    // --- Dynamic Stats Computation ---
    const stats = useMemo(() => {
        // 1. Identify IDs of Target JRs (Selected OR Filtered)
        const targetJrs = selectedJrIds.size > 0
            ? jrs.filter(j => selectedJrIds.has(j.id))
            : filteredJrs;

        const targetJrIds = new Set(targetJrs.map(j => j.id));

        // 2. Filter Candidates based on JRs
        const relevantCandidates = allCandidates.filter(c => targetJrIds.has(c.jr_id));

        // 3. Status Grouping
        const statusCounts: Record<string, number> = {};
        relevantCandidates.forEach(c => {
            const s = c.status || "Pool Candidate";
            statusCounts[s] = (statusCounts[s] || 0) + 1;
        });
        const candidatesByStatus = Object.keys(statusCounts).map(k => ({ status: k, count: statusCounts[k] }));

        // 4. Real Aging Calculation
        // Formula: For each candidate, find time diff between status changes.
        const stageTotals: Record<string, { totalDays: number; count: number }> = {};
        const now = new Date();

        relevantCandidates.forEach(cand => {
            const logs = [...(cand as any).logs || []].sort((a, b) => a.log_id - b.log_id);
            if (logs.length === 0) return;

            for (let i = 0; i < logs.length; i++) {
                const currentLog = logs[i];
                const nextLog = logs[i + 1];

                const startTime = new Date(currentLog.timestamp);
                const endTime = nextLog ? new Date(nextLog.timestamp) : now;

                if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) continue;

                const diffDays = Math.max(0, (endTime.getTime() - startTime.getTime()) / (1000 * 3600 * 24));
                const stage = currentLog.status || "Unk";

                if (!stageTotals[stage]) stageTotals[stage] = { totalDays: 0, count: 0 };
                stageTotals[stage].totalDays += diffDays;
                stageTotals[stage].count += 1;
            }
        });

        // Map to Chart Format (Limit to top stages if needed, or sort logically)
        const logicalStages = ["Pool Candidate", "Screening", "Interview", "Offer", "Hired", "Rejected"];
        const agingByStage = logicalStages.map(stage => ({
            stage: stage.replace(" Candidate", ""), // Shorten label
            days: stageTotals[stage] ? Math.round(stageTotals[stage].totalDays / stageTotals[stage].count) : 0
        })).filter(s => s.days > 0 || statusCounts[s.stage + " Candidate"]); // Show if there's data

        return {
            total_jrs: targetJrs.length,
            active_jrs: targetJrs.filter(j => j.is_active).length,
            total_candidates: relevantCandidates.length,
            avg_aging_days: avgAging,
            candidates_by_status: candidatesByStatus,
            aging_by_stage: agingByStage.length > 0 ? agingByStage : [
                { stage: 'Pool', days: 0 },
                { stage: 'Screen', days: 0 },
                { stage: 'Interview', days: 0 },
                { stage: 'Offer', days: 0 },
            ]
        };
    }, [filteredJrs, selectedJrIds, allCandidates, avgAging, jrs]);


    // Unique Options
    const optPosition = Array.from(new Set(jrs.map(j => j.job_title))).sort();
    const optBu = Array.from(new Set(jrs.map(j => j.division))).sort();
    const optSubBu = Array.from(new Set(jrs.map(j => j.department))).sort();
    const optJrType = ["New", "Replacement"];
    const optIsActive = ["Active", "Inactive"];
    const optCreatedBy = Array.from(new Set(jrs.map(j => userProfiles[j.created_by || ""] || j.created_by || "System"))).sort();

    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

    // Handle Copy
    const handleCopyClick = (jr: JobRequisition) => {
        setJrToCopy(jr);
        setCopyDialogOpen(true);
    };

    return (
        <div className="container mx-auto p-6 space-y-8 min-h-screen bg-slate-50/50">
            <AtsBreadcrumb
                items={[
                    { label: 'Job Requisition Menu', href: '/requisitions' },
                    { label: 'Table' }
                ]}
            />
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">Job Requisition Table</h1>
                    <p className="text-slate-500 mt-1">
                        Overview of all requisitions and their pipeline status.
                        {selectedJrIds.size > 0 && <span className="ml-2 font-medium text-blue-600">(Analyzing {selectedJrIds.size} selected items)</span>}
                    </p>
                </div>
                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                    <DialogTrigger asChild>
                        <Button>
                            <Plus className="mr-2 h-4 w-4" /> Create New JR
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                        <div className="text-center mb-6">
                            <h2 className="text-2xl font-bold">Create New Requisition</h2>
                            <p className="text-muted-foreground">Drafting a new job requisition. ID will be generated automatically.</p>
                        </div>
                        <CreateJobRequisitionForm
                            onCancel={() => setIsCreateOpen(false)}
                            onSuccess={(newJR) => {
                                setIsCreateOpen(false);
                                setJrs(prev => [newJR, ...prev]);
                            }}
                        />
                    </DialogContent>
                </Dialog>
            </div>

            {/* --- DASHBOARD SECTION --- */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <SummaryCard title="Total Requisitions" value={stats.total_jrs} icon={Briefcase} color="text-blue-600" />
                <SummaryCard title="Active Openings" value={stats.active_jrs} icon={TrendingUp} color="text-green-600" />
                <SummaryCard title="Total Candidates" value={stats.total_candidates} icon={Users} color="text-purple-600" />
                <SummaryCard title="Avg Aging (Days)" value={stats.avg_aging_days} icon={Clock} color="text-orange-600" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[400px]">
                <Card>
                    <CardHeader>
                        <CardTitle>Candidates by Status</CardTitle>
                        <CardDescription>Volume across {selectedJrIds.size > 0 ? 'selected' : 'active (filtered)'} pipelines</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.candidates_by_status} layout="vertical" margin={{ left: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                <XAxis type="number" hide />
                                <YAxis dataKey="status" type="category" width={100} tick={{ fontSize: 11 }} />
                                <Tooltip cursor={{ fill: 'transparent' }} />
                                <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]}>
                                    {stats.candidates_by_status.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Aging Analysis</CardTitle>
                        <CardDescription>Average days candidates spend in each stage</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.aging_by_stage}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="stage" tick={{ fontSize: 12 }} />
                                <YAxis />
                                <Tooltip />
                                <Bar dataKey="days" fill="#f97316" radius={[4, 4, 0, 0]} barSize={50} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            {/* --- LIST SECTION --- */}
            <Card>
                <CardHeader>
                    <div className="space-y-4">
                        <CardTitle>Requisition List</CardTitle>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2">
                            <div className="relative">
                                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search JR ID..."
                                    className="pl-8 w-full"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                            </div>
                            <FilterMultiSelect
                                label="Position"
                                options={optPosition}
                                selected={filterPosition}
                                onChange={(v: string) => toggle(filterPosition, v, setFilterPosition)}
                                icon={Briefcase}
                            />
                            <FilterMultiSelect
                                label="Business Unit"
                                options={optBu}
                                selected={filterBu}
                                onChange={(v: string) => toggle(filterBu, v, setFilterBu)}
                                icon={Briefcase}
                            />
                            <FilterMultiSelect
                                label="Sub BU"
                                options={optSubBu}
                                selected={filterSubBu}
                                onChange={(v: string) => toggle(filterSubBu, v, setFilterSubBu)}
                                icon={Briefcase}
                            />
                            {/* Created By Filter */}
                            <FilterMultiSelect
                                label="Created By"
                                options={optCreatedBy}
                                selected={filterCreatedBy}
                                onChange={(v: string) => toggle(filterCreatedBy, v, setFilterCreatedBy)}
                                icon={Users}
                            />
                            <FilterMultiSelect
                                label="JR Type"
                                options={optJrType}
                                selected={filterJrType}
                                onChange={(v: string) => toggle(filterJrType, v, setFilterJrType)}
                                icon={FileText}
                            />
                            <FilterMultiSelect
                                label="Active?"
                                options={optIsActive}
                                selected={filterIsActive}
                                onChange={(v: string) => toggle(filterIsActive, v, setFilterIsActive)}
                                icon={TrendingUp}
                            />
                        </div>
                        {/* Clear Filters Button */}
                        {(filterPosition.length > 0 || filterBu.length > 0 || filterSubBu.length > 0 || filterJrType.length > 0 || filterIsActive.length > 0 || filterCreatedBy.length > 0) && (
                            <div className="flex justify-end">
                                <Button variant="ghost" size="sm" onClick={() => {
                                    setFilterPosition([]); setFilterBu([]); setFilterSubBu([]); setFilterJrType([]); setFilterIsActive([]); setFilterCreatedBy([]); setSearch("");
                                    setSelectedJrIds(new Set());
                                }} className="text-destructive h-8 px-2">
                                    Clear All Filters
                                </Button>
                            </div>
                        )}
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/50">
                                <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground w-[40px]">
                                        <Checkbox
                                            checked={selectedJrIds.size === filteredJrs.length && filteredJrs.length > 0}
                                            onCheckedChange={toggleAllSelection}
                                        />
                                    </th>
                                    <SortableHeader label="JR ID" sortKey="id" currentSort={sortConfig} onSort={requestSort} />
                                    <SortableHeader label="Position" sortKey="job_title" currentSort={sortConfig} onSort={requestSort} />
                                    <SortableHeader label="BU" sortKey="division" currentSort={sortConfig} onSort={requestSort} />
                                    <SortableHeader label="Sub BU" sortKey="department" currentSort={sortConfig} onSort={requestSort} />
                                    <SortableHeader label="Created By" sortKey="created_by" currentSort={sortConfig} onSort={requestSort} />
                                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Candidates</th>
                                    <SortableHeader label="Type" sortKey="jr_type" currentSort={sortConfig} onSort={requestSort} />
                                    <SortableHeader label="Active" sortKey="is_active" currentSort={sortConfig} onSort={requestSort} />
                                    <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={10} className="p-8 text-center text-muted-foreground">Loading requisitions...</td>
                                    </tr>
                                ) : sortedJrs.length === 0 ? (
                                    <tr>
                                        <td colSpan={10} className="p-8 text-center text-muted-foreground">No requisitions found matching filters.</td>
                                    </tr>
                                ) : (
                                    sortedJrs.map((jr) => (
                                        <tr key={jr.id} className="border-b transition-colors hover:bg-muted/50">
                                            <td className="p-4">
                                                <Checkbox
                                                    checked={selectedJrIds.has(jr.id)}
                                                    onCheckedChange={() => toggleSelection(jr.id)}
                                                />
                                            </td>
                                            <td className="p-4 font-mono font-medium">{jr.id}</td>
                                            <td className="p-4 font-semibold">{jr.job_title}</td>
                                            <td className="p-4 text-muted-foreground">{jr.division}</td>
                                            <td className="p-4 text-muted-foreground">{jr.department}</td>
                                            <td className="p-4 text-sm text-muted-foreground">
                                                {userProfiles[jr.created_by || ""] || jr.created_by || "-"}
                                            </td>
                                            <td className="p-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-blue-500"
                                                            style={{ width: `${Math.min((jr.headcount_hired / jr.headcount_total) * 100, 100)}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-[10px] text-muted-foreground">{jr.headcount_hired}/{jr.headcount_total}</span>
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <Badge variant="outline">{jr.jr_type || 'New'}</Badge>
                                            </td>
                                            <td className="p-4">
                                                <Badge variant={jr.is_active ? "default" : "secondary"} className={jr.is_active ? "bg-green-600 hover:bg-green-700" : ""}>
                                                    {jr.is_active ? 'Active' : 'Inactive'}
                                                </Badge>
                                            </td>
                                            <td className="p-4 text-right">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" className="h-8 w-8 p-0">
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem onClick={() => router.push(`/requisitions/manage?selected=${jr.id}`)}>
                                                            View Details
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => handleCopyClick(jr)}>
                                                            <Copy className="mr-2 h-4 w-4" /> Copy Job Requisition
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            {/* Copy Dialog */}
            {copyDialogOpen && jrToCopy && (
                <CopyJRDialog
                    open={copyDialogOpen}
                    onOpenChange={setCopyDialogOpen}
                    sourceJR={jrToCopy}
                    onSuccess={(newId) => {
                        // Refresh data
                        setLoading(true);
                        getJobRequisitions().then(d => {
                            setJrs(d);
                            setLoading(false);
                        });
                        // Trigger stats re-calc via state update
                    }}
                />
            )}
        </div>
    );
}

function SummaryCard({ title, value, icon: Icon, color }: any) {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
                <Icon className={`h-4 w-4 ${color}`} />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{value?.toLocaleString()}</div>
            </CardContent>
        </Card>
    );
}

function StatusBadge({ status }: { status: string }) {
    const styles: Record<string, string> = {
        'Open': 'bg-green-100 text-green-700 border-green-200',
        'Closed': 'bg-slate-100 text-slate-700 border-slate-200',
        'On Hold': 'bg-orange-100 text-orange-700 border-orange-200',
        'Draft': 'bg-gray-100 text-gray-500 border-gray-200',
    };
    return (
        <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${styles[status] || styles['Draft']}`}>
            {status}
        </span>
    );
}

function SortableHeader({ label, sortKey, currentSort, onSort }: any) {
    return (
        <th
            className="h-12 px-4 text-left align-middle font-medium text-muted-foreground cursor-pointer hover:text-foreground group"
            onClick={() => onSort(sortKey)}
        >
            <div className="flex items-center gap-1">
                {label}
                <ArrowUpDown className={`h-3 w-3 ${currentSort?.key === sortKey ? 'text-primary' : 'text-transparent group-hover:text-muted-foreground'}`} />
            </div>
        </th>
    );
}
