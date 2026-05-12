"use client";

import { useEffect, useState, useRef } from "react";
import { getCohortAnalysis } from "@/app/actions/ai-search-demo";
import { type CohortAnalysis } from "./types";
import { ChevronDown, ChevronUp, Lightbulb, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Props {
    candidateIds: string[];
    totalFound: number;
    onAddJobFunction?: (fn: string) => void;
}

function FreqBar({ count, max }: { count: number; max: number }) {
    const pct = max > 0 ? Math.round((count / max) * 100) : 0;
    return (
        <div className="flex items-center gap-2 min-w-0">
            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                    className="h-full bg-indigo-400 rounded-full"
                    style={{ width: `${pct}%` }}
                />
            </div>
            <span className="text-xs text-slate-400 w-7 text-right shrink-0">{count}</span>
        </div>
    );
}

export function CohortInsights({ candidateIds, totalFound, onAddJobFunction }: Props) {
    const [data, setData] = useState<CohortAnalysis | null>(null);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(true);
    const prevIdsKey = useRef<string>("");

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

    if (candidateIds.length === 0) return null;

    const maxSkill = data?.top_skills?.[0]?.count ?? 1;
    const maxFunc  = data?.job_functions?.[0]?.count ?? 1;
    const maxLang  = data?.languages?.[0]?.count ?? 1;

    return (
        <div className="border border-indigo-100 rounded-xl bg-indigo-50/40 overflow-hidden">
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

            {open && (
                <div className="px-4 pb-4 grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Top Skills */}
                    <div>
                        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Top Skills</h4>
                        {loading ? (
                            <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-4 w-full bg-slate-200 rounded animate-pulse" />)}</div>
                        ) : !data?.top_skills?.length ? (
                            <p className="text-xs text-slate-400">ไม่มีข้อมูล</p>
                        ) : (
                            <div className="space-y-1.5">
                                {data.top_skills.slice(0, 12).map(s => (
                                    <div key={s.skill}>
                                        <div className="text-xs text-slate-700 truncate mb-0.5">{s.skill}</div>
                                        <FreqBar count={s.count} max={maxSkill} />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Job Functions */}
                    <div>
                        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Job Function</h4>
                        {loading ? (
                            <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-4 w-full bg-slate-200 rounded animate-pulse" />)}</div>
                        ) : !data?.job_functions?.length ? (
                            <p className="text-xs text-slate-400">ไม่มีข้อมูล</p>
                        ) : (
                            <div className="space-y-1.5">
                                {data.job_functions.map(f => (
                                    <div key={f.function} className="group">
                                        <div className="flex items-center gap-1 mb-0.5">
                                            <span className="text-xs text-slate-700 truncate flex-1">{f.function}</span>
                                            {onAddJobFunction && (
                                                <button
                                                    onClick={() => onAddJobFunction(f.function)}
                                                    className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 p-0.5 rounded hover:bg-indigo-100 text-indigo-500"
                                                    title={`Add "${f.function}" to filter`}
                                                >
                                                    <Plus className="h-3 w-3" />
                                                </button>
                                            )}
                                        </div>
                                        <FreqBar count={f.count} max={maxFunc} />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Languages */}
                    <div>
                        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Languages</h4>
                        {loading ? (
                            <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-4 w-full bg-slate-200 rounded animate-pulse" />)}</div>
                        ) : !data?.languages?.length ? (
                            <p className="text-xs text-slate-400">ไม่มีข้อมูล</p>
                        ) : (
                            <div className="flex flex-wrap gap-1.5">
                                {data.languages.map(l => (
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
