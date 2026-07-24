"use client";

import { useEffect, useState, useMemo, Fragment } from "react";
import { getJobRequisitions, getAllCandidatesSummary, getAgingSummary, getUserProfiles, updateJobRequisitionStatus } from "@/app/actions/requisitions";
import { getStatusMaster } from "@/app/actions/status-master";
import { JobRequisition } from "@/types/requisition";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Users, Clock, Briefcase, Filter, TrendingUp, ArrowUpDown, Copy, MoreHorizontal, FileText, CheckSquare, Square, Trophy, Trash2, Edit, Activity, ChevronDown, ChevronUp, ChevronRight, Loader2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList
} from 'recharts';
import { FilterMultiSelect } from "@/components/ui/filter-multi-select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CreateJobRequisitionForm } from "@/components/create-jr-form";
import { CandidateList, getRowStatusClass } from "@/components/candidate-list";
import { AtsBreadcrumb } from "@/components/ats-breadcrumb";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { CopyJRDialog } from "@/components/copy-jr-dialog";
import { MonthRangePicker } from "@/components/month-range-picker";
import { toast } from "@/lib/notifications";
import { useRouter } from "next/navigation";
import { deleteJobRequisition } from "@/app/actions/requisitions";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const IS_ACTIVE_OPTIONS: Array<'Active' | 'Inactive' | 'Closed'> = ['Active', 'Inactive', 'Closed'];

const IS_ACTIVE_STYLES: Record<string, string> = {
    'Active': 'bg-blue-50 text-blue-700 border-blue-100 hover:border-blue-200',
    'Inactive': 'bg-slate-100 text-slate-600 border-slate-200 hover:border-slate-300',
    'Closed': 'bg-emerald-50 text-emerald-700 border-emerald-100 hover:border-emerald-200',
};

// Statuses that only add noise to the overview charts (mirrors JR Manage page)
const EXCLUDED_CHART_STATUSES = ['Interview Scheduled - Hiring Manager', 'Interview Scheduled - Recruiter'];

// Wraps long status labels onto 2 lines (split on " - " if present, else by midpoint word)
const TwoLineXAxisTick = (props: any) => {
    const { x, y, payload } = props;
    const value: string = payload.value;
    let line1 = value;
    let line2 = '';
    if (value.includes(' - ')) {
        const parts = value.split(' - ');
        line1 = parts[0];
        line2 = parts.slice(1).join(' - ');
    } else {
        const words = value.split(' ');
        if (words.length > 1) {
            const mid = Math.ceil(words.length / 2);
            line1 = words.slice(0, mid).join(' ');
            line2 = words.slice(mid).join(' ');
        }
    }
    return (
        <g transform={`translate(${x},${y})`}>
            <text x={0} y={0} dy={14} textAnchor="middle" fontSize={11} fill="#475569">{line1}</text>
            {line2 && <text x={0} y={0} dy={28} textAnchor="middle" fontSize={11} fill="#475569">{line2}</text>}
        </g>
    );
};

const LeftAlignedYAxisTick = (props: any) => {
    const { x, y, payload } = props;
    return (
        <text x={10} y={y} dy={4} textAnchor="start" fontSize={11} fill="#475569">
            {payload.value}
        </text>
    );
};

