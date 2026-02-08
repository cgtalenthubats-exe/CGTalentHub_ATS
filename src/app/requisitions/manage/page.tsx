"use client";

export const dynamic = 'force-dynamic';

import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { JRSwitcher } from "@/components/jr-switcher";
import { JobRequisition } from "@/types/requisition";
import { CandidateList } from "@/components/candidate-list";
import { KanbanBoard } from "@/components/kanban-board";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, List, Kanban, MessageSquare, Briefcase, Share2, Loader2 } from "lucide-react";
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from "recharts";

import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { JRTabs } from "@/components/jr-tabs";
import { CreateJobRequisitionForm } from "@/components/create-jr-form";
import { AddCandidateDialog } from "@/components/add-candidate-dialog";
import { ReportViewDialog } from "@/components/report-view-dialog";
import { triggerReport } from "@/app/actions/n8n-actions";
import { toast } from "sonner";

export default function JRManagePage() {
    const router = useRouter();
    const searchParams = useSearchParams();

    // Tab State (Default to 'list' or read from URL)
    const initialTab = searchParams.get('tab') || "list";
    const [currentTab, setCurrentTab] = useState(initialTab);

    // Selected JR State
    // Selected JR State
    const [selectedJR, setSelectedJR] = useState<JobRequisition | null>(null);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isAddCandOpen, setIsAddCandOpen] = useState(false);
    const [analytics, setAnalytics] = useState<any>(null);
    const [refreshKey, setRefreshKey] = useState(0); // Trigger refresh for candidates
    const [isReportViewOpen, setIsReportViewOpen] = useState(false);
    const [isTriggeringReport, setIsTriggeringReport] = useState(false);

    // Sync URL with Tab
    const handleTabChange = (val: string) => {
        setCurrentTab(val);
    };

    // Update Tabs in LocalStorage when JR is Selected
    useEffect(() => {
        if (selectedJR) {
            try {
                const stored = localStorage.getItem("ats_jr_tabs");
                const tabs = stored ? JSON.parse(stored) : [];

                // Add if not exists
                if (!tabs.find((t: any) => t.id === selectedJR.id)) {
                    tabs.push({ id: selectedJR.id, title: selectedJR.title || selectedJR.id });
                    localStorage.setItem("ats_jr_tabs", JSON.stringify(tabs));
                    // Force update tabs component is tricky without context, 
                    // ideally JRTabs should listen to storage or we pass tabs as prop.
                    // For simplicity, we'll reload window or use a callback if we had one.
                    // Actually, passing 'key' to JRTabs might force re-render if we change it.
                    window.dispatchEvent(new Event("storage")); // Custom event to sync?
                }
            } catch (e) {
                console.error(e);
            }
        }
    }, [selectedJR]);



    // Handle create tab selection (if coming from history/url in future)
    // Handle url/history (simplified)
    useEffect(() => {
        // No special new tab logic needed on load anymore
    }, []);

    const handleTabSelect = (id: string) => {
        if (id === 'new') {
            setSelectedJR(null); // Show empty state for selection
            return;
        }

        if (!id) {
            setSelectedJR(null);
            return;
        }

        // Fetch full JR (Reuse verify logic or simple fetch)
        import("@/app/actions/requisitions").then(async ({ getRequisition }) => {
            const jr = await getRequisition(id);
            if (jr) setSelectedJR(jr);
        });
    };

    // ... Load Analytics (Existing) ...
    useEffect(() => {
        async function loadAnalytics() {
            if (selectedJR) {
                try {
                    const { getJRAnalytics } = await import("@/app/actions/jr-candidates");
                    const data = await getJRAnalytics(selectedJR.id);
                    setAnalytics(data);
                } catch (e) {
                    console.error("Failed to load analytics", e);
                }
            } else {
                setAnalytics(null);
            }
        }
        loadAnalytics();
    }, [selectedJR]);

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

    return (
        <div className="flex flex-col min-h-screen bg-slate-50/50 dark:bg-black">
            {/* Top Tabs Bar */}
            <JRTabs
                activeId={selectedJR ? selectedJR.id : undefined}
                onSelect={handleTabSelect}
                onAdd={() => {
                    setSelectedJR(null); // Just clear selection to show switcher "workspace"
                }}
            />

            <div className="container mx-auto p-6 space-y-6 flex-1">
                {/* Header / Switcher Bar */}
                <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4 border-b pb-6">
                    <div className="flex flex-col gap-2">
                        <h1 className="text-2xl font-bold tracking-tight text-foreground">Pipeline Management</h1>
                        <div className="flex gap-4 items-center">
                            <JRSwitcher
                                selectedId={selectedJR?.id}
                                onSelect={setSelectedJR}
                            />
                            {selectedJR && (
                                <div className="flex gap-2 text-sm text-slate-500">
                                    <span className={selectedJR.is_active ? 'text-green-600 font-medium' : 'text-slate-400'}>
                                        {selectedJR.status}
                                    </span>
                                    <span>•</span>
                                    <span>{selectedJR.headcount_hired}/{selectedJR.headcount_total} Hired</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex gap-2">
                        {/* Create New JR Button */}
                        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                            <DialogTrigger asChild>
                                <Button className="bg-primary text-primary-foreground">
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
                                    onSuccess={(newJR) => {
                                        setIsCreateOpen(false);
                                        setSelectedJR(newJR);
                                    }}
                                />
                            </DialogContent>
                        </Dialog>

                        {/* Actions dependent on JR selection */}
                        <div className="flex gap-2">
                            <Button
                                disabled={!selectedJR || isTriggeringReport}
                                variant="outline"
                                onClick={handleCreateReport}
                                className="border-indigo-200 text-indigo-700 hover:bg-indigo-50"
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
                                className="border-slate-200"
                            >
                                <BarChart className="mr-2 h-4 w-4" /> View History
                            </Button>
                            <Button
                                disabled={!selectedJR}
                                onClick={() => setIsAddCandOpen(true)}
                            >
                                <Plus className="mr-2 h-4 w-4" /> Add Candidate
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Main Content Area */}
                {selectedJR ? (
                    <div className="space-y-6">
                        {/* ANALYTICS SECTION */}
                        {analytics && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Card className="h-[250px]">
                                    <CardContent className="h-full pt-4">
                                        <h3 className="text-sm font-semibold text-muted-foreground mb-4">Candidates per Status</h3>
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
                                </TabsList>
                            </div>

                            <TabsContent value="list" className="mt-0">
                                <CandidateList key={`list-${selectedJR.id}-${refreshKey}`} jrId={selectedJR.id} jobTitle={selectedJR.job_title} bu={selectedJR.division} subBu={selectedJR.department} />
                            </TabsContent>

                            <TabsContent value="kanban" className="mt-0">
                                <KanbanBoard key={`kanban-${selectedJR.id}-${refreshKey}`} jrId={selectedJR.id} jobTitle={selectedJR.job_title} bu={selectedJR.division} subBu={selectedJR.department} />
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
                )}
            </div>

            {/* Add Candidate Dialog */}
            {selectedJR && (
                <AddCandidateDialog
                    open={isAddCandOpen}
                    onOpenChange={setIsAddCandOpen}
                    jrId={selectedJR.id}
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
            )}

            {/* Report History Dialog */}
            {selectedJR && (
                <ReportViewDialog
                    open={isReportViewOpen}
                    onOpenChange={setIsReportViewOpen}
                    jrId={selectedJR.id}
                    jobName={selectedJR.job_title}
                />
            )}
        </div>
    );
}
