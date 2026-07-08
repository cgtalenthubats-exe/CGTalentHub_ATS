import React, { useEffect, useState, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { JRCandidate } from "@/types/requisition";
import { getJRCandidates } from "@/app/actions/jr-candidates";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    MoreHorizontal,
    MessageSquare,
    ArrowRight,
    UserMinus,
    Copy,
    Trash2,

    Search,
    Filter,
    ChevronDown,
    Loader2,
    Building2,
    UserCircle2,
    Briefcase,
    History,
    RefreshCw,
    Pencil,
} from "lucide-react";
import { getStatusMaster } from "@/app/actions/status-master";
import {
    updateCandidateStatus,
    batchUpdateCandidateStatus,
    updateJRCandidateMetadata,
    removeFromJR,
    copyCandidatesToJR
} from "@/app/actions/status-updates";
import { triggerCandidateRefresh } from "@/app/actions/n8n-actions";
import { getStatuses, addStatus } from "@/app/actions/candidate-filters";
import { toast } from "@/lib/notifications";
import { getJobRequisitions } from "@/app/actions/requisitions";
import { cn } from "@/lib/utils";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";
import { AddFeedbackDialog } from "@/components/add-feedback-dialog";
import { CandidateAvatar } from "@/components/candidate-avatar";
import { StatusChangeDialog } from "@/components/status-change-dialog";
import { JRCandidateSheet } from "@/components/jr-candidate-sheet";

interface CandidateListProps {
    jrId: string;
    jobTitle: string;
    bu: string;
    subBu: string;
    updatedBy?: string;
    showSalary?: boolean;
}

import { ConfirmPlacementDialog } from "@/components/confirm-placement-dialog";
import { CandidateLinkedinButton } from "@/components/candidate-linkedin-button";
import { CompanyQuickEditDialog } from "@/components/company-quick-edit-dialog";

const UNKNOWN = '(Unknown)';

// ─── User Avatar helpers ──────────────────────────────────────────────────────
const AVATAR_COLORS = ['#6366f1','#8b5cf6','#ec4899','#f59e0b','#10b981','#3b82f6','#ef4444','#14b8a6','#f97316','#0ea5e9'];