export default function RequisitionsPage() {
    const router = useRouter();
    const [jrs, setJrs] = useState<JobRequisition[]>([]);

    // Data for Client-Side Aggregation
    const [allCandidates, setAllCandidates] = useState<{ jr_id: string; jr_candidate_id: string; status: string; logs: { status: string; timestamp: string; log_id: number }[] }[]>([]);
    const [avgAging, setAvgAging] = useState<number>(0);
    const [userProfiles, setUserProfiles] = useState<Record<string, string>>({}); // email -> real_name

    // Status Master (drives chart ordering + colors, same source as JR Manage page)
    const [statusMaster, setStatusMaster] = useState<{ status: string; stage_order: number; font_color: string | null; bg_color: string | null }[]>([]);
    const statusOrderMap = useMemo(() => new Map(statusMaster.map(m => [m.status, m.stage_order])), [statusMaster]);
    const statusColorMap = useMemo(() => new Map(statusMaster.map(m => [m.status, { font_color: m.font_color, bg_color: m.bg_color }])), [statusMaster]);

    const [loading, setLoading] = useState(true);
    const [isCreateOpen, setIsCreateOpen] = useState(false);

    // Copy Dialog State
    const [copyDialogOpen, setCopyDialogOpen] = useState(false);
    const [jrToCopy, setJrToCopy] = useState<JobRequisition | null>(null);

    // Edit Dialog State
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [jrToEdit, setJrToEdit] = useState<JobRequisition | null>(null);

    // Delete Dialog State
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [jrToDelete, setJrToDelete] = useState<JobRequisition | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Quick-edit Status state
    const [updatingStatusJrId, setUpdatingStatusJrId] = useState<string | null>(null);

    // Row expansion state: which JRs show the status breakdown, and which status (if any) is drilled into per JR
    const [expandedJrIds, setExpandedJrIds] = useState<Set<string>>(new Set());
    const [drilldownByJr, setDrilldownByJr] = useState<Record<string, string[]>>({});

    // Charts collapsed/expanded preference (persisted, mirrors JR Manage page)
    const [showCharts, setShowCharts] = useState(true);
    useEffect(() => {
        const saved = localStorage.getItem('jr_table_show_charts');
        if (saved !== null) setShowCharts(saved === 'true');
    }, []);
    const toggleShowCharts = () => {
        setShowCharts(prev => {
            localStorage.setItem('jr_table_show_charts', String(!prev));
            return !prev;
        });
    };

    // Filters
    const [search, setSearch] = useState("");
    const [filterBu, setFilterBu] = useState<string[]>([]);
    const [filterSubBu, setFilterSubBu] = useState<string[]>([]);
    const [filterPosition, setFilterPosition] = useState<string[]>([]);
    const [filterJrType, setFilterJrType] = useState<string[]>([]);
    const [filterIsActive, setFilterIsActive] = useState<string[]>([]);
    const [filterCreatedBy, setFilterCreatedBy] = useState<string[]>([]); // New Filter
    const [fromMonth, setFromMonth] = useState<string>(""); // YYYY-MM
    const [toMonth, setToMonth] = useState<string>("");     // YYYY-MM

    // Selection
    const [selectedJrIds, setSelectedJrIds] = useState<Set<string>>(new Set());

    // Sorting
    const [sortConfig, setSortConfig] = useState<{ key: keyof JobRequisition; direction: 'asc' | 'desc' } | null>({ key: 'id', direction: 'desc' });

    useEffect(() => {
        async function load() {
            setLoading(true);
            try {
                // Fetch Data needed for Client-Side Aggregation
                const [dJrs, dCandidates, dAging, dProfiles, dStatusMaster] = await Promise.all([
                    getJobRequisitions(),
                    getAllCandidatesSummary(),
                    getAgingSummary(),
                    getUserProfiles(),
                    getStatusMaster()
                ]);
                setJrs(dJrs);
                setAllCandidates(dCandidates as any);
                setAvgAging(dAging);
                setStatusMaster(dStatusMaster as any);

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

    const toggleRowExpand = (jrId: string) => {
        setExpandedJrIds(prev => {
            const next = new Set(prev);
            if (next.has(jrId)) {
                next.delete(jrId);
                // Collapse any open drilldown for this JR too
                setDrilldownByJr(prevD => ({ ...prevD, [jrId]: [] }));
            } else {
                next.add(jrId);
            }
            return next;
        });
    };

    const toggleDrilldown = (jrId: string, status: string) => {
        setDrilldownByJr(prev => {
            const current = prev[jrId] || [];
            const next = current.includes(status) ? current.filter(s => s !== status) : [...current, status];
            return { ...prev, [jrId]: next };
        });
    };

    const handleStatusChange = async (jr: JobRequisition, newStatus: 'Active' | 'Inactive' | 'Closed') => {
        if (jr.is_active === newStatus) return;
        setUpdatingStatusJrId(jr.id);
        const prevJrs = jrs;
        setJrs(prev => prev.map(j => j.id === jr.id ? { ...j, is_active: newStatus } : j));
        try {
            const result = await updateJobRequisitionStatus(jr.id, newStatus);
            if (!result.success) {
                setJrs(prevJrs);
                toast.error(result.error || "Failed to update status");
            }
        } catch (e) {
            setJrs(prevJrs);
            toast.error("Failed to update status");
        } finally {
            setUpdatingStatusJrId(null);
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
            const mActive = filterIsActive.length === 0 || filterIsActive.includes(jr.is_active || 'Active');

            // Creator Filter
            // jr.created_by is email. We filter by Real Name if possible.
            // filterCreatedBy contains Real Names (from options).
            const creatorName = userProfiles[jr.created_by || ""] || jr.created_by || "System";
            const mCreator = filterCreatedBy.length === 0 || filterCreatedBy.includes(creatorName);

            // Request Date Filter (jr.opened_date maps to job_requisitions.request_date), compared by month
            const requestMon = jr.opened_date ? jr.opened_date.slice(0, 7) : "";
            const mPeriod = (!fromMonth && !toMonth) || (requestMon && (!fromMonth || requestMon >= fromMonth) && (!toMonth || requestMon <= toMonth));

            return mSearch && mPosition && mBu && mSubBu && mType && mActive && mCreator && mPeriod;
        });
    }, [jrs, search, filterPosition, filterBu, filterSubBu, filterJrType, filterIsActive, filterCreatedBy, fromMonth, toMonth, userProfiles]);

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

    const formatDateDDMMYYYY = (dateStr: string | null | undefined): string => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return '';
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        return `${dd}-${mm}-${yyyy}`;
    };

    const exportJrTableCSV = () => {
        const candidateCountByJr: Record<string, number> = {};
        allCandidates.forEach(c => {
            candidateCountByJr[c.jr_id] = (candidateCountByJr[c.jr_id] || 0) + 1;
        });

        const header = ['jr_id', 'position_jr', 'bu', 'sub_bu', 'request_date', 'create_by', 'created_at', 'candidate_count', 'status'];
        const rows = sortedJrs.map(jr => [
            jr.id,
            jr.job_title,
            jr.division,
            jr.department,
            jr.opened_date || '',
            jr.created_by || '',
            formatDateDDMMYYYY(jr.created_at),
            candidateCountByJr[jr.id] || 0,
            jr.is_active || 'Active',
        ]);

        const csvContent = [header, ...rows]
            .map(row => row.map(val => `"${String(val ?? '').replace(/"/g, '""')}"`).join(','))
            .join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `job-requisitions-${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

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

        // 3. Status Grouping — ordered by status_master.stage_order (same source as JR Manage page)
        const statusCounts: Record<string, number> = {};
        relevantCandidates.forEach(c => {
            const s = c.status || "Pool Candidate";
            statusCounts[s] = (statusCounts[s] || 0) + 1;
        });
        const candidatesByStatus = Object.keys(statusCounts)
            .filter(s => !EXCLUDED_CHART_STATUSES.includes(s))
            .sort((a, b) => (statusOrderMap.get(a) ?? 999) - (statusOrderMap.get(b) ?? 999))
            .map(k => ({ status: k, count: statusCounts[k] }));

        // 4. Real Aging Calculation
        // Formula: For each candidate, find time diff between status changes.
        const stageTotals: Record<string, { totalDays: number; count: number }> = {};
        const now = new Date();

        relevantCandidates.forEach(cand => {
            const logs = [...(cand.logs || [])].sort((a, b) => a.log_id - b.log_id);
            if (logs.length === 0) return;

            for (let i = 0; i < logs.length; i++) {
                const currentLog = logs[i];
                const nextLog = logs[i + 1];

                const startTime = new Date(currentLog.timestamp);
                const endTime = nextLog ? new Date(nextLog.timestamp) : now;

                if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) continue;

                const diffDays = Math.max(0, (endTime.getTime() - startTime.getTime()) / (1000 * 3600 * 24));
                const stage = currentLog.status || "Pool Candidate";

                if (!stageTotals[stage]) stageTotals[stage] = { totalDays: 0, count: 0 };
                stageTotals[stage].totalDays += diffDays;
                stageTotals[stage].count += 1;
            }
        });

        // Use the real statuses that actually have data, ordered the same way as the status chart
        // (replaces the old hardcoded "Screening/Hired" placeholder list which didn't match real statuses)
        const stagesWithData = new Set([...Object.keys(statusCounts), ...Object.keys(stageTotals)]);
        const agingByStage = Array.from(stagesWithData)
            .filter(s => !EXCLUDED_CHART_STATUSES.includes(s))
            .sort((a, b) => (statusOrderMap.get(a) ?? 999) - (statusOrderMap.get(b) ?? 999))
            .map(stage => ({
                stage,
                days: stageTotals[stage] ? Math.round(stageTotals[stage].totalDays / stageTotals[stage].count) : 0
            }));

        return {
            total_jrs: targetJrs.length,
            active_jrs: targetJrs.filter(j => (j.is_active || 'Active') === 'Active').length,
            inactive_jrs: targetJrs.filter(j => (j.is_active || 'Active') === 'Inactive').length,
            closed_jrs: targetJrs.filter(j => (j.is_active || 'Active') === 'Closed').length,
            total_candidates: relevantCandidates.length,
            avg_aging_days: avgAging,
            candidates_by_status: candidatesByStatus,
            aging_by_stage: agingByStage
        };
    }, [filteredJrs, selectedJrIds, allCandidates, avgAging, jrs, statusOrderMap]);

    // Per-JR status breakdown for the row-expand drilldown (level 1)
    const statusBreakdownByJr = useMemo(() => {
        const map: Record<string, { status: string; count: number }[]> = {};
        const counts: Record<string, Record<string, number>> = {};
        allCandidates.forEach(c => {
            const s = c.status || "Pool Candidate";
            if (!counts[c.jr_id]) counts[c.jr_id] = {};
            counts[c.jr_id][s] = (counts[c.jr_id][s] || 0) + 1;
        });
        Object.keys(counts).forEach(jrId => {
            map[jrId] = Object.keys(counts[jrId])
                .sort((a, b) => (statusOrderMap.get(a) ?? 999) - (statusOrderMap.get(b) ?? 999))
                .map(s => ({ status: s, count: counts[jrId][s] }));
        });
        return map;
    }, [allCandidates, statusOrderMap]);

    // Unique Options
    const optPosition = Array.from(new Set(jrs.map(j => j.job_title).filter(v => v && v.trim() !== ""))).sort();
    const optBu = Array.from(new Set(jrs.map(j => j.division).filter(v => v && v.trim() !== ""))).sort();
    const optSubBu = Array.from(new Set(jrs.map(j => j.department).filter(v => v && v.trim() !== ""))).sort();
    const optJrType = ["New", "Replacement"];
    const optIsActive = IS_ACTIVE_OPTIONS;
    const optCreatedBy = Array.from(new Set(jrs.map(j => userProfiles[j.created_by || ""] || j.created_by || "System").filter(v => v && v.trim() !== ""))).sort();

    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

    // Handle Copy
    const handleCopyClick = (jr: JobRequisition) => {
        setJrToCopy(jr);
        setCopyDialogOpen(true);
    };

    // Handle Edit
    const handleEditClick = (jr: JobRequisition) => {
        setJrToEdit(jr);
        setEditDialogOpen(true);
    };

    // Handle Delete
    const handleDeleteClick = (jr: JobRequisition) => {
        setJrToDelete(jr);
        setDeleteDialogOpen(true);
    };

    const handleDeleteConfirm = async () => {
        if (!jrToDelete) return;
        setIsDeleting(true);
        const result = await deleteJobRequisition(jrToDelete.id);
        setIsDeleting(false);
        setDeleteDialogOpen(false);
        if (result.success) {
            toast.success(`Deleted ${jrToDelete.id} successfully.`);
            setJrs(prev => prev.filter(j => j.id !== jrToDelete.id));
            setJrToDelete(null);
        } else {
            toast.error('Error deleting JR: ' + result.error);
        }
    };

    const COL_SPAN = 12;

    return (
        <div className="mx-auto p-6 space-y-8 min-h-screen bg-slate-50/50 w-full max-w-[95%]">
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
                <div className="flex gap-3">
                    <Button
                        variant="outline"
                        className="border-amber-200 text-amber-700 hover:bg-amber-50"
                        onClick={() => router.push('/requisitions/placements')}
                    >
                        <Trophy className="mr-2 h-4 w-4" /> Successful Placements
                    </Button>
                    <Button variant="outline" onClick={exportJrTableCSV}>
                        <FileText className="mr-2 h-4 w-4" /> Export CSV
                    </Button>
                    <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                        <DialogTrigger asChild>
                            <Button>
                                <Plus className="mr-2 h-4 w-4" /> Create New JR
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                            <DialogHeader className="text-center mb-6">
                                <DialogTitle className="text-2xl font-bold">Create New Requisition</DialogTitle>
                                <DialogDescription>Drafting a new job requisition. ID will be generated automatically.</DialogDescription>
                            </DialogHeader>
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
            </div>

            {/* --- DASHBOARD SECTION --- */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <SummaryCard title="Total Requisitions" value={stats.total_jrs} icon={Briefcase} color="text-blue-600" />
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Requisition Status</CardTitle>
                        <TrendingUp className="h-4 w-4 text-slate-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-end gap-4">
                            <div>
                                <div className="text-2xl font-bold text-blue-600">{stats.active_jrs}</div>
                                <div className="text-xs text-muted-foreground">Active</div>
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-slate-500">{stats.inactive_jrs}</div>
                                <div className="text-xs text-muted-foreground">Inactive</div>
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-emerald-600">{stats.closed_jrs}</div>
                                <div className="text-xs text-muted-foreground">Closed</div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <SummaryCard title="Total Candidates" value={stats.total_candidates} icon={Users} color="text-purple-600" />
                <SummaryCard title="Avg Aging (Days)" value={stats.avg_aging_days} icon={Clock} color="text-orange-600" />
            </div>

            {/* --- CHARTS SECTION (collapsible, ordered by status_master.stage_order) --- */}
            <Card>
                <button
                    onClick={toggleShowCharts}
                    className="w-full flex items-center justify-between px-5 py-3.5 text-left"
                >
                    <div className="flex items-center gap-2">
                        <Activity className="h-4 w-4 text-slate-500" />
                        <span className="text-sm font-semibold text-slate-700">Candidates by Status & Aging Analysis</span>
                    </div>
                    {showCharts ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                </button>

                {showCharts && (
                    <CardContent className="pt-0">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Candidates by Status</CardTitle>
                                    <CardDescription>Volume across {selectedJrIds.size > 0 ? 'selected' : 'active (filtered)'} pipelines</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div style={{ height: Math.max(300, stats.candidates_by_status.length * 32) }}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={stats.candidates_by_status} layout="vertical" margin={{ left: 20, right: 30 }}>
                                                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                                <XAxis type="number" hide />
                                                <YAxis dataKey="status" type="category" width={220} interval={0} tick={LeftAlignedYAxisTick} />
                                                <Tooltip cursor={{ fill: 'transparent' }} />
                                                <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]}>
                                                    <LabelList dataKey="count" position="right" style={{ fontSize: 12, fontWeight: 700, fill: '#334155' }} />
                                                    {stats.candidates_by_status.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                    ))}
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle>Aging Analysis</CardTitle>
                                    <CardDescription>Average days candidates spend in each stage</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div style={{ height: Math.max(300, stats.candidates_by_status.length * 32) }}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={stats.aging_by_stage} margin={{ bottom: 30, top: 20 }}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                                <XAxis dataKey="stage" interval={0} height={50} tick={TwoLineXAxisTick} />
                                                <YAxis tick={{ fontSize: 12 }} />
                                                <Tooltip />
                                                <Bar dataKey="days" fill="#f97316" radius={[4, 4, 0, 0]} barSize={40}>
                                                    <LabelList dataKey="days" position="top" style={{ fontSize: 12, fontWeight: 700, fill: '#334155' }} />
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </CardContent>
                )}
            </Card>

            {/* --- LIST SECTION --- */}
            <Card>
                <CardHeader>
                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <CardTitle>Requisition List</CardTitle>
                            <Badge variant="outline" className="font-mono">Total: {filteredJrs.length} JR{filteredJrs.length === 1 ? '' : 's'}</Badge>
                        </div>
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
                                label="Status"
                                options={optIsActive}
                                selected={filterIsActive}
                                onChange={(v: string) => toggle(filterIsActive, v, setFilterIsActive)}
                                icon={TrendingUp}
                            />
                            <MonthRangePicker
                                fromMonth={fromMonth}
                                toMonth={toMonth}
                                onFromChange={setFromMonth}
                                onToChange={setToMonth}
                                className="h-10 min-w-0 w-full"
                            />
                        </div>
                        {/* Clear Filters Button */}
                        {(filterPosition.length > 0 || filterBu.length > 0 || filterSubBu.length > 0 || filterJrType.length > 0 || filterIsActive.length > 0 || filterCreatedBy.length > 0 || fromMonth || toMonth) && (
                            <div className="flex justify-end">
                                <Button variant="ghost" size="sm" onClick={() => {
                                    setFilterPosition([]); setFilterBu([]); setFilterSubBu([]); setFilterJrType([]); setFilterIsActive([]); setFilterCreatedBy([]); setSearch("");
                                    setFromMonth(""); setToMonth("");
                                    setSelectedJrIds(new Set());
                                }} className="text-destructive h-8 px-2">
                                    Clear All Filters
                                </Button>
                            </div>
                        )}
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border overflow-x-auto">
                        <table className="w-full text-base">
                            <thead className="bg-muted/50">
                                <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                                    <th className="h-14 px-2 text-left align-middle font-medium text-muted-foreground w-[36px]"></th>
                                    <th className="h-14 px-4 text-left align-middle font-medium text-muted-foreground w-[40px]">
                                        <Checkbox
                                            className="w-5 h-5"
                                            checked={selectedJrIds.size === filteredJrs.length && filteredJrs.length > 0}
                                            onCheckedChange={toggleAllSelection}
                                        />
                                    </th>
                                    <SortableHeader label="JR ID" sortKey="id" currentSort={sortConfig} onSort={requestSort} />
                                    <SortableHeader label="Position" sortKey="job_title" currentSort={sortConfig} onSort={requestSort} />
                                    <SortableHeader label="BU" sortKey="division" currentSort={sortConfig} onSort={requestSort} />
                                    <SortableHeader label="Sub BU" sortKey="department" currentSort={sortConfig} onSort={requestSort} />
                                    <SortableHeader label="Created By" sortKey="created_by" currentSort={sortConfig} onSort={requestSort} />
                                    <SortableHeader label="Request Date" sortKey="opened_date" currentSort={sortConfig} onSort={requestSort} />
                                    <th className="h-14 px-4 text-left align-middle font-medium text-muted-foreground">Candidates</th>
                                    <SortableHeader label="Type" sortKey="jr_type" currentSort={sortConfig} onSort={requestSort} />
                                    <SortableHeader label="Status" sortKey="is_active" currentSort={sortConfig} onSort={requestSort} />
                                    <th className="h-14 px-4 text-right align-middle font-medium text-muted-foreground">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={COL_SPAN} className="p-8 text-center text-muted-foreground">Loading requisitions...</td>
                                    </tr>
                                ) : sortedJrs.length === 0 ? (
                                    <tr>
                                        <td colSpan={COL_SPAN} className="p-8 text-center text-muted-foreground">No requisitions found matching filters.</td>
                                    </tr>
                                ) : (
                                    sortedJrs.map((jr) => {
                                        const isExpanded = expandedJrIds.has(jr.id);
                                        const drilldownStatuses = drilldownByJr[jr.id] || [];
                                        const breakdown = statusBreakdownByJr[jr.id] || [];
                                        const candidateCount = allCandidates.filter(c => c.jr_id === jr.id).length;
                                        const currentStatus = jr.is_active || 'Active';

                                        return (
                                            <Fragment key={jr.id}>
                                                <tr className="border-b transition-colors hover:bg-muted/50">
                                                    <td className="p-2 text-center">
                                                        <button
                                                            onClick={() => toggleRowExpand(jr.id)}
                                                            className="h-6 w-6 inline-flex items-center justify-center rounded hover:bg-slate-200 text-slate-500 disabled:opacity-30"
                                                            disabled={candidateCount === 0}
                                                            title={candidateCount === 0 ? "No candidates" : "Show status breakdown"}
                                                        >
                                                            <ChevronRight className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-90")} />
                                                        </button>
                                                    </td>
                                                    <td className="p-4">
                                                        <Checkbox
                                                            className="w-5 h-5"
                                                            checked={selectedJrIds.has(jr.id)}
                                                            onCheckedChange={() => toggleSelection(jr.id)}
                                                        />
                                                    </td>
                                                    <td className="p-4 font-mono font-medium">
                                                        <a
                                                            href={`/requisitions/manage?jr_id=${jr.id}`}
                                                            className="text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                                                        >
                                                            {jr.id}
                                                        </a>
                                                    </td>
                                                    <td className="p-4 font-semibold">{jr.job_title}</td>
                                                    <td className="p-4 text-muted-foreground">{jr.division}</td>
                                                    <td className="p-4 text-muted-foreground">{jr.department}</td>
                                                    <td className="p-4 text-base text-muted-foreground">
                                                        {userProfiles[jr.created_by || ""] || jr.created_by || "-"}
                                                    </td>
                                                    <td className="p-4 text-base text-muted-foreground whitespace-nowrap">
                                                        {formatDateDDMMYYYY(jr.opened_date) || "-"}
                                                    </td>
                                                    <td className="p-4">
                                                        <div className="flex items-center gap-2">
                                                            <Users className="h-3.5 w-3.5 text-muted-foreground" />
                                                            <span className="text-sm font-medium">
                                                                {candidateCount}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="p-4">
                                                        <Badge variant="outline">{jr.jr_type || 'New'}</Badge>
                                                    </td>
                                                    <td className="p-4">
                                                        {updatingStatusJrId === jr.id ? (
                                                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                                        ) : (
                                                            <select
                                                                className={cn(
                                                                    "text-xs font-bold h-8 pl-3 pr-7 rounded-lg border appearance-none focus:outline-none transition-all cursor-pointer",
                                                                    IS_ACTIVE_STYLES[currentStatus] || IS_ACTIVE_STYLES['Active']
                                                                )}
                                                                value={currentStatus}
                                                                onChange={(e) => handleStatusChange(jr, e.target.value as 'Active' | 'Inactive' | 'Closed')}
                                                            >
                                                                {IS_ACTIVE_OPTIONS.map(opt => (
                                                                    <option key={opt} value={opt}>{opt}</option>
                                                                ))}
                                                            </select>
                                                        )}
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
                                                                <DropdownMenuItem onClick={() => handleEditClick(jr)}>
                                                                    <Edit className="mr-2 h-4 w-4" /> Edit Details
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem onClick={() => handleCopyClick(jr)}>
                                                                    <Copy className="mr-2 h-4 w-4" /> Copy Job Requisition
                                                                </DropdownMenuItem>
                                                                <DropdownMenuSeparator />
                                                                <DropdownMenuItem
                                                                    onClick={() => handleDeleteClick(jr)}
                                                                    className="text-destructive focus:text-destructive"
                                                                >
                                                                    <Trash2 className="mr-2 h-4 w-4" /> Delete JR
                                                                </DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </td>
                                                </tr>

                                                {/* Level 1: status breakdown */}
                                                {isExpanded && (
                                                    <tr className="bg-slate-50/70 border-b">
                                                        <td colSpan={COL_SPAN} className="p-4">
                                                            <div className="flex flex-wrap gap-2">
                                                                {breakdown.map(({ status, count }) => {
                                                                    const dbColor = statusColorMap.get(status);
                                                                    const isSelected = drilldownStatuses.includes(status);
                                                                    return (
                                                                        <button
                                                                            key={status}
                                                                            onClick={() => toggleDrilldown(jr.id, status)}
                                                                            className={cn(
                                                                                "text-xs font-bold px-3 py-1.5 rounded-lg border transition-all",
                                                                                !dbColor?.bg_color && getRowStatusClass(status),
                                                                                isSelected && "ring-2 ring-offset-1 ring-primary"
                                                                            )}
                                                                            style={{
                                                                                backgroundColor: dbColor?.bg_color || undefined,
                                                                                color: dbColor?.font_color || undefined,
                                                                                borderColor: dbColor?.font_color ? `${dbColor.font_color}40` : undefined
                                                                            }}
                                                                        >
                                                                            {status} <span className="opacity-70">({count})</span>
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}

                                                {/* Level 2: candidate list for the drilled-into status(es) — reuses the JR Manage candidate list as-is */}
                                                {isExpanded && drilldownStatuses.length > 0 && (
                                                    <tr className="border-b">
                                                        <td colSpan={COL_SPAN} className="p-0 bg-white">
                                                            <div className="w-full overflow-x-auto p-4">
                                                                {/* key forces a remount whenever the selected statuses change — CandidateList
                                                                    only reads initialStatusFilters on mount, so without this the internal
                                                                    filter would stay stuck on whichever statuses were clicked first */}
                                                                <CandidateList
                                                                    key={`${jr.id}::${[...drilldownStatuses].sort().join(',')}`}
                                                                    jrId={jr.id}
                                                                    jobTitle={jr.job_title}
                                                                    bu={jr.division}
                                                                    subBu={jr.department}
                                                                    initialStatusFilters={drilldownStatuses}
                                                                />
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </Fragment>
                                        );
                                    })
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
                        setLoading(true);
                        getJobRequisitions().then(d => {
                            setJrs(d);
                            setLoading(false);
                        });
                    }}
                />
            )}

            {/* Edit Dialog */}
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader className="text-center mb-6">
                        <DialogTitle className="text-2xl font-bold">Edit Requisition</DialogTitle>
                        <DialogDescription className="text-muted-foreground">Updating <strong>{jrToEdit?.id}</strong> details.</DialogDescription>
                    </DialogHeader>
                    {jrToEdit && (
                        <CreateJobRequisitionForm
                            initialData={jrToEdit}
                            onCancel={() => setEditDialogOpen(false)}
                            onSuccess={(updatedJR) => {
                                setEditDialogOpen(false);
                                setJrs(prev => prev.map(j => j.id === updatedJR.id ? updatedJR : j));
                            }}
                        />
                    )}
                </DialogContent>
            </Dialog>

            {/* Delete JR Confirm Dialog */}
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Job Requisition?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete <strong>{jrToDelete?.id} — {jrToDelete?.job_title}</strong>?<br />
                            This will permanently delete the JR and all associated candidates and status logs.
                            <span className="block mt-2 font-semibold text-destructive">This action cannot be undone.</span>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteConfirm}
                            disabled={isDeleting}
                            className="bg-destructive hover:bg-destructive/90 text-white"
                        >
                            {isDeleting ? 'Deleting...' : 'Confirm Delete'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
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

function SortableHeader({ label, sortKey, currentSort, onSort }: any) {
    return (
        <th
            className="h-14 px-4 text-left align-middle font-medium text-muted-foreground cursor-pointer hover:text-foreground group"
            onClick={() => onSort(sortKey)}
        >
            <div className="flex items-center gap-1">
                {label}
                <ArrowUpDown className={`h-3 w-3 ${currentSort?.key === sortKey ? 'text-primary' : 'text-transparent group-hover:text-muted-foreground'}`} />
            </div>
        </th>
    );
}
