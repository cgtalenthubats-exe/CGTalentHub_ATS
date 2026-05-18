"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
    Hotel, Users, Star, Check, X, Plus, ChevronDown, ChevronRight,
    Loader2, Search, AlertCircle, RefreshCw, Building2, Pencil
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    getHotelChainMappingQueue,
    getHotelChainsForPicker,
    getHotelChainStats,
    assignCompanyToChain,
    markCompanyIndependent,
    addHotelChainEntry,
    updateSubBrandRating,
    type HotelChainQueueItem,
    type HotelChainPickerItem,
    type HotelChainStats,
} from "@/app/actions/company-mgmt";
import { toast } from "@/lib/notifications";

const RATINGS = ["3 Star", "4 Star", "5 Star"] as const;

// ── Helpers ────────────────────────────────────────────────────────────────────
function StarLabel({ rating }: { rating: string | null }) {
    if (!rating) return <span className="text-xs text-slate-300">No rating</span>;
    const map: Record<string, { stars: string; color: string; bg: string }> = {
        "5 Star": { stars: "★★★★★", color: "text-amber-500", bg: "bg-amber-50" },
        "4 Star": { stars: "★★★★", color: "text-amber-400", bg: "bg-amber-50" },
        "3 Star": { stars: "★★★", color: "text-slate-400", bg: "bg-slate-50" },
    };
    const s = map[rating];
    if (!s) return <span className="text-xs text-slate-300">{rating}</span>;
    return (
        <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${s.color} ${s.bg}`}>
            {s.stars}
        </span>
    );
}

// ── Stats Bar ──────────────────────────────────────────────────────────────────
function StatsBar({ stats, loading }: { stats: HotelChainStats | null; loading: boolean }) {
    const items = stats ? [
        { label: "Chains", value: stats.total_chains, color: "text-indigo-600" },
        { label: "★★★★★ Sub-brands", value: stats.sub_brand_5star, color: "text-amber-500" },
        { label: "★★★★ Sub-brands", value: stats.sub_brand_4star, color: "text-amber-400" },
        { label: "★★★ Sub-brands", value: stats.sub_brand_3star, color: "text-slate-500" },
        { label: "Unrated Sub-brands", value: stats.sub_brand_unrated, color: "text-rose-500" },
        { label: "Unmapped Companies", value: stats.unmapped_companies, color: "text-slate-400" },
    ] : [];

    return (
        <div className="grid grid-cols-6 gap-3">
            {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="bg-white rounded-xl border p-3 animate-pulse h-16" />
                ))
            ) : items.map(item => (
                <div key={item.label} className="bg-white rounded-xl border px-4 py-3">
                    <div className={`text-2xl font-bold ${item.color}`}>{item.value.toLocaleString()}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{item.label}</div>
                </div>
            ))}
        </div>
    );
}

// ── Inline Rating Editor ───────────────────────────────────────────────────────
function RatingEditor({
    brandId,
    current,
    onUpdated,
}: {
    brandId: number;
    current: string | null;
    onUpdated: (brandId: number, rating: string | null) => void;
}) {
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handler(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) setEditing(false);
        }
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    async function select(rating: string | null) {
        setSaving(true);
        setEditing(false);
        const result = await updateSubBrandRating(brandId, rating);
        setSaving(false);
        if (result.success) {
            onUpdated(brandId, rating);
            toast.success("Rating updated");
        } else {
            toast.error(result.error ?? "Failed");
        }
    }

    return (
        <div className="relative flex items-center gap-1" ref={ref}>
            <StarLabel rating={current} />
            {saving ? (
                <Loader2 className="h-3 w-3 animate-spin text-slate-300 ml-1" />
            ) : (
                <button
                    onClick={() => setEditing(e => !e)}
                    className="ml-1 text-slate-300 hover:text-indigo-500 transition-colors"
                >
                    <Pencil className="h-3 w-3" />
                </button>
            )}
            {editing && (
                <div className="absolute left-0 top-full mt-1 z-50 bg-white border rounded-xl shadow-xl p-1 w-[130px]">
                    {RATINGS.map(r => (
                        <button
                            key={r}
                            onClick={() => select(r)}
                            className={`w-full text-left px-3 py-1.5 rounded-lg hover:bg-indigo-50 flex items-center gap-2 ${current === r ? "bg-indigo-50" : ""}`}
                        >
                            <StarLabel rating={r} />
                        </button>
                    ))}
                    <button
                        onClick={() => select(null)}
                        className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-slate-50 text-xs text-slate-400"
                    >
                        Remove rating
                    </button>
                </div>
            )}
        </div>
    );
}

// ── Chain Accordion Item ───────────────────────────────────────────────────────
function ChainAccordionItem({
    parent,
    subBrands,
    onRatingUpdated,
}: {
    parent: HotelChainPickerItem;
    subBrands: HotelChainPickerItem[];
    onRatingUpdated: (brandId: number, rating: string | null) => void;
}) {
    const [open, setOpen] = useState(false);

    const starCounts = {
        "5 Star": subBrands.filter(s => s.rating === "5 Star").length,
        "4 Star": subBrands.filter(s => s.rating === "4 Star").length,
        "3 Star": subBrands.filter(s => s.rating === "3 Star").length,
        unrated: subBrands.filter(s => !s.rating || !["3 Star","4 Star","5 Star"].includes(s.rating)).length,
    };

    return (
        <div className="border-b last:border-0">
            <button
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left"
                onClick={() => setOpen(o => !o)}
            >
                {open
                    ? <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
                    : <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
                }
                <span className="font-semibold text-slate-800 flex-1">{parent.brand_name}</span>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                    {starCounts["5 Star"] > 0 && <span className="text-amber-500">★★★★★ ×{starCounts["5 Star"]}</span>}
                    {starCounts["4 Star"] > 0 && <span className="text-amber-400">★★★★ ×{starCounts["4 Star"]}</span>}
                    {starCounts["3 Star"] > 0 && <span className="text-slate-400">★★★ ×{starCounts["3 Star"]}</span>}
                    {starCounts.unrated > 0 && <span className="text-rose-400">{starCounts.unrated} unrated</span>}
                    <Badge variant="secondary" className="text-[10px]">{subBrands.length} sub-brands</Badge>
                </div>
            </button>

            {open && (
                <div className="bg-slate-50/50">
                    {subBrands.length === 0 ? (
                        <div className="px-10 py-3 text-xs text-slate-400 italic">No sub-brands</div>
                    ) : (
                        subBrands.map(sub => (
                            <div
                                key={sub.brand_id}
                                className="flex items-center gap-3 px-10 py-2.5 border-b last:border-0 hover:bg-white/60"
                            >
                                <span className="flex-1 text-sm text-slate-700">{sub.brand_name}</span>
                                <RatingEditor
                                    brandId={sub.brand_id}
                                    current={sub.rating}
                                    onUpdated={onRatingUpdated}
                                />
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}

// ── Tab 1: Chains & Sub-brands ─────────────────────────────────────────────────
function ChainsTab({
    chains,
    onChainAdded,
    onRatingUpdated,
}: {
    chains: HotelChainPickerItem[];
    onChainAdded: (brand: HotelChainPickerItem) => void;
    onRatingUpdated: (brandId: number, rating: string | null) => void;
}) {
    const [search, setSearch] = useState("");
    const [showAddModal, setShowAddModal] = useState(false);

    const parents = chains.filter(c => c.parent_id === null);
    const subBrandsByParent: Record<number, HotelChainPickerItem[]> = {};
    chains.filter(c => c.parent_id !== null).forEach(c => {
        const pid = c.parent_id!;
        if (!subBrandsByParent[pid]) subBrandsByParent[pid] = [];
        subBrandsByParent[pid].push(c);
    });

    const q = search.toLowerCase();
    const filtered = parents.filter(p => {
        if (!q) return true;
        return p.brand_name.toLowerCase().includes(q) ||
            (subBrandsByParent[p.brand_id] ?? []).some(s => s.brand_name.toLowerCase().includes(q));
    });

    return (
        <div className="flex flex-col gap-4">
            <div className="flex gap-3 items-center">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                        className="pl-9 h-9"
                        placeholder="Search chains or sub-brands..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs"
                    onClick={() => setShowAddModal(true)}
                >
                    <Plus className="h-3.5 w-3.5" />
                    Add Chain / Sub-brand
                </Button>
                <span className="text-xs text-slate-400 ml-auto">
                    {filtered.length} chains
                </span>
            </div>

            <Card className="overflow-hidden border-none shadow-sm">
                {filtered.map(parent => (
                    <ChainAccordionItem
                        key={parent.brand_id}
                        parent={parent}
                        subBrands={(subBrandsByParent[parent.brand_id] ?? []).filter(s =>
                            !q || s.brand_name.toLowerCase().includes(q) || parent.brand_name.toLowerCase().includes(q)
                        )}
                        onRatingUpdated={onRatingUpdated}
                    />
                ))}
                {filtered.length === 0 && (
                    <div className="py-12 text-center text-sm text-slate-400">
                        <Search className="h-5 w-5 mx-auto mb-2 text-slate-300" />
                        No chains match "{search}"
                    </div>
                )}
            </Card>

            {showAddModal && (
                <AddChainModal
                    chains={chains}
                    onClose={() => setShowAddModal(false)}
                    onAdded={onChainAdded}
                />
            )}
        </div>
    );
}

// ── Chain Picker Dropdown (for queue) ─────────────────────────────────────────
function ChainPicker({
    chains,
    onSelect,
    disabled,
}: {
    chains: HotelChainPickerItem[];
    onSelect: (brandId: number) => void;
    disabled?: boolean;
}) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handler(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        }
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const parents = chains.filter(c => c.parent_id === null);
    const subBrandsByParent: Record<number, HotelChainPickerItem[]> = {};
    chains.filter(c => c.parent_id !== null).forEach(c => {
        const pid = c.parent_id!;
        if (!subBrandsByParent[pid]) subBrandsByParent[pid] = [];
        subBrandsByParent[pid].push(c);
    });

    const q = search.toLowerCase();
    const filteredParents = parents.filter(p =>
        p.brand_name.toLowerCase().includes(q) ||
        (subBrandsByParent[p.brand_id] ?? []).some(s => s.brand_name.toLowerCase().includes(q))
    );

    return (
        <div className="relative" ref={ref}>
            <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs w-[160px] justify-between"
                onClick={() => setOpen(o => !o)}
                disabled={disabled}
            >
                <span className="truncate">Link to Chain</span>
                <ChevronDown className="h-3.5 w-3.5 shrink-0" />
            </Button>

            {open && (
                <div className="absolute left-0 top-full mt-1 z-50 w-[280px] bg-white border rounded-xl shadow-xl overflow-hidden">
                    <div className="p-2 border-b">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                            <Input
                                className="pl-8 h-8 text-xs"
                                placeholder="Search chains..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                autoFocus
                            />
                        </div>
                    </div>
                    <div className="max-h-[320px] overflow-y-auto p-1">
                        {filteredParents.map(parent => {
                            const subs = (subBrandsByParent[parent.brand_id] ?? []).filter(s =>
                                !q || s.brand_name.toLowerCase().includes(q) || parent.brand_name.toLowerCase().includes(q)
                            );
                            return (
                                <div key={parent.brand_id}>
                                    <button
                                        className="w-full text-left px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-50 rounded-lg"
                                        onClick={() => { onSelect(parent.brand_id); setOpen(false); setSearch(""); }}
                                    >
                                        {parent.brand_name}
                                    </button>
                                    {subs.map(sub => (
                                        <button
                                            key={sub.brand_id}
                                            className="w-full text-left px-5 py-1.5 text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 rounded-lg flex items-center justify-between"
                                            onClick={() => { onSelect(sub.brand_id); setOpen(false); setSearch(""); }}
                                        >
                                            <span className="truncate">{sub.brand_name}</span>
                                            {sub.rating && <StarLabel rating={sub.rating} />}
                                        </button>
                                    ))}
                                </div>
                            );
                        })}
                        {filteredParents.length === 0 && (
                            <div className="py-4 text-center text-xs text-slate-400">No chains found</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Tab 2: Unmapped Queue ──────────────────────────────────────────────────────
function UnmappedQueueTab({
    chains,
}: {
    chains: HotelChainPickerItem[];
}) {
    const [filter, setFilter] = useState<'all' | 'with_candidates' | 'pending'>('all');
    const [showIndependent, setShowIndependent] = useState(false);
    const [page, setPage] = useState(0);
    const PAGE_SIZE = 50;

    const [rows, setRows] = useState<HotelChainQueueItem[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [savingId, setSavingId] = useState<number | null>(null);

    const loadQueue = useCallback(async () => {
        setLoading(true);
        const result = await getHotelChainMappingQueue({ filter, showIndependent, page, pageSize: PAGE_SIZE });
        setRows(result.data);
        setTotal(result.total);
        setLoading(false);
    }, [filter, showIndependent, page]);

    useEffect(() => { loadQueue(); }, [loadQueue]);

    async function handleAssign(companyId: number, chainId: number) {
        setSavingId(companyId);
        const result = await assignCompanyToChain(companyId, chainId);
        if (result.success) {
            toast.success("Assigned");
            setRows(prev => prev.filter(r => r.company_id !== companyId));
            setTotal(t => t - 1);
        } else {
            toast.error(result.error ?? "Failed");
        }
        setSavingId(null);
    }

    async function handleIndependent(companyId: number) {
        setSavingId(companyId);
        const result = await markCompanyIndependent(companyId);
        if (result.success) {
            toast.success("Marked as independent");
            setRows(prev => prev.filter(r => r.company_id !== companyId));
            setTotal(t => t - 1);
        } else {
            toast.error(result.error ?? "Failed");
        }
        setSavingId(null);
    }

    const totalPages = Math.ceil(total / PAGE_SIZE);

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3 flex-wrap">
                <div className="flex rounded-lg border overflow-hidden">
                    {(["all", "with_candidates", "pending"] as const).map(f => (
                        <button
                            key={f}
                            onClick={() => { setFilter(f); setPage(0); }}
                            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                                filter === f ? "bg-indigo-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"
                            }`}
                        >
                            {f === "all" ? "All" : f === "with_candidates" ? "Has Candidates" : "Pending Review"}
                        </button>
                    ))}
                </div>
                <button
                    onClick={() => { setShowIndependent(s => !s); setPage(0); }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                        showIndependent ? "border-slate-400 bg-slate-100 text-slate-700" : "border-slate-200 text-slate-500 hover:bg-slate-50"
                    }`}
                >
                    {showIndependent && <Check className="h-3 w-3" />}
                    Show Independent
                </button>
                <button onClick={loadQueue} className="text-slate-400 hover:text-slate-600 p-1">
                    <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                </button>
                <span className="ml-auto text-xs text-slate-500">{total.toLocaleString()} companies</span>
            </div>

            <Card className="overflow-hidden border-none shadow-sm">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b bg-slate-50">
                            <th className="text-left p-3 text-xs font-semibold text-slate-500">Company</th>
                            <th className="text-left p-3 text-xs font-semibold text-slate-500 w-[90px]">Rating</th>
                            <th className="text-left p-3 text-xs font-semibold text-slate-500 w-[100px]">
                                <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />Candidates</span>
                            </th>
                            <th className="text-left p-3 text-xs font-semibold text-slate-500 w-[200px]">Link to Chain</th>
                            <th className="text-right p-3 text-xs font-semibold text-slate-500 w-[120px]">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={5} className="py-16 text-center"><Loader2 className="h-5 w-5 animate-spin text-slate-400 mx-auto" /></td></tr>
                        ) : rows.length === 0 ? (
                            <tr><td colSpan={5} className="py-16 text-center text-sm text-slate-400">
                                <AlertCircle className="h-5 w-5 mx-auto mb-2 text-slate-300" />
                                No companies in queue
                            </td></tr>
                        ) : rows.map(row => {
                            const isSaving = savingId === row.company_id;
                            return (
                                <tr key={row.company_id} className="border-b last:border-0 hover:bg-slate-50/50">
                                    <td className="p-3">
                                        <div className="flex items-center gap-2">
                                            <Building2 className="h-4 w-4 text-slate-300 shrink-0" />
                                            <span className="font-medium text-slate-800">{row.company_master}</span>
                                            {row.chain_mapping_status === 'independent' && (
                                                <Badge variant="outline" className="text-[10px] text-slate-500">Independent</Badge>
                                            )}
                                        </div>
                                    </td>
                                    <td className="p-3"><StarLabel rating={row.rating} /></td>
                                    <td className="p-3">
                                        <span className={`font-semibold ${row.candidate_count > 0 ? "text-indigo-600" : "text-slate-300"}`}>
                                            {row.candidate_count > 0 ? row.candidate_count : "—"}
                                        </span>
                                    </td>
                                    <td className="p-3">
                                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" /> : (
                                            <ChainPicker
                                                chains={chains}
                                                onSelect={id => handleAssign(row.company_id, id)}
                                                disabled={isSaving}
                                            />
                                        )}
                                    </td>
                                    <td className="p-3 text-right">
                                        <Button
                                            variant="ghost" size="sm"
                                            className="h-7 text-xs text-slate-400 hover:text-slate-700"
                                            onClick={() => handleIndependent(row.company_id)}
                                            disabled={isSaving || row.chain_mapping_status === 'independent'}
                                        >
                                            Independent
                                        </Button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>

                {totalPages > 1 && (
                    <div className="p-3 border-t flex items-center justify-between bg-slate-50">
                        <span className="text-xs text-slate-500">Page {page + 1} / {totalPages}</span>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Previous</Button>
                            <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Next</Button>
                        </div>
                    </div>
                )}
            </Card>
        </div>
    );
}

// ── Add Chain Modal ────────────────────────────────────────────────────────────
function AddChainModal({
    chains,
    onClose,
    onAdded,
}: {
    chains: HotelChainPickerItem[];
    onClose: () => void;
    onAdded: (brand: HotelChainPickerItem) => void;
}) {
    const [type, setType] = useState<"parent" | "sub">("sub");
    const [name, setName] = useState("");
    const [parentId, setParentId] = useState<number | null>(null);
    const [rating, setRating] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const parents = chains.filter(c => c.parent_id === null);

    async function handleSave() {
        if (!name.trim()) return;
        if (type === "sub" && !parentId) { toast.error("Select a parent chain"); return; }
        setSaving(true);
        const result = await addHotelChainEntry({ brand_name: name.trim(), parent_id: type === "sub" ? parentId : null, rating });
        setSaving(false);
        if (!result.success) { toast.error(result.error ?? "Failed"); return; }
        toast.success(`"${name.trim()}" added`);
        onAdded({
            brand_id: result.brand!.brand_id,
            brand_name: result.brand!.brand_name,
            parent_id: result.brand!.parent_id,
            rating: result.brand!.rating,
            parent_name: parents.find(p => p.brand_id === parentId)?.brand_name ?? null,
        });
        onClose();
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-[420px] p-6">
                <div className="flex items-center justify-between mb-5">
                    <h3 className="font-bold text-slate-900 flex items-center gap-2">
                        <Hotel className="h-5 w-5 text-indigo-600" /> Add Hotel Chain / Sub-brand
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
                </div>
                <div className="space-y-4">
                    <div>
                        <label className="text-xs font-medium text-slate-500 mb-1.5 block">Type</label>
                        <div className="flex gap-2">
                            {(["parent", "sub"] as const).map(t => (
                                <button key={t} onClick={() => setType(t)}
                                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${type === t ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-600"}`}>
                                    {t === "parent" ? "Parent Chain" : "Sub-brand"}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-medium text-slate-500 mb-1.5 block">Name</label>
                        <Input placeholder={type === "parent" ? "e.g. SALA Hospitality Group" : "e.g. SALA Resort & Spa"}
                            value={name} onChange={e => setName(e.target.value)} className="h-9" autoFocus />
                    </div>
                    {type === "sub" && (
                        <div>
                            <label className="text-xs font-medium text-slate-500 mb-1.5 block">Parent Chain</label>
                            <select className="w-full h-9 border rounded-lg px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                value={parentId ?? ""} onChange={e => setParentId(e.target.value ? Number(e.target.value) : null)}>
                                <option value="">Select parent chain...</option>
                                {parents.map(p => <option key={p.brand_id} value={p.brand_id}>{p.brand_name}</option>)}
                            </select>
                        </div>
                    )}
                    {type === "sub" && (
                        <div>
                            <label className="text-xs font-medium text-slate-500 mb-1.5 block">Star Rating (Sub-brand)</label>
                            <div className="flex gap-2">
                                {RATINGS.map(r => (
                                    <button key={r} onClick={() => setRating(rating === r ? null : r)}
                                        className={`flex-1 py-1.5 rounded-lg text-sm border transition-colors ${rating === r ? "border-amber-400 bg-amber-50 text-amber-600" : "border-slate-200 text-slate-500"}`}>
                                        {r === "3 Star" ? "★★★" : r === "4 Star" ? "★★★★" : "★★★★★"}
                                    </button>
                                ))}
                                <button onClick={() => setRating(null)}
                                    className={`px-3 py-1.5 rounded-lg text-xs border ${rating === null ? "border-slate-400 bg-slate-100" : "border-slate-200 text-slate-400"}`}>
                                    None
                                </button>
                            </div>
                        </div>
                    )}
                </div>
                <div className="flex gap-3 mt-6">
                    <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
                    <Button className="flex-1 bg-indigo-600 hover:bg-indigo-700" onClick={handleSave}
                        disabled={saving || !name.trim() || (type === "sub" && !parentId)}>
                        {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                        Add
                    </Button>
                </div>
            </div>
        </div>
    );
}

