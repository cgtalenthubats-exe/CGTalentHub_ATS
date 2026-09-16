"use client";

export const dynamic = 'force-dynamic';

import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { JRSwitcher } from "@/components/jr-switcher";
import { JobRequisition } from "@/types/requisition";
import { AtsBreadcrumb } from "@/components/ats-breadcrumb";
import { CandidateList } from "@/components/candidate-list";
import { KanbanBoard } from "@/components/kanban-board";
import { HistoryInsights } from "@/components/history-insights";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList, Cell
} from "recharts";
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { JRTabs } from "@/components/jr-tabs";
import { CreateJobRequisitionForm } from "@/components/create-jr-form";
import { AddCandidateDialog } from "@/components/add-candidate-dialog";
import { ReportViewDialog } from "@/components/report-view-dialog";
import { generateJRReportPPTX } from "@/app/actions/export-jr-report";
import { CopyJRDialog } from "@/components/copy-jr-dialog";
import { toast } from "@/lib/notifications";
import { deleteJobRequisition, getUserProfiles, getRequisition } from "@/app/actions/requisitions";
import { getJRAnalytics } from "@/app/actions/jr-candidates";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    Plus, List, Kanban, MessageSquare, Briefcase, Share2, Loader2,
    Copy, Trophy, Trash2, Edit, User, Activity, History, Sparkles, Download,
    StickyNote
} from "lucide-react";
import { AiSuggestionTab } from "./ai-suggestion-tab";
import { StageAgingPanel } from "./StageAgingPanel";
import { SalaryBenchmarkTab } from "./SalaryBenchmarkTab";
import { JRNoteDialog } from "@/components/jr-note-dialog";
import { getJRAgingDays, cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useJobRequisitionRealtime } from "@/hooks/use-jr-realtime";
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

// Module-level cache for instant "Back" navigation
const jrCache: Record<string, JobRequisition> = {};
const analyticsCache: Record<string, any> = {};

