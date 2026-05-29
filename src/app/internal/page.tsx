"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
    Users, Search, Filter, Plus, Building2, ChevronDown,
    Briefcase, UserCheck, UserX, Pencil, X, Check,
    Loader2, AlertTriangle, ExternalLink, Star
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
    getInternalCandidates,
    getInternalFilterOptions,
    addInternalCandidate,
    updateInternalEmploymentRecord,
    markAsResigned,
    type InternalCandidate,
    type InternalFilterOptions,
} from "@/app/actions/internal-candidates";
import { toast } from "@/lib/notifications";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

type Tab = "Active" | "Resigned" | "All";

export default function InternalCandidatePage() {
    const [tab, setTab] = useState<Tab>("Active");
    const [search, setSearch] = useState("");
    const [filterBu, setFilterBu] = useState("");
    const [filterSubBu, setFilterSubBu] = useState("");
    const [candidates, setCandidates] = useState<InternalCandidate[]>([]);
    const [options, setOptions] = useState<InternalFilterOptions>({ bus: [], sub_bus: [], job_grades: [] });
    const [loading, setLoading] = useState(true);

    const [addOpen, setAddOpen] = useState(false);
    const [editTarget, setEditTarget] = useState<InternalCandidate | null>(null);
    const [resignTarget, setResignTarget] = useState<InternalCandidate | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        const data = await getInternalCandidates({
            hiring_status: tab,
            bu: filterBu || undefined,
            sub_bu: filterSubBu || undefined,
            search: search || undefined,
        });
        setCandidates(data);
        setLoading(false);
    }, [tab, filterBu, filterSubBu, search]);

    useEffect(() => {
        getInternalFilterOptions().then(setOptions);
    }, []);

    useEffect(() => {
        const t = setTimeout(load, 300);
        return () => clearTimeout(t);
    }, [load]);

    const activeCount = candidates.filter(c =>
        c.hiring_status === 'Active' || (!c.hiring_status && c.candidate_status?.includes('Internal Candidate'))
    ).length;
    const resignedCount = candidates.filter(c =>
        c.hiring_status === 'Resigned' || (!c.hiring_status && c.candidate_status?.includes('Ex-Central'))
    ).length;

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 min-h-screen">
            {/* Header */}
            <div className="bg-white dark:bg-slate-900 border-b px-8 py-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-indigo-100 dark:bg-indigo-900/30">
                            <UserCheck className="h-6 w-6 text-indigo-600" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-slate-800 dark:text-slate-100">Internal Candidates</h1>
                            <p className="text-sm text-slate-500 font-medium">CG Group employees placed through CG Talent Hub</p>
                        </div>
                    </div>
                    <Button
                        className="gap-2 rounded-xl shadow-md"
                        onClick={() => setAddOpen(true)}
                    >
                        <Plus className="h-4 w-4" />
                        Add Internal Candidate
                    </Button>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 mt-5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-fit">
                    {(["Active", "Resigned", "All"] as Tab[]).map(t => (
                        <button
                            key={t}
                            onClick={() => setTab(t)}
                            className={cn(
                                "px-5 py-2 rounded-lg text-sm font-bold transition-all",
                                tab === t
                                    ? t === "Active" ? "bg-emerald-500 text-white shadow-sm"
                                        : t === "Resigned" ? "bg-slate-600 text-white shadow-sm"
                                        : "bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm"
                                    : "text-slate-500 hover:text-slate-700"
                            )}
                        >
                            {t}
                        </button>
                    ))}
                </div>
            </div>

            {/* Filters */}
            <div className="px-8 py-4 bg-white dark:bg-slate-900 border-b flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                        placeholder="Search name or ID..."
                        className="pl-9 h-9 rounded-lg border-slate-200"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
                <Select value={filterBu || "_all"} onValueChange={v => { setFilterBu(v === "_all" ? "" : v); setFilterSubBu(""); }}>
                    <SelectTrigger className="h-9 w-40 rounded-lg border-slate-200 text-sm">
                        <SelectValue placeholder="All BU" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="_all">All BU</SelectItem>
                        {options.bus.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                    </SelectContent>
                </Select>
                <Select value={filterSubBu || "_all"} onValueChange={v => setFilterSubBu(v === "_all" ? "" : v)}>
                    <SelectTrigger className="h-9 w-40 rounded-lg border-slate-200 text-sm">
                        <SelectValue placeholder="All Sub-BU" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="_all">All Sub-BU</SelectItem>
                        {(filterBu
                            ? options.sub_bus.filter(s => candidates.some(c => c.bu === filterBu && c.sub_bu === s))
                            : options.sub_bus
                        ).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                </Select>
                {(filterBu || filterSubBu || search) && (
                    <Button variant="ghost" size="sm" className="h-9 text-xs text-slate-500"
                        onClick={() => { setFilterBu(""); setFilterSubBu(""); setSearch(""); }}>
                        <X className="h-3 w-3 mr-1" /> Clear
                    </Button>
                )}
                <span className="ml-auto text-xs font-bold text-slate-400 uppercase tracking-wider">
                    {candidates.length} records
                </span>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto px-8 py-6">
                {loading ? (
                    <div className="flex items-center justify-center py-24 gap-3 text-slate-400">
                        <Loader2 className="h-6 w-6 animate-spin" />
                        <span className="font-medium">Loading...</span>
                    </div>
                ) : candidates.length === 0 ? (
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
                                    <th className="text-left px-4 py-3">Candidate</th>
                                    <th className="text-left px-4 py-3">Position</th>
                                    <th className="text-left px-4 py-3">BU</th>
                                    <th className="text-left px-4 py-3">Sub-BU</th>
                                    <th className="text-left px-4 py-3">JG</th>
                                    <th className="text-left px-4 py-3">Hire Date</th>
                                    <th className="text-left px-4 py-3">Status</th>
                                    <th className="text-right px-4 py-3">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {candidates.map((c, i) => {
                                    const isActive = c.hiring_status === 'Active' || (!c.hiring_status && c.candidate_status?.includes('Internal Candidate'));
                                    return (
                                        <tr key={c.candidate_id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors">
                                            <td className="px-4 py-3 text-slate-400 text-xs">{i + 1}</td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-3">
                                                    <Avatar className="h-9 w-9 border border-slate-100 shrink-0">
                                                        <AvatarImage src={c.photo || undefined} />
                                                        <AvatarFallback className="bg-indigo-50 text-indigo-600 font-black text-sm">
                                                            {c.name?.charAt(0)}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div>
                                                        <p className="font-bold text-slate-800 dark:text-slate-100">{c.name}</p>
                                                        <div className="flex items-center gap-1.5 mt-0.5">
                                                            <span className="text-[11px] text-slate-400 font-mono">{c.candidate_id}</span>
                                                            {c.linkedin && (
                                                                <a href={c.linkedin} target="_blank" rel="noreferrer"
                                                                    className="text-blue-500 hover:text-blue-700 transition-colors">
                                                                    <ExternalLink className="h-3 w-3" />
                                                                </a>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                                                {c.position || <span className="text-slate-300">—</span>}
                                            </td>
                                            <td className="px-4 py-3">
                                                {c.bu
                                                    ? <Badge variant="secondary" className="text-[10px] font-bold bg-indigo-50 text-indigo-700 border-indigo-100">{c.bu}</Badge>
                                                    : <span className="text-slate-300">—</span>}
                                            </td>
                                            <td className="px-4 py-3 text-slate-600 dark:text-slate-400 text-xs font-medium">
                                                {c.sub_bu || <span className="text-slate-300">—</span>}
                                            </td>
                                            <td className="px-4 py-3">
                                                {c.job_grade != null
                                                    ? <Badge variant="outline" className="text-[10px] font-black border-slate-200 text-slate-600">JG {c.job_grade}</Badge>
                                                    : <span className="text-slate-300">—</span>}
                                            </td>
                                            <td className="px-4 py-3 text-slate-600 dark:text-slate-400 text-xs">
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

            {/* Add Internal Candidate Dialog */}
            <AddInternalDialog
                open={addOpen}
                onClose={() => setAddOpen(false)}
                options={options}
                onSuccess={() => { setAddOpen(false); load(); }}
            />

            {/* Edit Dialog */}
            {editTarget && (
                <EditInternalDialog
                    candidate={editTarget}
                    options={options}
                    onClose={() => setEditTarget(null)}
                    onSuccess={() => { setEditTarget(null); load(); }}
                />
            )}

            {/* Resign Dialog */}
            {resignTarget && (
                <ResignDialog
                    candidate={resignTarget}
                    onClose={() => setResignTarget(null)}
                    onSuccess={() => { setResignTarget(null); load(); }}
                />
            )}
        </div>
    );
}

// ─── Add Internal Candidate Dialog ──────────────────────────────────────────

function AddInternalDialog({ open, onClose, options, onSuccess }: {
    open: boolean;
    onClose: () => void;
    options: InternalFilterOptions;
    onSuccess: () => void;
}) {
    const [form, setForm] = useState({
        name: "", position: "", bu: "", sub_bu: "",
        job_grade: "", hire_date: "", employee_id: "", linkedin_url: "", note: ""
    });
    const [submitting, setSubmitting] = useState(false);

    const set = (k: string, v: string) => setForm(prev => ({ ...prev, [k]: v }));

    const handleSubmit = async () => {
        if (!form.name.trim()) { toast.error("Name is required"); return; }
        setSubmitting(true);
        const result = await addInternalCandidate({
            name: form.name.trim(),
            position: form.position || undefined,
            bu: form.bu || undefined,
            sub_bu: form.sub_bu || undefined,
            job_grade: form.job_grade ? parseInt(form.job_grade) : undefined,
            hire_date: form.hire_date || undefined,
            employee_id: form.employee_id || undefined,
            linkedin_url: form.linkedin_url || undefined,
            note: form.note || undefined,
        });
        setSubmitting(false);
        if (result.success) {
            toast.success(`Added ${form.name} (${result.candidate_id})`);
            setForm({ name: "", position: "", bu: "", sub_bu: "", job_grade: "", hire_date: "", employee_id: "", linkedin_url: "", note: "" });
            onSuccess();
        } else {
            toast.error(result.error || "Failed to add");
        }
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-lg rounded-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <UserCheck className="h-5 w-5 text-indigo-600" />
                        Add Internal Candidate
                    </DialogTitle>
                </DialogHeader>
                <div className="grid grid-cols-2 gap-3 mt-2">
                    <div className="col-span-2">
                        <label className="text-xs font-bold text-slate-600 mb-1 block">Full Name *</label>
                        <Input placeholder="e.g. John Smith" value={form.name} onChange={e => set("name", e.target.value)} className="rounded-lg" />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-600 mb-1 block">Position</label>
                        <Input placeholder="e.g. GM" value={form.position} onChange={e => set("position", e.target.value)} className="rounded-lg" />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-600 mb-1 block">Employee ID</label>
                        <Input placeholder="e.g. EMP001" value={form.employee_id} onChange={e => set("employee_id", e.target.value)} className="rounded-lg" />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-600 mb-1 block">BU</label>
                        <Input placeholder="e.g. CRC" value={form.bu} onChange={e => set("bu", e.target.value)} list="bu-list" className="rounded-lg" />
                        <datalist id="bu-list">{options.bus.map(b => <option key={b} value={b} />)}</datalist>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-600 mb-1 block">Sub-BU</label>
                        <Input placeholder="e.g. CFG" value={form.sub_bu} onChange={e => set("sub_bu", e.target.value)} list="sub-bu-list" className="rounded-lg" />
                        <datalist id="sub-bu-list">{options.sub_bus.map(s => <option key={s} value={s} />)}</datalist>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-600 mb-1 block">Job Grade (JG)</label>
                        <Input type="number" placeholder="e.g. 20" value={form.job_grade} onChange={e => set("job_grade", e.target.value)} className="rounded-lg" />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-600 mb-1 block">Hire Date</label>
                        <Input type="date" value={form.hire_date} onChange={e => set("hire_date", e.target.value)} className="rounded-lg" />
                    </div>
                    <div className="col-span-2">
                        <label className="text-xs font-bold text-slate-600 mb-1 block">LinkedIn URL</label>
                        <Input placeholder="https://linkedin.com/in/..." value={form.linkedin_url} onChange={e => set("linkedin_url", e.target.value)} className="rounded-lg" />
                    </div>
                    <div className="col-span-2">
                        <label className="text-xs font-bold text-slate-600 mb-1 block">Note</label>
                        <Input placeholder="Optional note" value={form.note} onChange={e => set("note", e.target.value)} className="rounded-lg" />
                    </div>
                </div>
                <div className="flex gap-3 mt-4">
                    <Button variant="outline" className="flex-1 rounded-xl" onClick={onClose} disabled={submitting}>Cancel</Button>
                    <Button className="flex-1 rounded-xl" onClick={handleSubmit} disabled={submitting}>
                        {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                        Add Candidate
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// ─── Edit Dialog ─────────────────────────────────────────────────────────────

function EditInternalDialog({ candidate, options, onClose, onSuccess }: {
    candidate: InternalCandidate;
    options: InternalFilterOptions;
    onClose: () => void;
    onSuccess: () => void;
}) {
    const [form, setForm] = useState({
        position: candidate.position || "",
        bu: candidate.bu || "",
        sub_bu: candidate.sub_bu || "",
        job_grade: candidate.job_grade?.toString() || "",
        hire_date: candidate.hire_date || "",
        employee_id: candidate.employee_id || "",
        linkedIn: candidate.linkedin || "",
        note: candidate.note || "",
    });
    const [submitting, setSubmitting] = useState(false);
    const set = (k: string, v: string) => setForm(prev => ({ ...prev, [k]: v }));

    const handleSubmit = async () => {
        if (!candidate.employment_record_id) {
            toast.error("No employment record to update");
            return;
        }
        setSubmitting(true);
        const result = await updateInternalEmploymentRecord(candidate.employment_record_id, {
            position: form.position || undefined,
            bu: form.bu || undefined,
            sub_bu: form.sub_bu || undefined,
            job_grade: form.job_grade ? parseInt(form.job_grade) : null,
            hire_date: form.hire_date || undefined,
            employee_id: form.employee_id || undefined,
            linkedIn: form.linkedIn || undefined,
            note: form.note || undefined,
        });
        setSubmitting(false);
        if (result.success) { toast.success("Updated"); onSuccess(); }
        else toast.error(result.error || "Failed");
    };

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-lg rounded-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Pencil className="h-5 w-5 text-indigo-600" />
                        Edit — {candidate.name}
                    </DialogTitle>
                </DialogHeader>
                {!candidate.employment_record_id && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-sm">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        No employment record. Fields below will not save until a record is created.
                    </div>
                )}
                <div className="grid grid-cols-2 gap-3 mt-1">
                    <div>
                        <label className="text-xs font-bold text-slate-600 mb-1 block">Position</label>
                        <Input value={form.position} onChange={e => set("position", e.target.value)} className="rounded-lg" />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-600 mb-1 block">Employee ID</label>
                        <Input value={form.employee_id} onChange={e => set("employee_id", e.target.value)} className="rounded-lg" />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-600 mb-1 block">BU</label>
                        <Input value={form.bu} onChange={e => set("bu", e.target.value)} list="edit-bu-list" className="rounded-lg" />
                        <datalist id="edit-bu-list">{options.bus.map(b => <option key={b} value={b} />)}</datalist>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-600 mb-1 block">Sub-BU</label>
                        <Input value={form.sub_bu} onChange={e => set("sub_bu", e.target.value)} list="edit-sub-bu-list" className="rounded-lg" />
                        <datalist id="edit-sub-bu-list">{options.sub_bus.map(s => <option key={s} value={s} />)}</datalist>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-600 mb-1 block">Job Grade (JG)</label>
                        <Input type="number" value={form.job_grade} onChange={e => set("job_grade", e.target.value)} className="rounded-lg" />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-600 mb-1 block">Hire Date</label>
                        <Input type="date" value={form.hire_date} onChange={e => set("hire_date", e.target.value)} className="rounded-lg" />
                    </div>
                    <div className="col-span-2">
                        <label className="text-xs font-bold text-slate-600 mb-1 block">LinkedIn URL</label>
                        <Input value={form.linkedIn} onChange={e => set("linkedIn", e.target.value)} className="rounded-lg" />
                    </div>
                    <div className="col-span-2">
                        <label className="text-xs font-bold text-slate-600 mb-1 block">Note</label>
                        <Input value={form.note} onChange={e => set("note", e.target.value)} className="rounded-lg" />
                    </div>
                </div>
                <div className="flex gap-3 mt-4">
                    <Button variant="outline" className="flex-1 rounded-xl" onClick={onClose} disabled={submitting}>Cancel</Button>
                    <Button className="flex-1 rounded-xl" onClick={handleSubmit} disabled={submitting || !candidate.employment_record_id}>
                        {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                        Save Changes
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// ─── Resign Dialog ────────────────────────────────────────────────────────────

function ResignDialog({ candidate, onClose, onSuccess }: {
    candidate: InternalCandidate;
    onClose: () => void;
    onSuccess: () => void;
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
        if (result.success) {
            toast.success(`${candidate.name} marked as resigned`);
            onSuccess();
        } else {
            toast.error(result.error || "Failed");
        }
    };

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md rounded-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-red-600">
                        <UserX className="h-5 w-5" />
                        Mark as Resigned
                    </DialogTitle>
                </DialogHeader>
                <div className="p-3 rounded-xl bg-slate-50 border mb-3">
                    <p className="text-sm font-bold text-slate-800">{candidate.name}</p>
                    <p className="text-xs text-slate-500">{candidate.position} · {candidate.bu}</p>
                </div>
                <div className="space-y-3">
                    <div>
                        <label className="text-xs font-bold text-slate-600 mb-1 block">Resign Date *</label>
                        <Input type="date" value={resignDate} onChange={e => setResignDate(e.target.value)} className="rounded-lg" />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-600 mb-1 block">Resignation Reason</label>
                        <Input placeholder="e.g. Better opportunity" value={reason} onChange={e => setReason(e.target.value)} className="rounded-lg" />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-600 mb-1 block">Note</label>
                        <Input placeholder="Optional note" value={note} onChange={e => setNote(e.target.value)} className="rounded-lg" />
                    </div>
                </div>
                <div className="flex gap-3 mt-4">
                    <Button variant="outline" className="flex-1 rounded-xl" onClick={onClose} disabled={submitting}>Cancel</Button>
                    <Button className="flex-1 rounded-xl bg-red-600 hover:bg-red-700 text-white" onClick={handleSubmit} disabled={submitting}>
                        {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                        Confirm Resign
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
