"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
    Search, Plus, Pencil, UserX, UserCheck,
    Loader2, AlertTriangle, ExternalLink, X, Download,
    Building2, Check, ChevronDown,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
    getInternalCandidates, getInternalFilterOptions,
    addInternalCandidate, updateInternalEmploymentRecord, markAsResigned,
    type InternalCandidate, type InternalFilterOptions,
} from "@/app/actions/internal-candidates";
import {
    getCgBuTree, getCgGroupCompanies, getCompanySetupData,
    saveCompanyMapping, saveCandidateCgProfile, getCompanyMappingImpact,
    type CgBuTree, type CgGroupCompany, type MappedCompany, type PendingCompany,
} from "@/app/actions/cg-group-companies";
import { toast } from "@/lib/notifications";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { TabCompanySetup } from "./TabCompanySetup";
import { CandidatePreviewSheet } from "@/components/candidate-preview-sheet";
import { CandidateAvatar } from "@/components/candidate-avatar";

type MainTab = "people" | "company-setup";
type StatusTab = "Active" | "Ex-Central" | "All";

function getBu(c: InternalCandidate) { return c.source === 'group1' ? c.bu : c.cg_bu_abbr; }
function getSubBu(c: InternalCandidate) { return c.source === 'group1' ? c.sub_bu : c.cg_sub_bu_abbr; }

