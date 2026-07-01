"use client";

import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Pencil, Check, X, Loader2, Trash2, Users } from "lucide-react";
import {
    type CgGroupCompany, type CgBuTree,
    addCgGroupCompany, updateCgGroupCompany, deleteCgGroupCompany,
    findCandidatesForSubBu, bulkAssignCandidateBu,
} from "@/app/actions/cg-group-companies";
import { toast } from "@/lib/notifications";

interface Props {
    companies: CgGroupCompany[];
    buTree: CgBuTree[];
    onRefresh: () => void;
}

interface MatchCandidate {
    candidate_id: string;
    name: string;
    current_company: string;
    position: string;
}

interface AssignContext {
    buAbbr: string;
    subBuAbbr: string;
    subBuName: string;
    candidates: MatchCandidate[];
}

export function TabCompanySetup({ companies, buTree, onRefresh }: Props) {
    const [editId, setEditId] = useState<number | null>(null);
    const [editName, setEditName] = useState("");
    const [addingSubBu, setAddingSubBu] = useState<string | null>(null);
    const [newSubBuAbbr, setNewSubBuAbbr] = useState("");
    const [newSubBuName, setNewSubBuName] = useState("");
    const [saving, setSaving] = useState(false);
    const [addingBu, setAddingBu] = useState(false);
    const [newBuAbbr, setNewBuAbbr] = useState("");
    const [newBuName, setNewBuName] = useState("");

    // bulk-assign dialog state
    const [assignContext, setAssignContext] = useState<AssignContext | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [assigning, setAssigning] = useState(false);

    const handleEditSave = async (id: number) => {
        setSaving(true);
        const result = await updateCgGroupCompany(id, { sub_bu_name: editName });
        setSaving(false);
        if (result.success) { toast.success("Saved"); setEditId(null); onRefresh(); }
        else toast.error(result.error || "Failed");
    };

    const handleAddSubBu = async (buAbbr: string, buName: string) => {
        if (!newSubBuAbbr.trim()) { toast.error("Sub-BU code required"); return; }
        setSaving(true);
        const abbr = newSubBuAbbr.toUpperCase().trim();
        const name = newSubBuName.trim();
        const result = await addCgGroupCompany({
            bu_abbr: buAbbr, bu_name: buName,
            sub_bu_abbr: abbr,
            sub_bu_name: name || undefined,
        });
        setSaving(false);
        if (!result.success) { toast.error(result.error || "Failed"); return; }

        toast.success(`Added ${abbr} to ${buAbbr}`);
        setAddingSubBu(null); setNewSubBuAbbr(""); setNewSubBuName("");
        onRefresh();

        // Scan for unassigned candidates matching this Sub-BU name
        if (name) {
            const matches = await findCandidatesForSubBu(name);
            if (matches.length > 0) {
                setAssignContext({ buAbbr, subBuAbbr: abbr, subBuName: name, candidates: matches });
                setSelectedIds(new Set(matches.map(m => m.candidate_id)));
            }
        }
    };

    const handleAddBu = async () => {
        if (!newBuAbbr.trim() || !newBuName.trim()) { toast.error("BU code and name required"); return; }
        setSaving(true);
        const result = await addCgGroupCompany({
            bu_abbr: newBuAbbr.toUpperCase().trim(),
            bu_name: newBuName.trim(),
            sub_bu_abbr: newBuAbbr.toUpperCase().trim(),
            sub_bu_name: newBuName.trim(),
        });
        setSaving(false);
        if (result.success) {
            toast.success(`Added BU "${newBuAbbr.toUpperCase()}"`);
            setAddingBu(false); setNewBuAbbr(""); setNewBuName("");
            onRefresh();
        } else toast.error(result.error || "Failed");
    };

    const handleDeleteSubBu = async (id: number, abbr: string) => {
        if (!confirm(`Delete Sub-BU "${abbr}"?`)) return;
        setSaving(true);
        const result = await deleteCgGroupCompany(id);
        setSaving(false);
        if (result.success) { toast.success(`Deleted ${abbr}`); onRefresh(); }
        else toast.error(result.error || "Failed");
    };

    const handleBulkAssign = async () => {
        if (!assignContext || selectedIds.size === 0) return;
        setAssigning(true);
        const result = await bulkAssignCandidateBu(
            [...selectedIds],
            assignContext.buAbbr,
            assignContext.subBuAbbr,
        );
        setAssigning(false);
        if (result.success) {
            toast.success(`Assigned ${result.count} candidate${result.count !== 1 ? "s" : ""} to ${assignContext.subBuAbbr}`);
            setAssignContext(null);
            onRefresh();
        } else {
            toast.error(result.error || "Failed");
        }
    };

    const toggleAll = (checked: boolean) => {
        if (!assignContext) return;
        setSelectedIds(checked ? new Set(assignContext.candidates.map(c => c.candidate_id)) : new Set());
    };

    return (
        <div className="px-8 py-6">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-sm font-black text-slate-700 uppercase tracking-wider">BU / Sub-BU Structure</h2>
                    <p className="text-xs text-slate-400 mt-0.5">{buTree.length} BUs · {buTree.reduce((n, b) => n + b.sub_bus.length, 0)} Sub-BUs</p>
                </div>
                {!addingBu && (
                    <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs font-bold rounded-xl"
                        onClick={() => setAddingBu(true)}>
                        <Plus className="h-3.5 w-3.5" /> Add New BU
                    </Button>
                )}
            </div>

            {addingBu && (
                <div className="flex items-center gap-2 mb-5 bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3">
                    <span className="text-xs font-black text-indigo-600 uppercase tracking-wider shrink-0">New BU</span>
                    <Input value={newBuAbbr} onChange={e => setNewBuAbbr(e.target.value)}
                        placeholder="Abbr e.g. CHG" className="h-7 text-xs rounded-lg w-28"
                        onKeyDown={e => { if (e.key === 'Enter') handleAddBu(); }} />
                    <Input value={newBuName} onChange={e => setNewBuName(e.target.value)}
                        placeholder="Full name e.g. Central Hospitality Group"
                        className="h-7 text-xs rounded-lg flex-1"
                        onKeyDown={e => { if (e.key === 'Enter') handleAddBu(); }} />
                    <Button size="sm" className="h-7 px-3 text-xs rounded-lg" onClick={handleAddBu} disabled={saving}>
                        {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Create"}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 rounded-lg" onClick={() => setAddingBu(false)}>
                        <X className="h-3 w-3" />
                    </Button>
                </div>
            )}

            <div className="space-y-4">
                {buTree.map(bu => (
                    <div key={bu.bu_abbr} className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                        <div className="flex items-center gap-3 px-5 py-3 bg-indigo-50 border-b">
                            <Badge className="bg-indigo-600 text-white font-black text-xs border-none">{bu.bu_abbr}</Badge>
                            <span className="font-bold text-slate-800 text-sm">{bu.bu_name}</span>
                            <span className="ml-auto text-[11px] text-slate-400">{bu.sub_bus.length} Sub-BUs</span>
                        </div>
                        <div className="divide-y divide-slate-50">
                            {bu.sub_bus.map(sub => {
                                const full = companies.find(c => c.bu_abbr === bu.bu_abbr && c.sub_bu_abbr === sub.sub_bu_abbr);
                                const isEditing = editId === full?.id;
                                return (
                                    <div key={sub.sub_bu_abbr} className="flex items-center gap-3 px-5 py-2.5 hover:bg-slate-50/50 group">
                                        <Badge variant="outline" className="text-[10px] font-black border-slate-200 text-slate-600 shrink-0">
                                            {sub.sub_bu_abbr}
                                        </Badge>
                                        {isEditing ? (
                                            <div className="flex items-center gap-2 flex-1">
                                                <Input value={editName} onChange={e => setEditName(e.target.value)}
                                                    className="h-7 text-xs rounded-lg flex-1" autoFocus
                                                    onKeyDown={e => { if (e.key === 'Enter') handleEditSave(full!.id); if (e.key === 'Escape') setEditId(null); }} />
                                                <Button size="sm" className="h-7 w-7 p-0 rounded-lg" onClick={() => handleEditSave(full!.id)} disabled={saving}>
                                                    {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                                                </Button>
                                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 rounded-lg" onClick={() => setEditId(null)}>
                                                    <X className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        ) : (
                                            <>
                                                <span className="text-xs text-slate-600 flex-1">
                                                    {sub.sub_bu_name || <span className="text-slate-300 italic">No full name</span>}
                                                </span>
                                                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                                                    <Button size="sm" variant="ghost"
                                                        className="h-6 w-6 p-0 rounded-lg text-slate-400 hover:text-indigo-600"
                                                        onClick={() => { setEditId(full?.id ?? null); setEditName(sub.sub_bu_name || ""); }}>
                                                        <Pencil className="h-3 w-3" />
                                                    </Button>
                                                    <Button size="sm" variant="ghost"
                                                        className="h-6 w-6 p-0 rounded-lg text-slate-400 hover:text-rose-600"
                                                        onClick={() => full && handleDeleteSubBu(full.id, sub.sub_bu_abbr)}>
                                                        <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                );
                            })}
                            {addingSubBu === bu.bu_abbr ? (
                                <div className="flex items-center gap-2 px-5 py-2.5 bg-slate-50">
                                    <Input value={newSubBuAbbr} onChange={e => setNewSubBuAbbr(e.target.value)}
                                        placeholder="CODE" className="h-7 text-xs rounded-lg w-24"
                                        onKeyDown={e => { if (e.key === 'Enter') handleAddSubBu(bu.bu_abbr, bu.bu_name); }} />
                                    <Input value={newSubBuName} onChange={e => setNewSubBuName(e.target.value)}
                                        placeholder="Full name (optional)" className="h-7 text-xs rounded-lg flex-1"
                                        onKeyDown={e => { if (e.key === 'Enter') handleAddSubBu(bu.bu_abbr, bu.bu_name); }} />
                                    <Button size="sm" className="h-7 px-3 text-xs rounded-lg"
                                        onClick={() => handleAddSubBu(bu.bu_abbr, bu.bu_name)} disabled={saving}>
                                        {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Add"}
                                    </Button>
                                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 rounded-lg" onClick={() => setAddingSubBu(null)}>
                                        <X className="h-3 w-3" />
                                    </Button>
                                </div>
                            ) : (
                                <button
                                    className="flex items-center gap-1.5 px-5 py-2 text-[11px] font-bold text-slate-400 hover:text-indigo-600 hover:bg-indigo-50/50 transition-colors w-full text-left"
                                    onClick={() => { setAddingSubBu(bu.bu_abbr); setNewSubBuAbbr(""); setNewSubBuName(""); }}>
                                    <Plus className="h-3 w-3" /> Add Sub-BU
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Bulk-assign dialog — shows after adding a Sub-BU with matching candidates */}
            {assignContext && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
                        <div className="flex items-center gap-3 px-6 py-4 border-b">
                            <div className="h-9 w-9 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
                                <Users className="h-4 w-4 text-indigo-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-slate-800">
                                    พบ {assignContext.candidates.length} คนที่อาจอยู่ใน {assignContext.subBuAbbr}
                                </p>
                                <p className="text-xs text-slate-400 truncate">
                                    ชื่อบริษัทตรงกับ &ldquo;{assignContext.subBuName}&rdquo; — เลือกว่าจะ assign ใคร
                                </p>
                            </div>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 rounded-lg shrink-0"
                                onClick={() => setAssignContext(null)}>
                                <X className="h-3.5 w-3.5" />
                            </Button>
                        </div>

                        {/* Select all row */}
                        <div className="flex items-center gap-3 px-6 py-2.5 bg-slate-50 border-b">
                            <Checkbox
                                checked={selectedIds.size === assignContext.candidates.length && assignContext.candidates.length > 0}
                                onCheckedChange={v => toggleAll(!!v)}
                                className="rounded"
                            />
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                                เลือกทั้งหมด ({selectedIds.size}/{assignContext.candidates.length})
                            </span>
                        </div>

                        {/* Candidate list */}
                        <div className="max-h-72 overflow-y-auto divide-y divide-slate-50">
                            {assignContext.candidates.map(c => (
                                <div key={c.candidate_id}
                                    className="flex items-center gap-3 px-6 py-3 hover:bg-slate-50 cursor-pointer"
                                    onClick={() => {
                                        const next = new Set(selectedIds);
                                        if (next.has(c.candidate_id)) next.delete(c.candidate_id);
                                        else next.add(c.candidate_id);
                                        setSelectedIds(next);
                                    }}>
                                    <Checkbox
                                        checked={selectedIds.has(c.candidate_id)}
                                        onCheckedChange={() => {
                                            const next = new Set(selectedIds);
                                            if (next.has(c.candidate_id)) next.delete(c.candidate_id);
                                            else next.add(c.candidate_id);
                                            setSelectedIds(next);
                                        }}
                                        className="rounded shrink-0"
                                        onClick={e => e.stopPropagation()}
                                    />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-slate-800 truncate">{c.name || "—"}</p>
                                        <p className="text-[11px] text-slate-400 truncate">{c.position} · {c.current_company}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-between px-6 py-4 border-t bg-slate-50/50">
                            <Button variant="ghost" size="sm" className="h-8 px-3 text-xs rounded-xl text-slate-500"
                                onClick={() => setAssignContext(null)}>
                                ข้ามไปก่อน
                            </Button>
                            <Button size="sm"
                                className="h-8 px-4 text-xs rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold gap-1.5"
                                onClick={handleBulkAssign}
                                disabled={assigning || selectedIds.size === 0}>
                                {assigning
                                    ? <><Loader2 className="h-3 w-3 animate-spin" /> กำลัง assign...</>
                                    : `Assign ${selectedIds.size} คน → ${assignContext.subBuAbbr}`}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
