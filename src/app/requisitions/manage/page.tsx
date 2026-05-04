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
import { triggerReport } from "@/app/actions/n8n-actions";
import { CopyJRDialog } from "@/components/copy-jr-dialog";
import { toast } from "@/lib/notifications";
import { deleteJobRequisition, getUserProfiles, getRequisition } from "@/app/actions/requisitions";
import { getJRAnalytics } from "@/app/actions/jr-candidates";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
    Plus, List, Kanban, MessageSquare, Briefcase, Share2, Loader2, 
    Copy, Trophy, Trash2, Edit, User, Activity, History 
} from "lucide-react";
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
    const [salaryStats, setSalaryStats] = useState<any[]>([]);
    const [isSalaryLoading, setIsSalaryLoading] = useState(false);
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

    // Handle URL/History Sync
    useEffect(() => {
        const jrId = searchParams.get('jr_id');
        
        const loadSelectedJR = async (id: string) => {
            // If already loaded, skip
            if (selectedJR?.id === id) return;

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
                }
            } catch (e) {
                console.error("Failed to load JR from URL", e);
            } finally {
                setIsJRLoading(false);
            }
        };

        if (jrId) {
            loadSelectedJR(jrId);
        } else {
            setSelectedJR(null);
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

    // Load Salary Stats for the specific JR
    useEffect(() => {
        async function loadSalary() {
            if (selectedJR && currentTab === "salary") {
                setIsSalaryLoading(true);
                try {
                    const { getJRSalaryStats } = await import("@/app/actions/jr-candidates");
                    const data = await getJRSalaryStats(selectedJR.id);
                    setSalaryStats(data);
                } catch (e) {
                    console.error("Failed to load salary stats", e);
                } finally {
                    setIsSalaryLoading(false);
                }
            }
        }
        loadSalary();
    }, [selectedJR?.id, currentTab]);

    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

    const handleCreateReport = async () => {
        if (!selectedJR) return;

        setIsTriggeringReport(true);
        // Using a dummy email for now since we don't have auth context here yet
        const res = await triggerReport(selectedJR.id, "admin@cgtalenthub.com");

        if (res.success) {
            toast.success("Report generation triggered! Wait a few minutes for n8n to finish.");
        } else {
            toast.error(`Error: ${res.error}`);
        }
        setIsTriggeringReport(false);
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
                            <h1 className="text-2xl font-bold tracking-tight text-foreground">Job Requisition Manage</h1>
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg border border-indigo-100 dark:border-indigo-800">
                                <User className="h-4 w-4 text-indigo-600" />
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
                            {selectedJR && isSyncing && (
                                <div className="flex items-center gap-1.5 text-blue-600 font-bold animate-pulse text-sm">
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    <span>n8n is processing...</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="w-full lg:w-auto">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                            {/* Row 1 */}
                            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                                <DialogTrigger asChild>
                                    <Button className="bg-primary text-primary-foreground w-full">
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
                                            setSelectedJR(newJR);
                                            setIsSyncing(true); // Start syncing state
                                        }}
                                    />
                                </DialogContent>
                            </Dialog>

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
                                                setIsSyncing(true); // Start syncing state
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
                            {/* ANALYTICS SECTION */}
                            {analytics && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <Card className="h-[250px]">
                                        <CardContent className="h-full pt-4">
                                            <h3 className="text-sm font-semibold text-muted-foreground mb-4">Activity Transaction</h3>
                                            <ResponsiveContainer width="100%" height="80%">
                                                <BarChart
                                                    data={analytics.countsByStatus.filter((i: any) => i.count > 0)}
                                                    layout="vertical"
                                                    margin={{ left: 10, right: 10, bottom: 5 }}
                                                >
                                                    <XAxis type="number" hide />
                                                    <YAxis dataKey="status" type="category" width={100} tick={{ fontSize: 10 }} />
                                                    <Tooltip
                                                        cursor={{ fill: 'transparent' }}
                                                        content={({ active, payload }) => {
                                                            if (active && payload && payload.length) {
                                                                const data = payload[0].payload;
                                                                return (
                                                                    <div className="bg-slate-900 text-white text-xs rounded px-2 py-1 shadow-xl">
                                                                        <p className="font-semibold">{data.status}</p>
                                                                        <p>Count: {data.count}</p>
                                                                    </div>
                                                                );
                                                            }
                                                            return null;
                                                        }}
                                                    />
                                                    <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20}>
                                                        {analytics.countsByStatus
                                                            .filter((i: any) => i.count > 0)
                                                            .map((entry: any, index: number) => (
                                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                            ))}
                                                    </Bar>
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </CardContent>
                                    </Card>
                                    <Card className="h-[250px]">
                                        <CardContent className="h-full pt-4">
                                            <h3 className="text-sm font-semibold text-muted-foreground mb-4">Avg. Aging (Days)</h3>
                                            <ResponsiveContainer width="100%" height="80%">
                                                <BarChart data={analytics.agingByStatus} margin={{ bottom: 20 }}>
                                                    <XAxis dataKey="status" tick={{ fontSize: 10 }} />
                                                    <YAxis />
                                                    <Tooltip />
                                                    <Bar dataKey="avgDays" fill="#f97316" radius={[4, 4, 0, 0]} barSize={30} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </CardContent>
                                    </Card>
                                </div>
                            )}

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
                                        <TabsTrigger value="salary" className="h-10 px-6 data-[state=active]:bg-slate-100 dark:data-[state=active]:bg-slate-800 data-[state=active]:text-primary">
                                            <Briefcase className="mr-2 h-4 w-4" /> Salary Benchmark
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

                                <TabsContent value="salary" className="mt-0">
                                    <Card className="overflow-hidden border-2 border-slate-100 dark:border-slate-800 shadow-xl rounded-2xl bg-white dark:bg-slate-900">
                                        <CardContent className="p-0">
                                            <div className="p-6 border-b border-slate-50 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex justify-between items-center">
                                                <div>
                                                    <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Market Salary Benchmark</h3>
                                                    <p className="text-sm text-slate-500 font-medium">Comparison of candidate salaries in this Job Requisition (฿M)</p>
                                                </div>
                                                <div className="px-4 py-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl border border-indigo-100 dark:border-indigo-800">
                                                    <span className="text-xs font-black text-indigo-700 uppercase tracking-widest">Live JR Data</span>
                                                </div>
                                            </div>

                                            <div className="p-8">
                                                {isSalaryLoading ? (
                                                    <div className="h-[420px] flex flex-col items-center justify-center space-y-4">
                                                        <Loader2 className="h-12 w-10 animate-spin text-primary" />
                                                        <p className="text-slate-400 font-bold italic">Analyzing market data for candidates...</p>
                                                    </div>
                                                ) : salaryStats.length > 0 ? (
                                                    <div className="relative">
                                                        {/* CUSTOM LEGEND */}
                                                        <div className="flex flex-wrap justify-center gap-4 mb-10 p-4 bg-white/50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm max-w-fit mx-auto">
                                                            {Array.from(new Set(salaryStats.flatMap(item => Object.keys(item).filter(key => key !== 'company'))))
                                                                .map((pos, idx) => (
                                                                    <div key={pos} className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-800 transition-all cursor-default group">
                                                                        <div 
                                                                            className="w-3.5 h-3.5 rounded-full shadow-sm ring-2 ring-white dark:ring-slate-900 group-hover:scale-110 transition-transform" 
                                                                            style={{ backgroundColor: COLORS[idx % COLORS.length] }} 
                                                                        />
                                                                        <span className="text-xs font-black text-slate-700 dark:text-slate-200">{pos}</span>
                                                                    </div>
                                                                ))}
                                                        </div>

                                                        {/* SCROLLABLE CHART CONTAINER */}
                                                        <div className="overflow-x-auto pb-6 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                                                            <div style={{ width: Math.max(800, salaryStats.length * 280), minWidth: '100%' }}>
                                                                <div className="h-[420px] w-full">
                                                                    <ResponsiveContainer width="100%" height="100%">
                                                                        <BarChart 
                                                                            data={salaryStats} 
                                                                            margin={{ top: 40, right: 30, left: 20, bottom: 60 }}
                                                                            barCategoryGap="20%"
                                                                            barGap={2}
                                                                        >
                                                                            <XAxis 
                                                                                dataKey="company" 
                                                                                axisLine={{ stroke: '#0f172a', strokeWidth: 2 }}
                                                                                tickLine={{ stroke: '#0f172a' }}
                                                                                tick={{ fill: '#475569', fontSize: 12, fontWeight: 800 }}
                                                                                height={60}
                                                                                interval={0}
                                                                                tickFormatter={(val) => val.length > 25 ? `${val.substring(0, 25)}...` : val}
                                                                            />
                                                                            <YAxis 
                                                                                axisLine={{ stroke: '#0f172a', strokeWidth: 2 }}
                                                                                tickLine={{ stroke: '#0f172a' }}
                                                                                tick={{ fill: '#475569', fontSize: 11, fontWeight: 700 }}
                                                                                label={{ value: 'Annual Salary (฿M)', angle: -90, position: 'insideLeft', offset: -5, fill: '#64748b', fontSize: 12, fontWeight: 900 }}
                                                                            />
                                                                            <Tooltip 
                                                                                cursor={{ fill: 'rgba(241, 245, 249, 0.5)' }}
                                                                                content={({ active, payload, label }) => {
                                                                                    if (active && payload && payload.length) {
                                                                                        return (
                                                                                            <div className="bg-slate-900/95 backdrop-blur-md border border-slate-800 p-4 rounded-xl shadow-2xl ring-1 ring-white/10">
                                                                                                <p className="text-sm font-black text-white mb-3 border-b border-slate-700 pb-2">{label}</p>
                                                                                                <div className="space-y-2">
                                                                                                    {payload.map((p: any, idx: number) => (
                                                                                                        <div key={idx} className="flex items-center justify-between gap-6">
                                                                                                            <div className="flex items-center gap-2">
                                                                                                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                                                                                                                <span className="text-xs font-bold text-slate-300">{p.name}:</span>
                                                                                                            </div>
                                                                                                            <span className="text-xs font-black text-white">฿{p.value.toFixed(2)}M</span>
                                                                                                        </div>
                                                                                                    ))}
                                                                                                </div>
                                                                                            </div>
                                                                                        );
                                                                                    }
                                                                                    return null;
                                                                                }}
                                                                            />
                                                                            {Array.from(new Set(salaryStats.flatMap(item => Object.keys(item).filter(key => key !== 'company'))))
                                                                                .map((pos, idx) => (
                                                                                    <Bar 
                                                                                        key={pos} 
                                                                                        dataKey={pos} 
                                                                                        fill={COLORS[idx % COLORS.length]} 
                                                                                        radius={[6, 6, 0, 0]}
                                                                                        barSize={60}
                                                                                    >
                                                                                        <LabelList dataKey={pos} position="top" formatter={(val: any) => `฿${val.toFixed(1)}M`} style={{ fill: '#1e293b', fontSize: 10, fontWeight: 900 }} />
                                                                                    </Bar>
                                                                                ))}
                                                                        </BarChart>
                                                                    </ResponsiveContainer>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* SALARY DETAILS TABLE (Reusing standard CandidateList with Salary column) */}
                                                        <div className="mt-12">
                                                            <div className="mb-4 flex items-center gap-2">
                                                                <List className="h-4 w-4 text-slate-500" />
                                                                <span className="text-sm font-black text-slate-700 dark:text-slate-300">Candidate Salary Details</span>
                                                            </div>
                                                            <CandidateList 
                                                                jrId={selectedJR.id}
                                                                jobTitle={selectedJR.job_title}
                                                                bu={selectedJR.department || ""}
                                                                subBu={selectedJR.sub_department || ""}
                                                                updatedBy={selectedCreatedBy}
                                                                showSalary={true}
                                                            />
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="h-[400px] flex flex-col items-center justify-center text-center space-y-4 border-2 border-dashed border-slate-100 rounded-3xl bg-slate-50/50">
                                                        <div className="p-4 rounded-full bg-white shadow-sm ring-1 ring-slate-100">
                                                            <Briefcase className="h-10 w-10 text-slate-300" />
                                                        </div>
                                                        <div>
                                                            <h4 className="text-lg font-black text-slate-800">Insufficient Salary Data</h4>
                                                            <p className="text-slate-400 font-medium max-w-sm mt-1 mx-auto text-sm">
                                                                We couldn't find enough salary information for the candidates in this Job Requisition. Make sure their profiles have 'Annual Salary' and 'Current/Latest Experience' filled in.
                                                            </p>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>
                                </TabsContent>
                            </Tabs>
                        </div>
                    ) : (
                        // Empty State if no JR selected
                        <div className="flex flex-col items-center justify-center h-[400px] text-center space-y-4 border-2 border-dashed rounded-xl bg-white/50 dark:bg-slate-900/50">
                            <div className="p-4 rounded-full bg-slate-100 dark:bg-slate-800">
                                <Briefcase className="h-8 w-8 text-slate-400" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold">No Job Requisition Selected</h3>
                                <p className="text-muted-foreground max-w-sm mt-1">Please select an ongoing requisition from the top menu to view candidates and manage the pipeline.</p>
                            </div>
                        </div>
                    )
                }
            </div >

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