export default function InternalCandidatePage() {
    const [mainTab, setMainTab] = useState<MainTab>("people");
    const [statusTab, setStatusTab] = useState<StatusTab>("Active");
    const [search, setSearch] = useState("");
    const [filterBu, setFilterBu] = useState("");
    const [sourceFilter, setSourceFilter] = useState<"all" | "group1" | "group2">("all");

    const [candidates, setCandidates] = useState<InternalCandidate[]>([]);
    const [options, setOptions] = useState<InternalFilterOptions>({ bus: [], sub_bus: [], job_grades: [] } as any);
    const [loading, setLoading] = useState(true);

    const [buTree, setBuTree] = useState<CgBuTree[]>([]);
    const [cgCompanies, setCgCompanies] = useState<CgGroupCompany[]>([]);
    const [mapped, setMapped] = useState<MappedCompany[]>([]);
    const [pending, setPending] = useState<PendingCompany[]>([]);

    const [addOpen, setAddOpen] = useState(false);
    const [editTarget, setEditTarget] = useState<InternalCandidate | null>(null);
    const [resignTarget, setResignTarget] = useState<InternalCandidate | null>(null);
    const [buEditTarget, setBuEditTarget] = useState<InternalCandidate | null>(null);
    const [sheetCandidateId, setSheetCandidateId] = useState<string | null>(null);
    const [isSheetOpen, setIsSheetOpen] = useState(false);

    const loadPeople = useCallback(async () => {
        setLoading(true);
        const [data, opts] = await Promise.all([
            getInternalCandidates({
                hiring_status: statusTab === 'Active' ? 'Active' : statusTab === 'Ex-Central' ? 'Resigned' : 'All',
                bu: filterBu || undefined,
                search: search || undefined,
            }),
            getInternalFilterOptions(),
        ]);
        setCandidates(data);
        setOptions(opts);
        setLoading(false);
    }, [statusTab, filterBu, search]);

    const loadSetupData = useCallback(async () => {
        const [tree, comps, setupData] = await Promise.all([
            getCgBuTree(),
            getCgGroupCompanies(),
            getCompanySetupData(),
        ]);
        setBuTree(tree);
        setCgCompanies(comps);
        setMapped(setupData.mapped);
        setPending(setupData.pending);
    }, []);

    useEffect(() => { loadSetupData(); }, [loadSetupData]);
    useEffect(() => {
        const t = setTimeout(loadPeople, 300);
        return () => clearTimeout(t);
    }, [loadPeople]);

    const displayed = candidates.filter(c => sourceFilter === 'all' || c.source === sourceFilter);
    const activeCount = candidates.filter(c =>
        c.hiring_status === 'Active' || (!c.hiring_status && c.candidate_status?.includes('Internal Candidate'))
    ).length;
    const exCentralCount = candidates.filter(c =>
        c.hiring_status === 'Resigned' || (!c.hiring_status && c.candidate_status?.includes('Ex-Central'))
    ).length;

    const exportCSV = () => {
        const headers = ["candidate_id", "name", "job_function", "source", "bu", "sub_bu", "position", "job_grade", "hire_date", "resign_date", "status", "linkedin"];
        const rows = displayed.map(c => [
            c.candidate_id, c.name, c.job_function || "", c.source,
            getBu(c) || "", getSubBu(c) || "", c.position || "", c.job_grade || "",
            c.hire_date || "", c.resign_date || "", c.candidate_status?.join(", ") || "", c.linkedin || "",
        ]);
        const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
        const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = "internal_candidates.csv"; a.click();
        URL.revokeObjectURL(url);
    };

    const refresh = () => { loadPeople(); loadSetupData(); };

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 min-h-screen">
            {/* Header */}
            <div className="bg-white dark:bg-slate-900 border-b px-8 py-5">
                <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-indigo-100 dark:bg-indigo-900/30">
                            <UserCheck className="h-6 w-6 text-indigo-600" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-slate-800 dark:text-slate-100">Internal Candidates</h1>
                            <p className="text-sm text-slate-500 font-medium">CG Group employees — tracked by CG Talent Hub</p>
                        </div>
                    </div>
                    {mainTab === 'people' && (
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" className="gap-1.5 rounded-xl" onClick={exportCSV}>
                                <Download className="h-4 w-4" /> Export CSV
                            </Button>
                            <Button className="gap-2 rounded-xl shadow-md" onClick={() => setAddOpen(true)}>
                                <Plus className="h-4 w-4" /> Add Internal
                            </Button>
                        </div>
                    )}
                </div>
                {/* Main Tabs */}
                <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-fit">
                    {([
                        { key: 'people', label: 'People' },
                        { key: 'company-setup', label: 'Company Setup', badge: pending.length || null },
                    ] as { key: MainTab; label: string; badge?: number | null }[]).map(t => (
                        <button key={t.key} onClick={() => setMainTab(t.key)}
                            className={cn(
                                "px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-1.5",
                                mainTab === t.key
                                    ? "bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm"
                                    : "text-slate-500 hover:text-slate-700"
                            )}>
                            {t.label}
                            {t.badge != null && t.badge > 0 && (
                                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-amber-400 text-white">{t.badge}</span>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Tab: People ─────────────────────────────────────────────────── */}
            {mainTab === 'people' && (<>
                {/* Filter bar */}
                <div className="px-8 py-4 bg-white dark:bg-slate-900 border-b flex items-center gap-3 flex-wrap">
                    <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
                        {([
                            { key: 'Active', label: `Active (${activeCount})`, active: 'bg-emerald-500' },
                            { key: 'Ex-Central', label: `Ex-Central (${exCentralCount})`, active: 'bg-slate-600' },
                            { key: 'All', label: 'All', active: 'bg-white' },
                        ] as { key: StatusTab; label: string; active: string }[]).map(t => (
                            <button key={t.key} onClick={() => setStatusTab(t.key)}
                                className={cn("px-4 py-1.5 rounded-lg text-sm font-bold transition-all",
                                    statusTab === t.key ? `${t.active} text-white shadow-sm` : "text-slate-500 hover:text-slate-700"
                                )}>
                                {t.label}
                            </button>
                        ))}
                    </div>
                    <div className="relative min-w-[200px] max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input placeholder="Search name or ID..." className="pl-9 h-9 rounded-lg border-slate-200"
                            value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                    <Select value={filterBu || "_all"} onValueChange={v => setFilterBu(v === "_all" ? "" : v)}>
                        <SelectTrigger className="h-9 w-32 rounded-lg border-slate-200 text-sm">
                            <SelectValue placeholder="All BU" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="_all">All BU</SelectItem>
                            {(options as any).bus?.map((b: string) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <Select value={sourceFilter} onValueChange={v => setSourceFilter(v as any)}>
                        <SelectTrigger className="h-9 w-44 rounded-lg border-slate-200 text-sm">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Sources</SelectItem>
                            <SelectItem value="group1">Executive Recruit (ER)</SelectItem>
                            <SelectItem value="group2">Other (Profile only)</SelectItem>
                        </SelectContent>
                    </Select>
                    {(filterBu || search || sourceFilter !== 'all') && (
                        <Button variant="ghost" size="sm" className="h-9 text-xs text-slate-500"
                            onClick={() => { setFilterBu(""); setSearch(""); setSourceFilter("all"); }}>
                            <X className="h-3 w-3 mr-1" /> Clear
                        </Button>
                    )}
                    <span className="ml-auto text-xs font-bold text-slate-400 uppercase tracking-wider">{displayed.length} records</span>
                </div>

                {/* Table */}
                <div className="flex-1 overflow-auto px-8 py-6">
                    {loading ? (
                        <div className="flex items-center justify-center py-24 gap-3 text-slate-400">
                            <Loader2 className="h-6 w-6 animate-spin" /><span className="font-medium">Loading...</span>
                        </div>
                    ) : displayed.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-24 text-slate-400">
                            <UserCheck className="h-16 w-16 opacity-10 mb-4" />
                            <p className="font-bold text-slate-500">No internal candidates found</p>
                        </div>
                    ) : (
                        <div className="bg-white dark:bg-slate-900 rounded-2xl border overflow-hidden shadow-sm">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b bg-slate-50 dark:bg-slate-800/50 text-[11px] font-black uppercase tracking-wider text-slate-500">
                                        <th className="text-left px-4 py-3 w-8">#</th>
                                        <th className="px-4 py-3 w-14"></th>
                                        <th className="text-left px-4 py-3 min-w-[120px]">ID</th>
                                        <th className="text-left px-4 py-3 min-w-[160px]">Name</th>
                                        <th className="text-left px-4 py-3 min-w-[200px]">Position</th>
                                        <th className="text-left px-4 py-3 min-w-[180px]">Company</th>
                                        <th className="text-left px-4 py-3 min-w-[160px]">BU / Sub-BU</th>
                                        <th className="text-left px-4 py-3 w-16">JG</th>
                                        <th className="text-left px-4 py-3 min-w-[110px]">Hire Date</th>
                                        <th className="text-left px-4 py-3 w-24">Status</th>
                                        <th className="text-right px-4 py-3 w-20">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {displayed.map((c, i) => {
                                        const bu = getBu(c);
                                        const sub_bu = getSubBu(c);
                                        const isActive = c.hiring_status === 'Active' || (!c.hiring_status && c.candidate_status?.includes('Internal Candidate'));
                                        const isGroup1 = c.source === 'group1';
                                        const isExCentral = !isActive;
                                        return (
                                            <tr key={c.candidate_id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors">
                                                <td className="px-4 py-3 text-slate-400 text-xs">{i + 1}</td>

                                                {/* Photo */}
                                                <td className="px-4 py-3">
                                                    <CandidateAvatar
                                                        src={c.photo}
                                                        name={c.name}
                                                        className="h-10 w-10 border border-slate-100"
                                                        fallbackClassName="text-sm"
                                                    />
                                                </td>

                                                {/* ID — กดแล้ว slide panel */}
                                                <td className="px-4 py-3">
                                                    <button
                                                        onClick={() => { setSheetCandidateId(c.candidate_id); setIsSheetOpen(true); }}
                                                        className="font-mono text-[13px] font-black py-1 px-2.5 bg-indigo-50 rounded-lg text-indigo-700 border border-indigo-100 shadow-sm hover:bg-indigo-100 transition-colors whitespace-nowrap"
                                                    >
                                                        {c.candidate_id}
                                                    </button>
                                                </td>

                                                {/* Name */}
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="font-bold text-slate-800 dark:text-slate-100 leading-snug">{c.name}</span>
                                                        {isGroup1 && <Badge className="bg-indigo-100 text-indigo-700 border-none text-[9px] font-black px-1.5 py-0 shrink-0">ER</Badge>}
                                                    </div>
                                                    {c.linkedin && (
                                                        <a href={c.linkedin} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-600 mt-0.5">
                                                            <ExternalLink className="h-3 w-3" /> LinkedIn
                                                        </a>
                                                    )}
                                                </td>

                                                {/* Position */}
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-1.5">
                                                        {c.exp_label === 'Current'
                                                            ? <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">Current</span>
                                                            : c.exp_label === 'Latest Position'
                                                                ? <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-slate-50 text-slate-500 border border-slate-200 shrink-0">Latest</span>
                                                                : null}
                                                        {c.exp_position
                                                            ? <span className="text-xs font-bold text-slate-700 line-clamp-2" title={c.exp_position}>{c.exp_position}</span>
                                                            : <span className="text-slate-300 text-xs">—</span>}
                                                    </div>
                                                    {/* Ex-Central: previously at CG */}
                                                    {isExCentral && c.cg_prev_position && (
                                                        <p className="text-[11px] text-indigo-500 font-medium mt-0.5 line-clamp-1" title={c.cg_prev_position}>
                                                            ↩ {c.cg_prev_position}
                                                        </p>
                                                    )}
                                                </td>

                                                {/* Company */}
                                                <td className="px-4 py-3">
                                                    {c.exp_company
                                                        ? <span className="text-xs text-slate-600 line-clamp-2" title={c.exp_company}>{c.exp_company}</span>
                                                        : <span className="text-slate-300 text-xs">—</span>}
                                                    {/* Ex-Central: formerly at CG company */}
                                                    {isExCentral && c.cg_prev_company && (
                                                        <p className="text-[11px] text-indigo-500 font-medium mt-0.5 line-clamp-1" title={c.cg_prev_company}>
                                                            ↩ {c.cg_prev_company}
                                                        </p>
                                                    )}
                                                </td>

                                                {/* BU / Sub-BU */}
                                                <td className="px-4 py-3">
                                                    {isGroup1 ? (
                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                            {bu ? <Badge variant="secondary" className="text-[10px] font-bold bg-indigo-50 text-indigo-700 border-indigo-100">{bu}</Badge> : <span className="text-slate-300">—</span>}
                                                            {sub_bu && <span className="text-xs text-slate-500">{sub_bu}</span>}
                                                        </div>
                                                    ) : bu ? (
                                                        <button onClick={() => setBuEditTarget(c)}
                                                            className="flex items-center gap-1.5 flex-wrap group hover:bg-slate-100 rounded-lg px-2 py-1 -mx-2 transition-colors">
                                                            <Badge variant="secondary" className="text-[10px] font-bold bg-indigo-50 text-indigo-700 border-indigo-100">{bu}</Badge>
                                                            {sub_bu && <span className="text-xs text-slate-500">{sub_bu}</span>}
                                                            <Pencil className="h-3 w-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                        </button>
                                                    ) : (
                                                        <button onClick={() => setBuEditTarget(c)}
                                                            className="flex items-center gap-1 text-amber-600 hover:text-amber-700 hover:bg-amber-50 rounded-lg px-2 py-1 -mx-2 transition-colors text-xs font-bold">
                                                            <Building2 className="h-3 w-3" /> Assign BU
                                                        </button>
                                                    )}
                                                </td>

                                                <td className="px-4 py-3">
                                                    {c.job_grade != null
                                                        ? <Badge variant="outline" className="text-[10px] font-black border-slate-200 text-slate-600">JG {c.job_grade}</Badge>
                                                        : <span className="text-slate-300">—</span>}
                                                </td>
                                                <td className="px-4 py-3 text-slate-600 text-xs">
                                                    {c.hire_date
                                                        ? new Date(c.hire_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                                                        : <span className="text-slate-300">—</span>}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {isActive
                                                        ? <Badge className="bg-emerald-100 text-emerald-700 border-none text-[10px] font-bold">Active</Badge>
                                                        : <Badge className="bg-slate-100 text-slate-500 border-none text-[10px] font-bold">Ex-Central</Badge>}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-1.5 justify-end">
                                                        {isGroup1 && (<>
                                                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 rounded-lg hover:bg-indigo-50 hover:text-indigo-600"
                                                                onClick={() => setEditTarget(c)}>
                                                                <Pencil className="h-3.5 w-3.5" />
                                                            </Button>
                                                            {isActive && c.employment_record_id && (
                                                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 rounded-lg hover:bg-red-50 hover:text-red-500"
                                                                    onClick={() => setResignTarget(c)}>
                                                                    <UserX className="h-3.5 w-3.5" />
                                                                </Button>
                                                            )}
                                                        </>)}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </>)}

            {/* ── Tab: Company Setup ───────────────────────────────────────────── */}
            {mainTab === 'company-setup' && (
                <TabCompanySetup
                    companies={cgCompanies}
                    buTree={buTree}
                    mapped={mapped}
                    pending={pending}
                    onRefresh={() => { loadSetupData(); loadPeople(); }}
                />
            )}

            {/* Dialogs */}
            <AddInternalDialog open={addOpen} onClose={() => setAddOpen(false)} options={options}
                onSuccess={() => { setAddOpen(false); refresh(); }} />
            {editTarget && (
                <EditInternalDialog candidate={editTarget} options={options}
                    onClose={() => setEditTarget(null)}
                    onSuccess={() => { setEditTarget(null); refresh(); }} />
            )}
            {resignTarget && (
                <ResignDialog candidate={resignTarget}
                    onClose={() => setResignTarget(null)}
                    onSuccess={() => { setResignTarget(null); refresh(); }} />
            )}
            {buEditTarget && (
                <BuEditDialog
                    candidate={buEditTarget}
                    buTree={buTree}
                    cgCompanies={cgCompanies}
                    onClose={() => setBuEditTarget(null)}
                    onSuccess={() => { setBuEditTarget(null); refresh(); }}
                />
            )}

            <CandidatePreviewSheet
                candidateId={sheetCandidateId}
                open={isSheetOpen}
                onOpenChange={(open) => { setIsSheetOpen(open); if (!open) setSheetCandidateId(null); }}
            />
        </div>
    );
}

// ─── BU Edit Dialog (Group 2 inline) ─────────────────────────────────────────

function BuEditDialog({ candidate, buTree, cgCompanies, onClose, onSuccess }: {
    candidate: InternalCandidate;
    buTree: CgBuTree[];
    cgCompanies: CgGroupCompany[];
    onClose: () => void;
    onSuccess: () => void;
}) {
    const [selectedCgId, setSelectedCgId] = useState("");
    const [impact, setImpact] = useState<{ candidate_count: number; candidates: { candidate_id: string; name: string }[] } | null>(null);
    const [loadingImpact, setLoadingImpact] = useState(false);
    const [saving, setSaving] = useState(false);
    const [confirmed, setConfirmed] = useState(false);

    const hasCompany = !!candidate.current_company_id;

    const handleSelectChange = async (cgId: string) => {
        setSelectedCgId(cgId);
        setConfirmed(false);
        if (hasCompany && candidate.current_company_id) {
            setLoadingImpact(true);
            const data = await getCompanyMappingImpact(candidate.current_company_id);
            setImpact(data);
            setLoadingImpact(false);
        }
    };

    const handleSave = async () => {
        if (!selectedCgId) return;
        setSaving(true);
        if (hasCompany && candidate.current_company_id) {
            const result = await saveCompanyMapping(candidate.current_company_id, parseInt(selectedCgId));
            setSaving(false);
            if (result.success) { toast.success("Company mapping saved — all related candidates updated"); onSuccess(); }
            else toast.error(result.error || "Failed");
        } else {
            const cg = cgCompanies.find(c => c.id === parseInt(selectedCgId));
            const result = await saveCandidateCgProfile(candidate.candidate_id, cg?.bu_abbr || null, cg?.sub_bu_abbr || null);
            setSaving(false);
            if (result.success) { toast.success("BU assigned"); onSuccess(); }
            else toast.error(result.error || "Failed");
        }
    };

    const needsConfirm = hasCompany && impact && impact.candidate_count > 1;

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md rounded-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-indigo-600" /> Assign BU / Sub-BU
                    </DialogTitle>
                </DialogHeader>
                <div className="p-3 rounded-xl bg-slate-50 border mb-3">
                    <p className="text-sm font-bold text-slate-800">{candidate.name}</p>
                    <p className="text-xs text-slate-500">{candidate.candidate_id}</p>
                </div>

                {/* BU/Sub-BU selector */}
                <div>
                    <label className="text-xs font-bold text-slate-600 mb-1.5 block">BU / Sub-BU</label>
                    <Select value={selectedCgId || "_none"} onValueChange={v => handleSelectChange(v === '_none' ? '' : v)}>
                        <SelectTrigger className="rounded-lg">
                            <SelectValue placeholder="Select BU / Sub-BU" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="_none">— Select —</SelectItem>
                            {buTree.map(bu => (
                                <React.Fragment key={bu.bu_abbr}>
                                    {bu.sub_bus.map(sub => {
                                        const cgEntry = cgCompanies.find(c => c.bu_abbr === bu.bu_abbr && c.sub_bu_abbr === sub.sub_bu_abbr);
                                        return cgEntry ? (
                                            <SelectItem key={cgEntry.id} value={String(cgEntry.id)}>
                                                {bu.bu_abbr} / {sub.sub_bu_abbr}{sub.sub_bu_name ? ` — ${sub.sub_bu_name}` : ''}
                                            </SelectItem>
                                        ) : null;
                                    })}
                                </React.Fragment>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* Impact warning */}
                {loadingImpact && <p className="text-xs text-slate-400 mt-3"><Loader2 className="h-3 w-3 animate-spin inline mr-1" /> Checking impact...</p>}
                {impact && selectedCgId && (
                    <div className={cn("mt-3 p-3 rounded-xl border text-sm",
                        impact.candidate_count > 1 ? "bg-amber-50 border-amber-200 text-amber-800" : "bg-emerald-50 border-emerald-200 text-emerald-800"
                    )}>
                        {impact.candidate_count > 1 ? (
                            <>
                                <p className="font-bold mb-1">This will update {impact.candidate_count} candidates with this company</p>
                                <p className="text-xs text-amber-600">
                                    {impact.candidates.map(c => c.name).join(", ")}
                                    {impact.candidate_count > 5 ? ` and ${impact.candidate_count - 5} more...` : ""}
                                </p>
                                <label className="flex items-center gap-2 mt-2 cursor-pointer">
                                    <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} className="rounded" />
                                    <span className="text-xs font-bold">I understand, proceed</span>
                                </label>
                            </>
                        ) : (
                            <p className="font-medium">Only {candidate.name} will be affected.</p>
                        )}
                    </div>
                )}

                {/* No company note */}
                {!hasCompany && (
                    <p className="text-xs text-slate-400 mt-2">
                        No current company found — this will save directly to this candidate's profile only.
                    </p>
                )}

                <div className="flex gap-3 mt-4">
                    <Button variant="outline" className="flex-1 rounded-xl" onClick={onClose} disabled={saving}>Cancel</Button>
                    <Button
                        className="flex-1 rounded-xl"
                        onClick={handleSave}
                        disabled={!selectedCgId || saving || (!!needsConfirm && !confirmed)}
                    >
                        {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                        Save
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// ─── Add Dialog ───────────────────────────────────────────────────────────────

function AddInternalDialog({ open, onClose, options, onSuccess }: {
    open: boolean; onClose: () => void; options: InternalFilterOptions; onSuccess: () => void;
}) {
    const [form, setForm] = useState({ name: "", position: "", bu: "", sub_bu: "", job_grade: "", hire_date: "", employee_id: "", linkedin_url: "", note: "" });
    const [submitting, setSubmitting] = useState(false);
    const set = (k: string, v: string) => setForm(prev => ({ ...prev, [k]: v }));

    const handleSubmit = async () => {
        if (!form.name.trim()) { toast.error("Name is required"); return; }
        setSubmitting(true);
        const result = await addInternalCandidate({
            name: form.name.trim(), position: form.position || undefined,
            bu: form.bu || undefined, sub_bu: form.sub_bu || undefined,
            job_grade: form.job_grade ? parseInt(form.job_grade) : undefined,
            hire_date: form.hire_date || undefined, employee_id: form.employee_id || undefined,
            linkedin_url: form.linkedin_url || undefined, note: form.note || undefined,
        });
        setSubmitting(false);
        if (result.success) {
            toast.success(`Added ${form.name} (${result.candidate_id})`);
            setForm({ name: "", position: "", bu: "", sub_bu: "", job_grade: "", hire_date: "", employee_id: "", linkedin_url: "", note: "" });
            onSuccess();
        } else toast.error(result.error || "Failed to add");
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-lg rounded-2xl">
                <DialogHeader><DialogTitle className="flex items-center gap-2"><UserCheck className="h-5 w-5 text-indigo-600" /> Add Internal Candidate</DialogTitle></DialogHeader>
                <div className="grid grid-cols-2 gap-3 mt-2">
                    <div className="col-span-2"><label className="text-xs font-bold text-slate-600 mb-1 block">Full Name *</label>
                        <Input placeholder="e.g. John Smith" value={form.name} onChange={e => set("name", e.target.value)} className="rounded-lg" /></div>
                    <div><label className="text-xs font-bold text-slate-600 mb-1 block">Position</label>
                        <Input value={form.position} onChange={e => set("position", e.target.value)} className="rounded-lg" /></div>
                    <div><label className="text-xs font-bold text-slate-600 mb-1 block">Employee ID</label>
                        <Input value={form.employee_id} onChange={e => set("employee_id", e.target.value)} className="rounded-lg" /></div>
                    <div><label className="text-xs font-bold text-slate-600 mb-1 block">BU</label>
                        <Input value={form.bu} onChange={e => set("bu", e.target.value)} list="bu-list" className="rounded-lg" />
                        <datalist id="bu-list">{(options as any).bus?.map((b: string) => <option key={b} value={b} />)}</datalist></div>
                    <div><label className="text-xs font-bold text-slate-600 mb-1 block">Sub-BU</label>
                        <Input value={form.sub_bu} onChange={e => set("sub_bu", e.target.value)} list="sub-bu-list" className="rounded-lg" />
                        <datalist id="sub-bu-list">{(options as any).sub_bus?.map((s: string) => <option key={s} value={s} />)}</datalist></div>
                    <div><label className="text-xs font-bold text-slate-600 mb-1 block">Job Grade</label>
                        <Input type="number" value={form.job_grade} onChange={e => set("job_grade", e.target.value)} className="rounded-lg" /></div>
                    <div><label className="text-xs font-bold text-slate-600 mb-1 block">Hire Date</label>
                        <Input type="date" value={form.hire_date} onChange={e => set("hire_date", e.target.value)} className="rounded-lg" /></div>
                    <div className="col-span-2"><label className="text-xs font-bold text-slate-600 mb-1 block">LinkedIn URL</label>
                        <Input value={form.linkedin_url} onChange={e => set("linkedin_url", e.target.value)} className="rounded-lg" /></div>
                    <div className="col-span-2"><label className="text-xs font-bold text-slate-600 mb-1 block">Note</label>
                        <Input value={form.note} onChange={e => set("note", e.target.value)} className="rounded-lg" /></div>
                </div>
                <div className="flex gap-3 mt-4">
                    <Button variant="outline" className="flex-1 rounded-xl" onClick={onClose} disabled={submitting}>Cancel</Button>
                    <Button className="flex-1 rounded-xl" onClick={handleSubmit} disabled={submitting}>
                        {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Add
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// ─── Edit Dialog ──────────────────────────────────────────────────────────────

function EditInternalDialog({ candidate, options, onClose, onSuccess }: {
    candidate: InternalCandidate; options: InternalFilterOptions; onClose: () => void; onSuccess: () => void;
}) {
    const [form, setForm] = useState({
        position: candidate.position || "", bu: candidate.bu || "", sub_bu: candidate.sub_bu || "",
        job_grade: candidate.job_grade?.toString() || "", hire_date: candidate.hire_date || "",
        employee_id: candidate.employee_id || "", linkedIn: candidate.linkedin || "", note: candidate.note || "",
    });
    const [submitting, setSubmitting] = useState(false);
    const set = (k: string, v: string) => setForm(prev => ({ ...prev, [k]: v }));

    const handleSubmit = async () => {
        if (!candidate.employment_record_id) { toast.error("No employment record"); return; }
        setSubmitting(true);
        const result = await updateInternalEmploymentRecord(candidate.employment_record_id, {
            position: form.position || undefined, bu: form.bu || undefined, sub_bu: form.sub_bu || undefined,
            job_grade: form.job_grade ? parseInt(form.job_grade) : null,
            hire_date: form.hire_date || undefined, employee_id: form.employee_id || undefined,
            linkedIn: form.linkedIn || undefined, note: form.note || undefined,
        });
        setSubmitting(false);
        if (result.success) { toast.success("Updated"); onSuccess(); }
        else toast.error(result.error || "Failed");
    };

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-lg rounded-2xl">
                <DialogHeader><DialogTitle className="flex items-center gap-2"><Pencil className="h-5 w-5 text-indigo-600" /> Edit — {candidate.name}</DialogTitle></DialogHeader>
                {!candidate.employment_record_id && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-sm">
                        <AlertTriangle className="h-4 w-4 shrink-0" /> No employment record found.
                    </div>
                )}
                <div className="grid grid-cols-2 gap-3 mt-1">
                    <div><label className="text-xs font-bold text-slate-600 mb-1 block">Position</label><Input value={form.position} onChange={e => set("position", e.target.value)} className="rounded-lg" /></div>
                    <div><label className="text-xs font-bold text-slate-600 mb-1 block">Employee ID</label><Input value={form.employee_id} onChange={e => set("employee_id", e.target.value)} className="rounded-lg" /></div>
                    <div><label className="text-xs font-bold text-slate-600 mb-1 block">BU</label>
                        <Input value={form.bu} onChange={e => set("bu", e.target.value)} list="edit-bu-list" className="rounded-lg" />
                        <datalist id="edit-bu-list">{(options as any).bus?.map((b: string) => <option key={b} value={b} />)}</datalist></div>
                    <div><label className="text-xs font-bold text-slate-600 mb-1 block">Sub-BU</label>
                        <Input value={form.sub_bu} onChange={e => set("sub_bu", e.target.value)} list="edit-sub-bu-list" className="rounded-lg" />
                        <datalist id="edit-sub-bu-list">{(options as any).sub_bus?.map((s: string) => <option key={s} value={s} />)}</datalist></div>
                    <div><label className="text-xs font-bold text-slate-600 mb-1 block">Job Grade</label><Input type="number" value={form.job_grade} onChange={e => set("job_grade", e.target.value)} className="rounded-lg" /></div>
                    <div><label className="text-xs font-bold text-slate-600 mb-1 block">Hire Date</label><Input type="date" value={form.hire_date} onChange={e => set("hire_date", e.target.value)} className="rounded-lg" /></div>
                    <div className="col-span-2"><label className="text-xs font-bold text-slate-600 mb-1 block">LinkedIn</label><Input value={form.linkedIn} onChange={e => set("linkedIn", e.target.value)} className="rounded-lg" /></div>
                    <div className="col-span-2"><label className="text-xs font-bold text-slate-600 mb-1 block">Note</label><Input value={form.note} onChange={e => set("note", e.target.value)} className="rounded-lg" /></div>
                </div>
                <div className="flex gap-3 mt-4">
                    <Button variant="outline" className="flex-1 rounded-xl" onClick={onClose} disabled={submitting}>Cancel</Button>
                    <Button className="flex-1 rounded-xl" onClick={handleSubmit} disabled={submitting || !candidate.employment_record_id}>
                        {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Save Changes
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// ─── Resign Dialog ────────────────────────────────────────────────────────────

function ResignDialog({ candidate, onClose, onSuccess }: {
    candidate: InternalCandidate; onClose: () => void; onSuccess: () => void;
}) {
    const [resignDate, setResignDate] = useState(new Date().toISOString().split('T')[0]);
    const [reason, setReason] = useState("");
    const [note, setNote] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (!resignDate) { toast.error("Resign date is required"); return; }
        setSubmitting(true);
        const result = await markAsResigned(candidate.employment_record_id!, resignDate, reason, note);
        setSubmitting(false);
        if (result.success) { toast.success(`${candidate.name} marked as resigned`); onSuccess(); }
        else toast.error(result.error || "Failed");
    };

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md rounded-2xl">
                <DialogHeader><DialogTitle className="flex items-center gap-2 text-red-600"><UserX className="h-5 w-5" /> Mark as Resigned</DialogTitle></DialogHeader>
                <div className="p-3 rounded-xl bg-slate-50 border mb-3">
                    <p className="text-sm font-bold text-slate-800">{candidate.name}</p>
                    <p className="text-xs text-slate-500">{candidate.position} · {candidate.bu}</p>
                </div>
                <div className="space-y-3">
                    <div><label className="text-xs font-bold text-slate-600 mb-1 block">Resign Date *</label><Input type="date" value={resignDate} onChange={e => setResignDate(e.target.value)} className="rounded-lg" /></div>
                    <div><label className="text-xs font-bold text-slate-600 mb-1 block">Resignation Reason</label><Input value={reason} onChange={e => setReason(e.target.value)} className="rounded-lg" /></div>
                    <div><label className="text-xs font-bold text-slate-600 mb-1 block">Note</label><Input value={note} onChange={e => setNote(e.target.value)} className="rounded-lg" /></div>
                </div>
                <div className="flex gap-3 mt-4">
                    <Button variant="outline" className="flex-1 rounded-xl" onClick={onClose} disabled={submitting}>Cancel</Button>
                    <Button className="flex-1 rounded-xl bg-red-600 hover:bg-red-700 text-white" onClick={handleSubmit} disabled={submitting}>
                        {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Confirm Resign
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