// ── Main ───────────────────────────────────────────────────────────────────────
export default function HotelChainMappingTab() {
    const [tab, setTab] = useState<"chains" | "queue">("chains");
    const [chains, setChains] = useState<HotelChainPickerItem[]>([]);
    const [stats, setStats] = useState<HotelChainStats | null>(null);
    const [statsLoading, setStatsLoading] = useState(true);
    const [chainsLoading, setChainsLoading] = useState(true);

    const loadChains = useCallback(async () => {
        setChainsLoading(true);
        const data = await getHotelChainsForPicker();
        setChains(data);
        setChainsLoading(false);
    }, []);

    const loadStats = useCallback(async () => {
        setStatsLoading(true);
        const data = await getHotelChainStats();
        setStats(data);
        setStatsLoading(false);
    }, []);

    useEffect(() => { loadChains(); loadStats(); }, [loadChains, loadStats]);

    function handleRatingUpdated(brandId: number, rating: string | null) {
        setChains(prev => prev.map(c => c.brand_id === brandId ? { ...c, rating } : c));
    }

    function handleChainAdded(brand: HotelChainPickerItem) {
        setChains(prev => [...prev, brand]);
        loadStats();
    }

    return (
        <div className="flex flex-col gap-5">
            <StatsBar stats={stats} loading={statsLoading} />

            {/* Tabs */}
            <div className="flex gap-1 border-b">
                <button
                    onClick={() => setTab("chains")}
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                        tab === "chains" ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-700"
                    }`}
                >
                    <Hotel className="h-4 w-4" />
                    Chains & Sub-brands
                    {!chainsLoading && <Badge variant="secondary" className="text-[10px]">{chains.filter(c => c.parent_id === null).length}</Badge>}
                </button>
                <button
                    onClick={() => setTab("queue")}
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                        tab === "queue" ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-700"
                    }`}
                >
                    <Building2 className="h-4 w-4" />
                    Unmapped Companies
                    {stats && <Badge variant="secondary" className="text-[10px] bg-rose-50 text-rose-600">{stats.unmapped_companies.toLocaleString()}</Badge>}
                </button>
            </div>

            {tab === "chains" && !chainsLoading && (
                <ChainsTab
                    chains={chains}
                    onChainAdded={handleChainAdded}
                    onRatingUpdated={handleRatingUpdated}
                />
            )}
            {tab === "chains" && chainsLoading && (
                <div className="py-16 text-center"><Loader2 className="h-5 w-5 animate-spin text-slate-400 mx-auto" /></div>
            )}
            {tab === "queue" && (
                <UnmappedQueueTab chains={chains} />
            )}
        </div>
    );
}
