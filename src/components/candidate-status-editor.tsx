"use client";

import React, { useState, useEffect } from "react";
import { Plus, X, Building2, Loader2, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
    Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { getCgBuTree, addCgGroupCompany, type CgBuTree } from "@/app/actions/cg-group-companies";
import { setCandidateInternalStatus } from "@/app/actions/internal-candidates";
import { toast } from "@/lib/notifications";

const INTERNAL_STATUSES = ["Internal Candidate", "Ex-Central"] as const;
type InternalStatus = typeof INTERNAL_STATUSES[number];

const COMMON_STATUSES = ["Blacklist", "Over-aged"];

const STATUS_COLORS: Record<string, string> = {
    "Blacklist": "text-rose-600 border-rose-300 bg-rose-50/80",
    "Over-aged": "text-orange-600 border-orange-300 bg-orange-50/80",
    "Internal Candidate": "text-indigo-700 border-indigo-300 bg-indigo-50/80",
    "Ex-Central": "text-slate-600 border-slate-300 bg-slate-50/80",
};

interface Experience {
    company_id?: number;
    company?: string;
}

interface Props {
    candidateId: string;
    currentStatuses: string[];
    experiences?: Experience[];
    onStatusChange?: (newStatuses: string[]) => void;
}

export function CandidateStatusEditor({ candidateId, currentStatuses, experiences = [], onStatusChange }: Props) {
    const [statuses, setStatuses] = useState<string[]>(currentStatuses);
    const [popoverOpen, setPopoverOpen] = useState(false);

    // Dialog state for Internal / Ex-Central
    const [dialogStatus, setDialogStatus] = useState<InternalStatus | null>(null);
    const [buTree, setBuTree] = useState<CgBuTree[]>([]);
    const [selectedBu, setSelectedBu] = useState("");
    const [selectedSubBu, setSelectedSubBu] = useState("");
    const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
    const [saving, setSaving] = useState(false);
    // Inline create BU
    const [creatingBu, setCreatingBu] = useState(false);
    const [newBuAbbr, setNewBuAbbr] = useState("");
    const [newBuName, setNewBuName] = useState("");
    // Inline create Sub-BU
    const [creatingSubBu, setCreatingSubBu] = useState(false);
    const [newSubBuAbbr, setNewSubBuAbbr] = useState("");
    const [newSubBuName, setNewSubBuName] = useState("");

    const refreshBuTree = async () => { const t = await getCgBuTree(); setBuTree(t); };

    // Load BU tree once
    useEffect(() => { refreshBuTree(); }, []);

    const subBusForBu = buTree.find(b => b.bu_abbr === selectedBu)?.sub_bus || [];

    const handleCreateBu = async () => {
        if (!newBuAbbr.trim() || !newBuName.trim()) { toast.error("BU code and name required"); return; }
        setSaving(true);
        const abbr = newBuAbbr.toUpperCase().trim();
        const result = await addCgGroupCompany({
            bu_abbr: abbr, bu_name: newBuName.trim(),
            sub_bu_abbr: abbr, sub_bu_name: newBuName.trim(),
        });
        setSaving(false);
        if (result.success) {
            await refreshBuTree();
            setSelectedBu(abbr); setSelectedSubBu("");
            setCreatingBu(false); setNewBuAbbr(""); setNewBuName("");
            toast.success(`Created BU "${abbr}"`);
        } else toast.error(result.error || "Failed");
    };

    const handleCreateSubBu = async () => {
        if (!newSubBuAbbr.trim() || !selectedBu) { toast.error("Sub-BU code required"); return; }
        setSaving(true);
        const buEntry = buTree.find(b => b.bu_abbr === selectedBu);
        const abbr = newSubBuAbbr.toUpperCase().trim();
        const result = await addCgGroupCompany({
            bu_abbr: selectedBu, bu_name: buEntry?.bu_name || selectedBu,
            sub_bu_abbr: abbr, sub_bu_name: newSubBuName.trim() || undefined,
        });
        setSaving(false);
        if (result.success) {
            await refreshBuTree();
            setSelectedSubBu(abbr);
            setCreatingSubBu(false); setNewSubBuAbbr(""); setNewSubBuName("");
            toast.success(`Created Sub-BU "${abbr}"`);
        } else toast.error(result.error || "Failed");
    };

    // Companies from experiences (deduplicated)
    const cgCompanies = React.useMemo(() => {
        const seen = new Set<number>();
        return experiences.filter(e => {
            if (!e.company_id || seen.has(e.company_id)) return false;
            seen.add(e.company_id);
            return true;
        });
    }, [experiences]);

    const addableStatuses = [...INTERNAL_STATUSES, ...COMMON_STATUSES].filter(s => !statuses.includes(s));

    const handleAddClick = (s: string) => {
        setPopoverOpen(false);
        if (s === "Internal Candidate" || s === "Ex-Central") {
            setDialogStatus(s as InternalStatus);
            setSelectedBu("");
            setSelectedSubBu("");
            setSelectedCompanyId("");
        } else {
            applyNonInternalAdd(s);
        }
    };

    const applyNonInternalAdd = async (s: string) => {
        // For non-internal statuses, just PATCH directly via API
        const newStatuses = [...statuses, s];
        const res = await fetch(`/api/candidates/${candidateId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ candidate_status: newStatuses }),
        });
        if (res.ok) {
            setStatuses(newStatuses);
            onStatusChange?.(newStatuses);
            toast.success(`Status "${s}" added`);
        } else {
            toast.error("Failed to update status");
        }
    };

    const handleRemove = async (s: string) => {
        if (s === "Internal Candidate" || s === "Ex-Central") {
            setSaving(true);
            const result = await setCandidateInternalStatus(candidateId, 'remove', s as InternalStatus);
            setSaving(false);
            if (result.success) {
                const newStatuses = statuses.filter(x => x !== s);
                setStatuses(newStatuses);
                onStatusChange?.(newStatuses);
                toast.success(`Removed "${s}"`);
            } else {
                toast.error(result.error || "Failed");
            }
        } else {
            const newStatuses = statuses.filter(x => x !== s);
            const res = await fetch(`/api/candidates/${candidateId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ candidate_status: newStatuses }),
            });
            if (res.ok) {
                setStatuses(newStatuses);
                onStatusChange?.(newStatuses);
                toast.success(`Removed "${s}"`);
            } else {
                toast.error("Failed to update status");
            }
        }
    };

    const handleDialogConfirm = async () => {
        if (!dialogStatus || !selectedBu || !selectedSubBu) return;
        setSaving(true);
        const result = await setCandidateInternalStatus(
            candidateId,
            'add',
            dialogStatus,
            selectedBu,
            selectedSubBu,
            selectedCompanyId ? parseInt(selectedCompanyId) : null,
        );
        setSaving(false);
        if (result.success) {
            const newStatuses = statuses.includes(dialogStatus) ? statuses : [...statuses, dialogStatus];
            setStatuses(newStatuses);
            onStatusChange?.(newStatuses);
            toast.success(`"${dialogStatus}" added with BU: ${selectedBu}/${selectedSubBu}`);
            setDialogStatus(null);
        } else {
            toast.error(result.error || "Failed");
        }
    };

    return (
        <>
            <div className="flex items-center gap-1.5 flex-wrap">
                {statuses.map(s => (
                    <Badge key={s} variant="outline" className={cn(
                        "uppercase tracking-widest text-[10px] pr-1 flex items-center gap-1",
                        STATUS_COLORS[s] || "text-emerald-600 border-emerald-500/30 bg-emerald-50/50"
                    )}>
                        {s}
                        <button
                            onClick={() => handleRemove(s)}
                            disabled={saving}
                            className="ml-0.5 rounded-sm hover:opacity-70 transition-opacity"
                        >
                            <X className="h-2.5 w-2.5" />
                        </button>
                    </Badge>
                ))}

                {addableStatuses.length > 0 && (
                    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                        <PopoverTrigger asChild>
                            <button className="flex items-center justify-center h-5 w-5 rounded-full border border-dashed border-slate-300 hover:border-indigo-400 hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 transition-colors">
                                <Plus className="h-3 w-3" />
                            </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-48 p-1 rounded-xl" align="start">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider px-2 py-1">Add Status</p>
                            {addableStatuses.map(s => (
                                <button
                                    key={s}
                                    onClick={() => handleAddClick(s)}
                                    className={cn(
                                        "w-full text-left px-3 py-1.5 text-xs font-bold rounded-lg hover:bg-slate-100 transition-colors flex items-center gap-2",
                                        (s === "Internal Candidate" || s === "Ex-Central") && "text-indigo-700"
                                    )}
                                >
                                    {(s === "Internal Candidate" || s === "Ex-Central") && (
                                        <Building2 className="h-3 w-3 text-indigo-500 shrink-0" />
                                    )}
                                    {s}
                                </button>
                            ))}
                        </PopoverContent>
                    </Popover>
                )}
            </div>

            {/* Dialog for Internal Candidate / Ex-Central */}
            <Dialog open={!!dialogStatus} onOpenChange={() => setDialogStatus(null)}>
                <DialogContent className="sm:max-w-md rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Building2 className="h-5 w-5 text-indigo-600" />
                            Tag as "{dialogStatus}"
                        </DialogTitle>
                    </DialogHeader>

                    <p className="text-xs text-slate-500">
                        {dialogStatus === "Internal Candidate"
                            ? "กรุณาระบุ BU / Sub-BU ที่ candidate นี้สังกัด"
                            : "กรุณาระบุ BU / Sub-BU และ (ถ้ารู้) บริษัทที่ทำให้เป็น Ex-Central"}
                    </p>

                    <div className="space-y-3 mt-1">
                        {/* BU */}
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <label className="text-xs font-bold text-slate-600">BU *</label>
                                <button onClick={() => { setCreatingBu(v => !v); setCreatingSubBu(false); }}
                                    className="text-[10px] font-bold text-indigo-500 hover:text-indigo-700 flex items-center gap-0.5">
                                    <Plus className="h-3 w-3" /> New BU
                                </button>
                            </div>
                            {creatingBu ? (
                                <div className="flex gap-1.5 items-center bg-indigo-50 rounded-lg p-2 border border-indigo-100">
                                    <Input value={newBuAbbr} onChange={e => setNewBuAbbr(e.target.value)}
                                        placeholder="Abbr" className="h-7 text-xs rounded-md w-20"
                                        onKeyDown={e => { if (e.key === 'Enter') handleCreateBu(); }} />
                                    <Input value={newBuName} onChange={e => setNewBuName(e.target.value)}
                                        placeholder="Full name" className="h-7 text-xs rounded-md flex-1"
                                        onKeyDown={e => { if (e.key === 'Enter') handleCreateBu(); }} />
                                    <Button size="sm" className="h-7 px-2 text-xs rounded-md shrink-0"
                                        onClick={handleCreateBu} disabled={saving}>
                                        {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                                    </Button>
                                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 rounded-md"
                                        onClick={() => setCreatingBu(false)}>
                                        <X className="h-3 w-3" />
                                    </Button>
                                </div>
                            ) : (
                                <Select value={selectedBu || "_none"} onValueChange={v => { setSelectedBu(v === '_none' ? '' : v); setSelectedSubBu(""); setCreatingSubBu(false); }}>
                                    <SelectTrigger className="rounded-lg">
                                        <SelectValue placeholder="Select BU" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="_none">— Select BU —</SelectItem>
                                        {buTree.map(b => (
                                            <SelectItem key={b.bu_abbr} value={b.bu_abbr}>{b.bu_abbr} — {b.bu_name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        </div>

                        {/* Sub-BU */}
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <label className="text-xs font-bold text-slate-600">Sub-BU *</label>
                                {selectedBu && (
                                    <button onClick={() => { setCreatingSubBu(v => !v); setCreatingBu(false); }}
                                        className="text-[10px] font-bold text-indigo-500 hover:text-indigo-700 flex items-center gap-0.5">
                                        <Plus className="h-3 w-3" /> New Sub-BU
                                    </button>
                                )}
                            </div>
                            {creatingSubBu && selectedBu ? (
                                <div className="flex gap-1.5 items-center bg-indigo-50 rounded-lg p-2 border border-indigo-100">
                                    <Input value={newSubBuAbbr} onChange={e => setNewSubBuAbbr(e.target.value)}
                                        placeholder="Abbr" className="h-7 text-xs rounded-md w-20"
                                        onKeyDown={e => { if (e.key === 'Enter') handleCreateSubBu(); }} />
                                    <Input value={newSubBuName} onChange={e => setNewSubBuName(e.target.value)}
                                        placeholder="Full name (optional)" className="h-7 text-xs rounded-md flex-1"
                                        onKeyDown={e => { if (e.key === 'Enter') handleCreateSubBu(); }} />
                                    <Button size="sm" className="h-7 px-2 text-xs rounded-md shrink-0"
                                        onClick={handleCreateSubBu} disabled={saving}>
                                        {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                                    </Button>
                                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 rounded-md"
                                        onClick={() => setCreatingSubBu(false)}>
                                        <X className="h-3 w-3" />
                                    </Button>
                                </div>
                            ) : (
                                <Select value={selectedSubBu || "_none"} disabled={!selectedBu} onValueChange={v => setSelectedSubBu(v === '_none' ? '' : v)}>
                                    <SelectTrigger className="rounded-lg">
                                        <SelectValue placeholder="Select Sub-BU" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="_none">— Select Sub-BU —</SelectItem>
                                        {subBusForBu.map(s => (
                                            <SelectItem key={s.sub_bu_abbr} value={s.sub_bu_abbr}>
                                                {s.sub_bu_abbr}{s.sub_bu_name ? ` — ${s.sub_bu_name}` : ''}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        </div>

                        {/* Company (Ex-Central only) */}
                        {dialogStatus === "Ex-Central" && cgCompanies.length > 0 && (
                            <div>
                                <label className="text-xs font-bold text-slate-600 mb-1 block">
                                    บริษัทที่เคยทำงาน (ที่เป็นเหตุให้เป็น Ex-Central)
                                    <span className="font-normal text-slate-400 ml-1">— optional</span>
                                </label>
                                <Select value={selectedCompanyId || "_none"} onValueChange={v => setSelectedCompanyId(v === '_none' ? '' : v)}>
                                    <SelectTrigger className="rounded-lg">
                                        <SelectValue placeholder="เลือกบริษัท (ถ้ารู้)" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="_none">— ไม่ระบุ —</SelectItem>
                                        {cgCompanies.map(e => (
                                            <SelectItem key={e.company_id} value={String(e.company_id)}>
                                                {e.company}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                    </div>

                    <div className="flex gap-3 mt-4">
                        <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setDialogStatus(null)} disabled={saving}>
                            Cancel
                        </Button>
                        <Button
                            className="flex-1 rounded-xl"
                            disabled={!selectedBu || !selectedSubBu || saving}
                            onClick={handleDialogConfirm}
                        >
                            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                            Confirm
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
