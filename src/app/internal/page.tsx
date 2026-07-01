"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
    Search, Plus, Pencil, UserX, UserCheck,
    Loader2, AlertTriangle, ExternalLink, X, Download,
    Building2, Check, ChevronDown, ChevronRight, Filter, ChevronsUpDown,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
    getInternalCandidates, getInternalFilterOptions,
    addInternalCandidate, updateInternalEmploymentRecord, markAsResigned,
    swapCandidateInternalStatus,
    type InternalCandidate, type InternalFilterOptions,
} from "@/app/actions/internal-candidates";
import {
    getCgBuTree, getCgGroupCompanies,
    saveCandidateCgProfile, addCgGroupCompany,
    type CgBuTree, type CgGroupCompany,
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
    const [sourceFilter, setSourceFilter] = useState<"all" | "group1" | "group2">("all");

    const [candidates, setCandidates] = useState<InternalCandidate[]>([]);
    const [options, setOptions] = useState<InternalFilterOptions>({ bus: [], sub_bus: [], job_grades: [] } as any);
    const [loading, setLoading] = useState(true);

    const [buTree, setBuTree] = useState<CgBuTree[]>([]);
    const [cgCompanies, setCgCompanies] = useState<CgGroupCompany[]>([]);

    // column filters (live in filter bar)
    const [colFilterCompanies, setColFilterCompanies] = useState<string[]>([]);
    const [colFilterBu, setColFilterBu] = useState<string[]>([]);
    const [colFilterSubBu, setColFilterSubBu] = useState<string[]>([]);

    // bulk select
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [bulkBuOpen, setBulkBuOpen] = useState(false);

    const [addOpen, setAddOpen] = useState(false);
    const [editTarget, setEditTarget] = useState<InternalCandidate | null>(null);
    const [resignTarget, setResignTarget] = useState<InternalCandidate | null>(null);
    const [buEditTarget, setBuEditTarget] = useState<InternalCandidate | null>(null);
    const [sheetCandidateId, setSheetCandidateId] = useState<string | null>(null);
    const [isSheetOpen, setIsSheetOpen] = useState(false);
    const [mismatchTarget, setMismatchTarget] = useState<InternalCandidate | null>(null);

    const loadPeople = useCallback(async () => {
        setLoading(true);
        const [data, opts] = await Promise.all([
            getInternalCandidates({ search: search || undefined }),
            getInternalFilterOptions(),
        ]);
        setCandidates(data);
        setOptions(opts);
        setLoading(false);
    }, [search]);

    const loadSetupData = useCallback(async () => {
        const [tree, comps] = await Promise.all([getCgBuTree(), getCgGroupCompanies()]);
        setBuTree(tree);
        setCgCompanies(comps);
    }, []);

    useEffect(() => { loadSetupData(); }, [loadSetupData]);
    useEffect(() => {
        const t = setTimeout(loadPeople, 300);
        return () => clearTimeout(t);
    }, [loadPeople]);

    const isActive = (c: InternalCandidate) =>
        c.hiring_status === 'Active' || (!c.hiring_status && c.candidate_status?.includes('Internal Candidate'));
    const isExCentral = (c: InternalCandidate) =>
        c.hiring_status === 'Resigned' || (!c.hiring_status && c.candidate_status?.includes('Ex-Central'));

    const activeCount = candidates.filter(isActive).length;
    const exCentralCount = candidates.filter(isExCentral).length;
    const allCount = candidates.length;

    const displayed = candidates
        .filter(c => {
            if (statusTab === 'Active') return isActive(c);
            if (statusTab === 'Ex-Central') return isExCentral(c);
            return true;
        })
        .filter(c => sourceFilter === 'all' || c.source === sourceFilter)
        .filter(c => !colFilterCompanies.length || colFilterCompanies.includes(c.exp_company || ''))
        .filter(c => {
            if (!colFilterBu.length) return true;
            if (colFilterBu.includes('__unassigned__')) {
                const unassignedMatch = c.source !== 'group1' && !getBu(c);
                const otherSelected = colFilterBu.filter(b => b !== '__unassigned__');
                return unassignedMatch || (otherSelected.length > 0 && otherSelected.includes(getBu(c) || ''));
            }
            return colFilterBu.includes(getBu(c) || '');
        })
        .filter(c => !colFilterSubBu.length || colFilterSubBu.includes(getSubBu(c) || ''));

    // base pool for dropdown options — apply status + source filter only (not column filters)
    const optionPool = candidates
        .filter(c => {
            if (statusTab === 'Active') return isActive(c);
            if (statusTab === 'Ex-Central') return isExCentral(c);
            return true;
        })
        .filter(c => sourceFilter === 'all' || c.source === sourceFilter);

    const allCompanyOptions = Array.from(new Set(optionPool.map(c => c.exp_company || '').filter(Boolean))).sort();
    const allBuOptions = Array.from(new Set(optionPool.map(c => getBu(c) || '').filter(Boolean))).sort();
    const allSubBuOptions = Array.from(
        new Set(
            optionPool
                .filter(c => !colFilterBu.length || colFilterBu.includes(getBu(c) || ''))
                .map(c => getSubBu(c) || '')
                .filter(Boolean)
        )
    ).sort();

    // only group2 rows are selectable (group1 BU is read-only)
    const selectableIds = displayed.filter(c => c.source !== 'group1').map(c => c.candidate_id);
    const allSelected = selectableIds.length > 0 && selectableIds.every(id => selectedIds.has(id));
    const someSelected = selectableIds.some(id => selectedIds.has(id));
    const toggleSelectAll = (checked: boolean) => {
        const next = new Set(selectedIds);
        selectableIds.forEach(id => checked ? next.add(id) : next.delete(id));
        setSelectedIds(next);
    };
    const toggleRow = (id: string, checked: boolean) => {
        const next = new Set(selectedIds);
        checked ? next.add(id) : next.delete(id);
        setSelectedIds(next);
    };

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
                        { key: 'company-setup', label: 'Company Setup' },
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
                {/* Filter bar — row 1: status + search + source */}
                <div className="px-8 pt-4 pb-2 bg-white dark:bg-slate-900 border-b">
                    <div className="flex items-center gap-3">
                        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl shrink-0">
                            {([
                                { key: 'Active', label: `Active (${activeCount})`, active: 'bg-emerald-500' },
                                { key: 'Ex-Central', label: `Ex-Central (${exCentralCount})`, active: 'bg-slate-600' },
                                { key: 'All', label: `All (${allCount})`, active: 'bg-slate-800' },
                            ] as { key: StatusTab; label: string; active: string }[]).map(t => (
                                <button key={t.key} onClick={() => setStatusTab(t.key)}
                                    className={cn("px-4 py-1.5 rounded-lg text-sm font-bold transition-all",
                                        statusTab === t.key ? `${t.active} text-white shadow-sm` : "text-slate-500 hover:text-slate-700"
                                    )}>
                                    {t.label}
                                </button>
                            ))}
                        </div>
                        <div className="relative min-w-[180px] max-w-xs flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input placeholder="Search name or ID..." className="pl-9 h-9 rounded-lg border-slate-200"
                                value={search} onChange={e => setSearch(e.target.value)} />
                        </div>
                        <Select value={sourceFilter} onValueChange={v => setSourceFilter(v as any)}>
                            <SelectTrigger className="h-9 w-44 rounded-lg border-slate-200 text-sm shrink-0">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Sources</SelectItem>
                                <SelectItem value="group1">Executive Recruit (ER)</SelectItem>
                                <SelectItem value="group2">Other (Profile only)</SelectItem>
                            </SelectContent>
                        </Select>
                        <span className="ml-auto text-xs font-bold text-slate-400 uppercase tracking-wider shrink-0">{displayed.length} records</span>
                    </div>

                    {/* Row 2: column filters — always rendered so layout never shifts */}
                    <div className="flex items-center gap-2 mt-2">
                        <MultiSelectFilter
                            options={allCompanyOptions}
                            selected={colFilterCompanies}
                            onChange={setColFilterCompanies}
                            label="Company"
                        />
                        <MultiSelectFilter
                            options={['⚠ Unassigned', ...allBuOptions]}
                            selected={colFilterBu.map(b => b === '__unassigned__' ? '⚠ Unassigned' : b)}
                            onChange={vals => { setColFilterBu(vals.map(v => v === '⚠ Unassigned' ? '__unassigned__' : v)); setColFilterSubBu([]); }}
                            label="BU"
                        />
                        <MultiSelectFilter
                            options={allSubBuOptions}
                            selected={colFilterSubBu}
                            onChange={setColFilterSubBu}
                            label="Sub-BU"
                        />
                        <Button variant="ghost" size="sm"
                            className={cn("h-8 text-xs gap-1 text-slate-500 transition-opacity",
                                (search || sourceFilter !== 'all' || colFilterCompanies.length > 0 || colFilterBu.length > 0 || colFilterSubBu.length > 0)
                                    ? "opacity-100" : "opacity-0 pointer-events-none"
                            )}
                            onClick={() => { setSearch(""); setSourceFilter("all"); setColFilterCompanies([]); setColFilterBu([]); setColFilterSubBu([]); }}>
                            <X className="h-3 w-3" /> Clear all
                        </Button>
                    </div>
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
                        <div className="bg-white dark:bg-slate-900 rounded-2xl border shadow-sm overflow-hidden">
                            <div className="overflow-x-auto">
                            <table className="w-full text-sm min-w-[1200px]">
                                <thead>
                                    <tr className="border-b bg-slate-50 dark:bg-slate-800/50 text-[11px] font-black uppercase tracking-wider text-slate-500">
                                        <th className="px-3 py-3 w-10">
                                            <Checkbox
                                                checked={allSelected}
                                                ref={el => { if (el) (el as any).indeterminate = someSelected && !allSelected; }}
                                                onCheckedChange={v => toggleSelectAll(!!v)}
                                                className="rounded"
                                            />
                                        </th>
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
                                        const isGroup1 = c.source === 'group1';
                                        const isActiveCand = isActive(c);
                                        const isExCentralCand = isExCentral(c);
                                        return (
                                            <tr key={c.candidate_id} className={cn("hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors", selectedIds.has(c.candidate_id) && "bg-indigo-50/60")}>
                                                {/* Checkbox — only group2 */}
                                                <td className="px-3 py-3">
                                                    {!isGroup1 && (
                                                        <Checkbox
                                                            checked={selectedIds.has(c.candidate_id)}
                                                            onCheckedChange={v => toggleRow(c.candidate_id, !!v)}
                                                            className="rounded"
                                                        />
                                                    )}
                                                </td>
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
                                                    {isExCentralCand && c.cg_prev_position && (
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
                                                    {isExCentralCand && c.cg_prev_company && (
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
                                                    ) : (
                                                        <button onClick={() => setBuEditTarget(c)}
                                                            className="flex items-center gap-1.5 flex-wrap group hover:bg-slate-100 rounded-lg px-2 py-1 -mx-2 transition-colors min-w-[80px]">
                                                            {bu ? (
                                                                <>
                                                                    <Badge variant="secondary" className="text-[10px] font-bold bg-indigo-50 text-indigo-700 border-indigo-100">{bu}</Badge>
                                                                    {sub_bu && <span className="text-xs text-slate-500">{sub_bu}</span>}
                                                                </>
                                                            ) : (
                                                                <span className="text-amber-600 text-xs font-bold flex items-center gap-1">
                                                                    <Building2 className="h-3 w-3" /> Assign BU
                                                                </span>
                                                            )}
                                                            <Pencil className="h-3 w-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity ml-auto" />
                                                        </button>
                                                    )}
                                                </td>

                                                <td className="px-4 py-3">
                                                    {(c.job_grade ?? c.cg_job_grade) != null
                                                        ? <Badge variant="outline" className="text-[10px] font-black border-slate-200 text-slate-600">JG {c.job_grade ?? c.cg_job_grade}</Badge>
                                                        : <span className="text-slate-300">—</span>}
                                                </td>
                                                <td className="px-4 py-3 text-slate-600 text-xs">
                                                    {c.hire_date
                                                        ? new Date(c.hire_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                                                        : <span className="text-slate-300">—</span>}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-1.5">
                                                        {isActiveCand
                                                            ? <Badge className="bg-emerald-100 text-emerald-700 border-none text-[10px] font-bold">Active</Badge>
                                                            : <Badge className="bg-slate-100 text-slate-500 border-none text-[10px] font-bold">Ex-Central</Badge>}
                                                        {c.status_mismatch && (
                                                            <button
                                                                onClick={() => setMismatchTarget(c)}
                                                                title={c.status_mismatch === 'should_be_ex_central' ? 'May have left CG — click to review' : 'May be back at CG — click to review'}
                                                                className="text-amber-500 hover:text-amber-600 transition-colors"
                                                            >
                                                                <AlertTriangle className="h-3.5 w-3.5" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-1.5 justify-end">
                                                        {isGroup1 && (<>
                                                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 rounded-lg hover:bg-indigo-50 hover:text-indigo-600"
                                                                onClick={() => setEditTarget(c)}>
                                                                <Pencil className="h-3.5 w-3.5" />
                                                            </Button>
                                                            {isActiveCand && c.employment_record_id && (
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
                        </div>
                    )}
                </div>
            </>)}

            {/* Floating bulk action bar */}
            {selectedIds.size > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 bg-slate-900 text-white rounded-2xl shadow-2xl px-5 py-3">
                    <span className="text-sm font-bold">{selectedIds.size} คนถูกเลือก</span>
                    <Button size="sm" className="h-8 px-4 text-xs rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-bold gap-1.5"
                        onClick={() => setBulkBuOpen(true)}>
                        <Building2 className="h-3.5 w-3.5" /> Assign BU
                    </Button>
                    <button onClick={() => setSelectedIds(new Set())} className="text-slate-400 hover:text-white transition-colors ml-1">
                        <X className="h-4 w-4" />
                    </button>
                </div>
            )}

            {bulkBuOpen && (
                <BulkBuAssignDialog
                    count={selectedIds.size}
                    buTree={buTree}
                    onClose={() => setBulkBuOpen(false)}
                    onAssign={async (buAbbr, subBuAbbr) => {
                        const { bulkAssignCandidateBu } = await import("@/app/actions/cg-group-companies");
                        const result = await bulkAssignCandidateBu([...selectedIds], buAbbr, subBuAbbr);
                        if (result.success) {
                            toast.success(`Assigned ${result.count} คน → ${subBuAbbr}`);
                            setSelectedIds(new Set());
                            setBulkBuOpen(false);
                            refresh();
                        } else {
                            toast.error(result.error || "Failed");
                        }
                    }}
                />
            )}

            {/* ── Tab: Company Setup ───────────────────────────────────────────── */}
            {mainTab === 'company-setup' && (
                <TabCompanySetup
                    companies={cgCompanies}
                    buTree={buTree}
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

            {mismatchTarget && (
                <StatusMismatchDialog
                    candidate={mismatchTarget}
                    onClose={() => setMismatchTarget(null)}
                    onSuccess={() => { setMismatchTarget(null); refresh(); }}
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

// ─── Multi-Select Filter — Excel / Google Sheets style ────────────────────────

function MultiSelectFilter({ options, selected, onChange, label }: {
    options: string[];
    selected: string[];
    onChange: (v: string[]) => void;
    label?: string;
}) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    // pending = draft selection inside the dropdown; committed to parent only on Apply
    const [pending, setPending] = useState<string[]>(selected);

    // sync pending when dropdown opens
    const handleOpenChange = (o: boolean) => {
        if (o) setPending(selected);
        else setSearch("");
        setOpen(o);
    };

    const filtered = options.filter(o => o.toLowerCase().includes(search.toLowerCase()));
    const allFilteredSelected = filtered.length > 0 && filtered.every(o => pending.includes(o));
    const someFilteredSelected = filtered.some(o => pending.includes(o));

    const toggleOne = (val: string) =>
        setPending(p => p.includes(val) ? p.filter(s => s !== val) : [...p, val]);

    const toggleAll = () =>
        setPending(allFilteredSelected
            ? pending.filter(p => !filtered.includes(p))   // deselect filtered
            : [...new Set([...pending, ...filtered])]       // add all filtered
        );

    const apply = () => { onChange(pending); setOpen(false); setSearch(""); };
    const cancel = () => { setPending(selected); setOpen(false); setSearch(""); };
    const isActive = selected.length > 0;

    return (
        <Popover open={open} onOpenChange={handleOpenChange}>
            <PopoverTrigger asChild>
                <Button variant="outline" size="sm"
                    className={cn(
                        "h-8 gap-1.5 rounded-lg text-xs font-normal border-slate-200",
                        isActive && "border-indigo-400 bg-indigo-50 text-indigo-700 font-bold"
                    )}
                >
                    {isActive
                        ? <><Filter className="h-3 w-3" />{label}: {selected.length}</>
                        : <><ChevronsUpDown className="h-3 w-3 text-slate-400" />{label || "Filter"}</>
                    }
                    {isActive && (
                        <span onPointerDown={e => { e.preventDefault(); e.stopPropagation(); onChange([]); setPending([]); }}
                            className="ml-0.5 hover:text-rose-500 transition-colors">
                            <X className="h-3 w-3" />
                        </span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent
                className="w-64 p-0 rounded-xl shadow-xl border border-slate-200"
                align="start" side="bottom"
                onInteractOutside={cancel}
            >
                {/* Search */}
                <div className="flex items-center gap-2 px-3 py-2 border-b">
                    <Search className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <input autoFocus value={search} onChange={e => setSearch(e.target.value)}
                        placeholder={`ค้นหา ${label?.toLowerCase() || ''}…`}
                        className="w-full text-xs outline-none bg-transparent placeholder:text-slate-300" />
                    {search && (
                        <button onPointerDown={e => { e.preventDefault(); setSearch(""); }}
                            className="text-slate-300 hover:text-slate-500">
                            <X className="h-3 w-3" />
                        </button>
                    )}
                </div>

                {/* Select All row */}
                <label className="flex items-center gap-2 px-3 py-2 border-b bg-slate-50 cursor-pointer select-none hover:bg-slate-100">
                    <Checkbox
                        checked={allFilteredSelected}
                        ref={el => { if (el) (el as any).indeterminate = someFilteredSelected && !allFilteredSelected; }}
                        onCheckedChange={toggleAll}
                        className="rounded h-3.5 w-3.5 shrink-0"
                    />
                    <span className="text-xs font-bold text-slate-600">
                        {allFilteredSelected ? "Deselect All" : "Select All"}
                        {search && <span className="text-slate-400 font-normal"> ({filtered.length})</span>}
                    </span>
                </label>

                {/* List */}
                <div className="max-h-52 overflow-y-auto py-1">
                    {filtered.length === 0
                        ? <p className="text-xs text-slate-400 text-center py-4">ไม่พบ</p>
                        : filtered.map(opt => (
                            <label key={opt} className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 cursor-pointer select-none">
                                <Checkbox
                                    checked={pending.includes(opt)}
                                    onCheckedChange={() => toggleOne(opt)}
                                    className="rounded h-3.5 w-3.5 shrink-0"
                                />
                                <span className="text-xs text-slate-700 truncate">{opt}</span>
                            </label>
                        ))
                    }
                </div>

                {/* Footer */}
                <div className="border-t px-3 py-2 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-slate-400">
                        {pending.length > 0 ? `${pending.length} selected` : "No filter"}
                    </span>
                    <div className="flex gap-2">
                        <button onPointerDown={e => { e.preventDefault(); cancel(); }}
                            className="text-xs text-slate-500 hover:text-slate-700 font-medium px-2 py-1 rounded-lg hover:bg-slate-100">
                            Cancel
                        </button>
                        <button onPointerDown={e => { e.preventDefault(); apply(); }}
                            className="text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1 rounded-lg">
                            Apply
                        </button>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}

// ─── Bulk BU Assign Dialog ────────────────────────────────────────────────────

function BulkBuAssignDialog({ count, buTree, onClose, onAssign }: {
    count: number;
    buTree: CgBuTree[];
    onClose: () => void;
    onAssign: (buAbbr: string, subBuAbbr: string) => Promise<void>;
}) {
    const [selectedBu, setSelectedBu] = useState("");
    const [selectedSubBu, setSelectedSubBu] = useState("");
    const [saving, setSaving] = useState(false);
    const subBus = buTree.find(b => b.bu_abbr === selectedBu)?.sub_bus || [];

    const handleAssign = async () => {
        if (!selectedBu || !selectedSubBu) { return; }
        setSaving(true);
        await onAssign(selectedBu, selectedSubBu);
        setSaving(false);
    };

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-sm rounded-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-indigo-600" /> Assign BU — {count} คน
                    </DialogTitle>
                </DialogHeader>
                <div className="space-y-3 mt-2">
                    <div>
                        <label className="text-xs font-bold text-slate-600 mb-1.5 block">BU</label>
                        <Select value={selectedBu || "_none"} onValueChange={v => { setSelectedBu(v === '_none' ? '' : v); setSelectedSubBu(''); }}>
                            <SelectTrigger className="rounded-lg">
                                <SelectValue placeholder="Select BU" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="_none">— Select —</SelectItem>
                                {buTree.map(b => <SelectItem key={b.bu_abbr} value={b.bu_abbr}>{b.bu_abbr}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-600 mb-1.5 block">Sub-BU</label>
                        <Select value={selectedSubBu || "_none"} onValueChange={v => setSelectedSubBu(v === '_none' ? '' : v)} disabled={!selectedBu}>
                            <SelectTrigger className="rounded-lg">
                                <SelectValue placeholder={selectedBu ? "Select Sub-BU" : "Select BU first"} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="_none">— Select —</SelectItem>
                                {subBus.map(s => <SelectItem key={s.sub_bu_abbr} value={s.sub_bu_abbr}>{s.sub_bu_abbr}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <div className="flex gap-3 mt-5">
                    <Button variant="outline" className="flex-1 rounded-xl" onClick={onClose} disabled={saving}>Cancel</Button>
                    <Button className="flex-1 rounded-xl" onClick={handleAssign}
                        disabled={saving || !selectedBu || !selectedSubBu}>
                        {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                        Assign {count} คน
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// ─── Status Mismatch Dialog ───────────────────────────────────────────────────

function StatusMismatchDialog({ candidate, onClose, onSuccess }: {
    candidate: InternalCandidate;
    onClose: () => void;
    onSuccess: () => void;
}) {
    const [saving, setSaving] = useState(false);
    const isToExCentral = candidate.status_mismatch === 'should_be_ex_central';
    const from = isToExCentral ? 'Internal Candidate' : 'Ex-Central';
    const to = isToExCentral ? 'Ex-Central' : 'Internal Candidate';

    const handleConfirm = async () => {
        setSaving(true);
        const result = await swapCandidateInternalStatus(candidate.candidate_id, from, to);
        setSaving(false);
        if (result.success) {
            toast.success(`${candidate.name} → ${to}`);
            onSuccess();
        } else {
            toast.error(result.error || "Failed");
        }
    };

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-sm rounded-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-amber-600">
                        <AlertTriangle className="h-5 w-5" /> Status Mismatch Detected
                    </DialogTitle>
                </DialogHeader>
                <div className="p-3 rounded-xl bg-slate-50 border mb-3">
                    <p className="text-sm font-bold text-slate-800">{candidate.name}</p>
                    <p className="text-xs text-slate-500">{candidate.candidate_id}</p>
                    {candidate.exp_company && (
                        <p className="text-xs text-slate-500 mt-1">
                            {candidate.exp_label === 'Current' ? 'Currently at' : 'Last at'}: <span className="font-medium">{candidate.exp_company}</span>
                        </p>
                    )}
                </div>
                <p className="text-sm text-slate-600">
                    {isToExCentral
                        ? "ระบบตรวจพบว่า candidate นี้อาจไม่ได้ทำงานที่ CG Group แล้ว ต้องการเปลี่ยนสถานะเป็น Ex-Central?"
                        : "ระบบตรวจพบว่า candidate นี้อาจกลับมาทำงานที่ CG Group แล้ว ต้องการเปลี่ยนสถานะเป็น Active (Internal Candidate)?"}
                </p>
                <div className="flex items-center gap-2 mt-3 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-700">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    ระบบตรวจจากชื่อบริษัทในประวัติ — อาจไม่แม่นยำ 100% ตรวจสอบก่อนยืนยัน
                </div>
                <div className="flex gap-3 mt-4">
                    <Button variant="outline" className="flex-1 rounded-xl" onClick={onClose} disabled={saving}>
                        ไม่ใช่ ปล่อยไว้
                    </Button>
                    <Button className="flex-1 rounded-xl" onClick={handleConfirm} disabled={saving}>
                        {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                        เปลี่ยนเป็น {to}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// ─── BU Edit Dialog (Group 2) ─────────────────────────────────────────────────

function BuEditDialog({ candidate, buTree, onClose, onSuccess }: {
    candidate: InternalCandidate;
    buTree: CgBuTree[];
    cgCompanies?: CgGroupCompany[];
    onClose: () => void;
    onSuccess: () => void;
}) {
    const [localTree, setLocalTree] = useState<CgBuTree[]>(buTree);
    const [selectedBu, setSelectedBu] = useState(candidate.cg_bu_abbr || "");
    const [selectedSubBu, setSelectedSubBu] = useState(candidate.cg_sub_bu_abbr || "");
    const [jobGrade, setJobGrade] = useState(candidate.cg_job_grade?.toString() || "");
    const [saving, setSaving] = useState(false);

    // Inline create BU
    const [creatingBu, setCreatingBu] = useState(false);
    const [newBuAbbr, setNewBuAbbr] = useState("");
    const [newBuName, setNewBuName] = useState("");

    // Inline create Sub-BU
    const [creatingSubBu, setCreatingSubBu] = useState(false);
    const [newSubBuAbbr, setNewSubBuAbbr] = useState("");
    const [newSubBuName, setNewSubBuName] = useState("");

    const subBusForSelected = localTree.find(b => b.bu_abbr === selectedBu)?.sub_bus || [];

    const refreshTree = async () => {
        const { getCgBuTree: getTree } = await import("@/app/actions/cg-group-companies");
        const tree = await getTree();
        setLocalTree(tree);
    };

    const handleCreateBu = async () => {
        if (!newBuAbbr.trim()) return;
        const result = await addCgGroupCompany({
            bu_abbr: newBuAbbr.trim().toUpperCase(),
            bu_name: newBuName.trim() || newBuAbbr.trim().toUpperCase(),
            sub_bu_abbr: newBuAbbr.trim().toUpperCase(),
            sub_bu_name: newBuName.trim() || undefined,
        });
        if (result.success) {
            await refreshTree();
            setSelectedBu(newBuAbbr.trim().toUpperCase());
            setSelectedSubBu(newBuAbbr.trim().toUpperCase());
            setNewBuAbbr(""); setNewBuName(""); setCreatingBu(false);
            toast.success("BU created");
        } else toast.error(result.error || "Failed");
    };

    const handleCreateSubBu = async () => {
        if (!selectedBu || !newSubBuAbbr.trim()) return;
        const buNode = localTree.find(b => b.bu_abbr === selectedBu);
        const result = await addCgGroupCompany({
            bu_abbr: selectedBu,
            bu_name: buNode?.bu_name || selectedBu,
            sub_bu_abbr: newSubBuAbbr.trim().toUpperCase(),
            sub_bu_name: newSubBuName.trim() || undefined,
        });
        if (result.success) {
            await refreshTree();
            setSelectedSubBu(newSubBuAbbr.trim().toUpperCase());
            setNewSubBuAbbr(""); setNewSubBuName(""); setCreatingSubBu(false);
            toast.success("Sub-BU created");
        } else toast.error(result.error || "Failed");
    };

    const handleSave = async () => {
        setSaving(true);
        const result = await saveCandidateCgProfile(
            candidate.candidate_id,
            selectedBu || null,
            selectedSubBu || null,
            'recruiter',
            jobGrade ? parseInt(jobGrade) : null,
        );
        setSaving(false);
        if (result.success) { toast.success("Saved"); onSuccess(); }
        else toast.error(result.error || "Failed");
    };

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md rounded-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Pencil className="h-5 w-5 text-indigo-600" /> Edit — {candidate.name}
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 mt-1">
                    {/* BU */}
                    <div>
                        <label className="text-xs font-bold text-slate-600 mb-1.5 block">BU</label>
                        {creatingBu ? (
                            <div className="flex gap-2 items-center">
                                <Input placeholder="Abbr" value={newBuAbbr} onChange={e => setNewBuAbbr(e.target.value)}
                                    className="rounded-lg w-24 uppercase" maxLength={10}
                                    onKeyDown={e => e.key === 'Enter' && handleCreateBu()} autoFocus />
                                <Input placeholder="Full name" value={newBuName} onChange={e => setNewBuName(e.target.value)}
                                    className="rounded-lg flex-1"
                                    onKeyDown={e => e.key === 'Enter' && handleCreateBu()} />
                                <Button size="sm" variant="ghost" className="px-2 text-emerald-600 hover:bg-emerald-50" onClick={handleCreateBu}><Check className="h-4 w-4" /></Button>
                                <Button size="sm" variant="ghost" className="px-2 text-slate-400 hover:bg-slate-100" onClick={() => setCreatingBu(false)}><X className="h-4 w-4" /></Button>
                            </div>
                        ) : (
                            <div className="flex gap-2">
                                <Select value={selectedBu || "_none"} onValueChange={v => { setSelectedBu(v === '_none' ? '' : v); setSelectedSubBu(''); }}>
                                    <SelectTrigger className="rounded-lg flex-1">
                                        <SelectValue placeholder="Select BU" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="_none">— None —</SelectItem>
                                        {localTree.map(b => (
                                            <SelectItem key={b.bu_abbr} value={b.bu_abbr}>{b.bu_abbr}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Button size="sm" variant="outline" className="rounded-lg px-2.5 shrink-0 text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                                    onClick={() => setCreatingBu(true)} title="New BU">
                                    <Plus className="h-4 w-4" />
                                </Button>
                            </div>
                        )}
                    </div>

                    {/* Sub-BU */}
                    <div>
                        <label className="text-xs font-bold text-slate-600 mb-1.5 block">Sub-BU</label>
                        {creatingSubBu ? (
                            <div className="flex gap-2 items-center">
                                <Input placeholder="Abbr" value={newSubBuAbbr} onChange={e => setNewSubBuAbbr(e.target.value)}
                                    className="rounded-lg w-24 uppercase" maxLength={10}
                                    onKeyDown={e => e.key === 'Enter' && handleCreateSubBu()} autoFocus />
                                <Input placeholder="Full name" value={newSubBuName} onChange={e => setNewSubBuName(e.target.value)}
                                    className="rounded-lg flex-1"
                                    onKeyDown={e => e.key === 'Enter' && handleCreateSubBu()} />
                                <Button size="sm" variant="ghost" className="px-2 text-emerald-600 hover:bg-emerald-50" onClick={handleCreateSubBu}><Check className="h-4 w-4" /></Button>
                                <Button size="sm" variant="ghost" className="px-2 text-slate-400 hover:bg-slate-100" onClick={() => setCreatingSubBu(false)}><X className="h-4 w-4" /></Button>
                            </div>
                        ) : (
                            <div className="flex gap-2">
                                <Select value={selectedSubBu || "_none"} onValueChange={v => setSelectedSubBu(v === '_none' ? '' : v)}
                                    disabled={!selectedBu}>
                                    <SelectTrigger className="rounded-lg flex-1">
                                        <SelectValue placeholder={selectedBu ? "Select Sub-BU" : "Select BU first"} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="_none">— None —</SelectItem>
                                        {subBusForSelected.map(s => (
                                            <SelectItem key={s.sub_bu_abbr} value={s.sub_bu_abbr}>
                                                {s.sub_bu_abbr}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Button size="sm" variant="outline" className="rounded-lg px-2.5 shrink-0 text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                                    disabled={!selectedBu}
                                    onClick={() => setCreatingSubBu(true)} title="New Sub-BU">
                                    <Plus className="h-4 w-4" />
                                </Button>
                            </div>
                        )}
                    </div>

                    {/* Job Grade */}
                    <div>
                        <label className="text-xs font-bold text-slate-600 mb-1.5 block">Job Grade</label>
                        <Input type="number" min={1} max={30} placeholder="e.g. 15"
                            value={jobGrade} onChange={e => setJobGrade(e.target.value)}
                            className="rounded-lg w-32" />
                    </div>
                </div>

                <div className="flex gap-3 mt-5">
                    <Button variant="outline" className="flex-1 rounded-xl" onClick={onClose} disabled={saving}>Cancel</Button>
                    <Button className="flex-1 rounded-xl" onClick={handleSave} disabled={saving}>
                        {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                        Save Changes
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
