"use client";

import { useEffect, useState } from "react";
import { getJobRequisitions, getJRStats } from "@/app/actions/requisitions";
import { JobRequisition, DashboardStats } from "@/types/requisition";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Users, Clock, Briefcase, Filter, TrendingUp } from "lucide-react";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie
} from 'recharts';
import { FilterMultiSelect } from "@/components/ui/filter-multi-select";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { CreateJobRequisitionForm } from "@/components/create-jr-form";

export default function RequisitionsPage() {
    const [jrs, setJrs] = useState<JobRequisition[]>([]);
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [isCreateOpen, setIsCreateOpen] = useState(false);

    // Filters
    const [search, setSearch] = useState("");
    const [filterBu, setFilterBu] = useState<string[]>([]);
    const [filterSubBu, setFilterSubBu] = useState<string[]>([]);
    const [filterPosition, setFilterPosition] = useState<string[]>([]);
    const [filterStatus, setFilterStatus] = useState<string[]>([]);
    const [filterIsActive, setFilterIsActive] = useState<string[]>([]);

    useEffect(() => {
        async function load() {
            setLoading(true);
            try {
                const [dJrs, dStats] = await Promise.all([getJobRequisitions(), getJRStats()]);
                setJrs(dJrs);
                setStats(dStats);
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

    // Filter Logic
    const filteredJrs = jrs.filter(jr => {
        const mSearch = !search || jr.id.toLowerCase().includes(search.toLowerCase());
        const mPosition = filterPosition.length === 0 || filterPosition.includes(jr.job_title);
        const mBu = filterBu.length === 0 || filterBu.includes(jr.division);
        const mSubBu = filterSubBu.length === 0 || filterSubBu.includes(jr.department);
        const mStatus = filterStatus.length === 0 || filterStatus.includes(jr.status);
        const mActive = filterIsActive.length === 0 || filterIsActive.includes(jr.is_active ? 'Active' : 'Inactive');
        return mSearch && mPosition && mBu && mSubBu && mStatus && mActive;
    });

    // Unique Options
    const optPosition = Array.from(new Set(jrs.map(j => j.job_title))).sort();
    const optBu = Array.from(new Set(jrs.map(j => j.division))).sort();
    const optSubBu = Array.from(new Set(jrs.map(j => j.department))).sort();
    const optStatus = ["Open", "Closed", "On Hold", "Draft"];
    const optIsActive = ["Active", "Inactive"];

    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

    return (
        <div className="container mx-auto p-6 space-y-8 min-h-screen bg-slate-50/50">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">Job Requisition Table</h1>
                    <p className="text-slate-500 mt-1">Overview of all requisitions and their pipeline status.</p>
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
                                // Ideally append to JRs list or refetch
                                setJrs(prev => [newJR, ...prev]);
                            }}
                        />
                    </DialogContent>
                </Dialog>
            </div>

            {/* --- DASHBOARD SECTION --- */}
            {stats && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <SummaryCard title="Total Requisitions" value={stats.total_jrs} icon={Briefcase} color="text-blue-600" />
                    <SummaryCard title="Active Openings" value={stats.active_jrs} icon={TrendingUp} color="text-green-600" />
                    <SummaryCard title="Total Candidates" value={stats.total_candidates} icon={Users} color="text-purple-600" />
                    <SummaryCard title="Avg Aging (Days)" value={stats.avg_aging_days} icon={Clock} color="text-orange-600" />
                </div>
            )}

            {stats && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[400px]">
                    <Card>
                        <CardHeader>
                            <CardTitle>Candidates by Status</CardTitle>
                            <CardDescription>Current volume across all active pipelines</CardDescription>
                        </CardHeader>
                        <CardContent className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={stats.candidates_by_status} layout="vertical" margin={{ left: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="status" type="category" width={80} tick={{ fontSize: 12 }} />
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
            )}

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
                            <FilterMultiSelect
                                label="Status"
                                options={optStatus}
                                selected={filterStatus}
                                onChange={(v: string) => toggle(filterStatus, v, setFilterStatus)}
                                icon={Filter}
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
                        {(filterPosition.length > 0 || filterBu.length > 0 || filterSubBu.length > 0 || filterStatus.length > 0 || filterIsActive.length > 0) && (
                            <div className="flex justify-end">
                                <Button variant="ghost" size="sm" onClick={() => {
                                    setFilterPosition([]); setFilterBu([]); setFilterSubBu([]); setFilterStatus([]); setFilterIsActive([]); setSearch("");
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
                                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">JR ID</th>
                                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Position</th>
                                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">BU</th>
                                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Sub BU</th>
                                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Candidates</th>
                                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Status</th>
                                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Active</th>
                                    <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={8} className="p-8 text-center text-muted-foreground">Loading requisitions...</td>
                                    </tr>
                                ) : filteredJrs.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="p-8 text-center text-muted-foreground">No requisitions found matching filters.</td>
                                    </tr>
                                ) : (
                                    filteredJrs.map((jr) => (
                                        <tr key={jr.id} className="border-b transition-colors hover:bg-muted/50">
                                            <td className="p-4 font-mono font-medium">{jr.id}</td>
                                            <td className="p-4 font-semibold">{jr.job_title}</td>
                                            <td className="p-4 text-muted-foreground">{jr.division}</td>
                                            <td className="p-4 text-muted-foreground">{jr.department}</td>
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
                                                <StatusBadge status={jr.status} />
                                            </td>
                                            <td className="p-4">
                                                <Badge variant={jr.is_active ? "default" : "secondary"} className={jr.is_active ? "bg-green-600 hover:bg-green-700" : ""}>
                                                    {jr.is_active ? 'Active' : 'Inactive'}
                                                </Badge>
                                            </td>
                                            <td className="p-4 text-right">
                                                <Button variant="outline" size="sm" className="h-8">View</Button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
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