export default function JRManagePage() {
    const router = useRouter();
    const searchParams = useSearchParams();

    // Tab State (Default to 'list' or read from URL)
    const initialTab = searchParams.get('tab') || "list";
    const [currentTab, setCurrentTab] = useState(initialTab);

    // Selected JR State
    const [selectedJR, setSelectedJR] = useState<JobRequisition | null>(null);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isAddCandOpen, setIsAddCandOpen] = useState(false);
    const [analytics, setAnalytics] = useState<any>(null);
    const [isExportingAnalytics, setIsExportingAnalytics] = useState(false);
    const [isNoteOpen, setIsNoteOpen] = useState(false);

    const [isJRLoading, setIsJRLoading] = useState(false); // Track URL-based loading
    const [isInitialized, setIsInitialized] = useState(false); // Track initial mount
    const [refreshKey, setRefreshKey] = useState(0); // Trigger refresh for candidates
    const [isReportViewOpen, setIsReportViewOpen] = useState(false);
    const [isTriggeringReport, setIsTriggeringReport] = useState(false);
    const [isCopyDialogOpen, setIsCopyDialogOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);

    // Audit State
    const [profiles, setProfiles] = useState<{ email: string; real_name: string }[]>([]);
    const [selectedCreatedBy, setSelectedCreatedBy] = useState("System");

    // No longer adding tabs in a side effect of selectedJR to avoid loops.
    // Instead, it's handled inside the loadSelectedJR function when identity is confirmed.

    // Load Profiles and Auth User
    useEffect(() => {
        async function loadAuditData() {
            try {
                const [userProfiles, { getCurrentUserRealName }] = await Promise.all([
                    getUserProfiles(),
                    import("@/app/actions/user-actions")
                ]);
                setProfiles(userProfiles);
                
                const realName = await getCurrentUserRealName();
                setSelectedCreatedBy(realName);
            } catch (e) {
                console.error("Failed to load audit data", e);
            }
        }
        loadAuditData();
    }, []);

    const [loadError, setLoadError] = useState<string | null>(null);

    // Handle URL/History Sync
    useEffect(() => {
        const jrId = searchParams.get('jr_id');

        const loadSelectedJR = async (id: string) => {
            // If already loaded, skip
            if (selectedJR?.id === id) return;

            setLoadError(null);

            // Check cache for instant feel
            if (jrCache[id]) {
                setSelectedJR(jrCache[id]);
            } else {
                setIsJRLoading(true);
            }

            try {
                const jr = await getRequisition(id);
                if (jr) {
                    jrCache[id] = jr;
                    setSelectedJR(jr);

                    // Background revalidation: always fetch fresh data even if cached
                    // (above already does this — remove early-return only for cache path)
                    // This ensures stale data gets updated without a full reload

                    // Sync tab title if not in cache (migration)
                    const stored = localStorage.getItem("ats_jr_tabs");
                    const tabs = stored ? JSON.parse(stored) : [];
                    const existingIndex = tabs.findIndex((t: any) => t.id === jr.id);
                    const desiredTitle = `${jr.id} — ${jr.job_title}`;

                    if (existingIndex === -1) {
                        tabs.push({ id: jr.id, title: desiredTitle });
                        localStorage.setItem("ats_jr_tabs", JSON.stringify(tabs));
                        window.dispatchEvent(new Event("storage"));
                    } else if (tabs[existingIndex].title !== desiredTitle) {
                        tabs[existingIndex].title = desiredTitle;
                        localStorage.setItem("ats_jr_tabs", JSON.stringify(tabs));
                        window.dispatchEvent(new Event("storage"));
                    }
                } else {
                    // getRequisition() swallows its own DB error and returns null either
                    // way — surface it instead of silently falling back to the empty state,
                    // since that looked identical to "no JR selected" with no explanation.
                    const msg = `ไม่พบข้อมูล ${id} หรือโหลดไม่สำเร็จ`;
                    setLoadError(msg);
                    toast.error(msg, {
                        action: { label: "ลองใหม่", onClick: () => loadSelectedJR(id) },
                    });
                }
            } catch (e) {
                console.error("Failed to load JR from URL", e);
                const msg = "โหลดข้อมูล JR ไม่สำเร็จ (session อาจหมดอายุ หรือแอปเพิ่ง deploy ใหม่ — ลอง refresh หน้า)";
                setLoadError(msg);
                toast.error(msg, {
                    action: { label: "ลองใหม่", onClick: () => loadSelectedJR(id) },
                });
            } finally {
                setIsJRLoading(false);
            }
        };

        if (jrId) {
            loadSelectedJR(jrId);
        } else {
            setSelectedJR(null);
            setLoadError(null);
            setIsJRLoading(false);
        }

        // Initialize flag (though not strictly needed now in URL-first)
        if (!isInitialized) setIsInitialized(true);
    }, [searchParams, isInitialized]); // Only listen to URL changes

    // Update currentTab when searchParams change
    useEffect(() => {
        const tab = searchParams.get('tab') || "list";
        if (tab !== currentTab) setCurrentTab(tab);
    }, [searchParams]);

    // Selection Handlers (These now only update URL)
    const handleJRSelect = (id: string | null) => {
        const params = new URLSearchParams(window.location.search);
        if (id) {
            params.set('jr_id', id);
        } else {
            params.delete('jr_id');
        }
        // Use push (not replace) so Browser Back button can return to previous JR
        router.push(`${window.location.pathname}?${params.toString()}`, { scroll: false });
    };

    const handleTabChange = (val: string) => {
        const params = new URLSearchParams(window.location.search);
        params.set('tab', val);
        router.replace(`${window.location.pathname}?${params.toString()}`, { scroll: false });
    };

    // ... Load Analytics (Existing) ...
    useEffect(() => {
        async function loadAnalytics() {
            if (selectedJR) {
                const id = selectedJR.id;
                
                // Show cached analytics if available
                if (analyticsCache[id]) {
                    setAnalytics(analyticsCache[id]);
                }

                try {
                    const data = await getJRAnalytics(id);
                    analyticsCache[id] = data; // Update cache
                    setAnalytics(data);
                } catch (e) {
                    console.error("Failed to load analytics", e);
                }
            } else {
                setAnalytics(null);
            }
        }
        loadAnalytics();
    }, [selectedJR?.id]);


    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];
    const EXCLUDED_CHART_STATUSES = ['Interview Scheduled - Hiring Manager', 'Interview Scheduled - Recruiter'];

    const LeftAlignedYAxisTick = (props: any) => {
        const { x, y, payload } = props;
        return (
            <text x={10} y={y} dy={4} textAnchor="start" fontSize={13} fill="#475569">
                {payload.value}
            </text>
        );
    };

    // Wraps long status labels onto 2 lines (split on " - " if present, else by midpoint word)
    // Two-line X axis labels: status names are long enough to collide at 13 statuses wide.
    const TwoLineXAxisTick = (props: any) => {
        const { x, y, payload } = props;
        const words = String(payload.value).split(' ');
        const mid = Math.ceil(words.length / 2);
        const line1 = words.slice(0, mid).join(' ');
        const line2 = words.slice(mid).join(' ');
        return (
            <g transform={`translate(${x},${y})`}>
                <text x={0} y={0} dy={14} textAnchor="middle" fontSize={13} fill="#475569">{line1}</text>
                {line2 && <text x={0} y={0} dy={30} textAnchor="middle" fontSize={13} fill="#475569">{line2}</text>}
            </g>
        );
    };

    // Aging chart tooltip: avg is the bar height, but min/max/visit breakdown only show on hover
    const AgingTooltip = ({ active, payload, label }: any) => {
        if (!active || !payload || !payload.length) return null;
        const d = payload[0].payload;
        return (
            <div className="rounded-md border bg-white dark:bg-slate-900 shadow-md px-3 py-2 text-xs space-y-1">
                <div className="font-semibold text-slate-700 dark:text-slate-200">{label}</div>
                <div>Avg: <span className="font-medium">{d.avgDays} days</span></div>
                <div>Min–Max: <span className="font-medium">{d.minDays}–{d.maxDays} days</span></div>
                <div className="text-slate-500 dark:text-slate-400">
                    {d.visits} visit{d.visits === 1 ? '' : 's'} ({d.closedCount} closed, {d.ongoingCount} ongoing)
                </div>
            </div>
        );
    };

    const csvEscape = (val: any) => `"${String(val ?? '').replace(/"/g, '""')}"`;

    const downloadCSV = (filename: string, lines: string[]) => {
        const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
    };

    const exportAnalyticsCSV = async () => {
        if (!selectedJR) return;
        setIsExportingAnalytics(true);
        try {
            const { getJRActivityAgingExport } = await import("@/app/actions/jr-candidates");
            const { statuses, rows } = await getJRActivityAgingExport(selectedJR.id);
            const statusOrderIndex = new Map(statuses.map((s, i) => [s, i]));

            // Sort: 1) Successful Placement first, 2) Top profile then rank asc, 3) status_order
            const sortedRows = [...rows].sort((a, b) => {
                const aPlaced = a.currentStatus === 'Successful Placement' ? 0 : 1;
                const bPlaced = b.currentStatus === 'Successful Placement' ? 0 : 1;
                if (aPlaced !== bPlaced) return aPlaced - bPlaced;

                const aTop = a.type === 'Top profile' ? 0 : 1;
                const bTop = b.type === 'Top profile' ? 0 : 1;
                if (aTop !== bTop) return aTop - bTop;

                const rA = parseInt(a.rank || '999');
                const rB = parseInt(b.rank || '999');
                if (rA !== rB) return rA - rB;

                const oA = statusOrderIndex.get(a.currentStatus) ?? 999;
                const oB = statusOrderIndex.get(b.currentStatus) ?? 999;
                return oA - oB;
            });

            const baseHeader = ['Rank', 'Type', 'Current Status', 'Candidate ID', 'Name', 'Company', 'Position'];
            const header = [...baseHeader, ...statuses];

            const activityLines = [header.map(csvEscape).join(',')];
            sortedRows.forEach(r => {
                const line = [
                    r.rank, r.type, r.currentStatus, r.candidateId, r.name, r.company, r.position,
                    ...statuses.map(s => r.visited[s] || 0)
                ];
                activityLines.push(line.map(csvEscape).join(','));
            });

            const agingLines = [header.map(csvEscape).join(',')];
            sortedRows.forEach(r => {
                const line = [
                    r.rank, r.type, r.currentStatus, r.candidateId, r.name, r.company, r.position,
                    ...statuses.map(s => r.aging[s] || 0)
                ];
                agingLines.push(line.map(csvEscape).join(','));
            });

            downloadCSV(`activity-${selectedJR.id}.csv`, activityLines);
            downloadCSV(`aging-${selectedJR.id}.csv`, agingLines);
        } finally {
            setIsExportingAnalytics(false);
        }
    };

    const handleCreateReport = async () => {
        if (!selectedJR) return;
        setIsTriggeringReport(true);
        try {
            const { base64, filename } = await generateJRReportPPTX(selectedJR.id);
            const link = document.createElement("a");
            link.href = `data:application/vnd.openxmlformats-officedocument.presentationml.presentation;base64,${base64}`;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            toast.success("Report ready — downloading now.");
        } catch (err: any) {
            console.error("JR Report PPTX error:", err);
            toast.error(`Error generating report: ${err?.message ?? "Unknown error"}`);
        } finally {
            setIsTriggeringReport(false);
        }
    };

    // --- Realtime Sync ---
    useJobRequisitionRealtime(selectedJR?.id, (updatedJR) => {
        // Only update if the data actually changed (e.g. n8n filled in job_description)
        if (JSON.stringify(updatedJR) !== JSON.stringify(selectedJR)) {
            console.log("Auto-updating JR data via Realtime...");
            setSelectedJR(updatedJR);
            // Update local cache
            if (updatedJR.id) jrCache[updatedJR.id] = updatedJR;
            setIsSyncing(false); // Stop "processing" once we get an update
            
            toast.info(`Updated: ${updatedJR.id} data synced automatically.`, {
                icon: <Activity className="h-4 w-4 text-blue-500" />,
                duration: 2000
            });
        }
    });

    return (
        <div className="flex flex-col min-h-screen bg-slate-50/50 dark:bg-black">
            {/* Top Tabs Bar */}
            <JRTabs
                activeId={selectedJR ? selectedJR.id : undefined}
                onSelect={handleJRSelect}
                onAdd={() => {
                    handleJRSelect(null); // Just clear selection to show switcher "workspace"
                }}
            />

            <div className="mx-auto p-6 space-y-6 flex-1 w-full max-w-[95%]">
                <AtsBreadcrumb
                    items={[
                        { label: 'Job Requisition Menu', href: '/requisitions' },
                        { label: 'Manage' }
                    ]}
                />

                {/* Header / Switcher Bar */}
                <div className="flex flex-col lg:flex-row justify-between lg:items-start gap-6 border-b pb-6">
                    <div className="flex flex-col gap-4">
                        <div className="flex items-center gap-4">
                            <div className="flex flex-col gap-0.5">
                                <h1 className="text-2xl font-bold tracking-tight text-foreground">Job Requisition Manage</h1>
                                {selectedJR && (
                                    <div className="flex items-center gap-2 text-base text-muted-foreground">
                                        <span className="font-mono font-bold text-indigo-600">{selectedJR.id}</span>
                                        <span className="text-slate-400">—</span>
                                        <span>Position: <span className="font-semibold text-foreground">{selectedJR.job_title || '-'}</span></span>
                                        <span className="text-slate-300">·</span>
                                        <span>BU: <span className="font-semibold text-foreground">{selectedJR.division || '-'}</span></span>
                                        <span className="text-slate-300">·</span>
                                        <span>Sub-BU: <span className="font-semibold text-foreground">{selectedJR.department || '-'}</span></span>
                                        <span className="text-slate-300">·</span>
                                        <span>Status: <span className="font-semibold text-foreground">{selectedJR.is_active || '-'}</span></span>
                                        <span className="text-slate-300">·</span>
                                        {(() => {
                                            const days = getJRAgingDays(selectedJR.opened_date, selectedJR.closed_date);
                                            const isClosed = selectedJR.is_active === 'Closed';
                                            const label = isClosed ? "Days to Successful Placement" : "Days to Pending";
                                            return (
                                                <Badge
                                                    variant="outline"
                                                    className={cn(
                                                        "font-semibold",
                                                        isClosed ? "border-emerald-200 text-emerald-700 bg-emerald-50" : "border-amber-200 text-amber-700 bg-amber-50"
                                                    )}
                                                >
                                                    {label}: {days === null ? '-' : `${days}d`}
                                                </Badge>
                                            );
                                        })()}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="flex gap-4 items-center">
                            {isJRLoading ? (
                                <div className="flex items-center gap-2 px-4 h-12 bg-white rounded-lg border shadow-sm">
                                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                    <span className="text-sm font-black text-indigo-700 italic">Returning you to {searchParams.get('jr_id')}...</span>
                                </div>
                            ) : (
                                <JRSwitcher
                                    selectedId={selectedJR?.id}
                                    onSelect={(jr) => handleJRSelect(jr.id)}
                                />
                            )}

                            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                                <DialogTrigger asChild>
                                    <Button className="bg-primary text-primary-foreground shrink-0">
                                        <Plus className="mr-2 h-4 w-4" /> Create New JR
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                                    <DialogHeader className="mb-6">
                                        <DialogTitle className="text-2xl font-bold text-center">Create New Requisition</DialogTitle>
                                        <DialogDescription className="text-center">Drafting a new job requisition. ID will be generated automatically.</DialogDescription>
                                    </DialogHeader>
                                    <CreateJobRequisitionForm
                                        onCancel={() => setIsCreateOpen(false)}
                                        selectedCreatedBy={selectedCreatedBy}
                                        profiles={profiles}
                                        onSuccess={(newJR) => {
                                            setIsCreateOpen(false);
                                            handleJRSelect(newJR.id);
                                        }}
                                    />
                                </DialogContent>
                            </Dialog>

                            {selectedJR && isSyncing && (
                                <div className="flex items-center gap-1.5 text-blue-600 font-bold animate-pulse text-sm">
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    <span>n8n is processing...</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="w-full lg:w-auto flex flex-col items-end gap-3">
                        <div className="flex items-center gap-2 px-3 h-9 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg border border-indigo-100 dark:border-indigo-800">
                            <User className="h-4 w-4 text-indigo-600 shrink-0" />
                            <Select value={selectedCreatedBy} onValueChange={setSelectedCreatedBy}>
                                <SelectTrigger className="h-7 border-none bg-transparent shadow-none focus:ring-0 text-xs font-bold text-indigo-700 min-w-[140px] p-0">
                                    <SelectValue placeholder="Updated by..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {profiles.map((p, idx) => (
                                        <SelectItem key={`${p.email}-${idx}`} value={p.real_name} className="text-xs">{p.real_name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 w-full">
                            {/* Row 1 */}
                            <Button
                                disabled={!selectedJR}
                                variant="outline"
                                onClick={() => setIsNoteOpen(true)}
                                className="border-amber-200 text-amber-700 hover:bg-amber-50 w-full"
                            >
                                <StickyNote className="mr-2 h-4 w-4" /> {selectedJR?.jr_note ? "Note" : "Add Note"}
                            </Button>

                            <Button
                                disabled={!selectedJR || isTriggeringReport}
                                variant="outline"
                                onClick={handleCreateReport}
                                className="border-indigo-200 text-indigo-700 hover:bg-indigo-50 w-full"
                            >
                                {isTriggeringReport ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Working...
                                    </>
                                ) : (
                                    <>
                                        <Share2 className="mr-2 h-4 w-4" /> Create Report
                                    </>
                                )}
                            </Button>

                            <Button
                                disabled={!selectedJR}
                                variant="outline"
                                onClick={() => setIsReportViewOpen(true)}
                                className="border-slate-200 w-full"
                            >
                                <BarChart className="mr-2 h-4 w-4" /> View History
                            </Button>

                            <Button
                                variant="outline"
                                onClick={() => router.push('/requisitions/placements')}
                                className="border-amber-200 text-amber-700 hover:bg-amber-50 w-full"
                            >
                                <Trophy className="mr-2 h-4 w-4" /> Placements
                            </Button>

                            {/* Row 2 */}
                            <Button
                                disabled={!selectedJR}
                                onClick={() => setIsAddCandOpen(true)}
                                className="shadow-sm w-full bg-slate-900 hover:bg-slate-800 text-white"
                            >
                                <Plus className="mr-2 h-4 w-4" /> Add Candidate
                            </Button>

                            <Button
                                disabled={!selectedJR}
                                onClick={() => setIsCopyDialogOpen(true)}
                                className="bg-amber-500 hover:bg-amber-600 text-white w-full"
                            >
                                <Copy className="mr-2 h-4 w-4" /> Copy Job Requisition
                            </Button>

                            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                                <DialogTrigger asChild>
                                    <Button
                                        disabled={!selectedJR}
                                        variant="outline"
                                        className="border-blue-200 text-blue-700 hover:bg-blue-50 w-full"
                                    >
                                        <Edit className="mr-2 h-4 w-4" /> Edit Job Requisition
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                                    <DialogHeader className="mb-6 text-center">
                                        <DialogTitle className="text-2xl font-bold">Edit Requisition</DialogTitle>
                                        <DialogDescription>Updating <strong>{selectedJR?.id}</strong> details.</DialogDescription>
                                    </DialogHeader>
                                    {selectedJR && (
                                        <CreateJobRequisitionForm
                                            initialData={selectedJR}
                                            selectedCreatedBy={selectedCreatedBy}
                                            profiles={profiles}
                                            onCancel={() => setIsEditOpen(false)}
                                            onSuccess={(updatedJR) => {
                                                setIsEditOpen(false);
                                                setSelectedJR(updatedJR);
                                            }}
                                        />
                                    )}
                                </DialogContent>
                            </Dialog>

                            <Button
                                disabled={!selectedJR}
                                variant="destructive"
                                className="w-full"
                                onClick={() => setIsDeleteDialogOpen(true)}
                            >
                                <Trash2 className="mr-2 h-4 w-4" /> Delete This JR
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Main Content Area */}
                {
                    isJRLoading ? (
                        <div className="flex flex-col items-center justify-center h-[500px] bg-slate-50/30 dark:bg-slate-900/30 rounded-2xl border-2 border-dashed border-indigo-100 dark:border-indigo-900 animate-pulse transition-all">
                            <div className="p-4 rounded-full bg-indigo-50 dark:bg-indigo-900/50 mb-4">
                                <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
                            </div>
                            <h3 className="text-xl font-black text-indigo-900 dark:text-indigo-100">Preparing Workspace</h3>
                            <p className="text-slate-500 dark:text-slate-400 italic max-w-xs text-center mt-2">Connecting to secure database and fetching the latest candidates for {searchParams.get('jr_id')}...</p>
                        </div>
                    ) : selectedJR ? (
                        <div className="space-y-6">
                            <Card>
                                <CardContent className="pt-5">
                                    <StageAgingPanel key={`stage-aging-${selectedJR.id}-${refreshKey}`} jrId={selectedJR.id} />
                                </CardContent>
                            </Card>

                            <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full">
                                <div className="flex items-center justify-between mb-4">
                                    <TabsList className="h-12 w-fit bg-white dark:bg-slate-900 border">
                                        <TabsTrigger value="list" className="h-10 px-6 data-[state=active]:bg-slate-100 dark:data-[state=active]:bg-slate-800 data-[state=active]:text-primary">
                                            <List className="mr-2 h-4 w-4" /> List View
                                        </TabsTrigger>
                                        <TabsTrigger value="kanban" className="h-10 px-6 data-[state=active]:bg-slate-100 dark:data-[state=active]:bg-slate-800 data-[state=active]:text-primary">
                                            <Kanban className="mr-2 h-4 w-4" /> Pipeline
                                        </TabsTrigger>
                                        <TabsTrigger value="history" className="h-10 px-6 data-[state=active]:bg-slate-100 dark:data-[state=active]:bg-slate-800 data-[state=active]:text-primary">
                                            <History className="mr-2 h-4 w-4" /> History Insights
                                        </TabsTrigger>
                                        <TabsTrigger value="activity" className="h-10 px-6 data-[state=active]:bg-slate-100 dark:data-[state=active]:bg-slate-800 data-[state=active]:text-primary">
                                            <Activity className="mr-2 h-4 w-4" /> Activity &amp; Aging
                                        </TabsTrigger>
                                        <TabsTrigger value="salary" className="h-10 px-6 data-[state=active]:bg-slate-100 dark:data-[state=active]:bg-slate-800 data-[state=active]:text-primary">
                                            <Briefcase className="mr-2 h-4 w-4" /> Salary Benchmark
                                        </TabsTrigger>
                                        <TabsTrigger value="ai-suggestion" className="h-10 px-6 data-[state=active]:bg-slate-100 dark:data-[state=active]:bg-slate-800 data-[state=active]:text-primary">
                                            <Sparkles className="mr-2 h-4 w-4 text-indigo-500" /> AI Suggestion
                                        </TabsTrigger>
                                    </TabsList>
                                </div>

                                <TabsContent value="list" className="mt-0">
                                    <CandidateList key={`list-${selectedJR.id}-${refreshKey}`} jrId={selectedJR.id} jobTitle={selectedJR.job_title} bu={selectedJR.division} subBu={selectedJR.department} updatedBy={selectedCreatedBy} />
                                </TabsContent>

                                <TabsContent value="kanban" className="mt-0">
                                    <KanbanBoard key={`kanban-${selectedJR.id}-${refreshKey}`} jrId={selectedJR.id} jobTitle={selectedJR.job_title} bu={selectedJR.division} subBu={selectedJR.department} updatedBy={selectedCreatedBy} />
                                </TabsContent>

                                <TabsContent value="history" className="mt-0">
                                    <HistoryInsights key={`history-${selectedJR.id}-${refreshKey}`} jrId={selectedJR.id} />
                                </TabsContent>

                                <TabsContent value="activity" className="mt-0">
                                    {analytics ? (
                                        <Card>
                                            <CardContent className="pt-5 space-y-4">
                                                <div className="flex items-start justify-between gap-3 flex-wrap">
                                                    <div>
                                                        <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">Activity Transaction &amp; Aging</h3>
                                                        <p className="text-xs text-slate-400 font-medium">
                                                            Historical totals across every candidate who has ever been in this JR — the Stage Aging panel above covers what is happening right now.
                                                        </p>
                                                    </div>
                                                    <Button variant="outline" size="sm" onClick={exportAnalyticsCSV} disabled={isExportingAnalytics} className="gap-2">
                                                        {isExportingAnalytics ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                                                        {isExportingAnalytics ? "Exporting..." : "Export CSV"}
                                                    </Button>
                                                </div>

                                                <Tabs defaultValue="transaction" className="w-full">
                                                    <TabsList className="h-10 w-fit bg-white dark:bg-slate-900 border mb-3">
                                                        <TabsTrigger value="transaction" className="h-8 px-4 text-xs data-[state=active]:bg-slate-100 dark:data-[state=active]:bg-slate-800">
                                                            Activity Transaction
                                                        </TabsTrigger>
                                                        <TabsTrigger value="aging" className="h-8 px-4 text-xs data-[state=active]:bg-slate-100 dark:data-[state=active]:bg-slate-800">
                                                            Avg. Aging (Days)
                                                        </TabsTrigger>
                                                    </TabsList>

                                                    <TabsContent value="transaction" className="mt-0">
                                                        <h3 className="text-base font-bold text-slate-700 dark:text-slate-200 mb-4">Activity Transaction <span className="font-normal text-xs text-slate-400">— how many times candidates entered each status</span></h3>
                                                        {(() => {
                                                            const chartData = analytics.countsByStatus.filter((i: any) => i.count > 0 && !EXCLUDED_CHART_STATUSES.includes(i.status));
                                                            const chartHeight = Math.max(220, chartData.length * 32);
                                                            return (
                                                                <div style={{ height: chartHeight }}>
                                                                    <ResponsiveContainer width="100%" height="100%">
                                                                        <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 40, bottom: 5 }}>
                                                                            <XAxis type="number" hide />
                                                                            <YAxis dataKey="status" type="category" width={280} interval={0} tick={LeftAlignedYAxisTick} />
                                                                            <Tooltip
                                                                                cursor={{ fill: 'transparent' }}
                                                                                content={({ active, payload }) => {
                                                                                    if (active && payload && payload.length) {
                                                                                        const d = payload[0].payload;
                                                                                        return (
                                                                                            <div className="bg-slate-900 text-white text-xs rounded px-2 py-1 shadow-xl">
                                                                                                <p className="font-semibold">{d.status}</p>
                                                                                                <p>Count: {d.count}</p>
                                                                                            </div>
                                                                                        );
                                                                                    }
                                                                                    return null;
                                                                                }}
                                                                            />
                                                                            <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20}>
                                                                                <LabelList dataKey="count" position="right" style={{ fontSize: 13, fontWeight: 700, fill: '#334155' }} />
                                                                                {chartData.map((entry: any, index: number) => (
                                                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                                                ))}
                                                                            </Bar>
                                                                        </BarChart>
                                                                    </ResponsiveContainer>
                                                                </div>
                                                            );
                                                        })()}
                                                    </TabsContent>

                                                    <TabsContent value="aging" className="mt-0">
                                                        <h3 className="text-base font-bold text-slate-700 dark:text-slate-200 mb-4">Avg. Aging (Days) <span className="font-normal text-xs text-slate-400">— average across every visit, including candidates still waiting; the Stage Aging panel separates those two</span></h3>
                                                        {(() => {
                                                            const agingData = analytics.agingByStatus.filter((i: any) => !EXCLUDED_CHART_STATUSES.includes(i.status));
                                                            return (
                                                                <div style={{ height: 400 }}>
                                                                    <ResponsiveContainer width="100%" height="100%">
                                                                        <BarChart data={agingData} margin={{ bottom: 40, top: 20 }}>
                                                                            <XAxis dataKey="status" interval={0} height={60} tick={TwoLineXAxisTick} />
                                                                            <YAxis tick={{ fontSize: 13 }} />
                                                                            <Tooltip content={AgingTooltip} />
                                                                            <Bar dataKey="avgDays" fill="#f97316" radius={[4, 4, 0, 0]} barSize={30}>
                                                                                <LabelList dataKey="avgDays" position="top" style={{ fontSize: 13, fontWeight: 700, fill: '#334155' }} />
                                                                            </Bar>
                                                                        </BarChart>
                                                                    </ResponsiveContainer>
                                                                </div>
                                                            );
                                                        })()}
                                                    </TabsContent>
                                                </Tabs>
                                            </CardContent>
                                        </Card>
                                    ) : (
                                        <Card className="border-dashed">
                                            <CardContent className="py-12 text-center text-sm font-bold text-slate-400">
                                                No activity recorded for this JR yet.
                                            </CardContent>
                                        </Card>
                                    )}
                                </TabsContent>

                                <TabsContent value="salary" className="mt-0">
                                    <SalaryBenchmarkTab key={`salary-${selectedJR.id}`} jrId={selectedJR.id} />
                                </TabsContent>
                                <TabsContent value="ai-suggestion" className="mt-0">
                                    <AiSuggestionTab
                                        key={`ai-${selectedJR.id}`}
                                        jrId={selectedJR.id}
                                        jrTitle={selectedJR.job_title}
                                        jrDescription={selectedJR.job_description}
                                    />
                                </TabsContent>
                            </Tabs>
                        </div>
                    ) : (
                        // Empty State if no JR selected (or the load for jr_id in the URL failed)
                        <div className="flex flex-col items-center justify-center h-[400px] text-center space-y-4 border-2 border-dashed rounded-xl bg-white/50 dark:bg-slate-900/50">
                            <div className="p-4 rounded-full bg-slate-100 dark:bg-slate-800">
                                <Briefcase className="h-8 w-8 text-slate-400" />
                            </div>
                            {loadError ? (
                                <div>
                                    <h3 className="text-lg font-semibold text-destructive">Failed to load Job Requisition</h3>
                                    <p className="text-muted-foreground max-w-sm mt-1">{loadError}</p>
                                    {/* This page keeps its data in client state, so router.refresh()
                                        would leave the failed load exactly as it was — a real
                                        reload is what the button promises. */}
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="mt-3"
                                        onClick={() => window.location.reload()}
                                    >
                                        Reload page
                                    </Button>
                                </div>
                            ) : (
                                <div>
                                    <h3 className="text-lg font-semibold">No Job Requisition Selected</h3>
                                    <p className="text-muted-foreground max-w-sm mt-1">Please select an ongoing requisition from the top menu to view candidates and manage the pipeline.</p>
                                </div>
                            )}
                        </div>
                    )
                }
            </div >

            {/* Note Dialog */}
            {
                selectedJR && (
                    <JRNoteDialog
                        open={isNoteOpen}
                        onOpenChange={setIsNoteOpen}
                        jrId={selectedJR.id}
                        note={selectedJR.jr_note}
                        onSaved={(note) => {
                            setSelectedJR(prev => prev ? { ...prev, jr_note: note } : prev);
                        }}
                    />
                )
            }

            {/* Add Candidate Dialog */}
            {
                selectedJR && (
                    <AddCandidateDialog
                        open={isAddCandOpen}
                        onOpenChange={setIsAddCandOpen}
                        jrId={selectedJR.id}
                        updatedBy={selectedCreatedBy}
                        onSuccess={() => {
                            setRefreshKey(prev => prev + 1);
                            // Also refresh analytics
                            const loadAnalytics = async () => {
                                const { getJRAnalytics } = await import("@/app/actions/jr-candidates");
                                const data = await getJRAnalytics(selectedJR.id);
                                setAnalytics(data);
                            };
                            loadAnalytics();
                        }}
                    />
                )
            }

            {/* Report History Dialog */}
            {
                selectedJR && (
                    <ReportViewDialog
                        open={isReportViewOpen}
                        onOpenChange={setIsReportViewOpen}
                        jrId={selectedJR.id}
                        jobName={selectedJR.job_title}
                    />
                )
            }

            {/* Copy JR Dialog */}
            {
                selectedJR && (
                    <CopyJRDialog
                        open={isCopyDialogOpen}
                        onOpenChange={setIsCopyDialogOpen}
                        sourceJR={selectedJR}
                        updatedBy={selectedCreatedBy}
                        onSuccess={(newId) => {
                            handleJRSelect(newId); // Select the new JR automatically
                        }}
                    />
                )
            }

            {/* Delete JR Confirm Dialog */}
            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Job Requisition?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete <strong>{selectedJR?.id} — {selectedJR?.job_title}</strong>?<br />
                            This will permanently delete the JR and all associated candidates and status logs.
                            <span className="block mt-2 font-semibold text-destructive">This action cannot be undone.</span>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            disabled={isDeleting}
                            className="bg-destructive hover:bg-destructive/90 text-white"
                            onClick={async () => {
                                if (!selectedJR) return;
                                setIsDeleting(true);
                                const result = await deleteJobRequisition(selectedJR.id);
                                setIsDeleting(false);
                                setIsDeleteDialogOpen(false);
                                if (result.success) {
                                    toast.success(`Deleted ${selectedJR.id} and all related data.`);
                                    setSelectedJR(null);
                                    // Remove from JRTabs localStorage
                                    try {
                                        const stored = localStorage.getItem('ats_jr_tabs');
                                        if (stored) {
                                            const tabs = JSON.parse(stored).filter((t: any) => t.id !== selectedJR.id);
                                            localStorage.setItem('ats_jr_tabs', JSON.stringify(tabs));
                                            window.dispatchEvent(new Event('storage'));
                                        }
                                    } catch (e) { /* ignore */ }
                                } else {
                                    toast.error('Error deleting JR: ' + result.error);
                                }
                            }}
                        >
                            {isDeleting ? 'Deleting...' : 'Confirm Delete'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div >
    );
}

