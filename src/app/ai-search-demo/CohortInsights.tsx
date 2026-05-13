"use client";

import { useEffect, useState, useRef } from "react";
import { getCohortAnalysis } from "@/app/actions/ai-search-demo";
import { type CohortAnalysis } from "./types";
import { ChevronDown, ChevronUp, Lightbulb, Plus, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Props {
    candidateIds: string[];
    totalFound: number;
    onAddJobFunction?: (fn: string) => void;
}

const PREVIEW = 8;

function FreqBar({ count, max }: { count: number; max: number }) {
    const pct = max > 0 ? Math.round((count / max) * 100) : 0;
    return (
        <div className="flex items-center gap-2 min-w-0">
            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-400 rounded-full" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs text-slate-400 w-7 text-right shrink-0">{count}</span>
        </div>
    );
}

function ExpandableSection({ title, children, total }: { title: string; children: React.ReactNode; total: number }) {
    const [expanded, setExpanded] = useState(false);
    return (
        <div>
            <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{title}</h4>
                <span className="text-[10px] text-slate-400">{total} items</span>
            </div>
            {children}
            {total > PREVIEW && (
                <button
                    onClick={() => setExpanded(e => !e)}
                    className="mt-1.5 text-[10px] text-indigo-500 hover:text-indigo-700 font-semibold underline underline-offset-2"
                    data-expanded={expanded}
                >
                    {expanded ? "Show less" : `+${total - PREVIEW} more`}
                </button>
            )}
        </div>
    );
}

export function CohortInsights({ candidateIds, totalFound, onAddJobFunction }: Props) {
    const [data, setData] = useState<CohortAnalysis | null>(null);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(true);
    const [skillsExpanded, setSkillsExpanded] = useState(false);
    const [funcsExpanded, setFuncsExpanded] = useState(false);
    const [addedFn, setAddedFn] = useState<string | null>(null);
    const prevIdsKey = useRef<string>("");
    const addedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    useEffect(() => {
        const key = candidateIds.slice(0, 50).join(",");
        if (key === prevIdsKey.current) return;
        prevIdsKey.current = key;

        if (candidateIds.length === 0) { setData(null); return; }

        setLoading(true);
        getCohortAnalysis(candidateIds)
            .then(setData)
            .finally(() => setLoading(false));
    }, [candidateIds]);

    const handleAddJobFunction = (fn: string) => {
        onAddJobFunction?.(fn);
        setAddedFn(fn);
        clearTimeout(addedTimer.current);
        addedTimer.current = setTimeout(() => setAddedFn(null), 2000);
    };

    if (candidateIds.length === 0) return null;

    const maxSkill = data?.top_skills?.[0]?.count ?? 1;
    const maxFunc  = data?.job_functions?.[0]?.count ?? 1;

    const skills   = data?.top_skills   ?? [];
    const funcs    = data?.job_functions ?? [];
    const langs    = data?.languages    ?? [];

    const shownSkills = skillsExpanded ? skills : skills.slice(0, PREVIEW);
    const shownFuncs  = funcsExpanded  ? funcs  : funcs.slice(0, PREVIEW);

    return (
        <div className="border border-indigo-100 rounded-xl bg-indigo-50/40 overflow-hidden">
            {/* Header */}
            <button
                onClick={() => setOpen(o => !o)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-indigo-50 transition-colors"
            >
                <div className="flex items-center gap-2 text-sm font-semibold text-indigo-800">
                    <Lightbulb className="w-4 h-4" />
                    Cohort Insights
                    {data && (
                        <span className="text-xs font-normal text-indigo-500">
                            ({data.profiles_with_data} / {totalFound} มี LinkedIn data)
                        </span>
                    )}
                </div>
                {open ? <ChevronUp className="w-4 h-4 text-indigo-400" /> : <ChevronDown className="w-4 h-4 text-indigo-400" />}
            </button>

            {/* Toast — added feedback */}
            {addedFn && (
                <div className="mx-4 mb-2 flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs px-3 py-1.5 rounded-lg">
                    <Check className="h-3 w-3 shrink-0" />
                    <span>Added <strong>"{addedFn}"</strong> to Job Function filter</span>
                </div>
            )}

            {open && (
                <div className="px-4 pb-4 grid grid-cols-1 md:grid-cols-3 gap-6">

                    {/* Top Skills */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Top Skills</h4>
                            <span className="text-[10px] text-slate-400">{skills.length} items</span>
                        </div>
                        {loading ? (
                            <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-4 w-full bg-slate-200 rounded animate-pulse" />)}</div>
                        ) : !skills.length ? (
                            <p className="text-xs text-slate-400">ไม่มีข้อมูล</p>
                        ) : (
                            <>
                                <div className="space-y-1.5">
                                    {shownSkills.map(s => (
                                        <div key={s.skill}>
                                            <div className="text-xs text-slate-700 truncate mb-0.5">{s.skill}</div>
                                            <FreqBar count={s.count} max={maxSkill} />
                                        </div>
                                    ))}
                                </div>
                                {skills.length > PREVIEW && (
                                    <button
                                        onClick={() => setSkillsExpanded(e => !e)}
                                        className="mt-1.5 text-[10px] text-indigo-500 hover:text-indigo-700 font-semibold underline underline-offset-2"
                                    >
                                        {skillsExpanded ? "Show less" : `+${skills.length - PREVIEW} more`}
                                    </button>
                                )}
                            </>
                        )}
                    </div>

                    {/* Job Functions */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Job Function</h4>
                            <span className="text-[10px] text-slate-400">{funcs.length} items</span>
                        </div>
                        {loading ? (
                            <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-4 w-full bg-slate-200 rounded animate-pulse" />)}</div>
                        ) : !funcs.length ? (
                            <p className="text-xs text-slate-400">ไม่มีข้อมูล</p>
                        ) : (
                            <>
                                <div className="space-y-1.5">
                                    {shownFuncs.map(f => (
                                        <div key={f.function} className="group">
                                            <div className="flex items-center gap-1 mb-0.5">
                                                <span className={cn(
                                                    "text-xs truncate flex-1 transition-colors",
                                                    addedFn === f.function ? "text-emerald-600 font-semibold" : "text-slate-700"
                                                )}>{f.function}</span>
                                                {onAddJobFunction && (
                                                    <button
                                                        onClick={() => handleAddJobFunction(f.function)}
                                                        className={cn(
                                                            "shrink-0 p-0.5 rounded transition-all",
                                                            addedFn === f.function
                                                                ? "opacity-100 bg-emerald-100 text-emerald-600"
                                                                : "opacity-0 group-hover:opacity-100 hover:bg-indigo-100 text-indigo-500"
                                                        )}
                                                        title={`Add "${f.function}" to filter`}
                                                    >
                                                        {addedFn === f.function
                                                            ? <Check className="h-3 w-3" />
                                                            : <Plus className="h-3 w-3" />
                                                        }
                                                    </button>
                                                )}
                                            </div>
                                            <FreqBar count={f.count} max={maxFunc} />
                                        </div>
                                    ))}
                                </div>
                                {funcs.length > PREVIEW && (
                                    <button
                                        onClick={() => setFuncsExpanded(e => !e)}
                                        className="mt-1.5 text-[10px] text-indigo-500 hover:text-indigo-700 font-semibold underline underline-offset-2"
                                    >
                                        {funcsExpanded ? "Show less" : `+${funcs.length - PREVIEW} more`}
                                    </button>
                                )}
                            </>
                        )}
                    </div>

                    {/* Languages */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Languages</h4>
                            <span className="text-[10px] text-slate-400">{langs.length} items</span>
                        </div>
                        {loading ? (
                            <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-4 w-full bg-slate-200 rounded animate-pulse" />)}</div>
                        ) : !langs.length ? (
                            <p className="text-xs text-slate-400">ไม่มีข้อมูล</p>
                        ) : (
                            <div className="flex flex-wrap gap-1.5">
                                {langs.map(l => (
                                    <Badge
                                        key={l.language}
                                        variant="secondary"
                                        className="text-xs bg-white border border-slate-200 text-slate-600"
                                    >
                                        {l.language.trim()} <span className="ml-1 text-slate-400">{l.count}</span>
                                    </Badge>
                                ))}
                            </div>
                        )}
                    </div>

                </div>
            )}
        </div>
    );
}