function getAvatarColor(s: string): string {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
    return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function getInitials(s: string): string {
    if (s.includes('@')) {
        const local = s.split('@')[0];
        const num = local.match(/(\d+)$/);
        if (num) return local[0].toUpperCase() + parseInt(num[1]);
        return (local[0] + (local[1] || '')).toUpperCase();
    }
    const words = s.trim().split(/\s+/);
    if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
    return s.slice(0, 2).toUpperCase();
}

function UserAvatar({ id }: { id: string }) {
    return (
        <div
            className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-black text-white shrink-0 ring-2 ring-white"
            style={{ backgroundColor: getAvatarColor(id) }}
            title={id}
        >
            {getInitials(id)}
        </div>
    );
}

function buildOptions(vals: (string | null | undefined)[]): string[] {
    const defined = Array.from(new Set(vals.filter(Boolean))).sort() as string[];
    const hasUnknown = vals.some(v => !v);
    return hasUnknown ? [...defined, UNKNOWN] : defined;
}

function matchesMultiFilter(filter: string[], value: string | null | undefined): boolean {
    if (filter.length === 0) return true;
    return filter.some(f => f === UNKNOWN ? !value : f === value);
}

// Standalone multi-select filter with search input + Apply/Clear UX
function MSFilter({ label, options, selected, setSelected }: {
    label: string; options: string[]; selected: string[]; setSelected: (v: string[]) => void;
}) {
    const [open, setOpen] = useState(false);
    const [pending, setPending] = useState<string[]>([]);
    const [search, setSearch] = useState('');

    const handleOpenChange = (isOpen: boolean) => {
        if (isOpen) { setPending([...selected]); setSearch(''); }
        setOpen(isOpen);
    };

    const filtered = search
        ? options.filter(o => o.toLowerCase().includes(search.toLowerCase()))
        : options;

    const togglePending = (val: string) =>
        setPending(p => p.includes(val) ? p.filter(x => x !== val) : [...p, val]);

    const apply = () => { setSelected([...pending]); setOpen(false); };
    const clear = () => { setPending([]); setSelected([]); setOpen(false); };

    return (
        <Popover open={open} onOpenChange={handleOpenChange}>
            <PopoverTrigger asChild>
                <button className={cn(
                    "h-8 inline-flex items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold shadow-sm whitespace-nowrap transition-all",
                    selected.length > 0
                        ? "bg-indigo-50 border-indigo-300 text-indigo-700"
                        : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
                )}>
                    {selected.length > 0 ? `${label} (${selected.length})` : label}
                    <ChevronDown className="h-3 w-3 opacity-50" />
                </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[240px] p-0 shadow-xl border-slate-100 rounded-xl z-50">
                <div className="px-3 py-2 border-b border-slate-100">
                    <div className="mb-1.5 text-[10px] font-black uppercase text-slate-400 tracking-widest">{label}</div>
                    <input
                        placeholder="Search..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded-md outline-none focus:ring-1 focus:ring-indigo-300 bg-white"
                    />
                </div>
                <ScrollArea className="max-h-[200px]">
                    <div className="p-2 flex flex-col gap-0.5">
                        {filtered.length === 0 && (
                            <div className="text-xs text-slate-400 text-center py-3">No options</div>
                        )}
                        {filtered.map((opt, idx) => (
                            <label key={`${opt}-${idx}`} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer text-xs font-medium text-slate-700">
                                <Checkbox
                                    checked={pending.includes(opt)}
                                    onCheckedChange={() => togglePending(opt)}
                                    className="border-slate-300 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600 shrink-0"
                                />
                                <span className="leading-snug">{opt}</span>
                            </label>
                        ))}
                    </div>
                </ScrollArea>
                <div className="flex gap-2 p-2 border-t border-slate-100">
                    <button onClick={clear} className="flex-1 text-xs text-red-500 hover:text-red-700 font-semibold py-1.5 border border-red-100 rounded-md hover:bg-red-50">
                        Clear
                    </button>
                    <button onClick={apply} className="flex-1 text-xs bg-indigo-600 text-white rounded-md py-1.5 font-semibold hover:bg-indigo-700">
                        Apply
                    </button>
                </div>
            </PopoverContent>
        </Popover>
    );
}

// Age range filter with min/max inputs + include-unknown toggle
function AgeFilter({ ageMin, ageMax, includeUnknown, onChange }: {
    ageMin: number | null;
    ageMax: number | null;
    includeUnknown: boolean;
    onChange: (min: number | null, max: number | null, includeUnknown: boolean) => void;
}) {
    const [open, setOpen] = useState(false);
    const [pendingMin, setPendingMin] = useState('');
    const [pendingMax, setPendingMax] = useState('');
    const [pendingInclude, setPendingInclude] = useState(true);

    const handleOpenChange = (isOpen: boolean) => {
        if (isOpen) {
            setPendingMin(ageMin !== null ? String(ageMin) : '');
            setPendingMax(ageMax !== null ? String(ageMax) : '');
            setPendingInclude(includeUnknown);
        }
        setOpen(isOpen);
    };

    const apply = () => {
        const min = pendingMin !== '' ? parseInt(pendingMin) : null;
        const max = pendingMax !== '' ? parseInt(pendingMax) : null;
        onChange(
            min !== null && !isNaN(min) ? min : null,
            max !== null && !isNaN(max) ? max : null,
            pendingInclude
        );
        setOpen(false);
    };

    const clear = () => { onChange(null, null, true); setOpen(false); };

    const isActive = ageMin !== null || ageMax !== null;
    const label = isActive
        ? `Age: ${ageMin ?? ''}–${ageMax ?? ''}`
        : 'Age';

    return (
        <Popover open={open} onOpenChange={handleOpenChange}>
            <PopoverTrigger asChild>
                <button className={cn(
                    "h-8 inline-flex items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold shadow-sm whitespace-nowrap transition-all",
                    isActive
                        ? "bg-indigo-50 border-indigo-300 text-indigo-700"
                        : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
                )}>
                    {label}
                    <ChevronDown className="h-3 w-3 opacity-50" />
                </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[220px] p-0 shadow-xl border-slate-100 rounded-xl z-50">
                <div className="px-3 py-2 border-b border-slate-100">
                    <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2">Age Range</div>
                    <div className="flex items-center gap-2">
                        <input
                            type="number" placeholder="Min" value={pendingMin}
                            onChange={e => setPendingMin(e.target.value)}
                            className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded-md outline-none focus:ring-1 focus:ring-indigo-300 bg-white"
                            min={0} max={100}
                        />
                        <span className="text-slate-400 text-xs shrink-0">–</span>
                        <input
                            type="number" placeholder="Max" value={pendingMax}
                            onChange={e => setPendingMax(e.target.value)}
                            className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded-md outline-none focus:ring-1 focus:ring-indigo-300 bg-white"
                            min={0} max={100}
                        />
                    </div>
                </div>
                <div className="px-3 py-2.5 border-b border-slate-100">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                            checked={pendingInclude}
                            onCheckedChange={v => setPendingInclude(!!v)}
                            className="border-slate-300 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
                        />
                        <span className="text-xs text-slate-600 font-medium">Include unknown age</span>
                    </label>
                </div>
                <div className="flex gap-2 p-2">
                    <button onClick={clear} className="flex-1 text-xs text-red-500 hover:text-red-700 font-semibold py-1.5 border border-red-100 rounded-md hover:bg-red-50">
                        Clear
                    </button>
                    <button onClick={apply} className="flex-1 text-xs bg-indigo-600 text-white rounded-md py-1.5 font-semibold hover:bg-indigo-700">
                        Apply
                    </button>
                </div>
            </PopoverContent>
        </Popover>
    );
}

export function CandidateList({ jrId, jobTitle, bu, subBu, updatedBy, showSalary }: CandidateListProps) {
    const [candidates, setCandidates] = useState<JRCandidate[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusUpdating, setStatusUpdating] = useState<string | null>(null);
    const [filterText, setFilterText] = useState("");
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [statusOptions, setStatusOptions] = useState<any[]>([]);
    const [allJRs, setAllJRs] = useState<any[]>([]);

    // Per-column multi-select filters
    const [filterStatus, setFilterStatus] = useState<string[]>([]);
    const [filterGender, setFilterGender] = useState<string[]>([]);
    const [filterCompany, setFilterCompany] = useState<string[]>([]);
    const [filterPosition, setFilterPosition] = useState<string[]>([]);
    const [filterIsCurrentJob, setFilterIsCurrentJob] = useState<string[]>([]);
    const [filterCountry, setFilterCountry] = useState<string[]>([]);
    const [filterRegion, setFilterRegion] = useState<string[]>([]);
    const [filterNationality, setFilterNationality] = useState<string[]>([]);
    const [filterIndustry, setFilterIndustry] = useState<string[]>([]);
    const [filterRating, setFilterRating] = useState<string[]>([]);
    const [filterReviewer, setFilterReviewer] = useState<string[]>([]);
    const [filterAgeMin, setFilterAgeMin] = useState<number | null>(null);
    const [filterAgeMax, setFilterAgeMax] = useState<number | null>(null);
    const [filterAgeIncludeUnknown, setFilterAgeIncludeUnknown] = useState(true);

    // Status color map from DB
    const [statusColorMap, setStatusColorMap] = useState<Record<string, { font_color: string | null; bg_color: string | null }>>({});

    // Feedback Dialog State
    const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
    const [feedbackCandidate, setFeedbackCandidate] = useState<{ id: string, name: string } | null>(null);
    const [placementCandidate, setPlacementCandidate] = useState<{ id: string, name: string } | null>(null);

    // Sheet (Activity & Logs) State
    const [isSheetOpen, setIsSheetOpen] = useState(false);
    const [sheetCandidateId, setSheetCandidateId] = useState<string | null>(null);

    // Status Dialog State
    const [statusDialogOpen, setStatusDialogOpen] = useState(false);
    const [pendingStatus, setPendingStatus] = useState<string>("");
    const [pendingCandidateId, setPendingCandidateId] = useState<string | null>(null); // null if batch update
    const [isBatchUpdate, setIsBatchUpdate] = useState(false);
    const [editCompany, setEditCompany] = useState<{
        companyId: string; companyName: string; industry: string; group: string;
    } | null>(null);
    
    // Scroll Synchronization Refs
    const topScrollRef = useRef<HTMLDivElement>(null);
    const tableContainerRef = useRef<HTMLDivElement>(null);
    const virtualScrollRef = useRef<HTMLDivElement>(null);
    const [tableWidth, setTableWidth] = useState(0);

    // Sync scroll between top and bottom
    useEffect(() => {
        const top = topScrollRef.current;
        const bottom = tableContainerRef.current;
        if (!top || !bottom) return;

        let isSyncingTop = false;
        let isSyncingBottom = false;

        const onTopScroll = () => {
            if (!isSyncingBottom) {
                isSyncingTop = true;
                bottom.scrollLeft = top.scrollLeft;
            }
            isSyncingBottom = false;
        };

        const onBottomScroll = () => {
            if (!isSyncingTop) {
                isSyncingBottom = true;
                top.scrollLeft = bottom.scrollLeft;
            }
            isSyncingTop = false;
        };

        top.addEventListener('scroll', onTopScroll);
        bottom.addEventListener('scroll', onBottomScroll);

        return () => {
            top.removeEventListener('scroll', onTopScroll);
            bottom.removeEventListener('scroll', onBottomScroll);
        };
    }, [candidates.length]);

    // Update table width for dummy scrollbar
    useEffect(() => {
        const obs = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const table = entry.target.querySelector('table');
                if (table) {
                    setTableWidth(table.scrollWidth);
                }
            }
        });

        if (tableContainerRef.current) {
            obs.observe(tableContainerRef.current);
        }

        return () => obs.disconnect();
    }, [candidates.length]);

    useEffect(() => {
        async function load() {
            setLoading(true);
            try {
                const [candData, masters, jrs] = await Promise.all([
                    getJRCandidates(jrId),
                    getStatusMaster(),
                    getJobRequisitions()
                ]);
                setCandidates(candData);
                setStatusOptions(masters);
                setAllJRs(jrs.filter(j => j.id !== jrId));

                // Build color map from status master
                const colorMap: Record<string, { font_color: string | null; bg_color: string | null }> = {};
                (masters as any[]).forEach((m: any) => {
                    colorMap[m.status] = { font_color: m.font_color ?? null, bg_color: m.bg_color ?? null };
                });
                setStatusColorMap(colorMap);
            } catch (error) {
                console.error("Failed to load data", error);
            }
            setLoading(false);
        }
        if (jrId) load();
        console.log("ATS System: CandidateList Loaded (Safe Version - Fix Applied) ✅");
        // Manual Sync Trigger: Confirmed Local-Remote Parity
    }, [jrId]);

    const handleStatusChange = async (jrCandId: string, newStatus: string) => {
        if (newStatus === 'Successful Placement') {
            const candidate = candidates.find(c => c.id === jrCandId);
            if (candidate) {
                setPlacementCandidate({
                    id: jrCandId,
                    name: candidate.candidate_name || "Unknown Candidate"
                });
            }
            return;
        }

        setPendingCandidateId(jrCandId);
        setPendingStatus(newStatus);
        setIsBatchUpdate(false);
        setStatusDialogOpen(true);
    };

    const handleBatchStatusChange = async (newStatus: string) => {
        if (selectedIds.length === 0) return;

        if (newStatus === 'Successful Placement') {
            toast.error("Successful Placement cannot be set via batch update. Please use the individual 'Confirm Placement' flow.");
            return;
        }

        setPendingCandidateId(null);
        setPendingStatus(newStatus);
        setIsBatchUpdate(true);
        setStatusDialogOpen(true);
    };

    const confirmStatusChange = async (status: string, note: string, updatedBy: string, timestamp: string) => {
        if (!status) return;

        if (isBatchUpdate) {
            setLoading(true);
            const { success, error } = await batchUpdateCandidateStatus(selectedIds, status, updatedBy, note || null, timestamp);
            if (success) {
                const updated = await getJRCandidates(jrId);
                setCandidates(updated);
                setSelectedIds([]);
                toast.success(`Batch updated ${selectedIds.length} candidates to ${status}`);
            } else {
                toast.error("Batch error: " + error);
            }
            setLoading(false);
        } else if (pendingCandidateId) {
            setStatusUpdating(pendingCandidateId);
            const { success, error } = await updateCandidateStatus(pendingCandidateId, status, updatedBy, note || null, timestamp);
            if (success) {
                const updated = await getJRCandidates(jrId);
                setCandidates(updated);
                toast.success(`Updated status to ${status}`);
            } else {
                toast.error("Error: " + error);
            }
            setStatusUpdating(null);
        }

        setStatusDialogOpen(false);
    };

    const handleMetadataUpdate = async (jrCandId: string, updates: any) => {
        const { success, error } = await updateJRCandidateMetadata(jrCandId, updates);
        if (success) {
            const updated = await getJRCandidates(jrId);
            setCandidates(updated);
        } else {
            alert("Update error: " + error);
        }
    };

    const handleRefreshData = async (ids: string[]) => {
        const selectedCandidates = ids.map(id => {
            const c = candidates.find(cand => cand.id === id);
            return {
                id: c?.candidate_id || id,
                name: c?.candidate_name || "",
                linkedin: c?.candidate_linkedin_url || ""
            };
        });

        toast.promise(
            triggerCandidateRefresh(selectedCandidates, "JR Manager (Manual Trigger)"),
            {
                loading: `Sending ${ids.length} candidates to n8n for refresh...`,
                success: (data: any) => {
                    if (data.success) return `Successfully triggered refresh for ${ids.length} candidates!`;
                    throw new Error(data.error);
                },
                error: (err) => `Failed to refresh: ${err.message}`
            }
        );
    };

    const handleRemove = async (ids: string[]) => {
        if (!confirm(`Are you sure you want to remove ${ids.length} candidate(s)?`)) return;
        setLoading(true);
        const { success, error } = await removeFromJR(ids);
        if (success) {
            const updated = await getJRCandidates(jrId);
            setCandidates(updated);
            setSelectedIds([]);
        } else {
            alert("Remove error: " + error);
        }
        setLoading(false);
    };

    const handleCopy = async (ids: string[], targetJrId: string) => {
        setLoading(true);
        const res = await copyCandidatesToJR(ids, targetJrId, updatedBy);
        if (res.success) {
            const added = res.addedCount ?? 0;
            const skipped = res.skippedCount ?? 0;
            if (added === 0) {
                toast.info(`All selected candidates are already present in the target JR.`);
            } else {
                toast.success(
                    `Successfully copied ${added} candidates! ${skipped > 0 ? `(${skipped} were already in target and skipped)` : ""}`
                );
            }
        } else {
            toast.error("Copy error: " + res.error);
        }
        setLoading(false);
    };

    // Status Definitions (legacy — kept for dropdown styling only)
    const greyStatuses = ["Not Open", "Not Pass Interview", "Too Senior", "Hold"];
    const redStatuses = ["Rejected", "Not fit"];

    // Unique option sets derived from all candidates (Unknown included if any nulls exist)
    const uniqueStatuses = buildOptions(candidates.map(c => c.status));
    const uniqueGenders = buildOptions(candidates.map(c => c.candidate_gender));
    const uniqueCompanies = buildOptions(candidates.map(c => c.candidate_current_company));
    const uniquePositions = buildOptions(candidates.map(c => c.candidate_current_position));
    const uniqueCurrentJobs = ['Current', 'Latest Position'];
    const uniqueCountries = buildOptions(candidates.map(c => {
        if (!c.candidate_country) return null;
        const idx = c.candidate_country.indexOf('(');
        return idx >= 0 ? c.candidate_country.slice(0, idx).trim() : c.candidate_country;
    }));
    const uniqueRegions = buildOptions(candidates.map(c => c.candidate_region));
    const uniqueNationalities = buildOptions(candidates.map(c => c.candidate_nationality));
    const uniqueIndustries = buildOptions(candidates.map(c => c.candidate_industry));
    const uniqueRatings = buildOptions(candidates.map(c => c.candidate_hotel_rating));
    const uniqueReviewers = Array.from(new Set(candidates.flatMap(c => c.candidate_reviewers || []))).sort();

    // Multi-select filter logic (empty array = show all)
    const filteredCandidates = candidates.filter(c => {
        try {
            const f = (filterText || "").toLowerCase();
            const matchesGlobal = !f ||
                (c.candidate_name || "").toLowerCase().includes(f) ||
                (c.candidate_id || "").toLowerCase().includes(f) ||
                (c.candidate_email || "").toLowerCase().includes(f) ||
                (c.candidate_current_position || "").toLowerCase().includes(f) ||
                (c.candidate_current_company || "").toLowerCase().includes(f) ||
                (c.candidate_gender || "").toLowerCase().includes(f) ||
                (c.status || "").toLowerCase().includes(f) ||
                (c.candidate_country || "").toLowerCase().includes(f) ||
                (c.candidate_nationality || "").toLowerCase().includes(f) ||
                String(c.candidate_age || "").includes(f);

            const matchesStatus = matchesMultiFilter(filterStatus, c.status);
            const matchesGender = matchesMultiFilter(filterGender, c.candidate_gender);
            const matchesCompany = matchesMultiFilter(filterCompany, c.candidate_current_company);
            const matchesPosition = matchesMultiFilter(filterPosition, c.candidate_current_position);
            const matchesCurrentJob = matchesMultiFilter(filterIsCurrentJob, c.candidate_is_current_job);
            const matchesRegion = matchesMultiFilter(filterRegion, c.candidate_region);
            const matchesNationality = matchesMultiFilter(filterNationality, c.candidate_nationality);
            const matchesIndustry = matchesMultiFilter(filterIndustry, c.candidate_industry);
            const matchesRating = matchesMultiFilter(filterRating, c.candidate_hotel_rating);
            const matchesCountry = filterCountry.length === 0 || filterCountry.some(fc =>
                fc === UNKNOWN ? !c.candidate_country : (c.candidate_country || '').startsWith(fc)
            );
            const ageFilterActive = filterAgeMin !== null || filterAgeMax !== null;
            const matchesAge = !ageFilterActive || (() => {
                const age = parseInt(String(c.candidate_age || ''));
                const hasAge = !isNaN(age) && age > 0;
                if (!hasAge) return filterAgeIncludeUnknown;
                if (filterAgeMin !== null && age < filterAgeMin) return false;
                if (filterAgeMax !== null && age > filterAgeMax) return false;
                return true;
            })();

            const matchesReviewer = filterReviewer.length === 0 || filterReviewer.some(r => (c.candidate_reviewers || []).includes(r));

            return matchesGlobal && matchesStatus && matchesGender && matchesCompany && matchesPosition && matchesCurrentJob && matchesCountry && matchesRegion && matchesNationality && matchesIndustry && matchesRating && matchesAge && matchesReviewer;
        } catch { return false; }
    });

    // Custom Sorting Hierarchy:
    // 1. Successful Placement (Global Top)
    // 2. Type (Top Profile > Longlist)
    // 3. Status Score (Active=1 > Grey=2 > Red=3)
    // 4. Rank (Ascending)
    const sortedCandidates = [...filteredCandidates].sort((a, b) => {
        // 1. Successful Placement (Global Top)
        const isPlantedA = a.status === 'Successful Placement';
        const isPlantedB = b.status === 'Successful Placement';
        if (isPlantedA && !isPlantedB) return -1;
        if (!isPlantedA && isPlantedB) return 1;

        // 2. Type (Top Profile > Longlist)
        const isTopA = a.list_type === 'Top profile';
        const isTopB = b.list_type === 'Top profile';
        if (isTopA && !isTopB) return -1;
        if (!isTopA && isTopB) return 1;

        // 3. Status Score (Active > Grey > Red)
        const getScore = (s: string) => {
            if (redStatuses.includes(s)) return 3;
            if (greyStatuses.includes(s)) return 2;
            return 1;
        };
        const scoreA = getScore(a.status);
        const scoreB = getScore(b.status);
        if (scoreA !== scoreB) return scoreA - scoreB;

        // 4. Rank
        const rA = parseInt(a.rank || "999");
        const rB = parseInt(b.rank || "999");
        return rA - rB;
    });


    // Row Style Helper — uses DB colors if configured, else falls back to status groups
    const getRowClass = (status: string, isSelected: boolean) => {
        const dbColor = statusColorMap[status];
        if (dbColor?.bg_color) {
            // DB-configured color: apply via inline style (handled at <tr> level)
            return cn(
                "border-b last:border-0 transition-all",
                isSelected && "opacity-80"
            );
        }
        // Fallback legacy classes
        if (redStatuses.includes(status)) return "bg-red-50/40 hover:bg-red-50/80 transition-colors border-b";
        if (greyStatuses.includes(status)) return "bg-slate-50/50 hover:bg-slate-100/80 transition-colors border-b";
        return cn(
            "border-b last:border-0 hover:bg-slate-50/80 transition-all",
            isSelected && "bg-indigo-50/30"
        );
    };

    // Inline row style — for DB-driven bg_color on the whole row
    const getRowStyle = (status: string): React.CSSProperties => {
        const dbColor = statusColorMap[status];
        if (dbColor?.bg_color) {
            return { backgroundColor: dbColor.bg_color };
        }
        return {};
    };

    // Virtual scroll — only render visible rows (significant for 500+ candidate JRs)
    const rowVirtualizer = useVirtualizer({
        count: sortedCandidates.length,
        getScrollElement: () => virtualScrollRef.current,
        estimateSize: () => 104,
        overscan: 8,
        measureElement: typeof window !== 'undefined'
            ? el => el?.getBoundingClientRect().height ?? 104
            : undefined,
    });
    const virtualItems = rowVirtualizer.getVirtualItems();
    const totalVirtualSize = rowVirtualizer.getTotalSize();
    const paddingTop = virtualItems.length > 0 ? virtualItems[0].start : 0;
    const paddingBottom = virtualItems.length > 0 ? totalVirtualSize - virtualItems[virtualItems.length - 1].end : 0;
    const COL_SPAN = showSalary ? 17 : 16;



    // Selection Logic
    const toggleSelectAll = () => {
        if (selectedIds.length === filteredCandidates.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(filteredCandidates.map(c => c.id));
        }
    };

    const toggleSelect = (id: string) => {
        if (selectedIds.includes(id)) {
            setSelectedIds(selectedIds.filter(i => i !== id));
        } else {
            setSelectedIds([...selectedIds, id]);
        }
    };

    if (loading) return <div className="p-8 text-center text-muted-foreground">Loading candidates...</div>;
    // Keep showing table even if filtered empty, so user can clear filter

    return (
        <Card>
            <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
                <div className="flex items-center gap-4">
                    <CardTitle className="text-lg font-semibold">Active Candidates ({filteredCandidates.length})</CardTitle>
                    <div className="flex items-center gap-2 ml-4 px-2 py-0.5 bg-yellow-50 border border-yellow-200 rounded text-[10px] font-bold text-yellow-700 uppercase tracking-tight">
                        <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
                        Has history in other JRs
                    </div>
                    {selectedIds.length > 0 && (
                        <div className="flex items-center gap-3 bg-white dark:bg-slate-900 px-4 py-2 rounded-xl animate-in fade-in slide-in-from-left-2 shadow-lg border border-slate-200">
                            <div className="flex flex-col pr-4 border-r border-slate-200">
                                <span className="text-[10px] font-black uppercase text-indigo-600 tracking-widest">Selection</span>
                                <span className="text-sm font-black text-slate-900 leading-none">{selectedIds.length} <span className="text-[10px] text-slate-400">Candidates</span></span>
                            </div>
                            
                            <div className="flex items-center gap-2">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button size="sm" variant="outline" className="h-9 px-3 text-[11px] font-black text-indigo-600 border-indigo-100 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 gap-2 uppercase tracking-wide transition-all shadow-sm">
                                            <ArrowRight className="h-3.5 w-3.5" /> Status
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="start" className="w-[200px] rounded-xl shadow-2xl border-slate-100 p-1">
                                        <DropdownMenuLabel className="text-[9px] font-black uppercase text-slate-400 tracking-widest px-3 py-2">Batch Status Update</DropdownMenuLabel>
                                        {statusOptions.map((opt, idx) => (
                                            <DropdownMenuItem
                                                key={`${opt.status}-${idx}`}
                                                className="py-2.5 font-bold text-xs cursor-pointer rounded-lg mx-1"
                                                onClick={() => handleBatchStatusChange(opt.status)}
                                            >
                                                {opt.status}
                                            </DropdownMenuItem>
                                        ))}
                                    </DropdownMenuContent>
                                </DropdownMenu>

                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-9 px-3 text-[11px] font-black text-emerald-600 border-emerald-100 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 gap-2 uppercase tracking-wide transition-all shadow-sm"
                                    onClick={() => handleRefreshData(selectedIds)}
                                    title="Send to n8n for Update"
                                >
                                    <RefreshCw className="h-3.5 w-3.5" /> Refresh
                                </Button>

                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button size="sm" variant="outline" className="h-9 px-3 text-[11px] font-black text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-indigo-600 hover:border-indigo-200 gap-2 uppercase tracking-wide transition-all shadow-sm">
                                            <Copy className="h-3.5 w-3.5" /> Copy Selected Candidate to JR
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-72 p-2 shadow-2xl border-slate-100 rounded-2xl" align="start">
                                        <div className="flex flex-col gap-2">
                                            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-2 py-1">Target Requisition</span>
                                            <ScrollArea className="h-[240px] pr-2">
                                                <div className="flex flex-col gap-1.5 p-1">
                                                    {allJRs.map((j, idx) => (
                                                        <button
                                                            key={`${j.id}-${idx}`}
                                                            className="text-left py-2.5 px-3 rounded-xl hover:bg-indigo-50 text-[12px] font-bold border border-transparent hover:border-indigo-100 transition-all group flex flex-col gap-0.5"
                                                            onClick={() => handleCopy(selectedIds, j.id)}
                                                        >
                                                            <div className="text-slate-800 group-hover:text-indigo-700 leading-snug">{j.job_title}</div>
                                                            <div className="text-slate-400 text-[10px] uppercase tracking-wider font-mono">{j.id} • {j.department}</div>
                                                        </button>
                                                    ))}
                                                </div>
                                            </ScrollArea>
                                        </div>
                                    </PopoverContent>
                                </Popover>

                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-9 px-3 text-[11px] font-black text-rose-600 border-rose-100 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 gap-2 uppercase tracking-wide transition-all shadow-sm"
                                    title="Delete"
                                    onClick={() => handleRemove(selectedIds)}
                                >
                                    <Trash2 className="h-3.5 w-3.5" /> Remove
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
                {/* Per-column multi-select filter bar */}
                <div className="border-t border-slate-100">
                    <div className="flex flex-wrap items-center gap-2 px-4 py-3 bg-slate-50/50">
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest mr-1">Filters:</span>

                        <MSFilter label="Status" options={uniqueStatuses} selected={filterStatus} setSelected={setFilterStatus} />
                        <MSFilter label="Gender" options={uniqueGenders} selected={filterGender} setSelected={setFilterGender} />
                        <MSFilter label="Company" options={uniqueCompanies} selected={filterCompany} setSelected={setFilterCompany} />
                        <MSFilter label="Position" options={uniquePositions} selected={filterPosition} setSelected={setFilterPosition} />
                        <MSFilter label="Experience Type" options={uniqueCurrentJobs} selected={filterIsCurrentJob} setSelected={setFilterIsCurrentJob} />
                        <MSFilter label="Country" options={uniqueCountries} selected={filterCountry} setSelected={setFilterCountry} />
                        <MSFilter label="Region" options={uniqueRegions} selected={filterRegion} setSelected={setFilterRegion} />
                        <MSFilter label="Nationality" options={uniqueNationalities} selected={filterNationality} setSelected={setFilterNationality} />
                        <MSFilter label="Industry" options={uniqueIndustries} selected={filterIndustry} setSelected={setFilterIndustry} />
                        <MSFilter label="Hotel Rating" options={uniqueRatings} selected={filterRating} setSelected={setFilterRating} />
                        <MSFilter label="Reviewed By" options={uniqueReviewers} selected={filterReviewer} setSelected={setFilterReviewer} />
                        <AgeFilter
                            ageMin={filterAgeMin} ageMax={filterAgeMax} includeUnknown={filterAgeIncludeUnknown}
                            onChange={(min, max, inc) => { setFilterAgeMin(min); setFilterAgeMax(max); setFilterAgeIncludeUnknown(inc); }}
                        />

                        {/* Global text search */}
                        <div className="relative ml-auto">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                            <input
                                className="h-8 w-[200px] rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-xs shadow-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                                placeholder="Search all fields…"
                                value={filterText}
                                onChange={e => setFilterText(e.target.value)}
                            />
                        </div>

                        {/* Clear all */}
                        {(filterStatus.length > 0 || filterGender.length > 0 || filterCompany.length > 0 || filterPosition.length > 0 || filterIsCurrentJob.length > 0 || filterCountry.length > 0 || filterRegion.length > 0 || filterNationality.length > 0 || filterIndustry.length > 0 || filterRating.length > 0 || filterReviewer.length > 0 || filterAgeMin !== null || filterAgeMax !== null || filterText) && (
                            <Button size="sm" variant="ghost"
                                className="h-8 px-3 text-xs text-red-500 hover:text-red-700 hover:bg-red-50"
                                onClick={() => {
                                    setFilterStatus([]); setFilterGender([]); setFilterCompany([]);
                                    setFilterPosition([]); setFilterIsCurrentJob([]); setFilterCountry([]);
                                    setFilterRegion([]); setFilterNationality([]); setFilterIndustry([]); setFilterRating([]); setFilterReviewer([]);
                                    setFilterAgeMin(null); setFilterAgeMax(null); setFilterAgeIncludeUnknown(true);
                                    setFilterText("");
                                }}>
                                ✕ Clear All
                            </Button>
                        )}
                    </div>
                </div>
            </CardHeader>

            {/* Top Synchronized Scrollbar */}
            <div 
                ref={topScrollRef}
                className="w-full overflow-x-auto overflow-y-hidden h-3 bg-white border-b border-slate-100 z-20"
                style={{ scrollbarWidth: 'thin' }}
            >
                <div style={{ width: tableWidth, height: '1px' }} />
            </div>

            <CardContent ref={tableContainerRef} className="p-0 overflow-x-auto">
                <div
                    ref={virtualScrollRef}
                    style={{ maxHeight: 'calc(100vh - 320px)', overflowY: 'auto' }}
                >
                <table className="w-full text-sm border-collapse table-fixed">
                    <thead className="sticky top-0 z-10">
                        <tr className="bg-slate-50/80 dark:bg-slate-900/50 border-b border-slate-200 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                            <th className="px-5 py-4 w-[40px]">
                                <Checkbox
                                    checked={filteredCandidates.length > 0 && selectedIds.length === filteredCandidates.length}
                                    onCheckedChange={toggleSelectAll}
                                    className="border-slate-300 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                                />
                            </th>
                            <th className="text-right font-black text-slate-500 text-xs uppercase tracking-widest px-5 py-4 w-[80px]">Action</th>
                            <th className="text-left font-black text-slate-500 text-xs uppercase tracking-widest px-5 py-4 w-[70px]">Rank</th>
                            <th className="text-left font-black text-slate-500 text-xs uppercase tracking-widest px-5 py-4 w-[120px]">Type</th>
                            <th className="text-left font-black text-slate-500 text-xs uppercase tracking-widest px-5 py-4 w-[185px]">Status</th>
                            <th className="text-left font-black text-slate-500 text-xs uppercase tracking-widest px-5 py-4 w-[65px]">P</th>
                            <th className="text-left font-black text-slate-500 text-xs uppercase tracking-widest px-5 py-4 w-[120px]">ID</th>
                            <th className="text-left font-black text-slate-500 text-xs uppercase tracking-widest px-5 py-4 w-[50px]">LI</th>
                            <th className="text-left font-black text-slate-500 text-xs uppercase tracking-widest px-5 py-4 w-[280px]">Candidate Details</th>
                            <th className="text-left font-black text-slate-500 text-xs uppercase tracking-widest px-5 py-4 w-[120px]">Gender/Age</th>
                            <th className="text-left font-black text-slate-500 text-xs uppercase tracking-widest px-5 py-4 w-[200px]">Company</th>
                            <th className="text-left font-black text-slate-500 text-xs uppercase tracking-widest px-5 py-4 w-[200px]">Position</th>
                            <th className="text-left font-black text-slate-500 text-xs uppercase tracking-widest px-5 py-4 w-[160px]">Remark</th>
                            <th className="text-left font-black text-slate-500 text-xs uppercase tracking-widest px-5 py-4 w-[130px]">Is Current Job</th>
                            <th className="text-left font-black text-slate-500 text-xs uppercase tracking-widest px-5 py-4 w-[160px]">Country</th>
                            <th className="text-left font-black text-slate-500 text-xs uppercase tracking-widest px-5 py-4 w-[120px]">Reviewed By</th>
                            {showSalary && (
                                <th className="text-right font-black text-indigo-600 text-xs uppercase tracking-widest px-5 py-4 w-[150px] bg-indigo-50/30">Annual Salary</th>
                            )}
                        </tr>
                    </thead>
                    <tbody>
                        {paddingTop > 0 && <tr><td colSpan={COL_SPAN} style={{ height: paddingTop, padding: 0 }} /></tr>}
                        {virtualItems.map((virtualRow) => {
                            const c = sortedCandidates[virtualRow.index];
                            const isSelected = selectedIds.includes(c.id);
                            const isUpdating = statusUpdating === c.id;
                            const isTopProfile = c.list_type === "Top profile";

                            return (
                                <tr
                                    key={c.id}
                                    data-index={virtualRow.index}
                                    ref={el => rowVirtualizer.measureElement(el)}
                                    className={getRowClass(c.status, isSelected)}
                                    style={getRowStyle(c.status)}
                                >
                                    <td className="px-4 py-4">
                                        <Checkbox
                                            checked={isSelected}
                                            onCheckedChange={() => toggleSelect(c.id)}
                                            className="border-slate-300 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                                        />
                                    </td>
                                    <td className="px-4 py-4 text-left">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-slate-100 hover:text-primary transition-all">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="start" className="w-[200px] rounded-xl shadow-2xl border-slate-100">
                                                <DropdownMenuLabel className="text-[9px] font-black uppercase text-slate-400 tracking-widest px-3 py-2">Quick Actions</DropdownMenuLabel>

                                                <DropdownMenuItem
                                                    className="py-2.5 font-bold text-xs cursor-pointer rounded-lg mx-1 group"
                                                    onClick={() => {
                                                        setSheetCandidateId(c.id);
                                                        setIsSheetOpen(true);
                                                    }}
                                                >
                                                    <History className="mr-2 h-4 w-4 text-indigo-500 group-hover:scale-110 transition-transform" /> Full Activity & Logs
                                                </DropdownMenuItem>

                                                <Link href={`/candidates/${c.candidate_id}`}>
                                                    <DropdownMenuItem className="py-2.5 font-bold text-xs cursor-pointer rounded-lg mx-1 group">
                                                        <UserCircle2 className="mr-2 h-4 w-4 text-slate-400 group-hover:text-primary" /> View Global Profile
                                                    </DropdownMenuItem>
                                                </Link>
                                                <DropdownMenuItem
                                                    className="py-2.5 font-bold text-xs cursor-pointer rounded-lg mx-1"
                                                    onClick={() => {
                                                        setFeedbackCandidate({ id: c.id, name: c.candidate_name || "Unknown" });
                                                        setIsFeedbackOpen(true);
                                                    }}
                                                >
                                                    <MessageSquare className="mr-2 h-4 w-4 text-primary" /> Add Feedback
                                                </DropdownMenuItem>
                                                <DropdownMenuItem className="py-2.5 font-bold text-xs cursor-pointer rounded-lg mx-1">
                                                    <ArrowRight className="mr-2 h-4 w-4 text-primary" /> Move Stage
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator className="bg-slate-50" />
                                                <DropdownMenuItem
                                                    className="py-2.5 font-bold text-xs cursor-pointer text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg mx-1"
                                                    onClick={() => handleRemove([c.id])}
                                                >
                                                    <UserMinus className="mr-2 h-4 w-4" /> Remove from JR
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </td>
                                    <td className="px-4 py-4">
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <button className={cn(
                                                    "font-black text-sm h-8 w-8 flex items-center justify-center rounded-md border transition-all hover:scale-110",
                                                    isTopProfile ? "bg-amber-50 text-amber-600 border-amber-200 shadow-sm" : "bg-white text-slate-400 border-slate-100 hover:border-primary/30"
                                                )}>
                                                    {c.rank || (isTopProfile ? "?" : "-")}
                                                </button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-40 p-2" align="start">
                                                <div className="flex flex-col gap-2">
                                                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Set Rank</span>
                                                    <div className="flex gap-1">
                                                        <input
                                                            type="number"
                                                            placeholder="0-99"
                                                            className="h-8 w-16 text-xs border rounded px-2 focus:outline-none focus:ring-1 focus:ring-primary"
                                                            defaultValue={c.rank || ""}
                                                            onKeyDown={(e: any) => {
                                                                if (e.key === 'Enter') {
                                                                    handleMetadataUpdate(c.id, { rank: e.target.value || null });
                                                                }
                                                            }}
                                                        />
                                                        <Button
                                                            size="sm"
                                                            className="h-8 px-2 text-[10px] font-bold"
                                                            onClick={(e: any) => {
                                                                const input = e.currentTarget.previousSibling;
                                                                handleMetadataUpdate(c.id, { rank: input.value || null });
                                                            }}
                                                        >
                                                            Set
                                                        </Button>
                                                    </div>
                                                </div>
                                            </PopoverContent>
                                        </Popover>
                                    </td>
                                    <td className="px-4 py-4">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <button className="flex items-center">
                                                    {isTopProfile ? (
                                                        <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-200 border-none font-black text-xs px-2.5 py-1 rounded-lg shadow-sm transition-all">
                                                            ★ TOP PROFILE
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="border-slate-200 text-slate-500 hover:bg-slate-50 font-bold text-xs px-2.5 py-1 rounded-lg transition-all">
                                                            {c.list_type || "Longlist"}
                                                        </Badge>
                                                    )}
                                                </button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="start" className="w-32 p-1">
                                                <DropdownMenuItem
                                                    className="text-[10px] font-black uppercase rounded-lg cursor-pointer"
                                                    onClick={() => handleMetadataUpdate(c.id, { list_type: 'Top profile' })}
                                                >
                                                    Top profile
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    className="text-[10px] font-black uppercase rounded-lg cursor-pointer"
                                                    onClick={() => handleMetadataUpdate(c.id, { list_type: 'Longlist' })}
                                                >
                                                    Longlist
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </td>
                                    <td className="px-4 py-4">
                                        <div className="relative group/status flex items-center gap-2">
                                            {isUpdating ? (
                                                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                            ) : (
                                                <select
                                                    className={cn(
                                                        "text-[13px] font-black h-9 pl-4 pr-9 rounded-xl border appearance-none focus:outline-none transition-all cursor-pointer w-full bg-white min-w-[185px]",
                                                        !statusColorMap[c.status]?.bg_color && getRowStatusClass(c.status)
                                                    )}
                                                    style={{
                                                        backgroundColor: statusColorMap[c.status]?.bg_color || undefined,
                                                        color: statusColorMap[c.status]?.font_color || undefined,
                                                        borderColor: statusColorMap[c.status]?.font_color ? `${statusColorMap[c.status]?.font_color}40` : undefined
                                                    }}
                                                    value={c.status || ""}
                                                    onChange={(e) => handleStatusChange(c.id, e.target.value)}
                                                >
                                                    {statusOptions.length > 0 ? (
                                                        statusOptions.map((opt, idx) => (
                                                            <option key={`${opt.status}-${idx}`} value={opt.status} className="bg-white text-slate-800 font-bold py-1">
                                                                {opt.status}
                                                            </option>
                                                        ))
                                                    ) : (
                                                        <option>{c.status}</option>
                                                    )}
                                                </select>
                                            )}
                                            {!isUpdating && <ChevronDown className="absolute right-3 h-3 w-3 text-current pointer-events-none opacity-50" />}
                                        </div>
                                    </td>
                                    <td className="px-4 py-4">
                                        <CandidateAvatar
                                            src={c.candidate_image_url}
                                            name={c.candidate_name}
                                            className="h-16 w-16 transition-transform hover:scale-105 border-2 border-slate-100"
                                            fallbackClassName="text-xl"
                                            hasHistory={!!c.history_count && c.history_count > 0}
                                        />
                                    </td>
                                    <td className="px-4 py-4 overflow-hidden">
                                        <button
                                            onClick={() => {
                                                setSheetCandidateId(c.id);
                                                setIsSheetOpen(true);
                                            }}
                                            className="font-mono text-[15px] font-black py-1.5 px-3 bg-indigo-50 rounded-lg text-indigo-700 border border-indigo-100 shadow-sm hover:bg-indigo-100 transition-colors cursor-pointer inline-block whitespace-nowrap"
                                        >
                                            {c.candidate_id}
                                        </button>
                                    </td>
                                    <td className="px-4 py-4">
                                        <CandidateLinkedinButton
                                            checked={c.candidate_checked}
                                            linkedin={c.candidate_linkedin_url}
                                            candidateId={c.candidate_id}
                                        />
                                    </td>
                                    <td className="px-4 py-4 overflow-hidden">
                                        <div className="flex flex-col min-w-0">
                                            <span className="font-black text-xl text-slate-900 hover:text-primary cursor-pointer transition-colors leading-none tracking-tight truncate">
                                                {c.candidate_name}
                                            </span>
                                            <span className="text-[13px] font-bold text-slate-400 mt-1 truncate">
                                                {c.candidate_email || "No email recorded"}
                                            </span>
                                        </div>
                                    </td>
                                    {/* Gender/Age — inline edit */}
                                    <td className="px-4 py-4 overflow-hidden">
                                        <SexAgeCell
                                            candidateId={c.candidate_id}
                                            gender={c.candidate_gender || ''}
                                            age={c.candidate_age ?? null}
                                            ageSource={(c as any).candidate_age_source ?? null}
                                            onSaved={async () => {
                                                const updated = await getJRCandidates(jrId);
                                                setCandidates(updated);
                                            }}
                                        />
                                    </td>
                                    {/* Company column */}
                                    <td className="px-4 py-4 w-[200px] max-w-[200px]">
                                        <div
                                            className={cn(
                                                "flex items-start gap-2 text-[13px] font-bold text-slate-700 group/company min-w-0",
                                                c.candidate_current_company_id && "cursor-pointer"
                                            )}
                                            onClick={() => {
                                                if (!c.candidate_current_company_id) return;
                                                setEditCompany({
                                                    companyId: c.candidate_current_company_id,
                                                    companyName: c.candidate_current_company || '',
                                                    industry: c.candidate_current_company_industry || '',
                                                    group: c.candidate_current_company_group || '',
                                                });
                                            }}
                                            title={c.candidate_current_company_id ? "Click to edit Group & Industry" : undefined}
                                        >
                                            <Building2 className="h-4 w-4 text-slate-300 shrink-0 mt-0.5" />
                                            <div className="flex flex-col gap-0.5 min-w-0 overflow-hidden">
                                                <div className="flex items-center gap-1 min-w-0">
                                                    <span className="leading-snug line-clamp-2">
                                                        {safeRender(c.candidate_current_company)}
                                                    </span>
                                                    {c.candidate_current_company_id && (
                                                        <Pencil className="w-3 h-3 text-slate-300 opacity-0 group-hover/company:opacity-100 transition-opacity shrink-0" />
                                                    )}
                                                </div>
                                                {c.candidate_current_company_group && (
                                                    <span className="text-[11px] text-slate-400 font-medium leading-tight">
                                                        {c.candidate_current_company_group}
                                                    </span>
                                                )}
                                                {c.candidate_current_company_industry && (
                                                    <span className="text-[11px] text-slate-300 font-medium leading-tight">
                                                        {c.candidate_current_company_industry}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    {/* NEW: Separate Position column */}
                                    <td className="px-4 py-4">
                                        <div className="flex items-center gap-2 text-[13px] font-bold text-slate-700">
                                            <Briefcase className="h-4 w-4 text-primary/60 shrink-0" />
                                            <span className="truncate max-w-[180px]" title={c.candidate_current_position}>
                                                {safeRender(c.candidate_current_position)}
                                            </span>
                                        </div>
                                    </td>
                                    {/* Remark (candidate_status) — inline toggle */}
                                    <td className="px-4 py-4">
                                        <RemarkCell
                                            candidateId={c.candidate_id}
                                            statuses={c.candidate_status || []}
                                            onSaved={async () => {
                                                const updated = await getJRCandidates(jrId);
                                                setCandidates(updated);
                                            }}
                                        />
                                    </td>
                                    {/* NEW: Is Current Job column */}
                                    <td className="px-4 py-4">
                                        {c.candidate_is_current_job ? (
                                            <span className={cn(
                                                "text-xs font-black px-2.5 py-1 rounded-full border",
                                                c.candidate_is_current_job === 'Current'
                                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                                    : "bg-slate-50 text-slate-500 border-slate-200"
                                            )}>
                                                {c.candidate_is_current_job}
                                            </span>
                                        ) : (
                                            <span className="text-slate-300 text-xs">—</span>
                                        )}
                                    </td>
                                    {/* Country column */}
                                    <td className="px-4 py-4">
                                        {c.candidate_country ? (() => {
                                            const parenIdx = c.candidate_country!.indexOf('(');
                                            const countryName = parenIdx >= 0 ? c.candidate_country!.slice(0, parenIdx).trim() : c.candidate_country!;
                                            const countryNote = parenIdx >= 0 ? c.candidate_country!.slice(parenIdx) : null;
                                            return (
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="text-[13px] font-bold text-slate-700 leading-snug">{countryName}</span>
                                                    {countryNote && <span className="text-[11px] text-slate-400 leading-snug">{countryNote}</span>}
                                                </div>
                                            );
                                        })() : (
                                            <span className="text-slate-300 text-xs">—</span>
                                        )}
                                    </td>
                                    {/* Reviewed By — avatar stack */}
                                    <td className="px-4 py-4">
                                        {(() => {
                                            const reviewers = c.candidate_reviewers || [];
                                            if (reviewers.length === 0) return <span className="text-slate-300 text-xs">—</span>;
                                            const visible = reviewers.slice(0, 3);
                                            const overflow = reviewers.length - visible.length;
                                            return (
                                                <div className="flex items-center -space-x-1.5">
                                                    {visible.map(r => <UserAvatar key={r} id={r} />)}
                                                    {overflow > 0 && (
                                                        <div className="w-6 h-6 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center text-[9px] font-black text-slate-600 z-10">
                                                            +{overflow}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })()}
                                    </td>
                                    {showSalary && (
                                        <td className="px-5 py-4 text-right bg-indigo-50/10">
                                            {(() => {
                                                const monthly = parseFloat(c.candidate_salary_base || "0");
                                                const bonus = parseFloat((c.candidate_salary_bonus || "0").toString().replace(/[^0-9.]/g, '')) || 0;
                                                const annual = (monthly * 12) + (monthly * bonus);
                                                return annual > 0 ? (
                                                    <span className="font-black text-indigo-600">฿{(annual / 1000000).toFixed(2)}M</span>
                                                ) : (
                                                    <span className="text-[10px] font-bold text-slate-300 italic">No Data</span>
                                                );
                                            })()}
                                        </td>
                                    )}
                                </tr>
                            );
                        })}
                        {paddingBottom > 0 && <tr><td colSpan={COL_SPAN} style={{ height: paddingBottom, padding: 0 }} /></tr>}
                    </tbody>
                </table>
                </div>
            </CardContent>

            {feedbackCandidate && (
                <AddFeedbackDialog
                    open={isFeedbackOpen}
                    onOpenChange={setIsFeedbackOpen}
                    jrCandidateId={feedbackCandidate.id}
                    candidateName={feedbackCandidate.name}
                    onSuccess={() => {
                        // Optionally refresh list or analytics? 
                        // Feedback doesn't change list status usually, but maybe good to know
                    }}
                />
            )}
            {placementCandidate && (
                <ConfirmPlacementDialog
                    open={!!placementCandidate}
                    onOpenChange={(open) => !open && setPlacementCandidate(null)}
                    jrCandidateId={placementCandidate.id}
                    candidateName={placementCandidate.name}
                    position={jobTitle}
                    bu={bu}
                    subBu={subBu}
                    onSuccess={async () => {
                        // Refresh data
                        const updated = await getJRCandidates(jrId);
                        setCandidates(updated);
                        setPlacementCandidate(null);
                    }}
                />
            )}

            <StatusChangeDialog
                open={statusDialogOpen}
                onOpenChange={setStatusDialogOpen}
                targetStatus={pendingStatus}
                onConfirm={confirmStatusChange}
            />

            {editCompany && (
                <CompanyQuickEditDialog
                    open={!!editCompany}
                    onOpenChange={v => { if (!v) setEditCompany(null); }}
                    companyId={editCompany.companyId}
                    companyName={editCompany.companyName}
                    currentIndustry={editCompany.industry}
                    currentGroup={editCompany.group}
                    onSaved={async () => {
                        const updated = await getJRCandidates(jrId);
                        setCandidates(updated);
                    }}
                />
            )}

            {/* Slide-over Sheet: Activity Log & Feedback */}
            <JRCandidateSheet
                jrCandidateId={sheetCandidateId}
                open={isSheetOpen}
                onOpenChange={async (open) => {
                    setIsSheetOpen(open);
                    if (!open) {
                        setSheetCandidateId(null);
                        const updated = await getJRCandidates(jrId);
                        setCandidates(updated);
                    }
                }}
            />
        </Card>
    );
}

// Helper for safe string comparison
const safeLower = (s: any) => (typeof s === 'string' ? s : String(s || "")).toLowerCase();

// NEW: Helper to safely render values and prevent object crashes
const safeRender = (val: any) => {
    if (val === null || val === undefined) return "-";
    if (typeof val === 'object') return "-"; // Block objects
    return String(val);
}

function remarkBadgeClass(s: string) {
    const l = s.toLowerCase();
    if (l === 'blacklist') return "bg-rose-50 text-rose-600 border-rose-100";
    if (l === 'over-aged') return "bg-orange-50 text-orange-600 border-orange-100";
    if (l === "don't touch") return "bg-red-50 text-red-600 border-red-100";
    if (l === 'ex-central') return "bg-emerald-50 text-emerald-600 border-emerald-100";
    if (l === 'internal candidate') return "bg-indigo-50 text-indigo-600 border-indigo-100";
    if (l === 'active') return "bg-green-50 text-green-600 border-green-100";
    return "bg-slate-50 text-slate-500 border-slate-200";
}

function RemarkCell({ candidateId, statuses, onSaved }: {
    candidateId: string;
    statuses: string[];
    onSaved: () => void;
}) {
    const [open, setOpen] = useState(false);
    const [current, setCurrent] = useState<string[]>(statuses);
    const [options, setOptions] = useState<string[]>([]);
    const [saving, setSaving] = useState(false);
    const [newTag, setNewTag] = useState('');
    const [addingNew, setAddingNew] = useState(false);

    useEffect(() => {
        if (open && options.length === 0) {
            getStatuses().then(data => setOptions((data as any[]).map((d: any) => d.status)));
        }
    }, [open]);

    const toggle = async (s: string) => {
        const next = current.includes(s) ? current.filter(x => x !== s) : [...current, s];
        setCurrent(next);
        setSaving(true);
        await fetch(`/api/candidates/${candidateId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ candidate_status: next }),
        });
        setSaving(false);
        onSaved();
    };

    const handleAddNew = async () => {
        const tag = newTag.trim();
        if (!tag) return;
        setAddingNew(true);
        await addStatus(tag);
        setOptions(prev => [...prev, tag].sort());
        setNewTag('');
        setAddingNew(false);
        await toggle(tag);
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button className="min-w-[80px] text-left">
                    {current.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                            {current.map(s => (
                                <Badge key={s} variant="secondary" className={cn(
                                    "text-[10px] font-black uppercase tracking-wider border whitespace-nowrap px-2 py-0.5 rounded-lg",
                                    remarkBadgeClass(s)
                                )}>{s}</Badge>
                            ))}
                        </div>
                    ) : (
                        <span className="text-slate-300 text-xs hover:text-slate-400 transition-colors">— click to set —</span>
                    )}
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-52 p-2 rounded-xl shadow-xl border-slate-100" align="start">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 px-2 pb-2">Remark Tags</p>
                {options.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-2">Loading...</p>
                ) : options.map(s => (
                    <button
                        key={s}
                        onClick={() => toggle(s)}
                        disabled={saving}
                        className={cn(
                            "w-full text-left text-xs font-bold px-3 py-2 rounded-lg transition-all flex items-center justify-between",
                            current.includes(s) ? "bg-indigo-50 text-indigo-700" : "hover:bg-slate-50 text-slate-600"
                        )}
                    >
                        {s}
                        {current.includes(s) && <span className="text-indigo-400 text-base leading-none">✓</span>}
                    </button>
                ))}
                <div className="border-t border-slate-100 mt-2 pt-2 flex gap-1">
                    <input
                        value={newTag}
                        onChange={e => setNewTag(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleAddNew(); }}
                        placeholder="Add new tag..."
                        className="flex-1 h-7 text-[11px] font-bold px-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                    />
                    <Button size="sm" className="h-7 px-2 text-[11px]" disabled={addingNew || !newTag.trim()} onClick={handleAddNew}>
                        {addingNew ? <Loader2 className="h-3 w-3 animate-spin" /> : '+'}
                    </Button>
                </div>
            </PopoverContent>
        </Popover>
    );
}

const GENDER_OPTIONS = ['Male', 'Female', 'N/A'];

function SexAgeCell({ candidateId, gender, age, ageSource, onSaved }: {
    candidateId: string;
    gender: string;
    age: number | null;
    ageSource?: string | null;
    onSaved: () => void;
}) {
    const [open, setOpen] = useState(false);
    const [g, setG] = useState(gender);
    const [a, setA] = useState(String(age ?? ''));
    const [saving, setSaving] = useState(false);

    const save = async () => {
        setSaving(true);
        await fetch(`/api/candidates/${candidateId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ gender: g || null, age: parseInt(a) || null, age_source: parseInt(a) ? 'manual' : null }),
        });
        setSaving(false);
        setOpen(false);
        onSaved();
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button className="inline-flex items-center gap-2 font-black text-sm text-slate-700 bg-slate-50 hover:bg-slate-100 px-2.5 py-1.5 rounded-lg border border-slate-100 hover:border-slate-200 whitespace-nowrap transition-all">
                    {gender || '—'}{age ? <span className={ageSource === 'estimated' ? 'text-red-500 ml-1' : 'ml-1'}>, {age}</span> : ''}
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-52 p-3 rounded-xl shadow-xl border-slate-100 space-y-3" align="start">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Gender / Age</p>
                <select
                    value={g}
                    onChange={e => setG(e.target.value)}
                    className="w-full h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-300"
                >
                    <option value="">— Gender —</option>
                    {GENDER_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
                <input
                    type="number"
                    value={a}
                    onChange={e => setA(e.target.value)}
                    placeholder="Age"
                    className="w-full h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
                <Button size="sm" className="w-full h-8 text-xs font-black" disabled={saving} onClick={save}>
                    {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save'}
                </Button>
            </PopoverContent>
        </Popover>
    );
}

function getRowStatusClass(status: string) {
    const s = safeLower(status);
    if (s.includes('pool')) return 'bg-slate-100 text-slate-600 border-slate-200 hover:border-slate-300';
    if (s.includes('screen')) return 'bg-blue-50 text-blue-600 border-blue-100 hover:border-blue-200';
    if (s.includes('interview')) return 'bg-purple-50 text-purple-600 border-purple-100 hover:border-purple-200';
    if (s.includes('offer')) return 'bg-amber-50 text-amber-600 border-amber-100 hover:border-amber-200';
    if (s.includes('hired')) return 'bg-emerald-50 text-emerald-700 border-emerald-100 hover:border-emerald-200';
    if (s.includes('reject') || s.includes('not fit')) return 'bg-rose-50 text-rose-600 border-rose-100 hover:border-rose-200';
    return 'bg-slate-50 text-slate-500 border-slate-100';
}
