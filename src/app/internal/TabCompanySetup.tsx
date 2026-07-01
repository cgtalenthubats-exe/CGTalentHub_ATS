"use client";

import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Pencil, Check, X, Users, AlertCircle, Loader2, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    type CgGroupCompany, type CgBuTree, type MappedCompany, type PendingCompany,
    addCgGroupCompany, updateCgGroupCompany, saveCompanyMapping,
} from "@/app/actions/cg-group-companies";
import { toast } from "@/lib/notifications";

interface Props {
    companies: CgGroupCompany[];
    buTree: CgBuTree[];
    mapped: MappedCompany[];
    pending: PendingCompany[];
    onRefresh: () => void;
}

export function TabCompanySetup({ companies, buTree, mapped, pending, onRefresh }: Props) {
    const [editId, setEditId] = useState<number | null>(null);
    const [editName, setEditName] = useState("");
    const [addingSubBu, setAddingSubBu] = useState<string | null>(null);
    const [newSubBuAbbr, setNewSubBuAbbr] = useState("");
    const [newSubBuName, setNewSubBuName] = useState("");
    const [saving, setSaving] = useState(false);
    const [pendingAssign, setPendingAssign] = useState<Record<number, { buAbbr: string; subBuAbbr: string }>>({});

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
        const result = await addCgGroupCompany({
            bu_abbr: buAbbr, bu_name: buName,
            sub_bu_abbr: newSubBuAbbr.toUpperCase().trim(),
            sub_bu_name: newSubBuName.trim() || undefined,
        });
        setSaving(false);
        if (result.success) {
            toast.success(`Added ${newSubBuAbbr} to ${buAbbr}`);
            setAddingSubBu(null); setNewSubBuAbbr(""); setNewSubBuName("");
            onRefresh();
        } else toast.error(result.error || "Failed");
    };

    const handleMapPending = async (companyId: number, companyName: string) => {
        const assign = pendingAssign[companyId];
        if (!assign?.buAbbr || !assign?.subBuAbbr) { toast.error("Please select both BU and Sub-BU"); return; }
        const cgEntry = companies.find(c => c.bu_abbr === assign.buAbbr && c.sub_bu_abbr === assign.subBuAbbr);
        if (!cgEntry) { toast.error("BU/Sub-BU entry not found"); return; }
        setSaving(true);
        const result = await saveCompanyMapping(companyId, cgEntry.id);
        setSaving(false);
        if (result.success) {
            toast.success(`Mapped "${companyName}"`);
            onRefresh();
        } else toast.error(result.error || "Failed");
    };

    return (
        <div className="px-8 py-6 space-y-8">

            {/* Pending Confirmation */}
            {pending.length > 0 && (
                <div>
                    <div className="flex items-center gap-2 mb-4">
                        <AlertCircle className="h-4 w-4 text-amber-500" />
                        <h2 className="text-sm font-black text-slate-700 uppercase tracking-wider">
                            Pending Confirmation
                        </h2>
                        <Badge className="bg-amber-100 text-amber-700 border-none font-bold">{pending.length}</Badge>
                        <span className="text-xs text-slate-400">— found in Internal/Ex-Central histories, not yet mapped</span>
                    </div>
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border shadow-sm overflow-hidden">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b bg-slate-50 text-[11px] font-black uppercase tracking-wider text-slate-500">
                                    <th className="text-left px-4 py-3">Company Name</th>
                                    <th className="text-left px-4 py-3 w-16"><Users className="h-3 w-3 inline" /></th>
                                    <th className="text-left px-4 py-3 w-36">BU</th>
                                    <th className="text-left px-4 py-3 w-44">Sub-BU</th>
                                    <th className="px-4 py-3 w-24"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {pending.map(p => {
                                    const assign = pendingAssign[p.company_id] || { buAbbr: "", subBuAbbr: "" };
                                    const selectedBu = assign.buAbbr;
                                    const selectedSubBu = assign.subBuAbbr;
                                    const subBusForBu = buTree.find(b => b.bu_abbr === selectedBu)?.sub_bus || [];
                                    const canConfirm = !!selectedBu && !!selectedSubBu;
                                    return (
                                        <tr key={p.company_id} className="hover:bg-slate-50/70">
                                            <td className="px-4 py-3 text-xs font-bold text-slate-700">{p.company_name}</td>
                                            <td className="px-4 py-3">
                                                <Badge variant="outline" className="text-[10px] font-bold">{p.candidate_count}</Badge>
                                            </td>
                                            {/* BU */}
                                            <td className="px-4 py-3">
                                                <Select
                                                    value={selectedBu || "_none"}
                                                    onValueChange={v => setPendingAssign(prev => ({
                                                        ...prev,
                                                        [p.company_id]: { buAbbr: v === '_none' ? '' : v, subBuAbbr: '' }
                                                    }))}
                                                >
                                                    <SelectTrigger className="h-7 text-xs rounded-lg border-slate-200">
                                                        <SelectValue placeholder="Select BU" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="_none">— BU —</SelectItem>
                                                        {buTree.map(bu => (
                                                            <SelectItem key={bu.bu_abbr} value={bu.bu_abbr}>
                                                                {bu.bu_abbr}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </td>
                                            {/* Sub-BU */}
                                            <td className="px-4 py-3">
                                                <Select
                                                    value={selectedSubBu || "_none"}
                                                    disabled={!selectedBu}
                                                    onValueChange={v => setPendingAssign(prev => ({
                                                        ...prev,
                                                        [p.company_id]: { ...prev[p.company_id], subBuAbbr: v === '_none' ? '' : v }
                                                    }))}
                                                >
                                                    <SelectTrigger className="h-7 text-xs rounded-lg border-slate-200">
                                                        <SelectValue placeholder="Select Sub-BU" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="_none">— Sub-BU —</SelectItem>
                                                        {subBusForBu.map(sub => (
                                                            <SelectItem key={sub.sub_bu_abbr} value={sub.sub_bu_abbr}>
                                                                {sub.sub_bu_abbr}{sub.sub_bu_name ? ` — ${sub.sub_bu_name}` : ''}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </td>
                                            <td className="px-4 py-3">
                                                <Button
                                                    size="sm" className="h-7 px-3 text-xs rounded-lg"
                                                    disabled={!canConfirm || saving}
                                                    onClick={() => handleMapPending(p.company_id, p.company_name)}
                                                >
                                                    {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Confirm"}
                                                </Button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Mapped Companies */}
            <div>
                <div className="flex items-center gap-2 mb-4">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    <h2 className="text-sm font-black text-slate-700 uppercase tracking-wider">Mapped Companies</h2>
                    <Badge className="bg-emerald-100 text-emerald-700 border-none font-bold">{mapped.length}</Badge>
                </div>
                {mapped.length > 0 && (
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border shadow-sm overflow-hidden mb-8">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b bg-slate-50 text-[11px] font-black uppercase tracking-wider text-slate-500">
                                    <th className="text-left px-4 py-3">Company Name</th>
                                    <th className="text-left px-4 py-3 w-16"><Users className="h-3 w-3 inline" /></th>
                                    <th className="text-left px-4 py-3">BU</th>
                                    <th className="text-left px-4 py-3">Sub-BU</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {mapped.map(m => (
                                    <tr key={m.company_id} className="hover:bg-slate-50/50">
                                        <td className="px-4 py-3 text-xs font-bold text-slate-700">{m.company_name}</td>
                                        <td className="px-4 py-3">
                                            <Badge variant="outline" className="text-[10px] font-bold">{m.candidate_count}</Badge>
                                        </td>
                                        <td className="px-4 py-3">
                                            <Badge className="bg-indigo-100 text-indigo-700 border-none text-[10px] font-bold">{m.bu_abbr}</Badge>
                                        </td>
                                        <td className="px-4 py-3 text-xs text-slate-600">
                                            {m.sub_bu_abbr || <span className="text-slate-300">—</span>}
                                            {m.sub_bu_name && <span className="text-slate-400 ml-1">— {m.sub_bu_name}</span>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* BU / Sub-BU Master List */}
            <div>
                <h2 className="text-sm font-black text-slate-700 uppercase tracking-wider mb-4">BU / Sub-BU Master List</h2>
                <div className="space-y-4">
                    {buTree.map(bu => (
                        <div key={bu.bu_abbr} className="bg-white dark:bg-slate-900 rounded-2xl border shadow-sm overflow-hidden">
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
                                                        className="h-7 text-xs rounded-lg flex-1" autoFocus />
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
                                                    <Button size="sm" variant="ghost"
                                                        className="h-6 w-6 p-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                                                        onClick={() => { setEditId(full?.id ?? null); setEditName(sub.sub_bu_name || ""); }}>
                                                        <Pencil className="h-3 w-3" />
                                                    </Button>
                                                </>
                                            )}
                                        </div>
                                    );
                                })}
                                {addingSubBu === bu.bu_abbr ? (
                                    <div className="flex items-center gap-2 px-5 py-2.5 bg-slate-50">
                                        <Input value={newSubBuAbbr} onChange={e => setNewSubBuAbbr(e.target.value)}
                                            placeholder="CODE" className="h-7 text-xs rounded-lg w-24" />
                                        <Input value={newSubBuName} onChange={e => setNewSubBuName(e.target.value)}
                                            placeholder="Full name (optional)" className="h-7 text-xs rounded-lg flex-1" />
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
            </div>
        </div>
    );
}
