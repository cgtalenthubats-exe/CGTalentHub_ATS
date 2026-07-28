"use client";

import { useEffect, useState, useRef, type DragEvent as ReactDragEvent } from "react";
import { getStatusMaster, createStatus, updateStatusColors, updateRowColorEnabled, deleteStatus, reorderStatusMaster, StatusMasterRow } from "@/app/actions/status-master";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/lib/notifications";
import { Trash2, Plus, Loader2, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

// Preset color palette — Blue/Purple/Amber added to match colors already shown elsewhere in the
// app via candidate-list.tsx's keyword-based fallback (Approached/Prescreen=blue, Interview=purple,
// Offer=amber), which previously had no matching preset here.
const COLOR_PRESETS = [
    { label: "Default",  font: null,      bg: null      },
    { label: "Blue",     font: "#1d4ed8", bg: "#eff6ff" },
    { label: "Purple",   font: "#7e22ce", bg: "#faf5ff" },
    { label: "Red",      font: "#b91c1c", bg: "#fef2f2" },
    { label: "Green",    font: "#065f46", bg: "#d1fae5" },
    { label: "Orange",   font: "#c2410c", bg: "#fff7ed" },
    { label: "Amber",    font: "#b45309", bg: "#fffbeb" },
    { label: "Yellow",   font: "#92400e", bg: "#fefce8" },
    { label: "Slate",    font: "#475569", bg: "#f8fafc" },
] as const;

const BG_PREVIEW: Record<string, string> = {
    "#eff6ff": "bg-blue-50",
    "#faf5ff": "bg-purple-50",
    "#fef2f2": "bg-red-50",
    "#d1fae5": "bg-emerald-100",
    "#fff7ed": "bg-orange-50",
    "#fffbeb": "bg-amber-50",
    "#fefce8": "bg-yellow-50",
    "#f8fafc": "bg-slate-50",
};

const CUSTOM_LABEL = "Custom";

function findPresetLabel(font: string | null, bg: string | null) {
    const match = COLOR_PRESETS.find(p => p.font === font && p.bg === bg);
    if (match) return match.label;
    // Has a color but it doesn't match any preset exactly — came from the custom pickers below.
    if (font || bg) return CUSTOM_LABEL;
    return "Default";
}

export function StatusMasterSettings() {
    const [rows, setRows] = useState<StatusMasterRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<string | null>(null);
    const [deleting, setDeleting] = useState<string | null>(null);
    const [newStatus, setNewStatus] = useState("");
    const [adding, setAdding] = useState(false);

    // Re-fetches rows in place without the full-page "Loading statuses..." spinner — used after
    // every save so a color tweak doesn't blank out the whole table each time.
    async function refreshRows() {
        const data = await getStatusMaster();
        setRows(data as StatusMasterRow[]);
    }

    useEffect(() => {
        (async () => {
            setLoading(true);
            await refreshRows();
            setLoading(false);
        })();
    }, []);

    async function handleColorChange(status: string, presetLabel: string) {
        const preset = COLOR_PRESETS.find(p => p.label === presetLabel);
        if (!preset) return;
        setSaving(status);
        const res = await updateStatusColors(status, preset.font ?? null, preset.bg ?? null);
        if (res.success) {
            toast.success(`Updated "${status}" colors`);
            await refreshRows();
        } else {
            toast.error(res.error);
        }
        setSaving(null);
    }

    // Custom hex picker — bypasses the presets entirely for exact color control.
    async function handleCustomColorChange(status: string, font: string | null, bg: string | null) {
        setSaving(status);
        const res = await updateStatusColors(status, font, bg);
        if (!res.success) toast.error(res.error);
        await refreshRows();
        setSaving(null);
    }

    async function handleRowColorToggle(status: string, enabled: boolean) {
        setSaving(status);
        const res = await updateRowColorEnabled(status, enabled);
        if (res.success) {
            toast.success(enabled ? `"${status}" now tints the whole row` : `"${status}" now only colors the status chip`);
            await refreshRows();
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
            await refreshRows();
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
            await refreshRows();
        } else {
            toast.error(res.error);
        }
        setDeleting(null);
    }

    // Drag-to-reorder — same native HTML5 drag approach already used by the Kanban board,
    // so no new dependency is needed. Reorders local state immediately, persists on drop.
    const draggedStatus = useRef<string | null>(null);
    const [dragOverStatus, setDragOverStatus] = useState<string | null>(null);
    const [reordering, setReordering] = useState(false);

    function handleDragStart(status: string) {
        draggedStatus.current = status;
    }

    function handleDragOver(e: ReactDragEvent, status: string) {
        e.preventDefault();
        if (status !== dragOverStatus) setDragOverStatus(status);
    }

    async function handleDrop(targetStatus: string) {
        const source = draggedStatus.current;
        draggedStatus.current = null;
        setDragOverStatus(null);
        if (!source || source === targetStatus) return;

        const current = [...rows];
        const fromIdx = current.findIndex(r => r.status === source);
        const toIdx = current.findIndex(r => r.status === targetStatus);
        if (fromIdx === -1 || toIdx === -1) return;

        const [moved] = current.splice(fromIdx, 1);
        current.splice(toIdx, 0, moved);

        setRows(current); // optimistic
        setReordering(true);
        const res = await reorderStatusMaster(current.map(r => r.status));
        if (res.success) {
            toast.success("Order updated");
            await refreshRows();
        } else {
            toast.error(res.error);
            await refreshRows(); // revert to server truth
        }
        setReordering(false);
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
                            <th className="w-[36px]" />
                            <th className="text-left font-black text-xs uppercase tracking-widest text-slate-400 px-5 py-3">Status</th>
                            <th className="text-left font-black text-xs uppercase tracking-widest text-slate-400 px-5 py-3 w-[220px]">Chip Color</th>
                            <th className="text-left font-black text-xs uppercase tracking-widest text-slate-400 px-5 py-3 w-[160px]">Preview</th>
                            <th className="text-center font-black text-xs uppercase tracking-widest text-slate-400 px-5 py-3 w-[110px]">Tint Row?</th>
                            <th className="w-[60px]" />
                        </tr>
                    </thead>
                    <tbody>
                        {rows.flatMap((row, idx) => {
                            const isSaving = saving === row.status;
                            const isDeleting = deleting === row.status;
                            const currentLabel = findPresetLabel(row.font_color, row.bg_color);
                            const isDragOver = dragOverStatus === row.status;

                            const rowEl = (
                                <tr
                                    key={row.status}
                                    draggable
                                    onDragStart={() => handleDragStart(row.status)}
                                    onDragOver={(e) => handleDragOver(e, row.status)}
                                    onDragLeave={() => setDragOverStatus(prev => prev === row.status ? null : prev)}
                                    onDrop={() => handleDrop(row.status)}
                                    className={cn(
                                        "border-b border-slate-100 last:border-0 transition-colors",
                                        isDragOver && "ring-2 ring-inset ring-primary/40"
                                    )}
                                    style={{ backgroundColor: row.bg_color ?? undefined }}
                                >
                                    <td className="pl-4 text-slate-300 cursor-grab active:cursor-grabbing" title="Drag to reorder">
                                        <GripVertical className="h-4 w-4" />
                                    </td>
                                    <td className="px-5 py-3">
                                        <span
                                            className="font-semibold"
                                            style={{ color: row.font_color ?? "#1e293b" }}
                                        >
                                            {row.status}
                                        </span>
                                    </td>
                                    <td className="px-5 py-3">
                                        <div className="flex items-center gap-2">
                                            <select
                                                className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 flex-1 min-w-0"
                                                value={currentLabel}
                                                onChange={(e) => handleColorChange(row.status, e.target.value)}
                                                disabled={isSaving || isDeleting}
                                            >
                                                {COLOR_PRESETS.map(p => (
                                                    <option key={p.label} value={p.label}>{p.label}</option>
                                                ))}
                                                {currentLabel === CUSTOM_LABEL && (
                                                    <option value={CUSTOM_LABEL}>{CUSTOM_LABEL}</option>
                                                )}
                                            </select>
                                            {/* Custom hex pickers — font (text) + bg (fill), independent of the presets above */}
                                            <div className="flex flex-col items-center gap-0.5 shrink-0">
                                                <span className="text-[9px] font-black uppercase text-slate-400 tracking-wide">Font</span>
                                                <input
                                                    type="color"
                                                    title="Custom font color"
                                                    value={row.font_color ?? "#000000"}
                                                    onChange={(e) => handleCustomColorChange(row.status, e.target.value, row.bg_color)}
                                                    disabled={isSaving || isDeleting}
                                                    className="h-7 w-8 rounded-md border border-slate-200 p-0.5 cursor-pointer disabled:opacity-30"
                                                />
                                            </div>
                                            <div className="flex flex-col items-center gap-0.5 shrink-0">
                                                <span className="text-[9px] font-black uppercase text-slate-400 tracking-wide">BG</span>
                                                <input
                                                    type="color"
                                                    title="Custom background color"
                                                    value={row.bg_color ?? "#ffffff"}
                                                    onChange={(e) => handleCustomColorChange(row.status, row.font_color, e.target.value)}
                                                    disabled={isSaving || isDeleting}
                                                    className="h-7 w-8 rounded-md border border-slate-200 p-0.5 cursor-pointer disabled:opacity-30"
                                                />
                                            </div>
                                        </div>
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
                                    <td className="px-5 py-3 text-center">
                                        <Checkbox
                                            checked={row.row_color_enabled}
                                            onCheckedChange={(v) => handleRowColorToggle(row.status, !!v)}
                                            disabled={isSaving || isDeleting}
                                            title="Also tint the whole candidate-list row with this color"
                                        />
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

                            // Divider marking the Positive/Negative boundary used by the JR Manage
                            // candidate list sort (candidate-list.tsx) — everything above here sorts
                            // furthest-along-first, everything below sorts closest-to-Pool-first.
                            if (row.status === 'Successful Placement' && idx < rows.length - 1) {
                                return [
                                    rowEl,
                                    <tr key="__divider" className="bg-slate-100/80">
                                        <td colSpan={6} className="px-5 py-1.5 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">
                                            ▼ Negative / Rejected statuses (sorted lowest-order first below) ▼
                                        </td>
                                    </tr>
                                ];
                            }

                            return [rowEl];
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
