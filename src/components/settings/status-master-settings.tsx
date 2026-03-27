"use client";

import { useEffect, useState } from "react";
import { getStatusMaster, createStatus, updateStatusColors, deleteStatus, StatusMasterRow } from "@/app/actions/status-master";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Trash2, Plus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// Preset color palette
const COLOR_PRESETS = [
    { label: "Default",  font: null,      bg: null      },
    { label: "Red",      font: "#b91c1c", bg: "#fef2f2" },
    { label: "Green",    font: "#065f46", bg: "#d1fae5" },
    { label: "Orange",   font: "#c2410c", bg: "#fff7ed" },
    { label: "Yellow",   font: "#92400e", bg: "#fefce8" },
    { label: "Slate",    font: "#475569", bg: "#f8fafc" },
] as const;

const BG_PREVIEW: Record<string, string> = {
    "#fef2f2": "bg-red-50",
    "#d1fae5": "bg-emerald-100",
    "#fff7ed": "bg-orange-50",
    "#fefce8": "bg-yellow-50",
    "#f8fafc": "bg-slate-50",
};

function findPresetLabel(font: string | null, bg: string | null) {
    const match = COLOR_PRESETS.find(p => p.font === font && p.bg === bg);
    return match?.label ?? "Default";
}

export function StatusMasterSettings() {
    const [rows, setRows] = useState<StatusMasterRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<string | null>(null);
    const [deleting, setDeleting] = useState<string | null>(null);
    const [newStatus, setNewStatus] = useState("");
    const [adding, setAdding] = useState(false);

    async function reload() {
        setLoading(true);
        const data = await getStatusMaster();
        setRows(data as StatusMasterRow[]);
        setLoading(false);
    }

    useEffect(() => { reload(); }, []);

    async function handleColorChange(status: string, presetLabel: string) {
        const preset = COLOR_PRESETS.find(p => p.label === presetLabel);
        if (!preset) return;
        setSaving(status);
        const res = await updateStatusColors(status, preset.font ?? null, preset.bg ?? null);
        if (res.success) {
            toast.success(`Updated "${status}" colors`);
            await reload();
        } else {
            toast.error(res.error);
        }
        setSaving(null);
    }

    async function handleAdd() {
        if (!newStatus.trim()) return;
        setAdding(true);
        const res = await createStatus(newStatus.trim());
        if (res.success) {
            toast.success(`Added status "${newStatus.trim()}"`);
            setNewStatus("");
            await reload();
        } else {
            toast.error(res.error);
        }
        setAdding(false);
    }

    async function handleDelete(status: string) {
        if (!confirm(`Delete status "${status}"?`)) return;
        setDeleting(status);
        const res = await deleteStatus(status);
        if (res.success) {
            toast.success(`Deleted "${status}"`);
            await reload();
        } else {
            toast.error(res.error);
        }
        setDeleting(null);
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
                <Loader2 className="h-5 w-5 animate-spin" /> Loading statuses...
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div>
                <h2 className="text-lg font-bold text-slate-800">Pipeline Statuses</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                    Manage candidate statuses and their row colors in the JR Manage view.
                </p>
            </div>

            {/* Color Legend */}
            <div className="flex flex-wrap gap-2 pb-2 border-b border-slate-100">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest self-center mr-1">Colors:</span>
                {COLOR_PRESETS.map(p => (
                    <span
                        key={p.label}
                        className={cn(
                            "text-xs font-semibold px-3 py-1 rounded-full border",
                            p.bg ? BG_PREVIEW[p.bg] : "bg-white",
                            "border-slate-200"
                        )}
                        style={{ color: p.font ?? "#374151" }}
                    >
                        {p.label}
                    </span>
                ))}
            </div>

            {/* Table */}
            <div className="rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="text-left font-black text-xs uppercase tracking-widest text-slate-400 px-5 py-3">Status</th>
                            <th className="text-left font-black text-xs uppercase tracking-widest text-slate-400 px-5 py-3 w-[220px]">Row Color</th>
                            <th className="text-left font-black text-xs uppercase tracking-widest text-slate-400 px-5 py-3 w-[160px]">Preview</th>
                            <th className="w-[60px]" />
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row) => {
                            const isSaving = saving === row.status;
                            const isDeleting = deleting === row.status;
                            const currentLabel = findPresetLabel(row.font_color, row.bg_color);

                            return (
                                <tr
                                    key={row.status}
                                    className="border-b border-slate-100 last:border-0 transition-colors"
                                    style={{ backgroundColor: row.bg_color ?? undefined }}
                                >
                                    <td className="px-5 py-3">
                                        <span
                                            className="font-semibold"
                                            style={{ color: row.font_color ?? "#1e293b" }}
                                        >
                                            {row.status}
                                        </span>
                                    </td>
                                    <td className="px-5 py-3">
                                        <select
                                            className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 w-full"
                                            value={currentLabel}
                                            onChange={(e) => handleColorChange(row.status, e.target.value)}
                                            disabled={isSaving || isDeleting}
                                        >
                                            {COLOR_PRESETS.map(p => (
                                                <option key={p.label} value={p.label}>{p.label}</option>
                                            ))}
                                        </select>
                                    </td>
                                    <td className="px-5 py-3">
                                        <div
                                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border border-slate-200"
                                            style={{
                                                backgroundColor: row.bg_color ?? "#ffffff",
                                                color: row.font_color ?? "#374151"
                                            }}
                                        >
                                            {row.status}
                                        </div>
                                    </td>
                                    <td className="pr-4 text-right">
                                        {isSaving ? (
                                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground inline" />
                                        ) : (
                                            <button
                                                className="text-slate-300 hover:text-red-500 transition-colors disabled:opacity-30"
                                                onClick={() => handleDelete(row.status)}
                                                disabled={isDeleting}
                                                title="Delete status"
                                            >
                                                {isDeleting
                                                    ? <Loader2 className="h-4 w-4 animate-spin" />
                                                    : <Trash2 className="h-4 w-4" />
                                                }
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Add new status */}
            <div className="flex items-center gap-2 pt-2">
                <Input
                    placeholder="New status name..."
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                    className="h-9 text-sm max-w-xs"
                />
                <Button
                    size="sm"
                    onClick={handleAdd}
                    disabled={!newStatus.trim() || adding}
                    className="h-9"
                >
                    {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
                    Add Status
                </Button>
            </div>
        </div>
    );
}
